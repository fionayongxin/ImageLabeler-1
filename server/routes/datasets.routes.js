/**
 * ======================================================
 * datasets.routes.js  (FINAL)
 * ======================================================
 */

const express = require("express");
const router = express.Router();

const datasetsService = require("../services/datasets.service");

/**
 * List available datasets.
 */
router.get("/", (req, res) => {
  const { station, process } = req.query;
  const datasets = datasetsService.listDatasets(station, process);
  res.json(datasets);
});

/**
 * Paginated dataset images.
 *
 * Query:
 * ?station=station_01
 * &process=final_inspection
 * &page=1
 * &limit=24
 */
router.get("/images", (req, res) => {
  const { station, process } = req.query;
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 24;

  const result =
    datasetsService.listDatasetImagesPaged(
      station,
      process,
      page,
      limit
    );

  res.json(result);
});

module.exports = router;