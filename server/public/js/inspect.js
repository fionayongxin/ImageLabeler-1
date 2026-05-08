/**
 * ======================================================
 * INSPECT.JS — FINAL CLEAN VERSION (STABLE)
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

const canvas = document.getElementById("overlayCanvas");
const ctx = canvas.getContext("2d");

const tabOperator = document.getElementById("tabOperator");
const tabEngineer = document.getElementById("tabEngineer");

const operatorLayout = document.querySelector(".operator-layout");
const engineerLayout = document.querySelector(".engineer-layout");

const stepsListEl = document.getElementById("stepsList");
const stepNameInput = document.getElementById("stepName");

document.getElementById("deleteStepBtn")?.addEventListener("click", deleteStep);

/* ======================================================
   STATE
====================================================== */

let polling = false;
let pollingBusy = false;
let pollingTimer = null;
let lastStatus = null;
let cameraReady = false;

let classNames = {};
let steps = [];
let activeStepId = null;


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

function reindexSteps() {
  steps.forEach((step, index) => {
    step.name = `Step ${index + 1}`;
  });
}

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

    if (data.names) {
      classNames = data.names;
    }

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
   MODEL LOAD
====================================================== */


/* ======================================================
   MODEL LOAD (UPLOAD + UI SYNC)
====================================================== */

document.getElementById("modelFile")?.addEventListener("change", async (e) => {
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
    data.classes.forEach((c, i) => {
      classNames[i] = c;
    });

    renderAll();

  } catch (err) {
    console.error("[MODEL LOAD ERROR]", err);
    fileName.textContent = "Upload failed";
  }
});

function deleteStep() {
  if (!steps.length) return;

  const index = steps.findIndex(s => s.id === activeStepId);
  if (index === -1) return;

  steps.splice(index, 1);

  reindexSteps();

  if (steps.length === 0) {
    activeStepId = null;
  } else {
    const nextIndex = Math.min(index, steps.length - 1);
    activeStepId = steps[nextIndex].id;
  }

  renderAll();
}

/* ======================================================
   STEP SYSTEM
====================================================== */

function getActiveStep() {
  return steps.find(s => s.id === activeStepId);
}

function selectStep(id) {
  activeStepId = id;
  renderAll();
}

function addStep() {
  const id = Date.now();

  steps.push({
    id,
    name: `Step ${steps.length + 1}`,
    required: [],
    forbidden: []
  });

  activeStepId = id;
  renderAll();
}


/* ======================================================
   RENDER PIPELINE
====================================================== */

function renderAll() {
  renderStepsList();
  renderStepEditor();
  renderClassList();
  renderCheckboxGroups();
}


/* ------------ Steps List ------------ */

function renderStepsList() {
  stepsListEl.innerHTML = "";

  steps.forEach(step => {
    const div = document.createElement("div");

    div.textContent = step.name;
    div.className = step.id === activeStepId ? "active" : "";

    div.onclick = () => selectStep(step.id);

    stepsListEl.appendChild(div);
  });
}


/* ------------ Step Editor ------------ */

function renderStepEditor() {
  const step = getActiveStep();
  if (!step) return;

  stepNameInput.value = step.name;
}


/* ------------ Classes (read-only) ------------ */

function renderClassList() {
  const el = document.getElementById("classList");
  if (!el) return;

  el.innerHTML = "";

  Object.values(classNames).forEach(name => {
    const div = document.createElement("div");
    div.textContent = name;
    el.appendChild(div);
  });
}


/* ------------ Checkbox Groups ------------ */

function renderCheckboxGroups() {
  renderGroup(".steps-required", "required");
  renderGroup(".steps-forbidden", "forbidden");
}

function renderGroup(selector, type) {
  const container = document.querySelector(selector);
  if (!container) return;

  const step = getActiveStep();
  const selected = step ? step[type] : [];

  container.innerHTML = "";

  Object.values(classNames).forEach(name => {
    const label = document.createElement("label");

    const checked = selected.includes(name) ? "checked" : "";

    label.innerHTML = `
      <input type="checkbox" value="${name}" ${checked}>
      ${name}
    `;

    container.appendChild(label);
  });

  container.onchange = () => {
    const step = getActiveStep();
    if (!step) return;

    step[type] = Array.from(
      container.querySelectorAll("input:checked")
    ).map(cb => cb.value);
  };
}


/* ======================================================
   SAVE
====================================================== */

async function saveConfig() {
  await fetch("/api/inference/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      steps,
      currentStep: activeStepId
    })
  });

  alert("Saved");
}


/* ======================================================
   EVENTS
====================================================== */

document.getElementById("addStepBtn")?.addEventListener("click", addStep);

stepNameInput?.addEventListener("input", (e) => {
  const step = getActiveStep();
  if (!step) return;

  step.name = e.target.value;
  renderStepsList();
});

document.getElementById("saveConfigBtn")?.addEventListener("click", saveConfig);
const fileInput = document.getElementById("modelFile");
const fileBtn = document.getElementById("fileBtn");
const fileName = document.getElementById("fileName");

fileBtn.onclick = () => {
  fileInput.click();  
};

/* ======================================================
   MODE SWITCH
====================================================== */

tabOperator.onclick = () => {
  operatorLayout.classList.remove("hidden");
  engineerLayout.classList.add("hidden");

  tabOperator.classList.add("active");
  tabEngineer.classList.remove("active");

  stopPolling();
  startCamera();
};

tabEngineer.onclick = () => {
  operatorLayout.classList.add("hidden");
  engineerLayout.classList.remove("hidden");

  tabEngineer.classList.add("active");
  tabOperator.classList.remove("active");

  stopPolling();
  stopCamera();
};

/* ======================================================
   INIT
====================================================== */

startCamera();
