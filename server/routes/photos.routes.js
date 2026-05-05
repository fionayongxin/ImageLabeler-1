
const express = require("express");
const router = express.Router();
const photosService = require("../services/photos.service");

router.get("/", (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 24;
  res.json(photosService.listPhotosPaged(page, limit));
});

router.post("/save", async (req, res) => {
  try {
    const { image } = req.body;
    const result = await photosService.savePhoto(image);
    res.json(result);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

router.post("/delete", (req, res) => {
  const { image } = req.body;
  res.json(photosService.deletePhoto(image));
});

module.exports = router;
