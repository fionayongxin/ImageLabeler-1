/**
 * ======================================================
 * yolo.service.js
 * ======================================================
 *
 * Responsibilities:
 * - Handle YOLO labeling logic
 * - Build YOLO label format
 * - Upload labeled image + label to training server
 * - Delete local image only after successful upload
 * - Provide dataset classes for frontend
 *
 * Design:
 * - Dataset images persist on training server
 * - Local PC holds temporary captured images only
 * - dataset.yaml (classes) retrieved via server API
 */

const fs = require("fs");
const path = require("path");

const fetch = require("node-fetch");
const FormData = require("form-data");
const sharp = require("sharp");

const { PHOTOS_DIR } = require("../config/paths");
const { buildYoloFile } = require("../utils/yolo.format");
const { deleteFileSafe } = require("../utils/file.safe");

const { TRAINING_SERVER_BASE } = require("../config/env");

/* ======================================================
   CLASS LOADING
====================================================== */

/**
 * Fetch class list from training server.
 *
 * @param {string} station
 * @param {string} process
 * @returns {Promise<string[]>}
 */
async function getClasses(station, process) {
  if (!station || !process) {
    throw new Error("Missing station or process");
  }

  const res = await fetch(
    `${TRAINING_SERVER_BASE}/datasets/classes` +
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
   UPLOAD TO TRAINING SERVER
====================================================== */

/**
 * Upload image + label + thumbnail to training server.
 */
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

  /* -------- full image -------- */

  form.append(
    "image",
    fs.createReadStream(imagePath),
    imageName
  );

  /* -------- label file -------- */

  form.append(
    "label",
    Buffer.from(labelText),
    {
      filename: `${path.parse(imageName).name}.txt`,
      contentType: "text/plain"
    }
  );

  /* -------- thumbnail -------- */

  const thumbBuffer = await sharp(imagePath)
    .resize(320)                // fixed width (auto height)
    .jpeg({ quality: 60 })      // lightweight compression
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
    `${TRAINING_SERVER_BASE}/datasets/upload`,
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
   SAVE YOLO LABEL
====================================================== */

/**
 * Process and upload YOLO labeling payload.
 */
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

  // Basic validation
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

  /* -------- build label text -------- */

  const labelText = buildYoloFile(
    boxes,
    classMap,
    width,
    height
  ).join("\n");

  /* -------- upload to server -------- */

  try {
    await uploadToTrainingServer({
      imagePath: srcImagePath,
      imageName: image,
      labelText,
      station,
      process
    });

  } catch (err) {
    console.error("[YOLO Upload Failed]", err.message);

    throw new Error("Upload failed, image kept on PC");
  }

  /* -------- delete after server ACK -------- */

  deleteFileSafe(srcImagePath);

  return { status: "ok" };
}

/* ======================================================
   UNDO (NOT SUPPORTED)
====================================================== */

/**
 * Undo not supported due to server-side persistence.
 */
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