/**
 * ======================================================
 * training.service.js 
 * ======================================================
 *
 * Responsibilities:
 * - Proxy training lifecycle requests to remote server
 * - Provide training status and metrics
 *
 * Design:
 * - Node runs on PC
 * - Training runs on remote Python server
 * - This layer only forwards HTTP requests
 */

const fetch = require("node-fetch");

const {
  TRAINING_SERVER_BASE,
  STATION,
  PROCESS
} = require("../config/env");

/* ======================================================
   START TRAINING
====================================================== */

/**
 * Start training on remote server.
 *
 * @param {Object} cfg
 * @returns {Promise<Object>}
 */
async function startTraining(cfg) {
  const res = await fetch(
    `${TRAINING_SERVER_BASE}/train/start`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...cfg,
        station: STATION,
        process: PROCESS
      })
    }
  );

  const text = await res.text();

  if (!res.ok) {
    throw new Error(text);
  }

  return JSON.parse(text);
}

/* ======================================================
   STOP TRAINING
====================================================== */

/**
 * Stop training on remote server.
 *
 * @returns {Promise<Object>}
 */
async function stopTraining() {
  const res = await fetch(
    `${TRAINING_SERVER_BASE}/train/stop`,
    { method: "POST" }
  );

  const text = await res.text();

  try {
    return JSON.parse(text);
  } catch {
    return {
      status: "unknown",
      raw: text
    };
  }
}

/* ======================================================
   GET TRAINING PROGRESS
====================================================== */

/**
 * Fetch training progress.
 *
 * @returns {Promise<Object>}
 */
async function getTrainingProgress() {
  const res = await fetch(
    `${TRAINING_SERVER_BASE}/train/progress`
  );

  if (!res.ok) {
    return { status: "idle" };
  }

  return res.json();
}

/* ======================================================
   GET TRAINING METRICS
====================================================== */

/**
 * Fetch training metrics.
 *
 * @returns {Promise<Array>}
 */
async function getTrainingMetrics() {
  const res = await fetch(
    `${TRAINING_SERVER_BASE}/train/metrics`
  );

  if (!res.ok) {
    return [];
  }

  return res.json();
}

module.exports = {
  startTraining,
  stopTraining,
  getTrainingProgress,
  getTrainingMetrics
};