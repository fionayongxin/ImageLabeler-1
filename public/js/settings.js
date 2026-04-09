function renderKeyValue(containerId, data) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  if (!data || typeof data !== "object") {
    container.textContent = "-";
    return;
  }

  Object.entries(data).forEach(([key, value]) => {
    const row = document.createElement("div");
    row.className = "settings-row";

    const k = document.createElement("div");
    k.className = "settings-key";
    k.textContent = key;

    const v = document.createElement("div");
    v.className = "settings-value";
    v.textContent = value ?? "-";

    row.appendChild(k);
    row.appendChild(v);
    container.appendChild(row);
  });
}

async function loadSettings() {
  try {
    const res = await fetch("/api/settings");
    const data = await res.json();
    console.log(data.system)
    renderKeyValue("systemInfo", data.system);
    renderKeyValue("pathsInfo", data.paths);
    renderKeyValue("envInfo", data.environment);
    renderKeyValue("defaultsInfo", data.defaults);

  } catch (err) {
    console.error(err);
    document.getElementById("systemInfo").textContent =
      "Failed to load settings.";
  }
}

loadSettings();