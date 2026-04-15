/**
 * ======================================================
 * datasets.service.js
 * ------------------------------------------------------
 * Responsibility:
 * - Business logic for dataset discovery
 * - Provide dataset names and dataset image lists
 *
 * Design rules:
 * - NO Express / HTTP objects
 * - NO training logic
 * - NO inference logic
 * - Filesystem access limited to DATASET_ROOT
 *
 * This service is used by datasets.routes.js.
 * ======================================================
 */

const fs = require("fs");
const path = require("path");
const { DATASET_ROOT } = require("../config/paths");

/**
 * List dataset folders under a station + process.
 *
 * @param {string} station
 * @param {string} process
 * @returns {string[]} dataset directory names
 */
function listDatasets(station, process) {
  if (!station || !process) return [];

  const dir = path.join(DATASET_ROOT, station, process);
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir).filter(name =>
    fs.statSync(path.join(dir, name)).isDirectory()
  );
}

/**
 * List images belonging to a dataset (public URLs).
 *
 * @param {string} station
 * @param {string} process
 * @returns {string[]} image URLs
 */
function listDatasetImages(station, process) {
  if (!station || !process) return [];

  const imageDir = path.join(
    DATASET_ROOT,
    station,
    process,
    "images"
  );

  if (!fs.existsSync(imageDir)) return [];

  return fs.readdirSync(imageDir)
    .filter(name => /\.(png|jpg|jpeg)$/i.test(name))
    .map(name => `/datasets/${station}/${process}/images/${name}`);
}

module.exports = {
  listDatasets,
  listDatasetImages
};