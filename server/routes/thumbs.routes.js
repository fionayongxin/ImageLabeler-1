/**
 * ======================================================
 * thumbs.routes.js
 * ======================================================
 *
 * Responsibilities:
 * - Serve thumbnails for photos and datasets
 * - Generate thumbnails on demand (lazy)
 *
 * Design:
 * - No business logic here (only file + transform)
 * - Uses Sharp for thumbnail generation
 * - Centralized filesystem paths from paths.js
 */

const express = require("express");
const router = express.Router();

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const {
  PHOTOS_DIR,
  DATASET_ROOT
} = require("../config/paths"); 

/* ======================================================
   CONSTANTS
====================================================== */

const THUMB_SIZE = 256;

/* ======================================================
   HELPER: GENERATE THUMBNAIL IF NEEDED
====================================================== */

async function ensureThumb(fullImagePath, thumbPath) {
  // Full image missing → cleanup thumb if exists
  if (!fs.existsSync(fullImagePath)) {
    if (fs.existsSync(thumbPath)) {
      fs.unlinkSync(thumbPath);
    }
    return false;
  }

  // Thumbnail already exists
  if (fs.existsSync(thumbPath)) {
    return true;
  }

  // Ensure directory exists
  fs.mkdirSync(path.dirname(thumbPath), { recursive: true });

  // Generate thumbnail
  await sharp(fullImagePath)
    .resize(THUMB_SIZE, THUMB_SIZE, { fit: "inside" })
    .jpeg({ quality: 70 })
    .toFile(thumbPath);

  return true;
}

/* ======================================================
   PHOTO THUMBNAILS
   GET /thumbs/photos/:image
====================================================== */

router.get("/photos/:image", async (req, res) => {
  const { image } = req.params;

  const fullImagePath = path.join(PHOTOS_DIR, image);

  const thumbPath = path.join(
    PHOTOS_DIR,
    "thumbs",
    image
  );

  try {
    const ok = await ensureThumb(fullImagePath, thumbPath);

    if (!ok) {
      return res.status(404).send("Image not found");
    }

    res.sendFile(thumbPath);

  } catch (err) {
    console.error("[Thumbs][Photos]", err);

    res.status(500).send("Thumbnail error");
  }
});

/* ======================================================
   DATASET THUMBNAILS
   GET /thumbs/datasets/:station/:process/:image
====================================================== */

router.get("/datasets/:station/:process/:image", async (req, res) => {
  const { station, process, image } = req.params;

  const fullImagePath = path.join(
    DATASET_ROOT,
    station,
    process,
    "images",
    image
  );

  const thumbPath = path.join(
    DATASET_ROOT,
    station,
    process,
    "images",
    "thumbs",
    image
  );

  try {
    const ok = await ensureThumb(fullImagePath, thumbPath);

    if (!ok) {
      return res.status(404).send("Image not found");
    }

    res.sendFile(thumbPath);

  } catch (err) {
    console.error("[Thumbs][Datasets]", err);

    res.status(500).send("Thumbnail error");
  }
});

module.exports = router;