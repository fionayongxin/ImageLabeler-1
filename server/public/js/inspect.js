/**
 * ======================================================
 * INSPECT.JS — FINAL STABLE (NO FEATURE REMOVED)
 * ======================================================
 */

const CAMERA_URL = "/api/camera/stream";
const STATUS_URL = "/api/inference/status";

/* ======================================================
   STATE
====================================================== */

let activeConfig = null;
let activeStepId = null;
let currentModelFile = null;
let configNames = [];

let pollingBusy = false;
let lastStatus = null;

/* ======================================================
   DOM
====================================================== */

const camImg = document.getElementById("liveCam");
const placeholder = document.getElementById("camPlaceholder");
const headerStatus = document.getElementById("headerStatus");
const cameraResult = document.getElementById("cameraResult");
const loginUserEl = document.getElementById("loginUser");
const configListEl = document.getElementById("configList");
const stepsListEl = document.getElementById("stepsList");
const classListEl = document.getElementById("classList");

const configNameInput = document.getElementById("configName");
const confidenceInput = document.getElementById("confidence");

const operatorConfigSelect = document.getElementById("operatorConfigSelect");
const operatorStepSelect = document.getElementById("operatorStepSelect");

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
    const res = await fetch("/api/me", {
      credentials: "include"
    });

    if (!res.ok) {
      throw new Error("Failed to get current user");
    }

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
    activeStepId = activeConfig.currentStep;

    renderAll();
    alert("No config found. Please upload model and save.");
  } else {
    await loadSingleConfig(configNames[0]);
  }

  startCamera();
}

init();

/* ======================================================
   LOAD CONFIG
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

  currentModelFile = null;
  fileNameLabel.textContent = "Loaded from config";
  modelStatus.textContent = "Config loaded";

  renderAll();
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
    };

    configListEl.appendChild(div);
  });

  if (activeConfig && !configNames.includes(activeConfig.name)) {
    const div = document.createElement("div");
    div.textContent = activeConfig.name + " (unsaved)";
    div.className = "active";
    configListEl.appendChild(div);
  }
}

/* ======================================================
   LOAD CONFIG NAMES
====================================================== */

async function loadConfigList() {
  const res = await fetch("/api/configs");
  const data = await res.json();

  configNames = data.configs || [];

  renderConfigList();

  operatorConfigSelect.innerHTML = "";
  configNames.forEach(name => {
    const opt = document.createElement("option");
    opt.textContent = name;
    operatorConfigSelect.appendChild(opt);
  });
}

/* ======================================================
   RENDER
====================================================== */

function renderAll() {
  if (!activeConfig) return;

  configNameInput.value = activeConfig.name;
  confidenceInput.value = activeConfig.confidence;

  renderConfigList();
  renderSteps();
  renderOperator();
  renderClasses();
}

/* ======================================================
   STEPS ✅ FULL FIX
====================================================== */

function renderSteps() {
  stepsListEl.innerHTML = "";

  if (!activeConfig?.steps) return;

  activeConfig.steps.forEach((step, i) => {
    const div = document.createElement("div");

    div.textContent = `Step ${i + 1}`;
    div.className = step.id === activeStepId ? "active" : "";

    div.onclick = () => {
      activeStepId = step.id;
      activeConfig.currentStep = step.id;
      renderAll();
    };

    stepsListEl.appendChild(div);
  });
}

function addStep() {
  
  if (!activeConfig.steps) {
    activeConfig.steps = [];
  }

  activeConfig.steps.push({
    id: Date.now().toString(),
    required: [],
    forbidden: []
  });

  const newStepIndex = activeConfig.steps.length - 1;

  activeStepId = activeConfig.steps[newStepIndex].id;
  activeConfig.currentStep = activeStepId; 

  renderAll();
}

function deleteStep() {
  
  if (!activeConfig.steps) {
    activeConfig.steps = [];
  }

  if (activeConfig.steps.length <= 1) return;

  activeConfig.steps =
    activeConfig.steps.filter(s => s.id !== activeStepId);

  const index = 0;

  activeStepId = activeConfig.steps[index].id;
  activeConfig.currentStep = activeStepId; 

  renderAll();
}

/* ======================================================
   OPERATOR STEP ✅ FIXED (INDEX)
====================================================== */

/* ======================================================
   OPERATOR STEP ✅ NO NAME MATCHING
====================================================== */

operatorStepSelect.onchange = () => {
  if (!activeConfig?.steps?.length) return;

  const index = operatorStepSelect.selectedIndex;

  if (index < 0 || index >= activeConfig.steps.length) return;

  const step = activeConfig.steps[index];

  activeStepId = step.id;
  activeConfig.currentStep = step.id;

  renderAll();
};

function renderOperator() {
  operatorStepSelect.innerHTML = "";

  activeConfig.steps.forEach((step, i) => {
    const opt = document.createElement("option");

    opt.textContent = `Step ${i + 1}`;

    if (step.id === activeConfig.currentStep) {
      opt.selected = true;
    }

    operatorStepSelect.appendChild(opt);
  });
}

/* ======================================================
   MODEL + CLASS
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
};

/* ======================================================
   CLASSES
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
   CONFIG CONTROL
====================================================== */

document.getElementById("addConfigBtn").onclick = () => {
  activeConfig = createDefaultConfig();
  activeStepId = activeConfig.currentStep;

  currentModelFile = null;
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
};

/* ======================================================
   SAVE
====================================================== */

async function saveConfig() {
  if (!currentModelFile) {
    alert("Model required");
    return;
  }

  const form = new FormData();
  form.append("config", JSON.stringify(activeConfig));
  form.append("model", currentModelFile);

  const res = await fetch("/api/configs/save", {
    method: "POST",
    body: form
  });

  if (!res.ok) {
    alert("Save failed");
    return;
  }

  await loadConfigList();
  await loadSingleConfig(activeConfig.name);
}

document.getElementById("saveConfigBtn").onclick = saveConfig;

/* ======================================================
   EVENTS ✅ FIX (CRITICAL)
====================================================== */

document.getElementById("addStepBtn").onclick = addStep;
document.getElementById("deleteStepBtn").onclick = deleteStep;

/* ======================================================
   CAMERA + STATUS ✅ RESTORED
====================================================== */

function startCamera() {
  if (camImg) camImg.src = CAMERA_URL;
}

async function pollStatus() {
  if (pollingBusy) return;
  pollingBusy = true;

  try {
    const res = await fetch(STATUS_URL);
    const data = await res.json();

    if (data.status !== lastStatus) {
      lastStatus = data.status;
      setStatus(data.status.toLowerCase(), data.status);
    }
  } catch {}

  pollingBusy = false;
}

function setStatus(status, text) {
  if (headerStatus) headerStatus.textContent = text;
  if (cameraResult) cameraResult.textContent = text;
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