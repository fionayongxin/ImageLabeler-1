/**
 * ======================================================
 * experiments.service.js
 * ======================================================
 *
 * Responsibilities:
 * - Fetch experiment metadata from training server
 * - Provide experiment metrics
 * - Resolve download URL for trained weights
 *
 * Design:
 * - No filesystem access
 * - Training server is the single source of truth
 */

const fetch = require("node-fetch");

const { TRAINING_SERVER_BASE } = require("../config/env");

/* ======================================================
   LIST EXPERIMENTS
====================================================== */

/**
 * Fetch all experiment metadata.
 *
 * @returns {Promise<Array>}
 */
async function listExperiments() {
  const res = await fetch(`${TRAINING_SERVER_BASE}/experiments`);

  if (!res.ok) {
    return [];
  }

  const data = await res.json();
  return data;
}

/* ======================================================
   FETCH METRICS
====================================================== */

/**
 * Get metrics for a specific experiment.
 *
 * @param {string} runName
 * @returns {Promise<Array>}
 */
async function getExperimentMetrics(runName) {
  const res = await fetch(
    `${TRAINING_SERVER_BASE}/train/metrics?run=${encodeURIComponent(runName)}`
  );

  if (!res.ok) {
    return [];
  }

  const data = await res.json();
  return data;
}

/* ======================================================
   RESOLVE WEIGHTS DOWNLOAD
====================================================== */

/**
 * Build download URL for best weights.
 *
 * @param {string} runName
 * @returns {{ url: string, filename: string }}
 */
function getWeightsDownload(runName) {
  const encoded = encodeURIComponent(runName);

  return {
    url: `${TRAINING_SERVER_BASE}/experiments/${encoded}/weights`,
    filename: `${runName}_best.pt`
  };
}

module.exports = {
  listExperiments,
  getExperimentMetrics,
  getWeightsDownload
};
