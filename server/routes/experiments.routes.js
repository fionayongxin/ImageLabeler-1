/**
 * ======================================================
 * experiments.routes.js
 * ------------------------------------------------------
 * Responsibility:
 * - HTTP API for experiment metadata and artifacts
 * - Thin layer only
 *
 * Design rules:
 * - NO filesystem parsing here
 * - NO training execution here
 * - Delegate all logic to experiments.service
 *
 * Endpoints:
 * - GET /api/experiments
 * - GET /api/experiments/:name
 * - GET /api/experiments/:name/weights
 * ======================================================
 */

const express = require("express");
const router = express.Router();

const experimentsService = require("../services/experiments.service");

/**
 * List all experiments.
 */
router.get("/", (_req, res) => {
  const experiments = experimentsService.listExperiments();
  res.json(experiments);
});

/**
 * Get details for a single experiment.
 */
router.get("/:name", (req, res) => {
  const { name } = req.params;
  const experiment = experimentsService.getExperiment(name);
  res.json(experiment);
});

/**
 * Download trained weights for an experiment.
 */
router.get("/:name/weights", (req, res) => {
  const { name } = req.params;
  const { weightsPath, filename } =
    experimentsService.getWeightsDownload(name);

  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${filename}"`
  );
  res.sendFile(weightsPath);
});

/**
 * Return parsed training metrics for a completed experiment.
 */
router.get("/:name/metrics", (req, res) => {
  try {
    const metrics = experimentsService.getExperimentMetrics(req.params.name);
    res.json(metrics);
  } catch (err) {
    res.status(404).json([]);
  }
});

module.exports = router;
