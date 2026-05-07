/**
 * ======================================================
 * yolo.service.js
 * ======================================================
 * Responsibility:
 * - YOLO labeling business logic
 * - Build YOLO labels
 * - Upload labeled image + label to training server
 * - Delete local image ONLY after server ACK
 * - Provide class list for UI from dataset.yaml
 *
 * IMPORTANT:
 * - Dataset images are persisted on SERVER via HTTP
 * - dataset.yaml is still read locally for class names
 * ======================================================
 */

const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");
const FormData = require("form-data");
const sharp = require("sharp");

const { PHOTOS_DIR, DATASET_ROOT } = require("../config/paths");
const { buildYoloFile } = require("../utils/yolo.format");
const { deleteFileSafe } = require("../utils/file.safe");

const { TRAINING_SERVER_BASE } = require("../config/env");

/* ======================================================
   CLASS LOADING
====================================================== */

async function getClasses(station, process) {
  if (!station || !process) {
    throw new Error("Missing station or process");
  }

  const res = await fetch(
    `${TRAINING_SERVER_BASE}/dataset/classes` +
    `?station=${encodeURIComponent(station)}` +
    `&process=${encodeURIComponent(process)}`
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to load classes");
  }

  const data = await res.json();
  return data.classes || [];
}

/* ======================================================
   SERVER UPLOAD
====================================================== */

async function uploadToTrainingServer({
  imagePath,
  imageName,
  labelText,
  station,
  process
}) {
  const form = new FormData();

  form.append("station", station);
  form.append("process", process);

  form.append(
    "image",
    fs.createReadStream(imagePath),
    imageName
  );

  form.append(
    "label",
    Buffer.from(labelText),
    {
      filename: `${path.parse(imageName).name}.txt`,
      contentType: "text/plain"
    }
  );
  
  const thumbBuffer = await sharp(imagePath)
    .resize(320)          // width 320px (auto height)
    .jpeg({ quality: 60 }) // compress
    .toBuffer();

  form.append(
    "thumb",
    thumbBuffer,
    {
      filename: imageName,
      contentType: "image/jpeg"
    }
  );

  const res = await fetch(
    `${TRAINING_SERVER_BASE}/dataset/upload`,
    {
      method: "POST",
      body: form,
      headers: form.getHeaders()
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Training server upload failed (${res.status}): ${text}`
    );
  }
}

/* ======================================================
   SAVE YOLO (HTTP‑BASED, FACTORY SAFE)
====================================================== */

async function saveYolo(payload) {
  const {
    image,
    width,
    height,
    boxes,
    classMap,
    station,
    process
  } = payload;

  if (
    !image ||
    !width ||
    !height ||
    !Array.isArray(boxes) ||
    !station ||
    !process
  ) {
    throw new Error("Invalid YOLO payload");
  }

  const srcImagePath = path.join(PHOTOS_DIR, image);
  if (!fs.existsSync(srcImagePath)) {
    throw new Error("Source image not found on PC");
  }

  const labelText = buildYoloFile(
    boxes,
    classMap,
    width,
    height
  ).join("\n");

  try {
    await uploadToTrainingServer({
      imagePath: srcImagePath,
      imageName: image,
      labelText,
      station,
      process
    });
  } catch (err) {
    console.error("[UPLOAD] Failed:", err.message);

    throw new Error("Upload failed, image kept on PC");
  }

  // ---- delete ONLY after server ACK ----
  deleteFileSafe(srcImagePath);

  return { status: "ok" };
}

/* ======================================================
   UNDO (NOT SUPPORTED AFTER SERVER SAVE)
====================================================== */

function undoLastSave() {
  throw new Error(
    "Undo is not supported after server persistence"
  );
}

module.exports = {
  saveYolo,
  undoLastSave,
  getClasses
};