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
   EXPORT
====================================================== */
module.exports = {
  SERVER_ROOT,

  DATASET_ROOT,
  PHOTOS_DIR,
  TRAINING_ROOT,

  MODELS_DIR,
  ACTIVE_MODEL_META,

};