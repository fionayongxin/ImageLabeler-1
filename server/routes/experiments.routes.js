/**
 * ======================================================
 * experiments.routes.js 
 * ======================================================
 *
 * Mounted at: /api/experiments
 *
 * Responsibilities:
 * - List experiments (via service layer)
 * - Proxy metrics from training server
 * - Redirect to weights download
 *
 * Design:
 * - Backend service owns filesystem
 * - Training server owns metrics
 */

const express = require("express");
const router = express.Router();

const fetch = require("node-fetch");

const { TRAINING_SERVER_BASE } = require("../config/env");
const experimentsService = require("../services/experiments.service");

/* ======================================================
   LIST EXPERIMENTS
   GET /api/experiments
====================================================== */

router.get("/", async (_req, res) => {
  try {
    const list = await experimentsService.listExperiments();

    res.json(list);

  } catch (err) {
    console.error("[Experiments List Error]", err.message);

    // Keep original behavior (empty array fallback)
    res.json([]);
  }
});

/* ======================================================
   FETCH METRICS (PROXY)
   GET /api/experiments/:run/metrics
====================================================== */

router.get("/:run/metrics", async (req, res) => {
  try {
    const runName = req.params.run;

    const response = await fetch(
      `${TRAINING_SERVER_BASE}/train/metrics?run=${encodeURIComponent(runName)}`
    );

    if (!response.ok) {
      // Maintain existing behavior
      return res.json([]);
    }

    const data = await response.json();

    res.json(data);

  } catch (err) {
    console.error("[Experiments Metrics Error]", err.message);

    // Maintain existing behavior
    res.json([]);
  }
});

/* ======================================================
   DOWNLOAD WEIGHTS
   GET /api/experiments/:run/weights
====================================================== */

router.get("/:run/weights", async (req, res) => {
  try {
    const runName = req.params.run;

    const { url } = experimentsService.getWeightsDownload(runName);

    // Redirect client to actual file location
    res.redirect(url);

  } catch (err) {
    console.error("[Experiments Download Error]", err.message);

    res.status(404).json({
      error: "Weights not found"
    });
  }
});

module.exports = router;