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
  // ================= CALL FASTAPI =================
  const res = await axios.get(`${TRAINING_SERVER_BASE}/infer`);
  const data = res.data;

  // ================= READ CONFIG =================
  let config;
  try {
    const raw = await fs.readFile(INSPECTION_CONFIG_PATH, "utf-8");
    config = JSON.parse(raw);
  } catch {
    return {
      status: "unknown",
      detections: data.detections || [],
      names: data.names || {}
    };
  }

  const steps = config.steps || [];
  const currentStep = config.currentStep;

  const step = steps.find(s => s.id === currentStep);

  if (!step) {
    return {
      status: "unknown",
      detections: data.detections || [],
      names: data.names || {}
    };
  }

  // ================= EXTRACT DETECTED CLASSES =================

  const detectedClassNames = new Set(
    (data.detections || [])
      .filter(det => det.conf >= 0.3) //
      .map(det => data.names?.[det.cls] || det.name)
  );

  // ================= APPLY RULES =================

  let pass = true;

  if (step.required?.length) {
    for (const r of step.required) {
      if (!detectedClassNames.has(r)) {
        pass = false;
        break;
      }
    }
  }

  if (pass && step.forbidden?.length) {
    for (const f of step.forbidden) {
      if (detectedClassNames.has(f)) {
        pass = false;
        break;
      }
    }
  }

  // ================= FINAL RESULT =================

  const status = pass ? "PASS" : "FAIL";

  return {
    status,
    detections: data.detections || [],
    names: data.names || {}
  };
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
