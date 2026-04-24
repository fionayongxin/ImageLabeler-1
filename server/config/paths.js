/**
 * ======================================================
 * config/paths.js
 * ------------------------------------------------------
 * Single source of truth for filesystem paths.
 * ======================================================
 */

const path = require("path");

/* ======================================================
   SERVER ROOT
====================================================== */
const SERVER_ROOT = path.join(__dirname, "..");

/* ======================================================
   DATA
====================================================== */
const DATASET_ROOT = path.join(SERVER_ROOT, "..", "datasets");

const PHOTOS_DIR = path.join(SERVER_ROOT, "photos");
const TRAINING_ROOT = path.join(SERVER_ROOT, "training");

/* ======================================================
   MODELS
====================================================== */
const MODELS_DIR = path.join(SERVER_ROOT, "models");
const ACTIVE_MODEL_META = path.join(MODELS_DIR, "active_model.json");

/* ======================================================
   CAMERA (SIMULATED IMAGE)
====================================================== */
const CAMERA_IMAGE_PATH = path.join(DATASET_ROOT,
  "station_01/final_inspection/images/" +
  "92762c6d__331aa42d-Image__2026-03-25__15-47-02.jpg");

/* ======================================================
   EXPORT
====================================================== */
module.exports = {
  SERVER_ROOT,

  DATASET_ROOT,
  PHOTOS_DIR,
  TRAINING_ROOT,

  MODELS_DIR,
  ACTIVE_MODEL_META,

  CAMERA_IMAGE_PATH
};