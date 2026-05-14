/**
 * ======================================================
 * settings.js 
 * ======================================================
 * Responsibilities:
 * - Fetch system / environment diagnostics
 * - Render structured key-value panels
 *
 * Design:
 * - Read-only frontend
 * - Backend is the single source of truth
 *
 * Endpoint:
 * - GET /api/system
 */


/* ======================================================
   RENDER UTILITIES
====================================================== */

/**
 * Render a key-value object into a container.
 *
 * Each key becomes a row:
 * [key] | [value]
 *
 * @param {string} containerId
 * @param {Object} data
 */
function renderKeyValue(containerId, data) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Clear existing content
  container.innerHTML = "";

  // Validate input
  if (!data || typeof data !== "object") {
    container.textContent = "-";
    return;
  }

  // Render each key-value pair
  Object.entries(data).forEach(([key, value]) => {
    const row = document.createElement("div");
    row.className = "settings-row";

    const keyEl = document.createElement("div");
    keyEl.className = "settings-key";
    keyEl.textContent = key;

    const valueEl = document.createElement("div");
    valueEl.className = "settings-value";

    valueEl.textContent =
      value === null || value === undefined
        ? "-"
        : String(value);

    row.appendChild(keyEl);
    row.appendChild(valueEl);

    container.appendChild(row);
  });
}


/* ======================================================
   DATA LOADING
====================================================== */

/**
 * Fetch system diagnostics and populate UI panels.
 */
async function loadSettings() {
  try {
    const res = await fetch("/api/system");

    if (!res.ok) {
      throw new Error("Request failed");
    }

    const data = await res.json();

    renderKeyValue("systemInfo", data.system);
    renderKeyValue("envInfo", data.environment);

  } catch (err) {
    console.error("[Settings Load Error]", err);

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