/**
 * ======================================================
 * inference.service.js
 * ------------------------------------------------------
 * Responsibility:
 * - Orchestrate inference via FastAPI ONLY
 * - Manage active model metadata
 * - Never run ML locally
 *
 * Design rules:
 * - NO spawn / NO python execution
 * - NO Express / HTTP objects
 * - FastAPI is the single inference runtime
 * ======================================================
 */

const fs = require("fs");
const axios = require("axios");

const {
  ACTIVE_MODEL_META
} = require("../config/paths");

const {
  FASTAPI_BASE_URL
} = require("../config/env");

/**
 * Persist active model relative path.
 *
 * @param {string} relativePath
 */
function setActiveModel(relativePath) {
  if (!relativePath) {
    throw new Error("Invalid model path");
  }

  fs.writeFileSync(
    ACTIVE_MODEL_META,
    JSON.stringify({ path: relativePath }, null, 2)
  );
}

/**
 * Trigger FastAPI to reload the active model.
 *
 * @returns {Promise<Object>}
 */
async function reloadModel() {
  const res = await axios.post(`${FASTAPI_BASE_URL}/reload`);
  return res.data;
}

/**
 * Run inference via FastAPI.
 *
 * @returns {Promise<Object>}
 */
async function runInference() {
  const res = await axios.get(`${FASTAPI_BASE_URL}/infer`);
  return res.data;
}

module.exports = {
  setActiveModel,
  reloadModel,
  runInference
};
