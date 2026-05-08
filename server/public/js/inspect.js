/**
 * ======================================================
 * INSPECT.JS — FINAL STABLE VERSION (CONFIG + STEPS FIXED)
 * ======================================================
 */


/* ======================================================
   CONSTANTS
====================================================== */

const CAMERA_URL = "/api/camera/stream";
const STATUS_URL = "/api/inference/status";


/* ======================================================
   DOM
====================================================== */

const camImg = document.getElementById("liveCam");
const placeholder = document.getElementById("camPlaceholder");
const headerStatus = document.getElementById("headerStatus");
const cameraResult = document.getElementById("cameraResult");

const configNameInput = document.getElementById("configName");

const canvas = document.getElementById("overlayCanvas");
const ctx = canvas.getContext("2d");

const tabOperator = document.getElementById("tabOperator");
const tabEngineer = document.getElementById("tabEngineer");

const operatorLayout = document.querySelector(".operator-layout");
const engineerLayout = document.querySelector(".engineer-layout");

const stepsListEl = document.getElementById("stepsList");
const stepNameInput = document.getElementById("stepName");
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

let classNames = {};   // class names from model

let configs = [];
let activeConfigId = null;
let activeStepId = null;


/* ======================================================
   HELPERS
====================================================== */

function getActiveConfig() {
  return configs.find(c => c.id === activeConfigId);
}

function getSteps() {
  const cfg = getActiveConfig();
  return cfg ? cfg.steps : [];
}

function getActiveStep() {
  return getSteps().find(s => s.id === activeStepId);
}


/* ======================================================
   STATUS
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
   POLLING
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

    if (data.names) classNames = data.names;

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
   DRAW
====================================================== */

function drawBoxes(detections = []) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  detections
    .filter(d => d.conf >= 0.3)
    .forEach(d => {
      const [x1, y1, x2, y2] = d.xyxy;
      ctx.strokeStyle = "#22c55e";
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    });
}


/* ======================================================
   CONFIG SYSTEM
====================================================== */

function createDefaultStep() {
  const id = Date.now() + Math.random();
  return {
    id,
    name: "Step 1",
    required: [],
    forbidden: []
  };
}

function addConfig() {
  const id = Date.now().toString();
  const firstStep = createDefaultStep();

  configs.push({
    id,
    name: `Config ${configs.length + 1}`,
    model: null,
    confidence: 0.5,
    steps: [firstStep]
  });

  activeConfigId = id;
  activeStepId = firstStep.id;

  renderConfigList();
  renderAll();
}

function deleteConfig() {
  const index = configs.findIndex(c => c.id === activeConfigId);
  if (index === -1) return;

  configs.splice(index, 1);

  if (configs.length === 0) {
    ensureDefaultConfig();
  } else {
    const cfg = configs[0];
    activeConfigId = cfg.id;
    activeStepId = cfg.steps[0]?.id || null;
  }

  renderConfigList();
  renderAll();
}

function selectConfig(id) {
  activeConfigId = id;

  const steps = getSteps();
  activeStepId = steps[0]?.id || null;

  renderConfigList();
  renderAll();
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


/* ======================================================
   STEPS
====================================================== */

function reindexSteps() {
  const steps = getSteps();
  steps.forEach((step, i) => step.name = `Step ${i + 1}`);
}

function addStep() {
  const cfg = getActiveConfig();
  if (!cfg) return;

  const id = Date.now();

  cfg.steps.push({
    id,
    name: "",
    required: [],
    forbidden: []
  });

  reindexSteps();
  activeStepId = id;

  renderAll();
}

function deleteStep() {
  const cfg = getActiveConfig();
  if (!cfg) return;

  const steps = cfg.steps;
  const index = steps.findIndex(s => s.id === activeStepId);
  if (index === -1) return;

  steps.splice(index, 1);

  if (steps.length === 0) {
    const newStep = createDefaultStep();
    steps.push(newStep);
    activeStepId = newStep.id;
  } else {
    activeStepId = steps[index]?.id || steps[index - 1]?.id;
  }

  reindexSteps();
  renderAll();
}

function selectStep(id) {
  activeStepId = id;
  renderAll();
}


/* ======================================================
   MODEL LOAD
====================================================== */

fileBtn.onclick = () => fileInput.click();

fileInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];

  if (!file) {
    fileName.textContent = "No file selected";
    return;
  }

  fileName.textContent = file.name;

  try {
    const form = new FormData();
    form.append("model", file);

    const res = await fetch("/api/inference/model/classes", {
      method: "POST",
      body: form
    });

    const data = await res.json();

    classNames = {};
    data.classes.forEach((c, i) => classNames[i] = c);

    renderAll();

  } catch {
    fileName.textContent = "Upload failed";
  }
});


/* ======================================================
   RENDER
====================================================== */

function renderAll() {
  renderConfigDetails();
  renderStepsList();
  renderStepEditor();
  renderClassList();
  renderCheckboxGroups();
}

function renderConfigDetails() {
  const cfg = getActiveConfig();
  if (!cfg) return;

  configNameInput.value = cfg.name;
}

function renderStepsList() {
  const steps = getSteps();
  stepsListEl.innerHTML = "";

  steps.forEach(step => {
    const div = document.createElement("div");

    div.textContent = step.name;
    div.className = step.id === activeStepId ? "active" : "";
    div.onclick = () => selectStep(step.id);

    stepsListEl.appendChild(div);
  });
}

function renderStepEditor() {
  const step = getActiveStep();
  if (!step) return;

  stepNameInput.value = step.name;
}

function renderClassList() {
  const el = document.getElementById("classList");
  el.innerHTML = "";

  Object.values(classNames).forEach(name => {
    const div = document.createElement("div");
    div.textContent = name;
    el.appendChild(div);
  });
}

function renderCheckboxGroups() {
  renderGroup(".steps-required", "required");
  renderGroup(".steps-forbidden", "forbidden");
}

function renderGroup(selector, type) {
  const container = document.querySelector(selector);
  const step = getActiveStep();

  if (!container) return;

  if (!step) {
    container.innerHTML = "<div style='opacity:0.5'>No step</div>";
    return;
  }

  container.innerHTML = "";

  Object.values(classNames).forEach(name => {
    const checked = step[type].includes(name) ? "checked" : "";

    const label = document.createElement("label");
    label.innerHTML = `
      <input type="checkbox" value="${name}" ${checked}>
      ${name}
    `;
    container.appendChild(label);
  });

  container.onchange = () => {
    step[type] = Array.from(container.querySelectorAll("input:checked"))
      .map(cb => cb.value);
  };
}


/* ======================================================
   SAVE
====================================================== */

async function saveConfig() {
  const cfg = getActiveConfig();
  if (!cfg) return alert("No config");

  await fetch("/api/inference/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cfg)
  });

  alert("Saved");
}


/* ======================================================
   EVENTS
====================================================== */

document.getElementById("addStepBtn").onclick = addStep;
document.getElementById("deleteStepBtn").onclick = deleteStep;
document.getElementById("addConfigBtn").onclick = addConfig;
document.getElementById("deleteConfigBtn").onclick = deleteConfig;
document.getElementById("saveConfigBtn").onclick = saveConfig;

configNameInput.addEventListener("input", e => {
  const cfg = getActiveConfig();
  if (cfg) cfg.name = e.target.value;
});


/* ======================================================
   MODE SWITCH
====================================================== */

tabOperator.onclick = () => {
  operatorLayout.classList.remove("hidden");
  engineerLayout.classList.add("hidden");
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
  if (configs.length === 0) {
    const id = Date.now().toString();
    const step = createDefaultStep();

    configs.push({
      id,
      name: "Config 1",
      model: null,
      confidence: 0.5,
      steps: [step]
    });

    activeConfigId = id;
    activeStepId = step.id;
  }
}

ensureDefaultConfig();
renderConfigList();
renderAll();
startCamera();