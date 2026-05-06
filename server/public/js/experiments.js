/**
 * ======================================================
 * experiments.js
 * ------------------------------------------------------
 * Responsibility:
 * - List training experiments
 * - Support pagination
 * - Display metrics (loss / mAP) in overlay
 * - Download trained weights
 *
 * Design rules:
 * - Frontend NEVER inspects filesystem
 * - Backend APIs are the source of truth
 *
 * Aligned backend endpoints:
 * - GET /api/experiments
 * - GET /api/experiments/:runName/metrics
 * - GET /api/experiments/:runName/weights
 * ======================================================
 */

/* ======================================================
   STATE
====================================================== */

let allExperiments = [];
let currentPage = 1;
const PAGE_SIZE = 10;

let lossChart = null;
let mapChart = null;


/* ======================================================
   DATA LOADING
====================================================== */

/**
 * Load all experiment metadata from backend.
 */
async function loadExperiments() {
  const res = await fetch("/api/experiments");
  if (!res.ok) return;

  allExperiments = await res.json();
  currentPage = 1;
  renderPage();
}


/* ======================================================
   TABLE RENDERING
====================================================== */

/**
 * Render the current page slice into the table body.
 */
function renderPage() {
  const tbody = document.querySelector("#experimentsTable tbody");
  tbody.innerHTML = "";

  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = allExperiments.slice(start, start + PAGE_SIZE);

  pageItems.forEach(exp => {
    const tr = document.createElement("tr");
    tr.dataset.run = exp.name;

    const startedAt = exp.startedAt
      ? formatDate(exp.startedAt)
      : "-";

    const actions = [];

    if (exp.hasMetrics) {
      actions.push(`<button data-action="metrics">Metric</button>`);
    }

    if (exp.hasWeights && exp.status === "Completed") {
      actions.push(`<button data-action="weights">Weights</button>`);
    }

    tr.innerHTML = `
      <td>${exp.name}</td>
      <td class="status ${exp.status}">${exp.status}</td>
      <td>${exp.model ?? "-"}</td>
      <td>${exp.dataset ?? "-"}</td>
      <td>${exp.batch ?? "-"}</td>
      <td>${exp.epochs ?? "-"}</td>
      <td>${exp.imgsz ?? "-"}</td>
      <td>${startedAt}</td>
      <td>${actions.join(" ")}</td>
      
    `;

    tbody.appendChild(tr);
  });

  updatePaginationUI();
}

/**
 * Format timestamp to human‑readable string.
 *
 * @param {string} iso
 * @returns {string}
 */
function formatDate(iso) {
  const d = new Date(iso);

  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = d.getFullYear();

  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";

  hours = hours % 12 || 12;

  return `${day}/${month}/${year} ${hours}:${minutes} ${ampm}`;
}


/* ======================================================
   PAGINATION UI
====================================================== */

function updatePaginationUI() {
  const totalPages = Math.max(
    1,
    Math.ceil(allExperiments.length / PAGE_SIZE)
  );

  document.getElementById("pageInfo").textContent = `of ${totalPages}`;
  document.getElementById("pageInput").value = currentPage;
  document.getElementById("pageInput").max = totalPages;

  document.getElementById("prevPage").disabled = currentPage === 1;
  document.getElementById("nextPage").disabled = currentPage === totalPages;
}


/* ======================================================
   METRICS OVERLAY
====================================================== */

/**
 * Fetch and display metrics for a specific run.
 *
 * @param {string} runName
 */
async function showMetrics(runName) {
  const panel = document.getElementById("metricsPanel");
  const backdrop = document.getElementById("metricsBackdrop");

  panel.style.display = "block";
  backdrop.style.display = "block";
  panel.scrollTop = 0;

  const res = await fetch(`/api/experiments/${runName}/metrics`);
  if (!res.ok) return;

  const data = await res.json();
  if (!Array.isArray(data) || !data.length) return;

  const final = data[data.length - 1];
  const bestMap = Math.max(...data.map(d => d.map50 ?? 0));

  document.getElementById("finalEpoch").textContent = final.epoch;
  document.getElementById("finalLoss").textContent = final.loss.toFixed(4);
  document.getElementById("bestMap").textContent = bestMap.toFixed(4);

  drawLossChart(data);
  drawMapChart(data);
}

/**
 * Close metrics overlay.
 */
function closeMetrics() {
  document.getElementById("metricsPanel").style.display = "none";
  document.getElementById("metricsBackdrop").style.display = "none";
}


/* ======================================================
   CHART RENDERING
====================================================== */

function drawLossChart(data) {
  if (lossChart) lossChart.destroy();

  const ctx = document.getElementById("lossChart").getContext("2d");
  lossChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: data.map(d => d.epoch),
      datasets: [{
        label: "Loss",
        data: data.map(d => d.loss),
        borderColor: "#38bdf8",
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });
}

function drawMapChart(data) {
  if (mapChart) mapChart.destroy();

  const ctx = document.getElementById("mapChart").getContext("2d");
  mapChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: data.map(d => d.epoch),
      datasets: [{
        label: "mAP50",
        data: data.map(d => d.map50),
        borderColor: "#22c55e",
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { min: 0, max: 1 }
      }
    }
  });
}


/* ======================================================
   TABLE ACTION HANDLER
====================================================== */

document
  .querySelector("#experimentsTable")
  .addEventListener("click", e => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const tr = btn.closest("tr");
    const runName = tr.dataset.run;

    if (btn.dataset.action === "metrics") {
      showMetrics(runName);
    }

    if (btn.dataset.action === "weights") {
      window.location.href = `/api/experiments/${runName}/weights`;
    }
  });


/* ======================================================
   UI EVENT HOOKS
====================================================== */

document.getElementById("closeMetrics").addEventListener("click", closeMetrics);
document.getElementById("metricsBackdrop").addEventListener("click", closeMetrics);

document.getElementById("prevPage").addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage--;
    renderPage();
  }
});

document.getElementById("nextPage").addEventListener("click", () => {
  const totalPages = Math.ceil(allExperiments.length / PAGE_SIZE);
  if (currentPage < totalPages) {
    currentPage++;
    renderPage();
  }
});

document.getElementById("goPage").addEventListener("click", () => {
  const target = Number(document.getElementById("pageInput").value);
  const totalPages = Math.ceil(allExperiments.length / PAGE_SIZE);

  if (target >= 1 && target <= totalPages) {
    currentPage = target;
    renderPage();
  }
});


/* ======================================================
   INIT
====================================================== */

loadExperiments();
