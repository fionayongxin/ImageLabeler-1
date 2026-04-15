/**
 * ======================================================
 * inference.routes.js
 * ------------------------------------------------------
 * Responsibility:
 * - HTTP boundary for inference
 * - Delegate all work to inference.service
 *
 * Design rules:
 * - NO ML logic
 * - NO filesystem logic
 * - FastAPI
 * ======================================================
 */

const express = require("express");
const multer = require("multer");
const router = express.Router();

const inferenceService = require("../services/inference.service");

/**
 * Upload and activate a model (Engineer mode).
 * Triggers FastAPI reload.
 */
const upload = multer({
  storage: multer.diskStorage({
    destination: "models",
    filename: (_req, file, cb) => cb(null, file.originalname)
  }),
  fileFilter: (_req, file, cb) =>
    file.originalname.endsWith(".pt")
      ? cb(null, true)
      : cb(new Error("Only .pt files allowed"))
});

router.post("/model/upload", upload.single("model"), async (req, res) => {
  const relativePath = `models/${req.file.originalname}`;
  inferenceService.setActiveModel(relativePath);
  const reload = await inferenceService.reloadModel();
  res.json({ status: "ok", reload });
});

/**
 * Run inference (FastAPI).
 */
router.get("/status", async (_req, res) => {
  const result = await inferenceService.runInference();
  res.json(result);
});

/**
 * Proxy camera MJPEG stream from FastAPI
 */
router.get("/camera", async (_req, res) => {
  try {
    const response = await fetch(`${FASTAPI_BASE_URL}/camera`);

    if (!response.ok || !response.body) {
      throw new Error("FastAPI camera unavailable");
    }

    res.setHeader(
      "Content-Type",
      response.headers.get("content-type") ||
        "multipart/x-mixed-replace; boundary=frame"
    );

    response.body.pipe(res);

  } catch (err) {
    console.error("Camera proxy error:", err.message);
    res.status(500).end();
  }
});

module.exports = router;