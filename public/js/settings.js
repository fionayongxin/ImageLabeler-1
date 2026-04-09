/* =========================================================
   RENDER KEY-VALUE DATA
   Generic helper for settings sections
   ========================================================= */

function renderKeyValue(containerId, data) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  // Guard: invalid or empty data
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

/* =========================================================
   LOAD SETTINGS FROM BACKEND
   Populates all settings sections
   ========================================================= */

async function loadSettings() {
  try {
    const res = await fetch("/api/settings");
    if (!res.ok) throw new Error("Request failed");

    const data = await res.json();

    renderKeyValue("systemInfo", data.system);
    renderKeyValue("pathsInfo", data.paths);
    renderKeyValue("envInfo", data.environment);
    renderKeyValue("defaultsInfo", data.defaults);

  } catch (err) {
    console.error(err);

    // Fallback message on failure
    const systemInfo = document.getElementById("systemInfo");
    if (systemInfo) {
      systemInfo.textContent = "Failed to load settings.";
    }
  }
}

/* =========================================================
   INIT
   ========================================================= */

loadSettings();