/**
 * ======================================================
 * inference.service.js — FINAL CORRECT VERSION
 * ------------------------------------------------------
 * Responsibilities:
 * ✅ Orchestrate inference via FastAPI
 * ✅ Evaluate inspection rules (PASS / FAIL)
 * ✅ Proxy config read/write to FastAPI
 *
 * Design rules:
 * - NO local filesystem config IO
 * - FastAPI owns config persistence
 * - Node owns inspection logic
 * ======================================================
 */

const axios = require("axios");
const { TRAINING_SERVER_BASE } = require("../config/env");

/* ======================================================
   CONFIG PROXY (SERVER IS SOURCE OF TRUTH)
====================================================== */

async function readInspectionState() {
  const res = await axios.get(
    `${TRAINING_SERVER_BASE}/inspection/config`
  );
  return res.data;
}

async function updateInspectionConfig(config) {
  await axios.post(
    `${TRAINING_SERVER_BASE}/inspection/config`,
    config,
    { headers: { "Content-Type": "application/json" } }
  );
  return config;
}

async function setCurrentStep(stepId) {
  const state = await readInspectionState();
  if (!state) return null;

  state.currentStep = stepId;
  await updateInspectionConfig(state);
  return state;
}

/* ======================================================
   INFERENCE PIPELINE
====================================================== */

async function runInference() {
  // --------------------------------------------------
  // 1. CALL FASTAPI (DETECTION ONLY)
  // --------------------------------------------------
  const inferRes = await axios.get(`${TRAINING_SERVER_BASE}/infer`);
  const inferData = inferRes.data;

  // --------------------------------------------------
  // 2. LOAD CONFIG FROM SERVER
  // --------------------------------------------------
  let config;
  try {
    config = await readInspectionState();
  } catch {
    return {
      status: "UNKNOWN",
      detections: inferData.detections || [],
      names: inferData.names || {}
    };
  }

  const {
    steps = [],
    currentStep,
    confidence = 0.5
  } = config;

  if (!steps.length) {
    return {
      status: "UNKNOWN",
      detections: inferData.detections || [],
      names: inferData.names || {}
    };
  }

  // --------------------------------------------------
  // 3. DETERMINE ACTIVE STEP
  // --------------------------------------------------
  const step =
    steps.find(s => s.id === currentStep) || steps[0];

  // --------------------------------------------------
  // 4. FILTER DETECTIONS BY CONFIDENCE
  // --------------------------------------------------
  const filtered = (inferData.detections || []).filter(
    d => d.conf >= confidence
  );

  const detectedClasses = new Set(
    filtered.map(d => inferData.names?.[d.cls] || d.name)
  );

  // --------------------------------------------------
  // 5. APPLY RULES
  // --------------------------------------------------
  let pass = true;
  let reason = "";

  for (const r of step.required || []) {
    if (!detectedClasses.has(r)) {
      pass = false;
      reason = `Missing required: ${r}`;
      break;
    }
  }

  if (pass) {
    for (const f of step.forbidden || []) {
      if (detectedClasses.has(f)) {
        pass = false;
        reason = `Forbidden detected: ${f}`;
        break;
      }
    }
  }

  // --------------------------------------------------
  // 6. RETURN RESULT
  // --------------------------------------------------
  return {
    status: pass ? "PASS" : "FAIL",
    reason,
    detections: filtered,
    names: inferData.names || {},
    currentStep: step.id
  };
}

/* ======================================================
   EXPORTS
====================================================== */

module.exports = {
  runInference,
  readInspectionState,
  updateInspectionConfig,
  setCurrentStep
};