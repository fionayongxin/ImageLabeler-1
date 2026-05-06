/**
 * ======================================================
 * training.service.js  (REMOTE TRAINING PROXY)
 * ======================================================
 * - Node runs on PC
 * - Training runs on remote Python server
 * - This file ONLY forwards requests via HTTP
 */

const TRAIN_SERVER = "http://10.192.74.39:8002";

/**
 * Start training on remote server.
 */

const { FASTAPI_BASE_URL, STATION, PROCESS } = require("../config/env");

async function startTraining(cfg) {
  const res = await fetch(`${FASTAPI_BASE_URL}/train/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...cfg,
      station: STATION,
      process: PROCESS
    })
  });


  const text = await res.text();

  if (!res.ok) {
    throw new Error(text);
  }

  return JSON.parse(text);
}

/**
 * Stop training on remote server.
 */
async function stopTraining() {

  const res = await fetch(`${TRAIN_SERVER}/train/stop`, {
    method: "POST"
  });

  const text = await res.text();

  try {
    return JSON.parse(text);
  } catch {
    return { status: "unknown", raw: text };
  }
}

/**
 * Get training progress from remote server.
 */
async function getTrainingProgress() {
  const res = await fetch(`${TRAIN_SERVER}/train/progress`);
  if (!res.ok) return { status: "idle" };
  return res.json();
}

/**
 * Get training metrics from remote server.
 */
async function getTrainingMetrics() {
  const res = await fetch(`${TRAIN_SERVER}/train/metrics`);
  if (!res.ok) return [];
  return res.json();
}

module.exports = {
  startTraining,
  stopTraining,
  getTrainingProgress,
  getTrainingMetrics
};