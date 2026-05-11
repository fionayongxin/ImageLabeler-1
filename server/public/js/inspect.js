/**
 * ======================================================
 * INSPECT.JS — FINAL STABLE VERSION
 * ------------------------------------------------------
 * ✅ Configs auto-indexed
 * ✅ Steps auto-indexed
 * ✅ Model isolated per config
 * ✅ Confidence threshold (0–1) with validation
 * ✅ No global leakage
 * ✅ Always at least 1 config + 1 step
 * ======================================================
 */

/* ======================================================
   CONSTANTS
====================================================== */

const CAMERA_URL = "/api/camera/stream";
const STATUS_URL = "/api/inference/status";

/* ======================================================
   DOM REFERENCES
====================================================== */

const camImg = document.getElementById("liveCam");
const placeholder = document.getElementById("camPlaceholder");
const headerStatus = document.getElementById("headerStatus");
const cameraResult = document.getElementById("cameraResult");

const configNameInput = document.getElementById("configName");
const stepNameInput = document.getElementById("stepName");
const confidenceInput = document.getElementById("confidence");

const canvas = document.getElementById("overlayCanvas");
const ctx = canvas.getContext("2d");

const tabOperator = document.getElementById("tabOperator");
const tabEngineer = document.getElementById("tabEngineer");

const operatorLayout = document.querySelector(".operator-layout");
const engineerLayout = document.querySelector(".engineer-layout");

const stepsListEl = document.getElementById("stepsList");
const configListEl = document.getElementById("configList");

const fileInput = document.getElementById("modelFile");
const fileBtn = document.getElementById("fileBtn");
const fileName = document.getElementById("fileName");

/* ======================================================
   STATE
====================================================== */

let polling = false;
let pollingBusy = false;
let pollingTimer = null;
let lastStatus = null;

let configs = [];
let activeConfigId = null;
let activeStepId = null;

/* ======================================================
   STATE HELPERS
====================================================== */

const getActiveConfig = () =>
  configs.find(c => c.id === activeConfigId);

const getSteps = () =>
  getActiveConfig()?.steps ?? [];

const getActiveStep = () =>
  getSteps().find(s => s.id === activeStepId);

/* ======================================================
   STATUS UI
====================================================== */

function setStatus(status, text) {
  headerStatus.textContent = text;
  cameraResult.textContent = text;
  headerStatus.className = `status-pill status-${status}`;
  cameraResult.className = `result-overlay status-${status}`;
}

/* ======================================================
   CAMERA
====================================================== */

function resizeCanvas() {
  canvas.width = camImg.clientWidth;
  canvas.height = camImg.clientHeight;
}

window.addEventListener("resize", resizeCanvas);

function startCamera() {
  camImg.src = CAMERA_URL;
}

function stopCamera() {
  camImg.src = "";
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  placeholder.style.display = "flex";
}

camImg.onload = () => {
  resizeCanvas();
  placeholder.style.display = "none";
  lastStatus = null;
  setStatus("unknown", "WAITING");
  startPolling();
};

/* ======================================================
   POLLING (OPERATOR MODE)
====================================================== */

function startPolling() {
  if (polling) return;
  polling = true;
  pollingTimer = setInterval(pollInspectionStatus, 1000);
}

function stopPolling() {
  polling = false;
  clearInterval(pollingTimer);
}

async function pollInspectionStatus() {
  if (!polling || pollingBusy) return;
  pollingBusy = true;

  try {
    const res = await fetch(STATUS_URL);
    const data = await res.json();

    drawBoxes(data.detections);

    if (data.status !== lastStatus) {
      lastStatus = data.status;
      setStatus(data.status.toLowerCase(), data.status);
    }

  } catch {
    setStatus("unknown", "DISCONNECTED");
  }

  pollingBusy = false;
}

/* ======================================================
   DRAWING
====================================================== */

function drawBoxes(detections = []) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  detections
    .filter(d => d.conf >= 0.3) // draw-only threshold
    .forEach(d => {
      const [x1, y1, x2, y2] = d.xyxy;
      ctx.strokeStyle = "#22c55e";
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    });
}

/* ======================================================
   CONFIG + STEP MANAGEMENT
====================================================== */

function createDefaultStep() {
  return {
    id: Date.now() + Math.random(),
    name: "Step 1",
    required: [],
    forbidden: []
  };
}

function reindexConfigs() {
  configs.forEach((cfg, i) => {
    cfg.name = `Config ${i + 1}`;
  });
}

function reindexSteps() {
  getSteps().forEach((step, i) => {
    step.name = `Step ${i + 1}`;
  });
}

function addConfig() {
  const id = Date.now().toString();
  const step = createDefaultStep();

  configs.push({
    id,
    name: "",
    model: null,
    confidence: 0.5,     // ✅ normalized default
    steps: [step]
  });

  reindexConfigs();
  activeConfigId = id;
  activeStepId = step.id;
  renderAll();
}

function deleteConfig() {
  configs = configs.filter(c => c.id !== activeConfigId);

  if (configs.length === 0) ensureDefaultConfig();

  reindexConfigs();
  activeConfigId = configs[0].id;
  activeStepId = configs[0].steps[0].id;
  renderAll();
}

function selectConfig(id) {
  activeConfigId = id;
  activeStepId = getSteps()[0]?.id ?? null;
  renderAll();
}

function addStep() {
  const cfg = getActiveConfig();
  if (!cfg) return;

  const id = Date.now();
  cfg.steps.push({ id, name: "", required: [], forbidden: [] });

  reindexSteps();
  activeStepId = id;
  renderAll();
}

function deleteStep() {
  const cfg = getActiveConfig();
  if (!cfg) return;

  cfg.steps = cfg.steps.filter(s => s.id !== activeStepId);

  if (cfg.steps.length === 0) {
    cfg.steps.push(createDefaultStep());
  }

  reindexSteps();
  activeStepId = cfg.steps[0].id;
  renderAll();
}

/* ======================================================
   MODEL LOAD (PER CONFIG)
====================================================== */

fileBtn.onclick = () => fileInput.click();

fileInput.addEventListener("change", async e => {
  const cfg = getActiveConfig();
  const file = e.target.files[0];
  if (!cfg || !file) return;

  fileName.textContent = file.name;

  const form = new FormData();
  form.append("model", file);

  const res = await fetch("/api/inference/model/classes", {
    method: "POST",
    body: form
  });

  const data = await res.json();

  cfg.model = {
    filename: file.name,
    classes: data.classes
  };

  renderAll();
});

/* ======================================================
   CONFIDENCE THRESHOLD (0–1)
====================================================== */

confidenceInput.addEventListener("input", e => {
  const cfg = getActiveConfig();
  if (!cfg) return;

  const value = parseFloat(e.target.value);

  if (isNaN(value) || value < 0 || value > 1) {
    confidenceInput.classList.add("invalid");
    return;
  }

  confidenceInput.classList.remove("invalid");
  cfg.confidence = value;
});

/* ======================================================
   RENDER PIPELINE
====================================================== */

function renderAll() {
  renderConfigList();
  renderConfigDetails();
  renderStepsList();
  renderStepEditor();
  renderClassList();
  renderCheckboxGroups();
}

function renderConfigList() {
  configListEl.innerHTML = "";

  configs.forEach(cfg => {
    const div = document.createElement("div");
    div.textContent = cfg.name;
    div.className = cfg.id === activeConfigId ? "active" : "";
    div.onclick = () => selectConfig(cfg.id);
    configListEl.appendChild(div);
  });
}

function renderConfigDetails() {
  const cfg = getActiveConfig();
  if (!cfg) return;

  configNameInput.value = cfg.name;
  fileName.textContent = cfg.model?.filename ?? "No file selected";

  confidenceInput.value = cfg.confidence.toFixed(2);
  confidenceInput.classList.remove("invalid");
}

function renderStepsList() {
  stepsListEl.innerHTML = "";

  getSteps().forEach(step => {
    const div = document.createElement("div");
    div.textContent = step.name;
    div.className = step.id === activeStepId ? "active" : "";
    div.onclick = () => {
      activeStepId = step.id;
      renderAll();
    };
    stepsListEl.appendChild(div);
  });
}

function renderStepEditor() {
  const step = getActiveStep();
  if (step) stepNameInput.value = step.name;
}

function renderClassList() {
  const cfg = getActiveConfig();
  const el = document.getElementById("classList");
  el.innerHTML = "";

  cfg?.model?.classes?.forEach(cls => {
    const div = document.createElement("div");
    div.textContent = cls;
    el.appendChild(div);
  });
}

function renderCheckboxGroups() {
  renderGroup(".steps-required", "required");
  renderGroup(".steps-forbidden", "forbidden");
}

function renderGroup(selector, type) {
  const cfg = getActiveConfig();
  const step = getActiveStep();
  const box = document.querySelector(selector);
  box.innerHTML = "";

  if (!cfg?.model || !step) {
    box.innerHTML = "<div style='opacity:.5'>No model</div>";
    return;
  }

  cfg.model.classes.forEach(cls => {
    const checked = step[type].includes(cls);
    const label = document.createElement("label");

    label.innerHTML = `<input type="checkbox" ${checked ? "checked" : ""}> ${cls}`;

    label.querySelector("input").onchange = e => {
      step[type] = e.target.checked
        ? [...step[type], cls]
        : step[type].filter(x => x !== cls);
    };

    box.appendChild(label);
  });
}

/* ======================================================
   SAVE (SERVER-SIDE)
====================================================== */

async function saveConfig() {
  const cfg = getActiveConfig();

  if (!cfg) {
    alert("No config");
    return;
  }

  if (confidenceInput.classList.contains("invalid")) {
    alert("Confidence must be between 0 and 1");
    return;
  }

  await fetch("/api/inference/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cfg)
  });

  alert("Saved");
}

/* ======================================================
   EVENT BINDINGS
====================================================== */

document.getElementById("addConfigBtn").onclick = addConfig;
document.getElementById("deleteConfigBtn").onclick = deleteConfig;
document.getElementById("addStepBtn").onclick = addStep;
document.getElementById("deleteStepBtn").onclick = deleteStep;
document.getElementById("saveConfigBtn").onclick = saveConfig;

configNameInput.oninput = e => {
  const cfg = getActiveConfig();
  if (cfg) cfg.name = e.target.value;
};

/* ======================================================
   MODE SWITCH
====================================================== */

tabOperator.onclick = () => {
  engineerLayout.classList.add("hidden");
  operatorLayout.classList.remove("hidden");
  stopPolling();
  startCamera();
};

tabEngineer.onclick = () => {
  operatorLayout.classList.add("hidden");
  engineerLayout.classList.remove("hidden");
  stopPolling();
  stopCamera();
};

/* ======================================================
   INIT
====================================================== */

function ensureDefaultConfig() {
  if (configs.length === 0) addConfig();
}

ensureDefaultConfig();
renderAll();
startCamera();