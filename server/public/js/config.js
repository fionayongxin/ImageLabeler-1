// ================= GLOBAL STATE =================
let steps = [];
let activeStepId = null;

// All available classes (later load from DB)
const ALL_CLASSES = [
  "T_2_label",
  "T_Body",
  "T_Bushing",
  "T_Hole_Plug",
  "T_Inner_opening"
];

// ================= INIT =================
init();

function init() {
  loadFromStorage();

  if (steps.length === 0) {
    addStep(); // only create Step 1 if nothing saved
  }

  renderSteps();
  renderClassCheckboxes();
  selectStep(activeStepId);
}

// ================= STEP MANAGEMENT =================

function addStep() {
  const id = Date.now();
  const stepNo = getNextStepNumber();

  steps.push({
    id,
    name: `Step ${stepNo}`,
    required: [],
    forbidden: []
  });

  activeStepId = id;
  renderSteps();
}
function getNextStepNumber() {
  const nums = steps
    .map(s => parseInt(s.name.replace("Step ", ""), 10))
    .filter(n => !isNaN(n));

  return nums.length ? Math.max(...nums) + 1 : 1;
}

function deleteCurrentStep() {
  if (steps.length <= 1) {
    alert("At least one step is required.");
    return;
  }

  if (!confirm("Delete this step? This cannot be undone.")) return;

  const idx = steps.findIndex(s => s.id === activeStepId);
  if (idx === -1) return;

  steps.splice(idx, 1);

  const nextStep = steps[idx - 1] || steps[idx] || steps[0];
  activeStepId = nextStep.id;

  renderSteps();
  loadStepData();
}
function loadFromStorage() {
  const saved = localStorage.getItem("inspectionSteps");

  if (saved) {
    steps = JSON.parse(saved);
    activeStepId = steps[0]?.id || null;
    const nums = steps
      .map(s => parseInt(s.name.replace("Step ", ""), 10))
      .filter(n => !isNaN(n));

    stepCounter = nums.length ? Math.max(...nums) + 1 : 1;
  }
}


function selectStep(id) {
  activeStepId = id;
  renderSteps();
  loadStepData();
}

function getActiveStep() {
  return steps.find(s => s.id === activeStepId);
}

// ================= RENDER STEP TABS =================

function renderSteps() {
  const tabs = document.getElementById("stepTabs");
  tabs.innerHTML = "";

  steps.forEach(step => {
    const div = document.createElement("div");
    div.className = "step-tab" + (step.id === activeStepId ? " active" : "");
    div.innerText = step.name;
    div.onclick = () => selectStep(step.id);
    tabs.appendChild(div);
  });

  const add = document.createElement("div");
  add.className = "step-tab add";
  add.innerText = "+";
  add.onclick = () => {
    addStep();
    renderSteps();
  };
  tabs.appendChild(add);
}

// ================= CLASS CHECKBOXES =================

function renderClassCheckboxes() {
  renderCheckboxGroup("required", "required-checkbox");
  renderCheckboxGroup("forbidden", "forbidden-checkbox");
}

function renderCheckboxGroup(type, className) {
  const container = document.querySelector(
    type === "required" ? ".class-box" : ".class-box.error"
  );
  container.innerHTML = "";

  ALL_CLASSES.forEach(cls => {
    const label = document.createElement("label");
    label.innerHTML = `
      <input type="checkbox" class="${className}" value="${cls}">
      ${cls}
    `;
    container.appendChild(label);
  });

  container.addEventListener("change", onCheckboxChange);
}

function onCheckboxChange() {
  const step = getActiveStep();
  if (!step) return;

  step.required = Array.from(
    document.querySelectorAll(".required-checkbox:checked")
  ).map(cb => cb.value);

  step.forbidden = Array.from(
    document.querySelectorAll(".forbidden-checkbox:checked")
  ).map(cb => cb.value);
}

// ================= LOAD STEP DATA =================

function loadStepData() {
  const step = getActiveStep();
  if (!step) return;

  document.querySelectorAll(".required-checkbox").forEach(cb => {
    cb.checked = step.required.includes(cb.value);
  });

  document.querySelectorAll(".forbidden-checkbox").forEach(cb => {
    cb.checked = step.forbidden.includes(cb.value);
  });
}

// ================= SAVE =================


function saveConfig() {
  localStorage.setItem("inspectionSteps", JSON.stringify(steps));
  localStorage.setItem("stepCounter", stepCounter);
  alert("Config saved");
}
