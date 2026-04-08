
async function loadExperiments() {
  const res = await fetch("/api/experiments");
  if (!res.ok) return;

  const experiments = await res.json();
  const tbody = document.querySelector("#experimentsTable tbody");
  tbody.innerHTML = "";

  experiments.forEach(exp => {
    const tr = document.createElement("tr");
    tr.dataset.run = exp.name;

    const dataset = exp.config
      ? `${exp.config.station} / ${exp.config.process}`
      : "-";

    const startedAt = exp.startedAt
      ? new Date(exp.startedAt).toLocaleString()
      : "-";

    const actions = [];

    if (exp.hasMetrics) {
      actions.push(`<button data-action=metrics>Metric</button>`);
    }

    console.log(exp.name, exp.hasMetrics, exp.hasWeights);

    if (exp.hasWeights) {
      actions.push(`<button data-action=weights>Model</button>`);
    }

    const modelName = exp.config?.model ?? "-";
    const imgSize  = exp.config?.imgsz ?? "-";
    const epochs   = exp.config?.epochs ?? "-";
    const batchSize = exp.config?.batch ?? "-";


    tr.innerHTML = `
      <td>${exp.name}</td>
      <td class="status ${exp.status}">${exp.status}</td>
      <td>${modelName}</td>
      <td>${imgSize}</td>
      <th>${batchSize} </th>
      <td>${epochs}</td>
      <td>${dataset}</td>
      <td>${startedAt}</td>
      <td>${actions.join(" ")}</td>
    `;
    console.log(actions)

    tbody.appendChild(tr);
  });
}

async function showMetrics(runName) {
  const panel = document.getElementById("metricsPanel");
  const tbody = document.getElementById("metricsTableBody");

  panel.style.display = "block";
  tbody.innerHTML = "";

  const res = await fetch(`/api/experiments/${runName}/metrics`);
  if (!res.ok) return;

  const data = await res.json();
  if (!data.length) return;

  // Summary
  const final = data[data.length - 1];
  const bestMap = Math.max(...data.map(d => d.map50 || 0));

  document.getElementById("finalEpoch").textContent = final.epoch;
  document.getElementById("finalLoss").textContent =
    final.loss ? final.loss.toFixed(4) : "-";
  document.getElementById("bestMap").textContent =
    bestMap ? bestMap.toFixed(4) : "-";

  // Table
  data.forEach(row => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.epoch}</td>
      <td>${row.loss ? row.loss.toFixed(4) : "-"}</td>
      <td>${row.map50 ? row.map50.toFixed(4) : "-"}</td>
    `;
    tbody.appendChild(tr);
  });
}

loadExperiments();

document.querySelector("#experimentsTable").addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const tr = btn.closest("tr");
  const runName = tr.dataset.run;
  const action = btn.dataset.action;
  console.log("Action" + action)

  if (action === "metrics") {
    showMetrics(runName);
  }


  if (action === "weights") {
    const filePath = `/training/${runName}/weights/best.pt`;
    window.location.href = filePath;
  }
});