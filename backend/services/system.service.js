/**
 * ======================================================
 * system.service.js 
 * ======================================================
 *
 * Responsibilities:
 * - Provide system and environment diagnostics
 * - Read-only access to runtime information
 *
 * Design:
 * - No Express / HTTP handling
 * - No filesystem mutation
 * - No business logic
 *
 * Used by:
 * - system.routes.js
 */

const os = require("os");
const { execSync } = require("child_process");

/* ======================================================
   SYSTEM INFORMATION
====================================================== */

/**
 * Gather system and environment information.
 *
 * @returns {{
 *   system: {
 *     hostname: string,
 *     platform: string,
 *     arch: string,
 *     node: string
 *   },
 *   environment: {
 *     python: string,
 *     yolo: string,
 *     cuda: boolean
 *   }
 * }}
 */
function getSystemInfo() {
  let python = "unknown";
  let yolo = "unknown";
  let cuda = false;

  /* -------- Python version -------- */

  try {
    python = execSync("python --version")
      .toString()
      .trim();
  } catch {
    // keep default "unknown"
  }

  /* -------- YOLO version -------- */

  try {
    yolo = execSync("yolo version")
      .toString()
      .trim();
  } catch {
    // keep default "unknown"
  }

  /* -------- CUDA availability -------- */

  try {
    // If command succeeds, CUDA (NVIDIA driver) is present
    execSync("nvidia-smi", { stdio: "ignore" });
    cuda = true;
  } catch {
    // GPU not available or not configured → false
  }

  return {
    system: {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      node: process.version
    },
    environment: {
      python,
      yolo,
      cuda
    }
  };
}

module.exports = {
  getSystemInfo
};