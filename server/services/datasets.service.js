/**
 * ======================================================
 * datasets.service.js  (UNIFIED – NO THUMB LOGIC)
 * ======================================================
 */

const fs = require("fs");
const path = require("path");
const { DATASET_ROOT } = require("../config/paths");

const IMAGE_REGEX = /\.(png|jpg|jpeg)$/i;

/* ======================================================
   DATASET DISCOVERY
====================================================== */

function listDatasets(station, process) {
  if (!station || !process) return [];

  const dir = path.join(DATASET_ROOT, station, process);
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter(name =>
      fs.statSync(path.join(dir, name)).isDirectory()
    );
}

/* ======================================================
   PAGINATED IMAGE LISTING
====================================================== */

function listDatasetImagesPaged(
  station,
  process,
  page = 1,
  limit = 24
) {
  if (!station || !process) {
    return { total: 0, images: [] };
  }

  const imagesDir = path.join(
    DATASET_ROOT,
    station,
    process,
    "images"
  );

  if (!fs.existsSync(imagesDir)) {
    return { total: 0, images: [] };
  }

  const files = fs
    .readdirSync(imagesDir)
    .filter(name => IMAGE_REGEX.test(name))
    .sort();

  const total = files.length;
  const start = (page - 1) * limit;
  const slice = files.slice(start, start + limit);

  return {
    total,
    images: slice.map(
      name => `/thumbs/datasets/${station}/${process}/${name}` // ✅ unified
    )
  };
}

module.exports = {
  listDatasets,
  listDatasetImagesPaged
};