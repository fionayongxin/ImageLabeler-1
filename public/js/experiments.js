
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
      actions.push(`<button data-action="n>`);
    }

    if (exp.hasWeights) {
      actions.push(`<button data-action=weights>Model</button>`);
    }


    tr.innerHTML = `
      <td>${exp.name}</td>
      <td class="status ${exp.status}">${exp.status}</td>
      <td>${exp.config?.model ?? "-"}</td>
      <td>${dataset}</td>
      <td>${exp.config?.epochs ?? "-"}</td>
      <td>${startedAt}</td>
      <td>${actions.join(" ")}</td>
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
    // experiment detail page
    window.location.href = `/experiments/${runName}`;
  }

  if (action === "weights") {
    const filePath = `/training/${runName}/weights/best.pt`;
    window.location.href = filePath;
  }
});
