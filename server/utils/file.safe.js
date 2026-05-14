/**
 * ======================================================
 * file.safe.js 
 * ======================================================
 *
 * Responsibilities:
 * - Provide safe filesystem helper functions
 * - Centralize common fs operations
 *
 * Design:
 * - No Express usage
 * - No business logic
 * - Small, reusable, predictable helpers
 */

const fs = require("fs");
const path = require("path");

/* ======================================================
   ENSURE DIRECTORY
====================================================== */

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

/* ======================================================
   MOVE FILE (SAFE)
====================================================== */

/**
 * Move (rename) a file safely.
 * Ensures destination directory exists.
 *
 * @param {string} from
 * @param {string} to
 */
function moveFileSafe(from, to) {
  ensureDir(path.dirname(to));
  fs.renameSync(from, to);
}

/* ======================================================
   DELETE FILE (SAFE)
====================================================== */

/**
 * Delete a file if it exists.
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