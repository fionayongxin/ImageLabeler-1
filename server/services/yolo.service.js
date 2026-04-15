/**
 * ======================================================
 * yolo.service.js
 * ------------------------------------------------------
 * Responsibility:
 * - Business logic for YOLO labeling
 * - Convert boxes to YOLO format
 * - Move images into dataset structure
 * - Support undo of last save
 *
 * Design rules:
 * - NO Express / HTTP
 * - NO request/response objects
 * - Use utils for filesystem safety & YOLO math
 * - Owns labeling lifecycle state
 * ======================================================
 */

const fs = require("fs");
const path = require("path");

const { DATASET_ROOT, PHOTOS_DIR } = require("../config/paths");
const { buildYoloFile } = require("../utils/yolo.format");
const {
  ensureDir,
  moveFileSafe,
  deleteFileSafe
} = require("../utils/file.safe");

/**
 * Internal state to support undo.
 * Only the most recent save is undoable.
 */
let lastSaved = null;

/**
 * Save YOLO labels and move image into dataset.
 *
 * @param {Object} payload
 * @returns {{ status: string }}
 */
function saveYolo(payload) {
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
    throw new Error("Source image not found");
  }

  const imagesDir = path.join(
    DATASET_ROOT,
    station,
    process,
    "images"
  );

  const labelsDir = path.join(
    DATASET_ROOT,
    station,
    process,
    "labels"
  );

  ensureDir(imagesDir);
  ensureDir(labelsDir);

  const baseName = path.parse(image).name;
  const dstImagePath = path.join(imagesDir, image);
  const labelPath = path.join(labelsDir, `${baseName}.txt`);

  const yoloLines = buildYoloFile(
    boxes,
    classMap,
    width,
    height
  );

  fs.writeFileSync(labelPath, yoloLines.join("\n"));
  moveFileSafe(srcImagePath, dstImagePath);

  lastSaved = {
    image,
    from: srcImagePath,
    to: dstImagePath,
    labelPath
  };

  return { status: "ok" };
}

/**
 * Undo the last YOLO save operation.
 *
 * @returns {{ status: string, image: string }}
 */
function undoLastSave() {
  if (!lastSaved) {
    throw new Error("Nothing to undo");
  }

  moveFileSafe(lastSaved.to, lastSaved.from);
  deleteFileSafe(lastSaved.labelPath);

  const image = lastSaved.image;
  lastSaved = null;

  return { status: "ok", image };
}

module.exports = {
  saveYolo,
  undoLastSave
};