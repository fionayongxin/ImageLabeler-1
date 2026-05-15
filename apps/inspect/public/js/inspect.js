/**
 * ======================================================
 * INSPECT.JS
 * ======================================================
 * - All logic preserved
 * - Only structure + readability improved
 * - Safe for production
 */

const CAMERA_URL = "/api/camera/stream";
const STATUS_URL = "/api/inference/status";

/* ======================================================
   STATE
====================================================== */

let activeConfig = null;
let activeStepId = null;
let currentModelFile = null;
let currentconfigName = null;
let configNames = [];

let pollingBusy = false;
let lastStatus = null;

/* ======================================================
   DOM REFERENCES
====================================================== */

const camImg = document.getElementById("liveCam");
const placeholder = document.getElementById("camPlaceholder");
const headerStatus = document.getElementById("headerStatus");
const cameraResult = document.getElementById("cameraResult");
const loginUserEl = document.getElementById("loginUser");

const configListEl = document.getElementById("configList");
const stepsListEl = document.getElementById("stepsList");
const classListEl = document.getElementById("classList");

const requiredBox = document.querySelector(".steps-required");
const forbiddenBox = document.querySelector(".steps-forbidden");

const configNameInput = document.getElementById("configName");
const confidenceInput = document.getElementById("confidence");

const operatorConfigSelect = document.getElementById("operatorConfigSelect");

const modelFileInput = document.getElementById("modelFile");
const fileBtn = document.getElementById("fileBtn");
const fileNameLabel = document.getElementById("fileName");
const modelStatus = document.getElementById("modelStatus");

const tabOperator = document.getElementById("tabOperator");
const tabEngineer = document.getElementById("tabEngineer");

const operatorLayout = document.querySelector(".operator-layout");
const engineerLayout = document.querySelector(".engineer-layout");

/* ======================================================
   CONFIG FACTORY
====================================================== */

function createDefaultConfig() {
  const id = Date.now().toString();

  return {
    id: `cfg_${id}`,
    name: `Config_${id}`,
    confidence: 0.5,
    currentStep: id,
    steps: [{ id, required: [], forbidden: [] }],
    classes: []
  };
}

/* ======================================================
   INIT
====================================================== */

async function loadCurrentUser() {
  try {
    const res = await fetch("/api/me", { credentials: "include" });
    if (!res.ok) throw new Error("Failed to get current user");

    const data = await res.json();

    const fullName = data.fullName || "";
    const userId = data.userId || "Unknown";

    if (loginUserEl) {
      loginUserEl.textContent = `Logged User : ${fullName || userId}`;
      loginUserEl.title = userId;
    }

  } catch (err) {
    console.error("Failed to load current user:", err);

    if (loginUserEl) {
      loginUserEl.textContent = "Logged User : Unknown";
      loginUserEl.title = "";
    }
  }
}

async function init() {
  await loadCurrentUser();
  await loadConfigList();

  if (configNames.length === 0) {
    activeConfig = createDefaultConfig();
    currentconfigName = null;
    activeStepId = activeConfig.currentStep;
    renderAll();
    alert("No config found. Please upload model and save.");
  } else {
    loadSingleConfig(configNames[0]);
    syncInspectionState();
  }

  startCamera();
}

init();

/* ======================================================
   CONFIG LOADING
====================================================== */

async function loadSingleConfig(name) {
  const res = await fetch("/api/configs/select", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name })
  });

  if (!res.ok) return;

  const data = await res.json();
  if (!data.config) return;

  activeConfig = data.config;
  activeStepId = activeConfig.currentStep;
  currentconfigName = activeConfig.name;
  currentModelFile = null;

  if (!data.modelFile) {
    modelStatus.textContent = "No model (upload required)";
    fileNameLabel.textContent = "No file";
  } else {
    modelStatus.textContent = "Model attached";
    fileNameLabel.textContent = data.modelFile;
  }

  configNameInput.value = activeConfig.name;
  confidenceInput.value = activeConfig.confidence;

  renderSteps();
  renderClasses();
  renderStepClassCheckboxes();
  renderOperatorStepInfo();
  renderConfigList();
}

/* ======================================================
   CONFIG LIST
====================================================== */

function renderConfigList() {
  configListEl.innerHTML = "";

  configNames.forEach(name => {
    const div = document.createElement("div");
    div.textContent = name;
    div.className = activeConfig?.name === name ? "active" : "";

    div.onclick = async () => {
      await loadSingleConfig(name);
      syncInspectionState();
    };

    configListEl.appendChild(div);
  });

  // Show unsaved config
  if (activeConfig && !configNames.includes(activeConfig.name)) {
    const div = document.createElement("div");
    div.textContent = activeConfig.name + " (unsaved)";
    div.className = "active";
    configListEl.appendChild(div);
  }
}

async function loadConfigList() {
  const res = await fetch("/api/configs");
  const data = await res.json();

  configNames = data.configs || [];

  renderConfigList();

  // Update dropdown
  operatorConfigSelect.innerHTML = "";
  configNames.forEach(name => {
    const opt = document.createElement("option");
    opt.textContent = name;
    operatorConfigSelect.appendChild(opt);
  });
}

operatorConfigSelect.onchange = async () => {
  const name = operatorConfigSelect.value;
  if (!name) return;
  loadSingleConfig(name);   
  syncInspectionState();      
};

/* ======================================================
   RENDERING (MAIN ENTRY)
====================================================== */

function renderAll() {
  if (!activeConfig) return;

  configNameInput.value = activeConfig.name;
  confidenceInput.value = activeConfig.confidence;

  renderConfigList();
  renderSteps();
  renderClasses();
  renderStepClassCheckboxes();
  renderOperatorStepInfo();
}

/* ======================================================
   OPERATOR DISPLAY
====================================================== */

function renderOperatorStepInfo() {
  if (!activeConfig?.steps) return;

  const step = activeConfig.steps.find(s => s.id === activeConfig.currentStep);
  if (!step) return;

  const stepIndex = activeConfig.steps.findIndex(s => s.id === step.id);

  const stepDisplay = document.getElementById("currentStepDisplay");
  if (stepDisplay) stepDisplay.textContent = `Step ${stepIndex + 1}`;

  const reqEl = document.getElementById("requiredDisplay");
  if (reqEl) {
    reqEl.innerHTML = "";

    if (step.required?.length) {
      step.required.forEach(c => {
        const span = document.createElement("span");
        span.className = "tag";
        span.textContent = c;
        reqEl.appendChild(span);
      });
    } else {
      reqEl.textContent = "None";
    }
  }

  const forbEl = document.getElementById("forbiddenDisplay");
  if (forbEl) {
    forbEl.innerHTML = "";

    if (step.forbidden?.length) {
      step.forbidden.forEach(c => {
        const span = document.createElement("span");
        span.className = "tag forbidden";
        span.textContent = c;
        forbEl.appendChild(span);
      });
    } else {
      forbEl.textContent = "None";
    }
  }
}

/* ======================================================
   STEP CLASS CHECKBOXES
====================================================== */

function renderStepClassCheckboxes() {
  if (!activeConfig?.steps || !activeConfig?.classes) return;

  const stepIndex = activeConfig.steps.findIndex(s => s.id === activeStepId);
  if (stepIndex === -1) return;

  const step = activeConfig.steps[stepIndex];

  step.required = step.required || [];
  step.forbidden = step.forbidden || [];

  requiredBox.innerHTML = "";
  forbiddenBox.innerHTML = "";

  activeConfig.classes.forEach(cls => {

    // Required
    const reqLabel = document.createElement("label");
    const reqCb = document.createElement("input");

    reqCb.type = "checkbox";
    reqCb.checked = step.required.includes(cls);

    reqCb.onchange = () => {
      if (reqCb.checked) {
        step.required = Array.from(new Set([...step.required, cls]));
        step.forbidden = step.forbidden.filter(c => c !== cls);
      } else {
        step.required = step.required.filter(c => c !== cls);
      }
      enforceStepHasClass(stepIndex);
    };

    reqLabel.appendChild(reqCb);
    reqLabel.append(" " + cls);
    requiredBox.appendChild(reqLabel);

    // Forbidden
    const forbLabel = document.createElement("label");
    const forbCb = document.createElement("input");

    forbCb.type = "checkbox";
    forbCb.checked = step.forbidden.includes(cls);

    forbCb.onchange = () => {
      if (forbCb.checked) {
        step.forbidden = Array.from(new Set([...step.forbidden, cls]));
        step.required = step.required.filter(c => c !== cls);
      } else {
        step.forbidden = step.forbidden.filter(c => c !== cls);
      }
      enforceStepHasClass(stepIndex);
    };

    forbLabel.appendChild(forbCb);
    forbLabel.append(" " + cls);
    forbiddenBox.appendChild(forbLabel);
  });
}

/* ======================================================
   STEP VALIDATION
====================================================== */

function enforceStepHasClass(stepIndex) {
  const step = activeConfig.steps[stepIndex];
  if (!step) return;

  const hasAny = step.required.length > 0 || step.forbidden.length > 0;

  if (!hasAny) {
    activeConfig.steps.splice(stepIndex, 1);

    if (activeConfig.steps.length === 0) {
      const id = Date.now().toString();
      activeConfig.steps.push({ id, required: [], forbidden: [] });
      activeStepId = id;
      activeConfig.currentStep = id;
    } else {
      activeStepId = activeConfig.steps[0].id;
      activeConfig.currentStep = activeStepId;
    }
  }

  renderAll();
}

/* ======================================================
   STEPS
====================================================== */

function renderSteps() {
  stepsListEl.innerHTML = "";
  if (!activeConfig?.steps) return;

  activeConfig.steps.forEach((step, i) => {
    const div = document.createElement("div");

    div.textContent = `Step ${i + 1}`;
    div.className = step.id === activeStepId ? "active" : "";

    div.onclick = async () => {
      activeStepId = step.id;
      activeConfig.currentStep = step.id;

      syncInspectionState();
      renderAll();
    };

    stepsListEl.appendChild(div);
  });
}

function addStep() {
  if (!activeConfig.steps) activeConfig.steps = [];

  const id = Date.now().toString();
  activeConfig.steps.push({ id, required: [], forbidden: [] });

  activeStepId = id;
  activeConfig.currentStep = id;

  renderAll();
}

function deleteStep() {
  if (!activeConfig.steps || activeConfig.steps.length <= 1) return;

  activeConfig.steps = activeConfig.steps.filter(s => s.id !== activeStepId);

  activeStepId = activeConfig.steps[0].id;
  activeConfig.currentStep = activeStepId;

  renderAll();
}

/* ======================================================
   MODEL + CLASS LOADING
====================================================== */

fileBtn.onclick = () => modelFileInput.click();

modelFileInput.onchange = async e => {
  const file = e.target.files[0];

  if (!file || !file.name.endsWith(".pt")) {
    alert("Only .pt allowed");
    return;
  }

  currentModelFile = file;
  fileNameLabel.textContent = file.name;
  modelStatus.textContent = "Extracting classes...";

  const form = new FormData();
  form.append("model", file);

  const res = await fetch("/api/inference/model/classes", {
    method: "POST",
    body: form
  });

  if (!res.ok) {
    modelStatus.textContent = "Failed";
    return;
  }

  const data = await res.json();
  activeConfig.classes = data.classes || [];

  modelStatus.textContent = "Model loaded";

  renderClasses();
  renderStepClassCheckboxes();
};

configNameInput.oninput = () => {
  if (!activeConfig) return;

  const name = configNameInput.value.trim();

  if (!name) return; // prevent empty name

  activeConfig.name = name;
};

confidenceInput.oninput = () => {
  if (!activeConfig) return;
  activeConfig.confidence = parseFloat(confidenceInput.value) || 0;
};

/* ======================================================
   CLASSES VIEW
====================================================== */

function renderClasses() {
  classListEl.innerHTML = "";

  (activeConfig.classes || []).forEach(c => {
    const div = document.createElement("div");
    div.textContent = c;
    classListEl.appendChild(div);
  });
}

/* ======================================================
   CONFIG ACTIONS
====================================================== */

document.getElementById("addConfigBtn").onclick = () => {
  activeConfig = createDefaultConfig();
  activeStepId = activeConfig.currentStep;
  currentModelFile = null;
  currentconfigName = null;

  modelStatus.textContent = "No model (upload required)";
  fileNameLabel.textContent = "No file";

  renderAll();
};

document.getElementById("deleteConfigBtn").onclick = async () => {
  if (configNames.length <= 1) {
    alert("Cannot delete last config");
    return;
  }

  await fetch("/api/configs/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: activeConfig.name })
  });

  await loadConfigList();
  await loadSingleConfig(configNames[0]);
  await updateModelStatus(activeConfig.name);
  syncInspectionState();
};

/* ======================================================
   SAVE CONFIG
====================================================== */

async function saveConfig() {
  let modelExists = false;

  const checkName =
    currentconfigName && currentconfigName !== activeConfig.name
      ? currentconfigName
      : activeConfig.name;

  if (checkName) {
    try {
      const res = await fetch(
        `/api/configs/model-exists?name=${encodeURIComponent(checkName)}`
      );
      const data = await res.json();
      modelExists = data.exists;
    } catch {}
  }

  if (!currentModelFile && !modelExists) {
    alert("Model required (no existing model found)");
    return;
  }

  if (
    currentconfigName !== activeConfig.name &&
    configNames.includes(activeConfig.name)
  ) {
    alert("Config name already exists");
    return;
  }

  const form = new FormData();
  form.append("config", JSON.stringify(activeConfig));

  if (currentModelFile) {
    form.append("model", currentModelFile);
  }

  const isRename =
    currentconfigName &&
    currentconfigName !== activeConfig.name &&
    configNames.includes(currentconfigName);

  if (isRename) {
    form.append("oldName", currentconfigName);
  }

  const res = await fetch("/api/configs/save", {
    method: "POST",
    body: form
  });

  if (!res.ok) {
    alert("Save failed");
    return;
  }

  currentconfigName = activeConfig.name;

  await fetch("/api/inference/reload", { method: "POST" });

  await loadConfigList();
  await loadSingleConfig(activeConfig.name);

  await updateModelStatus(activeConfig.name);

  syncInspectionState();
}

async function syncInspectionState() {
  if (!activeConfig) return;

  try {
    const payload = {
      configName: activeConfig.name,
      confidence: activeConfig.confidence,
      currentStep: activeConfig.currentStep,
      steps: activeConfig.steps
    };

    await fetch("/api/inference/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

  } catch (err) {
    console.error("Failed to sync inspection state", err);
  }
}

async function updateModelStatus(name) {
  try {
    const res = await fetch(
      `/api/configs/model-file?name=${encodeURIComponent(name)}`
    );

    const data = await res.json();

    if (!data.file) {
      modelStatus.textContent = "No model (upload required)";
      fileNameLabel.textContent = "No file";
      return;
    }

    modelStatus.textContent = "Model attached";
    fileNameLabel.textContent = data.file;

  } catch {
    modelStatus.textContent = "Unknown";
    fileNameLabel.textContent = "-";
  }
}

document.getElementById("saveConfigBtn").onclick = saveConfig;

/* ======================================================
   EVENTS
====================================================== */

document.getElementById("addStepBtn").onclick = addStep;
document.getElementById("deleteStepBtn").onclick = deleteStep;

/* ======================================================
   CAMERA + STATUS
====================================================== */

function drawBoxes(detections) {
  if (!camImg) return;

  const canvas = document.getElementById("overlay");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  canvas.width = camImg.clientWidth;
  canvas.height = camImg.clientHeight;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  detections.forEach(det => {
    const scaleX = canvas.width / 1280;
    const scaleY = canvas.height / 1024;

    const [x1, y1, x2, y2] = det.xyxy;

    const sx1 = x1 * scaleX;
    const sy1 = y1 * scaleY;
    const sx2 = x2 * scaleX;
    const sy2 = y2 * scaleY;

    ctx.strokeStyle = "lime";
    ctx.lineWidth = 2;

    ctx.strokeRect(sx1, sy1, sx2 - sx1, sy2 - sy1);
    ctx.fillStyle = "lime";
    ctx.fillText(det.name, sx1, sy1 - 5);
  });
}

function startCamera() {
  if (camImg) camImg.src = CAMERA_URL;
}

async function pollStatus() {
  if (pollingBusy) return;
  pollingBusy = true;

  try {
    const res = await fetch(STATUS_URL);
    const data = await res.json();

    drawBoxes(data.detections || []);

    if (data.status !== lastStatus) {
      lastStatus = data.status;
      setStatus(data.status.toLowerCase(), data.status);
    }

    if (data.currentStep && activeConfig) {
      activeConfig.currentStep = data.currentStep;
      activeStepId = data.currentStep;
      renderOperatorStepInfo();
    }
    
  } catch {}

  pollingBusy = false;
}

function setStatus(status, text) {
  if (headerStatus) headerStatus.textContent = text;
  if (cameraResult) cameraResult.textContent = text;

  const bigStatus = document.getElementById("bigStatus");
  if (bigStatus) {
    bigStatus.className = `big-status status-${status}`;
    bigStatus.textContent = text;
  }
}

if (camImg) {
  camImg.onload = () => {
    if (placeholder) placeholder.style.display = "none";
    setInterval(pollStatus, 1000);
  };
}

/* ======================================================
   MODE SWITCH
====================================================== */

function setMode(mode) {
  if (mode === "operator") {
    engineerLayout.classList.add("hidden");
    operatorLayout.classList.remove("hidden");

    tabOperator.classList.add("active");
    tabEngineer.classList.remove("active");
  } else {
    operatorLayout.classList.add("hidden");
    engineerLayout.classList.remove("hidden");

    tabEngineer.classList.add("active");
    tabOperator.classList.remove("active");
  }
}

tabOperator.onclick = () => setMode("operator");
tabEngineer.onclick = () => setMode("engineer");