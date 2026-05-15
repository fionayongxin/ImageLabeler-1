/**
 * ======================================================
 * training.routes.js 
 * ======================================================
 *
 * Responsibilities:
 * - Start training
 * - Stop training
 * - Provide progress updates
 * - Provide live training metrics
 *
 * Design:
 * - Thin routing layer only
 * - All logic delegated to training.service
 */

const express = require("express");
const router = express.Router();

const trainingService = require("../services/training.service");

/* ======================================================
   START TRAINING
   POST /api/train/start
====================================================== */

router.post("/start", async (req, res) => {
  try {
    const result = await trainingService.startTraining(req.body);

    res.json(result);

  } catch (err) {
    console.error("[Training Start Error]", err);

    res.status(500).json({
      error: err.message
    });
  }
});

/* ======================================================
   STOP TRAINING
   POST /api/train/stop
====================================================== */

router.post("/stop", async (_req, res) => {
  try {
    const result = await trainingService.stopTraining();

    res.json(result);

  } catch (err) {
    console.error("[Training Stop Error]", err);

    res.status(500).json({
      error: err.message
    });
  }
});

/* ======================================================
   TRAINING PROGRESS
   GET /api/train/progress
====================================================== */

router.get("/progress", async (_req, res) => {
  try {
    const result = await trainingService.getTrainingProgress();

    res.json(result);

  } catch (err) {
    console.error("[Training Progress Error]", err);

    // Maintain existing behavior
    res.json({ status: "idle" });
  }
});

/* ======================================================
   TRAINING METRICS
   GET /api/train/metrics
====================================================== */

router.get("/metrics", async (_req, res) => {
  try {
    const metrics = await trainingService.getTrainingMetrics();

    res.json(metrics);

  } catch (err) {
    console.error("[Training Metrics Error]", err);

    // Maintain existing behavior
    res.json([]);
  }
});

module.exports = router;