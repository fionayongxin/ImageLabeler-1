/**
 * ======================================================
 * photos.routes.js
 * ------------------------------------------------------
 * Responsibility:
 * - HTTP API for captured photos
 * - Thin routing layer ONLY
 *
 * Design rules:
 * - NO filesystem logic here
 * - NO path concatenation here
 * - Router returns data exactly as provided by service
 *
 * Endpoints:
 * - GET    /api/photos           → list all photos
 * - POST   /api/photos/save      → save new photo
 * - POST   /api/photos/delete    → delete photo
 * - GET    /api/photos/latest    → list latest N photos
 * ======================================================
 */

const express = require("express");
const router = express.Router();

const photosService = require("../services/photos.service");

/**
 * List all captured photos (newest first).
 * Returns array of PUBLIC URLs.
 */
router.get("/", (_req, res) => {
  const photos = photosService.listPhotos();
  res.json(photos);
});

/**
 * Save a captured photo.
 * Body:
 * {
 *   image: "data:image/png;base64,..."
 * }
 */
router.post("/save", (req, res) => {
  const { image } = req.body;
  const result = photosService.savePhoto(image);
  res.json(result);
});

/**
 * Delete a photo by filename.
 * Body:
 * {
 *   image: "photo_xxx.png"
 * }
 */
router.post("/delete", (req, res) => {
  const { image } = req.body;
  const result = photosService.deletePhoto(image);
  res.json(result);
});

/**
 * Get latest captured photos.
 * Query:
 *   ?limit=2
 *
 * Returns array of PUBLIC URLs.
 */
router.get("/latest", (req, res) => {
  const limit = Number(req.query.limit) || 2;
  const photos = photosService.getLatestPhotos(limit);
  res.json(photos);
});

module.exports = router;
