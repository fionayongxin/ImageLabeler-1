/**
 * ======================================================
 * inference.service.js — LOCAL FILESYSTEM VERSION
 * ------------------------------------------------------
 * ✅ No server config
 * ✅ No FastAPI inference
 * ✅ Load config from local folder
 * ✅ Apply inspection rules
 * ✅ Placeholder for local detection runner
 * ======================================================
 */

const fs = require("fs");
const path = require("path");

/* ======================================================
   CONFIG ROOT
====================================================== */

const CONFIG_ROOT = path.join(__dirname, "..", "..", "config");

/* ======================================================
   CURRENT ACTIVE CONFIG (MEMORY POINTER)
====================================================== */

let activeConfigName = null;
let activeConfig = null;

/* ======================================================
   LOAD CONFIG FROM FILESYSTEM
====================================================== */

function loadConfig(configName) {
  try {
    const configPath = path.join(
      CONFIG_ROOT,
      configName,
      "config.json"
    );

    if (!fs.existsSync(configPath)) {
      console.warn("[CONFIG] Not found:", configPath);
      return null;
    }

    const raw = fs.readFileSync(configPath, "utf-8");
    const cfg = JSON.parse(raw);

    activeConfigName = configName;
    activeConfig = cfg;

    return cfg;

  } catch (err) {
    console.error("[LOAD CONFIG ERROR]", err);
    return null;
  }
}

/* ======================================================
   LIST AVAILABLE CONFIGS (FOLDERS)
====================================================== */

function listConfigs() {
  try {
    return fs.readdirSync(CONFIG_ROOT)
      .filter(name => {
        const full = path.join(CONFIG_ROOT, name);
        return fs.statSync(full).isDirectory();
      });

  } catch {
    return [];
  }
}

/* ======================================================
   LOCAL INFERENCE PLACEHOLDER
   ⚠ Replace with actual YOLO runner later
====================================================== */

async function runLocalDetection() {
  // TODO: integrate YOLO CLI / python / binding

  // Temporary fake detections
  return {
    detections: [],
    names: {}
  };
}

/* ======================================================
   MAIN INFERENCE PIPELINE
====================================================== */

async function runInference() {

  if (!activeConfig) {
    return {
      status: "UNKNOWN",
      reason: "No config loaded",
      detections: [],
      names: {}
    };
  }

  const {
    steps = [],
    currentStep,
    confidence = 0.5
  } = activeConfig;

  if (!steps.length) {
    return {
      status: "UNKNOWN",
      reason: "No steps defined",
      detections: [],
      names: {}
    };
  }

  // --------------------------------------------------
  // 1. RUN LOCAL DETECTION
  // --------------------------------------------------
  const inferData = await runLocalDetection();

  // --------------------------------------------------
  // 2. GET ACTIVE STEP
  // --------------------------------------------------
  const step =
    steps.find(s => s.id === currentStep) || steps[0];

  // --------------------------------------------------
  // 3. FILTER BY CONFIDENCE
  // --------------------------------------------------
  const filtered = (inferData.detections || []).filter(
    d => d.conf >= confidence
  );

  const detectedClasses = new Set(
    filtered.map(d => inferData.names?.[d.cls] || d.name)
  );

  // --------------------------------------------------
  // 4. APPLY RULES
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
  // 5. RETURN RESULT
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
   SET ACTIVE CONFIG
====================================================== */

function setActiveConfig(configName) {
  return loadConfig(configName);
}

/* ======================================================
   EXPORTS
====================================================== */

module.exports = {
  runInference,
  loadConfig,
  setActiveConfig,
  listConfigs
};