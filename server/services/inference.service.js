/**
 * ======================================================
 * inference.service.js
 * ------------------------------------------------------
 * Responsibility:
 * - Orchestrate inference via FastAPI ONLY
 * - Manage active model metadata
 * - Never run ML locally
 *
 * Design rules:
 * - NO spawn / NO python execution
 * - NO Express / HTTP objects
 * - FastAPI is the single inference runtime
 * ======================================================
 */


const axios = require("axios");
const fs = require("fs/promises");
const path = require("path");

const { TRAINING_SERVER_BASE } = require("../config/env");

// -----------------------------------------------------------------------------
// INSPECTION CONFIG PATH (single source of truth)
// -----------------------------------------------------------------------------

const INSPECTION_CONFIG_PATH = path.join(
  __dirname,
  "..",
  "config",
  "inspection_state.json"
);

// -----------------------------------------------------------------------------
// INFERENCE (EXISTING FUNCTIONALITY — UNCHANGED)
// -----------------------------------------------------------------------------

async function runInference() {
  const res = await axios.get(`${TRAINING_SERVER_BASE}/infer`);
  return res.data;
}

// -----------------------------------------------------------------------------
// INSPECTION CONFIG MANAGEMENT (MERGED HERE)
// -----------------------------------------------------------------------------

async function readInspectionState() {
  const raw = await fs.readFile(INSPECTION_CONFIG_PATH, "utf-8");
  return JSON.parse(raw);
}

async function writeInspectionState(state) {
  await fs.writeFile(
    INSPECTION_CONFIG_PATH,
    JSON.stringify(state, null, 2),
    "utf-8"
  );
}

async function setCurrentStep(step) {
  const state = await readInspectionState();
  state.currentStep = step;
  await writeInspectionState(state);
  return state;
}

async function updateInspectionConfig(partialUpdate) {
  const state = await readInspectionState();
  const updated = { ...state, ...partialUpdate };
  await writeInspectionState(updated);
  return updated;
}

// -----------------------------------------------------------------------------
// EXPORTS (SINGLE SERVICE, SINGLE OWNER)
// -----------------------------------------------------------------------------

module.exports = {
  // inference
  runInference,

  // inspection configuration
  readInspectionState,
  writeInspectionState,
  setCurrentStep,
  updateInspectionConfig
};
