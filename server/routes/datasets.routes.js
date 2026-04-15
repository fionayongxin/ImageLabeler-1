/**
 * ======================================================
 * datasets.routes.js
 * ------------------------------------------------------
 * Responsibility:
 * HTTP API for dataset discovery and browsing
 * - Thin routing layer only
 *
 * Design rules:
 * - NO filesystem logic here
 * - NO training logic
 * - Delegate all work to datasets.service
 *
 * Endpoints:
 * - GET /api/datasets
 * - GET /api/datasets/images
 * ======================================================
 */

const express = require("express");
const router = express.Router();

const datasetsService = require("../services/datasets.service");

/**
 * List available datasets by station and process.
 * Query:
 *   ?station=station_01&process=final_inspection
 */
router.get("/", (req, res) => {
  const { station, process } = req.query;
  const datasets = datasetsService.listDatasets(station, process);
  res.json(datasets);
});

/**
 * List images for a given dataset.
 * Query:
 *   ?station=station_01&process=final_inspection
 */
router.get("/images", (req, res) => {
  const { station, process } = req.query;
  const images = datasetsService.listDatasetImages(station, process);
  res.json(images);
});

/**
 * Export router for mounting in server.js
 */
module.exports = router;