const express = require("express");
const router = express.Router();

const trainingService = require("../services/training.service");

/**
 * Start a new training run.
 */
router.post("/start", async (req, res) => {
  try {
    const result = await trainingService.startTraining(req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Stop training.
 */

router.post("/stop", async (_req, res) => {

  try {
    const result = await trainingService.stopTraining();
    res.json(result);
  } catch (err) {
    console.error("Stop training error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get training progress.
 */
router.get("/progress", async (_req, res) => {
  try {
    const result = await trainingService.getTrainingProgress();
    res.json(result);
  } catch (err) {
    res.json({ status: "idle" });
  }
});

/**
 * Live training metrics.
 */
router.get("/metrics", async (_req, res) => {
  try {
    const metrics = await trainingService.getTrainingMetrics();
    res.json(metrics);
  } catch {
    res.json([]);
  }
});


module.exports = router;