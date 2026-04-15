/**
 * ======================================================
 * system.service.js
 and environment diagnostics * ------------------------------------------------------
 * - Read-only access to runtime information
 *
 * Design rules:
 * - NO Express / HTTP handling
 * - NO filesystem mutation
 * - NO business logic
 *
 * This service is used by system.routes.js.
 * ======================================================
 */

const os = require("os");
const { execSync } = require("child_process");

/**
 * Gather system and environment information.
 *
 * @returns {{
 *   system: { hostname, platform, arch, node },
 *   environment: { python, yolo, cuda }
 * }}
 */
function getSystemInfo() {
  let python = "unknown";
  let yolo = "unknown";
  let cuda = false;

  try {
    python = execSync("python --version").toString().trim();
  } catch {}

  try {
    yolo = execSync("yolo version").toString().trim();
  } catch {}

  try {
    execSync("nvidia-smi", { stdio: "ignore" });
    cuda = true;
  } catch {}

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