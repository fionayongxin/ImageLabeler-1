// ================================
// Elements (MUST exist in HTML)
// ================================
const stationInput = document.getElementById("station");
const processInput = document.getElementById("process");
const modelSelect = document.getElementById("model");
const runNameInput = document.getElementById("runName");

const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");
const progressFile = document.getElementById("progressFile");

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");

// ================================
// State
// ================================
let progressTimer = null;
let currentRunName = null;
let lossChart = null;
let mapChart = null;

// ================================
// Helpers
// ================================
function generateExperimentName() {
  const station = stationInput.value || "station";
  const process = processInput.value || "process";
  const modelName = modelSelect.value.replace(".pt", "");
  return `${station}-${process}-${modelName}-${Date.now()}`;
}

// ================================
// Init
// ================================
runNameInput.value = generateExperimentName();

modelSelect.addEventListener("change", () => {
  if (!currentRunName) {
    runNameInput.value = generateExperimentName();
  }
});

// ================================
// Loss Chart
// ================================
function initLossChart() {
  const canvas = document.getElementById("lossChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  if (lossChart) {
    lossChart.destroy();
  }

  lossChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Training Loss",
          data: [],
          borderColor: "#ef4444",
          backgroundColor: "rgba(239, 68, 68, 0.15)",
          tension: 0.25,
          fill: true,
          pointRadius: 2
        }
      ]
    },
    options: {
      animation: false,
      responsive: true,
      scales: {
        x: {
          title: { display: true, text: "Epoch" }
        },
        y: {
          title: { display: true, text: "Loss" }
        }
      }
    }
  });
}

async function updateLossChart() {
  if (!lossChart) return;

  const res = await fetch("/api/train/metrics");
  if (!res.ok) return;

  const data = await res.json();
  if (!data.length) return;

  lossChart.data.labels = data.map(d => d.epoch);
  lossChart.data.datasets[0].data = data.map(d => d.loss);
  lossChart.update();
}


function initMapChart() {
  const canvas = document.getElementById("mapChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  if (mapChart) {
    mapChart.destroy();
  }

  mapChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "mAP50",
          data: [],
          borderColor: "#22c55e",
          backgroundColor: "rgba(34, 197, 94, 0.15)",
          tension: 0.25,
          fill: true,
          pointRadius: 2
        }
      ]
    },
    options: {
      animation: false,
      responsive: true,
      scales: {
        x: {
          title: { display: true, text: "Epoch" }
        },
        y: {
          title: { display: true, text: "mAP50" },
          min: 0,
          max: 1
        }
      }
    }
  });
}

// ================================
// Progress Polling
// ================================
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

async function updateProgress() {
  let res;
  try {
    res = await fetch("/api/train/progress");
  } catch {
    return;
  }

  if (!res.ok) return;
  const data = await res.json();

  if (!progressBar || !progressText) return;

  if (data.status === "idle") {
    progressBar.style.width = "0%";
    progressText.textContent = "Idle";
    if (progressFile) progressFile.textContent = "–";
    stopProgressPolling();
    stopBtn.disabled = true;
    startBtn.disabled = false;
    return;
  }

  if (data.status === "starting") {
    progressBar.style.width = "1%";
    progressText.textContent = "Starting training…";
    if (progressFile) {
      progressFile.textContent = "Preparing training files…";
    }
    return;
  }

  if (data.status === "running") {
    
    await updateCharts();
    progressBar.style.width = `${data.progress}%`;
    progressText.textContent =
      `Epoch ${data.epoch}/${data.totalEpochs} (${data.progress}%)`;

    if (progressFile) {
      progressFile.textContent = `${data.runName}/results.csv`;
    }

    await updateLossChart();

    if (data.progress >= 100) {
      progressText.textContent = "Training completed";
      stopProgressPolling();
      stopBtn.disabled = true;
      startBtn.disabled = false;
      currentRunName = null;
      runNameInput.value = generateExperimentName();
    }
  }
}

// ================================
// Start Training
// ================================
startBtn.onclick = async () => {
  const station = stationInput.value.trim();
  const process = processInput.value.trim();
  
  if (!station || !process) {
    alert("Station and process are required");
    return;
  }

  currentRunName =
    runNameInput.value.trim() || generateExperimentName();
  runNameInput.value = currentRunName;

  startBtn.disabled = true;
  stopBtn.disabled = false;

  progressBar.style.width = "1%";
  progressText.textContent = "Starting training…";
  if (progressFile) progressFile.textContent = "–";

  initLossChart();
  initMapChart();

  await fetch("/api/train/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      station,
      process,
      model: modelSelect.value,
      epochs: Number(document.getElementById("epochs").value),
      imgsz: Number(document.getElementById("imgsz").value),
      batch: Number(document.getElementById("batch").value),
      runName: currentRunName
    })
  });

  startProgressPolling();
};

// ================================
// Stop Training
// ================================
stopBtn.onclick = async () => {
  await fetch("/api/train/stop", { method: "POST" });
  stopProgressPolling();

  progressText.textContent = "Training stopped";
  if (progressFile) progressFile.textContent = "–";

  currentRunName = null;
  runNameInput.value = generateExperimentName();

  startBtn.disabled = false;
  stopBtn.disabled = true;
};

async function updateCharts() {
  if (!lossChart && !mapChart) return;

  const res = await fetch("/api/train/metrics");
  if (!res.ok) return;

  const data = await res.json();
  if (!data.length) return;

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