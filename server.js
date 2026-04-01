const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.static("public"));
app.use("/photos", express.static("photos"));

/* ---------- DIRECTORIES ---------- */
const photosDir = path.join(__dirname, "photos");
const yoloImageDir = path.join(__dirname, "labels", "yolo", "image");
const yoloLabelDir = path.join(__dirname, "labels", "yolo", "label");

[photosDir, yoloImageDir, yoloLabelDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

/* ---------- TAKE PHOTO ---------- */
app.post("/api/save-photo", (req, res) => {
  const { image } = req.body;

  if (!image || !image.startsWith("data:image")) {
    return res.status(400).json({ error: "Invalid image data" });
  }

  const base64Data = image.replace(/^data:image\/png;base64,/, "");
  const filename = `photo_${Date.now()}.png`;
  const filepath = path.join(photosDir, filename);

  fs.writeFile(filepath, base64Data, "base64", err => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to save image" });
    }

    res.json({ filename });
  });
});


/* ---------- UNDO STATE ---------- */
let lastSaved = null;

/* ---------- LIST PHOTOS ---------- */
app.get("/api/photos", (req, res) => {
  const files = fs.readdirSync(photosDir)
    .filter(f => f.toLowerCase().endsWith(".png"))
    .sort((a, b) => b.localeCompare(a));
  res.json(files);
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

/* ---------- UNDO LAST SAVE ---------- */
app.post("/api/undo-last-save", (req, res) => {
  if (!lastSaved) {
    return res.status(400).json({ error: "Nothing to undo" });
  }

  try {
    const { imageFrom, imageTo, labelPath, image } = lastSaved;

    if (fs.existsSync(imageTo)) {
      fs.renameSync(imageTo, imageFrom);
    }

    if (fs.existsSync(labelPath)) {
      fs.unlinkSync(labelPath);
    }

    lastSaved = null;
    res.json({ status: "ok", image });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Undo failed" });
  }
});

/* ---------- START SERVER ---------- */
app.listen(3000, () => {
  console.log("✅ Server running at http://localhost:3000");
});