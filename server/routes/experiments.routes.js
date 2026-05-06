/**
 * ======================================================
 * experiments.routes.js
 * ======================================================
 * Mounted at /api/experiments
 * ======================================================
 */

const express = require("express");
const router = express.Router();

const experimentsService = require("../services/experiments.service");

/**
 * GET /api/experiments
 */
router.get("/", async (_req, res) => {
  try {
    const list = await experimentsService.listExperiments();
    res.json(list);
  } catch (err) {
    console.error("[Experiments]", err.message);
    res.json([]);
  }
});

/**
 * GET /api/experiments/:run/metrics
 */
router.get("/:run/metrics", async (req, res) => {
  try {
    const runName = req.params.run;

    const response = await fetch(
      `http://10.192.74.39:8002/train/metrics?run=${encodeURIComponent(runName)}`
    );

    if (!response.ok) {
      return res.json([]);
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("[Experiments Metrics]", err.message);
    res.json([]);
  }
});

/**
 * GET /api/experiments/:run/weights
 */
router.get("/:run/weights", async (req, res) => {
  try {
    const { url } = experimentsService.getWeightsDownload(req.params.run);
    res.redirect(url);
  } catch (err) {
    console.error("[Experiments Download]", err.message);
    res.status(404).json({ error: "Weights not found" });
  }
});

module.exports = router;
