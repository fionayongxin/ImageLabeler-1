/**
 * ======================================================
 * training.js
 * ------------------------------------------------------
 * Responsibility:
 * - Configure and start training
 * - Poll training progress
 * - Render loss and mAP charts
 * - Stop training gracefully
 *
 * Design rules:
 * - Frontend never spawns processes
 * - Backend owns training lifecycle
 * - Frontend polls status only
 *
 * Aligned backend endpoints:
 * - POST /api/train/start
 * - POST /api/train/stop
 * - GET  /api/train/progress
 * - GET  /api/train/metrics
 * ======================================================
 */

/* ======================================================
   DOM REFERENCES
====================================================== */

const modelSelect  = document.getElementById("model");
const runNameInput = document.getElementById("runName");

const progressBar  = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");
const progressFile = document.getElementById("progressFile");

const startBtn = document.getElementById("startBtn");
const stopBtn  = document.getElementById("stopBtn");

/* ======================================================
   STATE
====================================================== */

let progressTimer = null;
let currentRunName = null;

let lossChart = null;
let mapChart  = null;

/* ======================================================
   HELPERS
====================================================== */

/**
 * Generate a unique experiment name using user inputs.
 *
 * @returns {string}
 */

function generateExperimentName() {
  const model = modelSelect.value.replace(".pt", "");
  const ts = new Date().toISOString().slice(0,19).replace(/[:T]/g, "-");
  return `${model}_${ts}`;
}

/* ======================================================
   INITIALIZATION
====================================================== */

// Pre‑fill run name on page load
runNameInput.value = generateExperimentName();

// Regenerate run name when model changes (only if idle)
modelSelect.addEventListener("change", () => {
  if (!currentRunName) {
    runNameInput.value = generateExperimentName();
  }
});

/* ======================================================
   LOSS CHART
====================================================== */

function initLossChart() {
  const canvas = document.getElementById("lossChart");
  if (!canvas) return;

  if (lossChart) lossChart.destroy();

  lossChart = new Chart(canvas.getContext("2d"), {
    type: "line",
    data: {
      labels: [],
      datasets: [{
        label: "Training Loss",
        data: [],
        borderColor: "#ef4444",
        backgroundColor: "rgba(239,68,68,0.15)",
        tension: 0.25,
        fill: true,
        pointRadius: 2
      }]
    },
    options: {
      animation: false,
      responsive: true,
      scales: {
        x: { title: { display: true, text: "Epoch" } },
        y: { title: { display: true, text: "Loss" } }
      }
    }
  });
}

/* ======================================================
   MAP CHART
====================================================== */

function initMapChart() {
  const canvas = document.getElementById("mapChart");
  if (!canvas) return;

  if (mapChart) mapChart.destroy();

  mapChart = new Chart(canvas.getContext("2d"), {
    type: "line",
    data: {
      labels: [],
      datasets: [{
        label: "mAP50",
        data: [],
        borderColor: "#22c55e",
        backgroundColor: "rgba(34,197,94,0.15)",
        tension: 0.25,
        fill: true,
        pointRadius: 2
      }]
    },
    options: {
      animation: false,
      responsive: true,
      scales: {
        x: { title: { display: true, text: "Epoch" } },
        y: {
          title: { display: true, text: "mAP50" },
          min: 0,
          max: 1
        }
      }
    }
  });
}

/* ======================================================
   PROGRESS POLLING
====================================================== */

function startProgressPolling() {
  stopProgressPolling();
  progressTimer = setInterval(updateProgress, 1000);
}

function stopProgressPolling() {
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
}

/**
 * Poll backend for training progress and update UI.
 */

async function updateProgress() {
  let res;

  try {
    res = await fetch("/api/train/progress");
  } catch {
    return;
  }

  if (!res.ok) return;

  const data = await res.json();

  /* ---------------- Idle ---------------- */
  if (data.status === "idle") {
    progressBar.style.width = "0%";
    progressText.textContent = "Idle";
    if (progressFile) progressFile.textContent = "–";

    stopProgressPolling();
    startBtn.disabled = false;
    stopBtn.disabled = true;

    currentRunName = null;
    runNameInput.value = generateExperimentName();
    return;
  }

  /* ---------------- Starting ---------------- */
  if (data.status === "starting") {
    progressBar.style.width = "1%";
    progressText.textContent = "Starting training…";
    if (progressFile) {
      progressFile.textContent = "Preparing training files…";
    }
    return;
  }

  /* ---------------- Stopping ---------------- */
  if (data.status === "stopping") {
    progressText.textContent = "Stopping training…";
    stopBtn.disabled = true;
    return;
  }

  /* ---------------- Running ---------------- */
  if (data.status === "running") {
    await updateCharts();

    progressBar.style.width = `${data.progress}%`;
    progressText.textContent =
      `Epoch ${data.epoch}/${data.totalEpochs} (${data.progress}%)`;

    if (progressFile) {
      progressFile.textContent = `${data.runName}/results.csv`;
    }

    if (data.progress >= 100) {
      progressText.textContent = "Training completed";

      stopProgressPolling();
      startBtn.disabled = false;
      stopBtn.disabled = true;

      currentRunName = null;
      runNameInput.value = generateExperimentName();
    }
  }
}


/* ======================================================
   START TRAINING
====================================================== */

startBtn.onclick = async () => {
  currentRunName =
    runNameInput.value.trim() || generateExperimentName();

  runNameInput.value = currentRunName;

  startBtn.disabled = true;
  stopBtn.disabled = false;

  progressBar.style.width = "1%";
  progressText.textContent = "Starting training…";
  if (progressFile) progressFile.textContent = "–";
  
  if (lossChart) {
    lossChart.destroy();
    lossChart = null;
  }

  if (mapChart) {
    mapChart.destroy();
    mapChart = null;
  }

  initLossChart();
  initMapChart();

  await fetch("/api/train/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modelSelect.value,
      epochs: Number(document.getElementById("epochs").value),
      imgsz:  Number(document.getElementById("imgsz").value),
      batch:  Number(document.getElementById("batch").value),
      runName: currentRunName
    })
  });

  startProgressPolling();
};

/* ======================================================
   STOP TRAINING
====================================================== */

stopBtn.onclick = async () => {

  stopBtn.disabled = true;
  progressText.textContent = "Stopping training…";

  try {
    const res = await fetch("/api/train/stop", { method: "POST" });
  } catch (err) {
    console.error("Stop fetch failed", err);
  }
};

/* ======================================================
   METRICS UPDATE (LOSS + MAP)
====================================================== */

async function updateCharts() {
  if (!lossChart && !mapChart) return;

  const res = await fetch("/api/train/metrics");
  if (!res.ok) return;

  const data = await res.json();
  if (!Array.isArray(data) || !data.length) return;

  const epochs = data.map(d => d.epoch);

  if (lossChart) {
    lossChart.data.labels = epochs;
    lossChart.data.datasets[0].data = data.map(d => d.loss);
    lossChart.update();
  }

  if (mapChart) {
    mapChart.data.labels = epochs;
    mapChart.data.datasets[0].data = data.map(d => d.map50);
    mapChart.update();
  }
}

/* ======================================================
   INIT
====================================================== */

document.addEventListener("DOMContentLoaded", async () => {
  initLossChart();
  initMapChart();

  try {
    const res = await fetch("/api/train/progress");
    if (!res.ok) return;

    const data = await res.json();

    if (data.status === "running") {
      startBtn.disabled = true;
      stopBtn.disabled = false;

      currentRunName = data.runName;
      runNameInput.value = data.runName;

      progressBar.style.width = `${data.progress}%`;
      progressText.textContent =
        `Epoch ${data.epoch}/${data.totalEpochs} (${data.progress}%)`;

      startProgressPolling();
    }
  } catch (err) {
    console.error("Failed to restore training state", err);
  }
});