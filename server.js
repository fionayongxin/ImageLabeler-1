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

// Ensure directories exist
[photosDir, yoloImageDir, yoloLabelDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});
``

/* ---------- LIST PHOTOS ---------- */
app.get("/api/photos", (req, res) => {
  const files = fs.readdirSync(photosDir)
    .filter(f => f.endsWith(".png"))
    .sort((a, b) => b.localeCompare(a));
  res.json(files);
});

/* ---------- SAVE YOLO LABELS ---------- */

app.post("/api/save-yolo", (req, res) => {
  const { image, width, height, boxes, classMap } = req.body;

  if (!image || !width || !height || !Array.isArray(boxes)) {
    return res.status(400).json({ error: "Invalid YOLO data" });
  }

  const baseName = path.parse(image).name;

  /* ---------- 1. CREATE YOLO LABEL ---------- */
  const yoloLines = boxes.map(b => {
    const classId = classMap[b.label];
    if (classId === undefined) return null;

    const xc = (b.x + b.w / 2) / width;
    const yc = (b.y + b.h / 2) / height;
    const w  = b.w / width;
    const h  = b.h / height;

    return `${classId} ${xc.toFixed(6)} ${yc.toFixed(6)} ${w.toFixed(6)} ${h.toFixed(6)}`;
  }).filter(Boolean);

  const labelPath = path.join(yoloLabelDir, `${baseName}.txt`);
  fs.writeFileSync(labelPath, yoloLines.join("\n"));

  /* ---------- 2. MOVE IMAGE OUT OF photos/ ---------- */
  const srcImagePath = path.join(photosDir, image);
  const dstImagePath = path.join(yoloImageDir, image);

  if (!fs.existsSync(srcImagePath)) {
    return res.status(404).json({ error: "Source image not found" });
  }

  fs.renameSync(srcImagePath, dstImagePath);

  /* ---------- DONE ---------- */
  res.json({
    status: "ok",
    imageMovedTo: "labels/yolo/image",
    labelSavedTo: "labels/yolo/label"
  });
});

/* ---------- START SERVER ---------- */
app.listen(3000, () => {
  console.log("✅ Server running at http://localhost:3000");
});
