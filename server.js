const express = require("express");
const fs = require("fs");
const path = require("path");
const { spawn, execSync } = require("child_process");
const os = require("os");
const console = require("console");

/* ======================================================
   ROOTS
====================================================== */
const DATASET_ROOT =
  "/home/user/Documents/h1-visual-inspection/interface/datasets";

const TRAINING_ROOT = path.join(__dirname, "training");

/* ======================================================
   APP
====================================================== */
const app = express();

app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/photos", express.static(path.join(__dirname, "photos")));
app.use("/datasets", express.static(DATASET_ROOT));
app.use("/training", express.static(TRAINING_ROOT));

/* ======================================================
   DIRECTORIES
====================================================== */
const photosDir = path.join(__dirname, "photos");
const yoloImageDir = path.join(__dirname, "datasets", "station_01", "final_inspection", "images");
const yoloLabelDir = path.join(__dirname, "datasets", "station_01", "final_inspection", "labels");

[
  photosDir,
  TRAINING_ROOT,
  yoloImageDir,
  yoloLabelDir,
].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

/* ======================================================
   STATE
====================================================== */
let trainProcess = null;
let activeRunName = null;
let lastSaved = null;

let inspectionResult = {
  status: "UNKNOWN",
  detected: [],
  timestamp: null
};

let inspectionCriteria = {
  required: [],
  forbidden: [],
  confidence: 0.5
};

/* ======================================================
   HELPERS
====================================================== */
function parseMetricsCsv(csvPath) {
  if (!fs.existsSync(csvPath)) return [];

  const lines = fs.readFileSync(csvPath, "utf8").trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",");
  const rows = lines.slice(1);

  const epochIdx = headers.indexOf("epoch");
  if (epochIdx === -1) return [];

  const lossIdx = headers.indexOf("train/box_loss") !== -1
    ? headers.indexOf("train/box_loss")
    : headers.indexOf("train/loss");

  const map50Key = headers.find(h => h.startsWith("metrics/mAP50"));
  const map50Idx = map50Key ? headers.indexOf(map50Key) : -1;

  return rows.map(line => {
    const v = line.split(",");
    return {
      epoch: Number(v[epochIdx]) + 1,
      loss: lossIdx !== -1 ? Number(v[lossIdx]) : null,
      map50: map50Idx !== -1 ? Number(v[map50Idx]) : null
    };
  });
}

/* ======================================================
   PAGE ROUTES
====================================================== */
app.get("/", (_, res) => res.redirect("/trainer"));

["trainer", "experiments", "datasets", "settings", "inspect"].forEach(page => {
  app.get(`/${page}`, (_, res) =>
    res.sendFile(path.join(__dirname, "public", `${page}.html`))
  );
});

app.get("/experiments/:name", (_, res) => {
  res.sendFile(path.join(__dirname, "public", "experiments.html"));
});


/* ======================================================
   API ROUTES
====================================================== */

/* ---------- PHOTOS ---------- */
app.get("/api/photos", (_, res) => {
  const files = fs.readdirSync(photosDir)
    .filter(f => f.toLowerCase().endsWith(".png"))
    .sort((a, b) => b.localeCompare(a));
  res.json(files);
});

app.post("/api/save-photo", (req, res) => {
  const { image } = req.body;
  if (!image?.startsWith("data:image")) {
    return res.status(400).json({ error: "Invalid image data" });
  }

  const base64 = image.replace(/^data:image\/png;base64,/, "");
  const filename = `photo_${Date.now()}.png`;
  fs.writeFileSync(path.join(photosDir, filename), base64, "base64");

  res.json({ filename });
});

/* ---------- DATASETS ---------- */
app.get("/api/datasets", (req, res) => {
  const { station, process } = req.query;
  if (!station || !process) return res.json([]);

  const dir = path.join(DATASET_ROOT, station, process);
  if (!fs.existsSync(dir)) return res.json([]);

  res.json(
    fs.readdirSync(dir).filter(name =>
      fs.statSync(path.join(dir, name)).isDirectory()
    )
  );
});

/* ---------- YOLO SAVE ---------- */
app.post("/api/save-yolo", (req, res) => {
  const { image, width, height, boxes, classMap } = req.body;

  if (!image || !width || !height || !Array.isArray(boxes)) {
    return res.status(400).json({ error: "Invalid YOLO data" });
  }

  const baseName = path.parse(image).name;
  const srcImagePath = path.join(photosDir, image);
  const dstImagePath = path.join(yoloImageDir, image);
  const labelPath = path.join(yoloLabelDir, `${baseName}.txt`);

  if (!fs.existsSync(srcImagePath)) {
    return res.status(404).json({ error: "Source image not found" });
  }

  const yoloLines = boxes.map(b => {
    const classId = classMap[b.label];
    if (classId === undefined) return null;

    const xc = (b.x + b.w / 2) / width;
    const yc = (b.y + b.h / 2) / height;
    const w = b.w / width;
    const h = b.h / height;

    return `${classId} ${xc.toFixed(6)} ${yc.toFixed(6)} ${w.toFixed(6)} ${h.toFixed(6)}`;
  }).filter(Boolean);

  fs.writeFileSync(labelPath, yoloLines.join("\n"));
  fs.renameSync(srcImagePath, dstImagePath);

  /* ✅ store FULL undo information */
  lastSaved = {
    image,              // filename only
    imageFrom: srcImagePath,
    imageTo: dstImagePath,
    labelPath
  };

  res.json({ status: "ok" });

});

/* ======================================================
   TRAINING
====================================================== */
app.post("/api/train/start", (req, res) => {
  const { station, process, model, epochs, imgsz, batch, runName } = req.body;

  if (trainProcess) {
    return res.status(409).json({ error: "Training already running" });
  }

  if (!station || !process || !runName) {
    return res.status(400).json({ error: "Missing parameters" });
  }

  const safe = s => String(s).replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeRunName = safe(runName);

  const datasetRoot = path.join(DATASET_ROOT, safe(station), safe(process));
  const datasetYaml = path.join(datasetRoot, "dataset.yaml");
  if (!fs.existsSync(datasetYaml)) {
    return res.status(400).json({ error: "dataset.yaml not found" });
  }

  const runDir = path.join(TRAINING_ROOT, safeRunName);
  if (fs.existsSync(runDir)) {
    return res.status(409).json({ error: "Run name already exists" });
  }

  fs.mkdirSync(runDir, { recursive: true });
  activeRunName = safeRunName;

  trainProcess = spawn(
    "python",
    [
      path.join(__dirname, "training", "train.py"),
      "--data", datasetYaml,
      "--model", model,
      "--epochs", epochs,
      "--imgsz", imgsz,
      "--batch", batch,
      "--name", safeRunName,
      "--project", TRAINING_ROOT
    ],
    { stdio: "inherit" }
  );

  trainProcess.on("close", () => {
    trainProcess = null;
    activeRunName = null;
  });

  fs.writeFileSync(
    path.join(runDir, "run_config.json"),
    JSON.stringify({
      station,
      process,
      datasetPath: datasetRoot,
      model,
      epochs,
      imgsz,
      batch,
      runName: safeRunName,
      startedAt: new Date().toISOString()
    }, null, 2)
  );

  res.json({ status: "started", experiment: safeRunName });
});

app.post("/api/train/stop", (_, res) => {
  if (!trainProcess) {
    return res.status(400).json({ error: "No training running" });
  }

  trainProcess.kill("SIGTERM");
  res.json({ status: "stopping" });
});

/* ---------- TRAINING PROGRESS ---------- */
app.get("/api/train/progress", (_, res) => {
  if (!trainProcess || !activeRunName) {
    return res.json({ status: "idle" });
  }

  const runDir = path.join(TRAINING_ROOT, activeRunName);
  const csvPath = path.join(runDir, "results.csv");
  const cfgPath = path.join(runDir, "run_config.json");

  if (!fs.existsSync(cfgPath) || !fs.existsSync(csvPath)) {
    return res.json({ status: "starting", runName: activeRunName });
  }

  const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
  const data = parseMetricsCsv(csvPath);
  if (!data.length) return res.json({ status: "starting" });

  const last = data[data.length - 1];
  const total = Number(cfg.epochs);
  const progress = Math.min(100, Math.round((last.epoch / total) * 100));

  res.json({
    status: "running",
    progress,
    epoch: last.epoch,
    totalEpochs: total,
    runName: activeRunName
  });
});

/* ---------- METRICS ---------- */
app.get("/api/train/metrics", (_, res) => {
  if (!activeRunName) return res.json([]);
  const csv = path.join(TRAINING_ROOT, activeRunName, "results.csv");
  res.json(parseMetricsCsv(csv));
});

app.get("/api/experiments/:name/metrics", (req, res) => {
  const csv = path.join(TRAINING_ROOT, req.params.name, "results.csv");
  res.json(parseMetricsCsv(csv));
});

/* ======================================================
   EXPERIMENT LIST
====================================================== */
app.get("/api/experiments", (_, res) => {
  if (!fs.existsSync(TRAINING_ROOT)) return res.json([]);

  const experiments = fs.readdirSync(TRAINING_ROOT)
    .filter(d => fs.statSync(path.join(TRAINING_ROOT, d)).isDirectory())
    .map(name => {
      const runDir = path.join(TRAINING_ROOT, name);
      const cfgPath = path.join(runDir, "run_config.json");
      const resultsCsv = path.join(runDir, "results.csv");
      const bestPt = path.join(runDir, "weights", "best.pt");
      const metricsJson = path.join(runDir, "val", "metrics.json");

      let config = null;
      let startedAt = null;
      if (fs.existsSync(cfgPath)) {
        config = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
        startedAt = config.startedAt ?? null;
      }

      let status = "failed";
      if (fs.existsSync(bestPt)) status = "completed";
      else if (trainProcess && activeRunName === name) status = "running";
      else if (fs.existsSync(resultsCsv)) status = "stopped";

      const stats = fs.statSync(runDir);
      return {
        name,
        status,
        config,
        startedAt,
        updatedAt: stats.mtime.toISOString(),

        hasWeights: fs.existsSync(bestPt),
        hasMetrics: fs.existsSync(resultsCsv)   // ✅ FIX
      };
    })
    .sort((a, b) => {
      const ta = a.startedAt ? new Date(a.startedAt).getTime() : 0;
      const tb = b.startedAt ? new Date(b.startedAt).getTime() : 0;
      return tb - ta; // newest first
    });


  res.json(experiments);
});

app.get("/api/experiments/:name", (req, res) => {
  const { name } = req.params;
  const runDir = path.join(TRAINING_ROOT, name);

  if (!fs.existsSync(runDir)) {
    return res.status(404).json({ error: "Experiment not found" });
  }

  const cfgPath = path.join(runDir, "run_config.json");
  const resultsCsv = path.join(runDir, "results.csv");
  const bestPt = path.join(runDir, "weights", "best.pt");
  const metricsJson = path.join(runDir, "val", "metrics.json");

  let config = null;
  if (fs.existsSync(cfgPath)) {
    config = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
  }

  let metrics = null;
  if (fs.existsSync(metricsJson)) {
    try {
      metrics = JSON.parse(fs.readFileSync(metricsJson, "utf8"));
    } catch {
      metrics = null;
    }
  }

  const stats = fs.statSync(runDir);

  res.json({
    name,

    // metadata
    config,
    startedAt: config?.startedAt ?? null,
    updatedAt: stats.mtime.toISOString(),

    // artifacts
    paths: {
      runDir,
      resultsCsv: fs.existsSync(resultsCsv) ? resultsCsv : null,
      bestPt: fs.existsSync(bestPt) ? bestPt : null,
      metricsJson: fs.existsSync(metricsJson) ? metricsJson : null
    },

    // content
    metrics
  });
});

/* ======================================================
   DATASET IMAGES
====================================================== */
app.get("/api/dataset/images", (req, res) => {
  const { station, process } = req.query;
  if (!station || !process) {
    return res.status(400).json({ error: "station and process required" });
  }

  const dir = path.join(DATASET_ROOT, station, process, "images");
  if (!fs.existsSync(dir)) return res.json([]);

  res.json(
    fs.readdirSync(dir)
      .filter(f => /\.(png|jpg|jpeg)$/i.test(f))
      .map(f => `/datasets/${station}/${process}/images/${f}`)
  );
});

/* ======================================================
   SETTINGS
====================================================== */
app.get("/api/settings", (_, res) => {
  let python = "unknown";
  let yolo = "unknown";
  let cuda = false;

  try { python = execSync("python --version").toString().trim(); } catch {}
  try { yolo = execSync("yolo version").toString().trim(); } catch {}
  try { execSync("nvidia-smi", { stdio: "ignore" }); cuda = true; } catch {}

  res.json({
    system: {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      node: process.version      
    },    
    paths: {
      datasets: DATASET_ROOT,
      training: TRAINING_ROOT
    },
    environment: { python, yolo, cuda }
  });
});

/* ===============================
   LATEST CAPTURED IMAGES
================================ */
app.get("/api/photos/latest", (req, res) => {
  const limit = Number(req.query.limit) || 5;

  const dir = photosDir; // you already use this in /api/photos
  if (!fs.existsSync(dir)) return res.json([]);

  const files = fs.readdirSync(dir)
    .filter(f => f.toLowerCase().endsWith(".png"))
    .map(name => {
      const full = path.join(dir, name);
      return {
        name,
        time: fs.statSync(full).mtimeMs
      };
    })
    .sort((a, b) => b.time - a.time)
    .slice(0, limit)
    .map(f => `/photos/${f.name}`);

  res.json(files);
});
/* ---------- UNDO LAST SAVE ---------- */

app.post("/api/undo-last-save", (req, res) => {
  if (!lastSaved) {
    return res.status(400).json({ error: "Nothing to undo" });
  }

  try {
    const { image, imageTo, labelPath } = lastSaved;

    const restorePath = path.join(photosDir, image);

    /* ✅ restore image back to /photos */
    if (fs.existsSync(imageTo)) {
      fs.renameSync(imageTo, restorePath);
    }

    /* ✅ remove YOLO label */
    if (fs.existsSync(labelPath)) {
      fs.unlinkSync(labelPath);
    }

    lastSaved = null;
    res.json({ status: "ok", image });

  } catch (err) {
    console.error("Undo failed:", err);
    res.status(500).json({ error: "Undo failed" });
  }
});

/* ======================================================
   START SERVER
====================================================== */
app.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
