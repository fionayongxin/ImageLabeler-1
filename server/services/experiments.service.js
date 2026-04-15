/**
 * ======================================================
 * experiments.service.js
 * ------------------------------------------------------
 * Responsibility:
 * - Read experiment metadata from disk
 * - List experiments
 * - Provide experiment details
 * - Resolve downloadable weights with industry naming
 *
 * Design rules:
 * - NO Express / HTTP
 * - NO training execution
 * - Read‑only over training artifacts
 * ======================================================
 */

const fs = require("fs");
const path = require("path");

const { TRAINING_ROOT } = require("../config/paths");
const { parseTrainingMetrics } = require("../utils/csv.parser");

/**
 * List all experiments under TRAINING_ROOT.
 *
 * @returns {Array}
 */
function listExperiments() {
  if (!fs.existsSync(TRAINING_ROOT)) return [];

  return fs.readdirSync(TRAINING_ROOT)
    .filter(dir =>
      fs.statSync(path.join(TRAINING_ROOT, dir)).isDirectory()
    )
    .map(name => {
      const runDir = path.join(TRAINING_ROOT, name);
      const cfgPath = path.join(runDir, "run_config.json");
      const resultsCsv = path.join(runDir, "results.csv");
      const bestPt = path.join(runDir, "weights", "best.pt");

      let config = null;
      let startedAt = null;

      if (fs.existsSync(cfgPath)) {
        config = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
        startedAt = config.startedAt ?? null;
      }

      let status = "Failed";
      if (fs.existsSync(bestPt)) status = "Completed";
      else if (fs.existsSync(resultsCsv)) status = "Stopped";

      const stats = fs.statSync(runDir);

      return {
        name,
        status,
        config,
        startedAt,
        updatedAt: stats.mtime.toISOString(),
        hasWeights: fs.existsSync(bestPt),
        hasMetrics: fs.existsSync(resultsCsv)
      };
    })
    .sort((a, b) => {
      const ta = a.startedAt ? new Date(a.startedAt).getTime() : 0;
      const tb = b.startedAt ? new Date(b.startedAt).getTime() : 0;
      return tb - ta;
    });
}

/**
 * Get full details of a single experiment.
 *
 * @param {string} name
 * @returns {Object}
 */
function getExperiment(name) {
  const runDir = path.join(TRAINING_ROOT, name);
  if (!fs.existsSync(runDir)) {
    throw new Error("Experiment not found");
  }

  const cfgPath = path.join(runDir, "run_config.json");
  const resultsCsv = path.join(runDir, "results.csv");
  const bestPt = path.join(runDir, "weights", "best.pt");

  let config = null;
  if (fs.existsSync(cfgPath)) {
    config = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
  }

  const metrics = fs.existsSync(resultsCsv)
    ? parseTrainingMetrics(resultsCsv)
    : [];

  return {
    name,
    config,
    metrics,
    paths: {
      resultsCsv: fs.existsSync(resultsCsv) ? resultsCsv : null,
      bestPt: fs.existsSync(bestPt) ? bestPt : null
    }
  };
}

/**
 * Resolve downloadable weights path and filename.
 *
 * @param {string} name
 * @returns {{ weightsPath: string, filename: string }}
 */
function getWeightsDownload(name) {
  const runDir = path.join(TRAINING_ROOT, name);
  const cfgPath = path.join(runDir, "run_config.json");
  const weightsPath = path.join(runDir, "weights", "best.pt");

  if (!fs.existsSync(cfgPath) || !fs.existsSync(weightsPath)) {
    throw new Error("Weights not found");
  }

  const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));

  const station = cfg.station ?? "station";
  const process = cfg.process ?? "process";
  const model = (cfg.model ?? "model")
    .replace(".pt", "")
    .replace(/[^a-zA-Z0-9_-]/g, "");

  const runs = fs.readdirSync(TRAINING_ROOT)
    .map(r => {
      const c = path.join(TRAINING_ROOT, r, "run_config.json");
      if (!fs.existsSync(c)) return null;

      const data = JSON.parse(fs.readFileSync(c, "utf8"));
      return {
        name: r,
        station: data.station,
        process: data.process,
        model: data.model,
        startedAt: new Date(data.startedAt).getTime()
      };
    })
    .filter(Boolean)
    .filter(r =>
      r.station === cfg.station &&
      r.process === cfg.process &&
      r.model === cfg.model
    )
    .sort((a, b) => a.startedAt - b.startedAt);

  const index = runs.findIndex(r => r.name === name);
  const runNumber = index >= 0 ? index + 1 : runs.length;

  const suffix = `r${String(runNumber).padStart(2, "0")}`;
  const filename = `${station}_${process}_${model}_best_${suffix}.pt`;

  return { weightsPath, filename };
}

/**
 * Read metrics for a completed experiment.
 *
 * @param {string} name
 * @returns {Array}
 */
function getExperimentMetrics(name) {
  const runDir = path.join(TRAINING_ROOT, name);
  const csvPath = path.join(runDir, "results.csv");

  if (!fs.existsSync(csvPath)) {
    throw new Error("Metrics not found");
  }

  return parseTrainingMetrics(csvPath);
}

module.exports = {
  listExperiments,
  getExperiment,
  getWeightsDownload,
  getExperimentMetrics
};