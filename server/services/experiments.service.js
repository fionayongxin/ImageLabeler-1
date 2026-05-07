/**
 * ======================================================
 * experiments.service.js  (REMOTE, SEMANTIC)
 * ======================================================
 * Responsibility:
 * - Read experiment metadata from training server
 * - Resolve experiment downloads
 * - Read experiment metrics
 *
 * Design rules:
 * - NO filesystem access
 * - Training server is source of truth
 * ======================================================
 */

const fetch = require("node-fetch");

const { TRAINING_SERVER_BASE } = require("../config/env");

/**
 * List all experiments.
 *
 * @returns {Array}
 */
async function listExperiments() {
  const res = await fetch(`${TRAINING_SERVER_BASE}/experiments`);
  if (!res.ok) return [];
  return res.json();
}

/**
 * Get metrics for a specific experiment.
 *
 * @param {string} runName
 * @returns {Array}
 */
async function getExperimentMetrics(runName) {
  const res = await fetch(
    `${TRAINING_SERVER_BASE}/train/metrics?run=${encodeURIComponent(runName)}`
  );
  if (!res.ok) return [];
  return res.json();
}

/**
 * Resolve best weights download for an experiment.
 *
 * @param {string} runName
 * @returns {{ url: string, filename: string }}
 */
function getWeightsDownload(runName) {
  return {
    url: `${TRAINING_SERVER_BASE}/experiments/${encodeURIComponent(runName)}/weights`,
    filename: `${runName}_best.pt`
  };
}

module.exports = {
  listExperiments,
  getExperimentMetrics,
  getWeightsDownload
};
