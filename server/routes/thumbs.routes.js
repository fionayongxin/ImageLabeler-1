const express = require("express");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const router = express.Router();
const THUMB_SIZE = 256;

/* ======================================================
   HELPER
====================================================== */

async function ensureThumb(fullImagePath, thumbPath) {
  // ✅ original image gone → cleanup stale thumb
  if (!fs.existsSync(fullImagePath)) {
    if (fs.existsSync(thumbPath)) {
      fs.unlinkSync(thumbPath);
    }
    return false;
  }

  if (fs.existsSync(thumbPath)) {
    return true;
  }

  fs.mkdirSync(path.dirname(thumbPath), { recursive: true });

  await sharp(fullImagePath)
    .resize(256, 256, { fit: "inside" })
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

  const fullImagePath = path.join(
    __dirname,
    "..",
    "..",
    "server",
    "photos",
    image
  );

  const thumbPath = path.join(
    __dirname,
    "..",
    "..",
    "server",
    "photos",
    "thumbs",
    image
  );

  try {
    const ok = await ensureThumb(fullImagePath, thumbPath);
    if (!ok) return res.status(404).send("Image not found");

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
    __dirname,
    "..",
    "..",
    "datasets",
    station,
    process,
    "images",
    image
  );

  const thumbPath = path.join(
    __dirname,
    "..",
    "..",
    "datasets",
    station,
    process,
    "images",
    "thumbs",
    image
  );
  const ok = await ensureThumb(fullImagePath, thumbPath);
  if (!ok) return res.status(404).send("Image not found");
  res.sendFile(thumbPath);
  D
});

module.exports = router;