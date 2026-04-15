/**
 * ======================================================
 * settings.js
 * ------------------------------------------------------
 * Responsibility:
 * - Load system / environment diagnostics from backend
 * - Render key‑value information into settings panels
 *
 * Design rules:
 * - Frontend is read‑only
 * - Backend is single source of truth
 *
 * Aligned backend endpoint:
 * - GET /api/system
 * ======================================================
 */

/* ======================================================
   RENDER KEY‑VALUE DATA
====================================================== */

/**
 * Render an object as key‑value rows into a container.
 *
 * @param {string} containerId
 * @param {Object} data
 */
function renderKeyValue(containerId, data) {
  const container = document.getElementById(containerId);
  if (!container) return;

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
    v.textContent =
      value === null || value === undefined
        ? "-"
        : String(value);

    row.appendChild(k);
    row.appendChild(v);
    container.appendChild(row);
  });
}

/* ======================================================
   LOAD SETTINGS FROM BACKEND
====================================================== */

/**
 * Load system diagnostics and populate settings panels.
 */
async function loadSettings() {
  try {
    const res = await fetch("/api/system");
    if (!res.ok) throw new Error("Request failed");

    const data = await res.json();

    renderKeyValue("systemInfo", data.system);
    renderKeyValue("envInfo", data.environment);

  } catch (err) {
    console.error(err);

    const systemInfo = document.getElementById("systemInfo");
    if (systemInfo) {
      systemInfo.textContent = "Failed to load system information.";
    }
  }
}

/* ======================================================
   INIT
====================================================== */

loadSettings();
