/**
 * ======================================================
 * config/paths.js
 * ======================================================
 *
 * Purpose:
 * - Centralize ALL filesystem paths
 * - Ensure consistent path resolution across the server
 *
 * Design Rules:
 * - Single source of truth (do NOT hardcode paths elsewhere)
 * - No runtime logic — only path definitions
 * - All paths must be absolute (built using path.join)
 *
 * Structure:
 * - Server Root
 * - Data Directories
 * - Model Directories
 */

const path = require("path");

/* ======================================================
   SERVER ROOT
====================================================== */

const SERVER_ROOT = path.join(__dirname, "..");

/* ======================================================
   DATA DIRECTORIES
====================================================== */

// interface/datasets (adjust if needed)
const DATASET_ROOT = path.join(SERVER_ROOT, "..", "datasets");

const PHOTOS_DIR = path.join(SERVER_ROOT, "photos");
const TRAINING_ROOT = path.join(SERVER_ROOT, "training");

/* ======================================================
   CONFIG DIRECTORIES
====================================================== */

const CONFIG_ROOT = path.join(SERVER_ROOT, "..", "config");

const INSPECTION_STATE_PATH = path.join(
  CONFIG_ROOT,
  "inspection_state.json"
);

/* ======================================================
   MODEL DIRECTORIES
====================================================== */

const MODELS_DIR = path.join(SERVER_ROOT, "models");

const ACTIVE_MODEL_META = path.join(
  MODELS_DIR,
  "active_model.json"
);

/* ======================================================
   EXPORTS
====================================================== */

module.exports = {
  SERVER_ROOT,

  DATASET_ROOT,
  PHOTOS_DIR,
  TRAINING_ROOT,

  CONFIG_ROOT,
  INSPECTION_STATE_PATH,

  MODELS_DIR,
  ACTIVE_MODEL_META
};