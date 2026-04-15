/**
 * ======================================================
 * training.routes.js
 * ------------------------------------------------------
 * Responsibility:
 * - HTTP API for training lifecycle
 * - Thin routing layer only
 *
 * Design rules:
 * - NO training logic here
 * - NO filesystem logic here
 * - Delegate all work to training.service
 *
 * Endpoints:
 * - POST /api/train/start
 * - POST /api/train/stop
 * - GET  /api/train/progress
 * ======================================================
 */

const express = require("express");
const router = express.Router();

const trainingService = require("../services/training.service");

/**
 * Start a new training run.
 * Body expects:
 * {
 *   station,
 *   process,
 *   model,
 *   epochs,
 *   imgsz,
 *   batch,
 *   runName
 * }
 */
router.post("/start", (req, res) => {
  const result = trainingService.startTraining(req.body);
  res.json(result);
});

/**
 * Stop the active training run.
 */
router.post("/stop", (_req, res) => {
  const result = trainingService.stopTraining();
  res.json(result);
});

/**
 * Get current training progress.
 */
router.get("/progress", (_req, res) => {
  const result = trainingService.getTrainingProgress();
  res.json(result);
});

/**
 * Live training metrics (loss, mAP).
 * Used by trainer.js for live charts.
 */
router.get("/metrics", (_req, res) => {
  try {
    const metrics = trainingService.getTrainingMetrics();
    res.json(metrics);
  } catch (err) {
    res.status(500).json([]);
  }
});

module.exports = router;