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

const TRAIN_SERVER = "http://10.192.74.39:8002";

/**
 * List all experiments.
 *
 * @returns {Array}
 */
async function listExperiments() {
  const res = await fetch(`${TRAIN_SERVER}/experiments`);
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
    `${TRAIN_SERVER}/train/metrics?run=${encodeURIComponent(runName)}`
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
    url: `${TRAIN_SERVER}/experiments/${encodeURIComponent(runName)}/weights`,
    filename: `${runName}_best.pt`
  };
}

module.exports = {
  listExperiments,
  getExperimentMetrics,
  getWeightsDownload
};
