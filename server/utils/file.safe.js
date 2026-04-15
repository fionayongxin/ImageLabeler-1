/**
 * ======================================================
 * file.safe.js
 * ------------------------------------------------------
 * Responsibility:
 * - Safe filesystem helpers
 * - Centralize common fs patterns
 *
 * Design rules:
 * - NO Express
 * - NO business logic
 * - Small, reusable, predictable helpers
 * ======================================================
 */

const fs = require("fs");
const path = require("path");

/**
 * Ensure a directory exists (mkdir -p behavior).
 *
 * @param {string} dirPath
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Safely move a file (rename).
 *
 * @param {string} from
 * @param {string} to
 */
function moveFileSafe(from, to) {
  ensureDir(path.dirname(to));
  fs.renameSync(from, to);
}

/**
 * Safely delete a file if it exists.
 *
 * @param {string} filePath
 */
function deleteFileSafe(filePath) {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

module.exports = {
  ensureDir,
  moveFileSafe,
  deleteFileSafe
};