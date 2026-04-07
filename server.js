const express = require("express");
const fs = require("fs");
const path = require("path");
const { spawn, execSync } = require("child_process");
const os = require("os");

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
const yoloImageDir = path.join(__dirname, "labels", "yolo", "image");
const yoloLabelDir = path.join(__dirname, "labels", "yolo", "label");
const photosDir = path.join(__dirname, "photos");
[photosDir, TRAINING_ROOT].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});


/* ======================================================
   STATE
====================================================== */
let trainProcess = null;
let activeRunName = null;


/* ======================================================
   PAGE ROUTES
====================================================== */
app.get("/", (_, res) => res.redirect("/trainer"));

["trainer", "experiments", "datasets", "settings", "inspect"].forEach(page => {
  app.get(`/${page}`, (_, res) =>
    res.sendFile(path.join(__dirname, "public", `${page}.html`))
  );
});

/* ======================================================
   API ROUTES
====================================================== */
/* ---------- LIST PHOTOS ---------- */
app.get("/api/photos", (req, res) => {
  const files = fs.readdirSync(photosDir)
    .filter(f => f.toLowerCase().endsWith(".png"))
    .sort((a, b) => b.localeCompare(a));
  res.json(files);
});

/* ---------- SAVE PHOTO ---------- */
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

/* ---------- LIST DATASETS ---------- */
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

/* ---------- SAVE YOLO ---------- */
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

  lastSaved = {
    image,
    imageFrom: srcImagePath,
    imageTo: dstImagePath,
    labelPath
  };

  res.json({ status: "ok" });
});

/* ======================================================
   TRAINING
====================================================== */

/* ---------- START TRAINING ---------- */
app.post("/api/train/start", (req, res) => {
  const { station, process, model, epochs, imgsz, batch, runName } = req.body;
  
  if (trainProcess) {
    return res.status(409).json({
      error: "Training already running"
    });
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
  trainProcess = spawn("python", [
    "training/train.py",
    "--data", datasetYaml,
    "--model", model,
    "--epochs", epochs,
    "--imgsz", imgsz,
    "--batch", batch,
    "--name", safeRunName,
    "--project", TRAINING_ROOT
  ]);

  trainProcess.stdout.on("data", d => console.log(d.toString()));
  trainProcess.stderr.on("data", d => console.error(d.toString()));

  trainProcess.on("close", (code, signal) => {
    console.log(`🧠 Training closed (code=${code}, signal=${signal})`);
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

/* ================================
   TRAINING PROGRESS
================================ */
app.get("/api/train/progress", (req, res) => {
  if (!trainProcess || !activeRunName) {
    return res.json({ status: "idle" });
  }

  const runDir = path.join(TRAINING_ROOT, activeRunName);
  const cfgPath = path.join(runDir, "run_config.json");
  const csvPath = path.join(runDir, "results.csv");

  if (!fs.existsSync(cfgPath)) {
    return res.json({
      status: "starting",
      runName: activeRunName,
      file: "results.csv"
    });
  }

  const config = JSON.parse(fs.readFileSync(cfgPath, "utf8"));

  if (!fs.existsSync(csvPath)) {
    return res.json({
      status: "starting",
      runName: activeRunName,
      file: "results.csv"
    });
  }

  const lines = fs.readFileSync(csvPath, "utf8").trim().split("\n");
  if (lines.length < 2) {
    return res.json({
      status: "starting",
      runName: activeRunName,
      file: "results.csv"
    });
  }

  const headers = lines[0].split(",");
  const values = lines[lines.length - 1].split(",");
  const row = Object.fromEntries(
    headers.map((h, i) => [h, Number(values[i])])
  );

  const epoch = row.epoch ?? 0;
  const total = config.epochs;

  const progress = Math.min(
    100,
    Math.round(((epoch + 1) / total) * 100)
  );

  res.json({
    status: "running",
    progress,
    epoch: epoch + 1,
    totalEpochs: total,
    runName: activeRunName,
    file: "results.csv"
  });
});

/* ---------- STOP TRAINING ---------- */

app.post("/api/train/stop", (_, res) => {
  if (!trainProcess) {
    return res.status(400).json({ error: "No training running" });
  }

  console.log("🛑 Early stop requested");
  trainProcess.kill("SIGTERM");

  trainProcess = null;
  activeRunName = null; // ✅ reset

  res.json({ status: "stopped" });
});

/* ================================
   TRAINING METRICS (LOSS)
================================ */
app.get("/api/train/metrics", (req, res) => {
  if (!activeRunName) {
    return res.json([]);
  }

  const runDir = path.join(TRAINING_ROOT, activeRunName);
  const csvPath = path.join(runDir, "results.csv");

  if (!fs.existsSync(csvPath)) {
    return res.json([]);
  }

  const lines = fs.readFileSync(csvPath, "utf8").trim().split("\n");
  if (lines.length < 2) {
    return res.json([]);
  }

  const headers = lines[0].split(",");
  const rows = lines.slice(1);


  const epochIdx = headers.indexOf("epoch");

  const lossIdx = headers.includes("train/box_loss")
    ? headers.indexOf("train/box_loss")
    : headers.includes("train/loss")
    ? headers.indexOf("train/loss")
    : -1;

  const map50Key = headers.find(h =>
    h.startsWith("metrics/mAP50")
  );
  const map50Idx = map50Key
    ? headers.indexOf(map50Key)
    : -1;

  if (epochIdx === -1) {
    return res.json([]);
  }

  const data = rows.map(line => {
    const v = line.split(",");
    return {
      epoch: Number(v[epochIdx]) + 1,
      loss: lossIdx !== -1 ? Number(v[lossIdx]) : null,
      map50: map50Idx !== -1 ? Number(v[map50Idx]) : null
    };
  });

  res.json(data);
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

        // metadata
        config,
        startedAt,
        updatedAt: stats.mtime.toISOString(),

        // ✅ THESE ARE REQUIRED FOR BUTTONS
        hasWeights: fs.existsSync(bestPt),
        hasMetrics: fs.existsSync(metricsJson)
      };
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
  let pythonVersion = "unknown";
  let yoloVersion = "unknown";
  let cuda = false;

  try { pythonVersion = execSync("python --version").toString().trim(); } catch {}
  try { yoloVersion = execSync("yolo version").toString().trim(); } catch {}
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
    environment: {
      python: pythonVersion,
      yolo: yoloVersion,
      cuda
    }
  });
});

/* ======================================================
   START SERVER
====================================================== */
app.listen(3000, () => {
  console.log("✅ Server running at http://localhost:3000");
});
