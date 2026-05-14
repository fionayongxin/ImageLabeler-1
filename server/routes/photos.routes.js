/**
 * ======================================================
 * photos.routes.js 
 * ======================================================
 *
 * Responsibilities:
 * - List paginated photos
 * - Save captured images
 * - Delete existing images
 *
 * Design:
 * - Service layer handles all filesystem logic
 * - Routes only handle HTTP + validation
 */

const express = require("express");
const router = express.Router();

const photosService = require("../services/photos.service");

/* ======================================================
   LIST PHOTOS (PAGINATED)
   GET /api/photos
====================================================== */

router.get("/", (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 24;

  const result = photosService.listPhotosPaged(page, limit);

  res.json(result);
});

/* ======================================================
   SAVE PHOTO
   POST /api/photos/save
====================================================== */

router.post("/save", async (req, res) => {
  try {
    const { image } = req.body;

    const result = await photosService.savePhoto(image);

    res.json(result);

  } catch (err) {
    res.status(400).json({
      message: err.message
    });
  }
});

/* ======================================================
   DELETE PHOTO
   POST /api/photos/delete
====================================================== */

router.post("/delete", (req, res) => {
  const { image } = req.body;

  const result = photosService.deletePhoto(image);

  res.json(result);
});

module.exports = router;