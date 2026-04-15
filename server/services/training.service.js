/**
 * ======================================================
 * training.service.js
 * ------------------------------------------------------
 * Responsibility:
 * - training lifecycle business logic
 * - Start / stop training
 * - Track training state
 * - Report training progress
 *
 * Design rules:
 * - NO Express / HTTP
 * - NO UI logic
 * - Single active training at a time
 * ======================================================
 */

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const { DATASET_ROOT, TRAINING_ROOT } = require("../config/paths");
const { parseTrainingMetrics } = require("../utils/csv.parser");

/* Ensure training root exists */
if (!fs.existsSync(TRAINING_ROOT)) {
  fs.mkdirSync(TRAINING_ROOT, { recursive: true });
}

/* Internal state */
let trainProcess = null;
let activeRunName = null;

/* Utils */
function safeName(name) {
  return String(name).replace(/[^a-zA-Z0-9_-]/g, "_");
}

/**
 * Start training.
 */
function startTraining({
  station,
  process,
  model,
  epochs,
  imgsz,
  batch,
  runName
}) {
  if (trainProcess) {
    throw new Error("Training already running");
  }

  if (!station || !process || !runName) {
    throw new Error("Missing parameters");
  }

  const safeRun = safeName(runName);
  const datasetDir = path.join(
    DATASET_ROOT,
    safeName(station),
    safeName(process)
  );

  const datasetYaml = path.join(datasetDir, "dataset.yaml");
  if (!fs.existsSync(datasetYaml)) {
    throw new Error("dataset.yaml not found");
  }

  const runDir = path.join(TRAINING_ROOT, safeRun);
  if (fs.existsSync(runDir)) {
    throw new Error("Run already exists");
  }

  fs.mkdirSync(runDir, { recursive: true });
  activeRunName = safeRun;

  trainProcess = spawn(
    "python3",
    [
        path.join(__dirname, "..", "..", "training", "train.py"),     
        "--data", datasetYaml,
        "--model", model,
        "--epochs", epochs,
        "--imgsz", imgsz,
        "--batch", batch,
        "--name", safeRun,
        "--project", TRAINING_ROOT
    ],
    { stdio: "inherit" }
  );

  trainProcess.on("close", () => {
    trainProcess = null;
    activeRunName = null;
  });

  fs.writeFileSync(
    path.join(runDir, "run_config.json"),
    JSON.stringify({
      station,
      process,
      model,
      epochs,
      imgsz,
      batch,
      runName: safeRun,
      startedAt: new Date().toISOString()
    }, null, 2)
  );

  return { status: "started", runName: safeRun };
}

/**
 * Stop training.
 */
function stopTraining() {
  if (!trainProcess) {
    throw new Error("No training running");
  }

  trainProcess.kill("SIGTERM");
  return { status: "stopping" };
}

/**
 * Get training progress.
 */
function getTrainingProgress() {
  if (!trainProcess || !activeRunName) {
    return { status: "idle" };
  }

  const runDir = path.join(TRAINING_ROOT, activeRunName);
  const csvPath = path.join(runDir, "results.csv");
  const cfgPath = path.join(runDir, "run_config.json");

  if (!fs.existsSync(csvPath) || !fs.existsSync(cfgPath)) {
    return { status: "starting", runName: activeRunName };
  }

  const cfg = JSON.parse(fs.readFileSync(cfgPath));
  const metrics = parseTrainingMetrics(csvPath);
  if (!metrics.length) {
    return { status: "starting", runName: activeRunName };
  }

  const last = metrics[metrics.length - 1];
  const totalEpochs = Number(cfg.epochs);
  const progress = Math.min(
    100,
    Math.round((last.epoch / totalEpochs) * 100)
  );

  return {
    status: "running",
    runName: activeRunName,
    epoch: last.epoch,
    totalEpochs,
    progress
  };
}

/**
 * Return live training metrics from results.csv.
 * Used ONLY for live chart updates during training.
 *
 * @returns {Array}
 */
function getTrainingMetrics() {
  if (!activeRunName) return [];

  const runDir = path.join(TRAINING_ROOT, activeRunName);
  const csvPath = path.join(runDir, "results.csv");

  if (!fs.existsSync(csvPath)) return [];

  return parseTrainingMetrics(csvPath);
}

module.exports = {
  startTraining,
  stopTraining,
  getTrainingProgress,
  getTrainingMetrics
};

