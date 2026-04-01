const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.static("public"));
app.use("/photos", express.static("photos"));

/* ---------- DIRECTORIES ---------- */
const photosDir = path.join(__dirname, "photos");
const labelsDir = path.join(__dirname, "labels");
const yoloDir = path.join(labelsDir, "yolo");

[photosDir, labelsDir, yoloDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

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

  const lines = boxes.map(b => {
    const classId = classMap[b.label];
    if (classId === undefined) return null;

    const xc = (b.x + b.w / 2) / width;
    const yc = (b.y + b.h / 2) / height;
    const w  = b.w / width;
    const h  = b.h / height;

    return `${classId} ${xc.toFixed(6)} ${yc.toFixed(6)} ${w.toFixed(6)} ${h.toFixed(6)}`;
  }).filter(Boolean);

  fs.writeFileSync(
    path.join(yoloDir, `${baseName}.txt`),
    lines.join("\n")
  );

  res.json({ status: "ok", file: `${baseName}.txt` });
});

/* ---------- START SERVER ---------- */
app.listen(3000, () => {
  console.log("✅ Server running at http://localhost:3000");
});
