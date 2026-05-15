/**
 * ======================================================
 * inference.service.js 
 * ======================================================
 *
 * Responsibilities:
 * - Load inspection configs from filesystem
 * - Maintain active config (in-memory pointer)
 *
 * Design:
 * - Filesystem is source of truth
 * - No inference logic here
 * - Local-only configuration loading
 */

const fs = require("fs");
const path = require("path");

const { CONFIG_ROOT } = require("../config/paths"); 

/* ======================================================
   ACTIVE CONFIG (IN-MEMORY POINTER)
====================================================== */

let activeConfigName = null;
let activeConfig = null;

/* ======================================================
   LOAD CONFIG FROM FILESYSTEM
====================================================== */

/**
 * Load a config by name.
 *
 * @param {string} configName
 * @returns {object|null}
 */
function loadConfig(configName) {
  try {
    const configPath = path.join(
      CONFIG_ROOT,
      configName,
      "config.json"
    );

    if (!fs.existsSync(configPath)) {
      console.warn("[Config] Not found:", configPath);
      return null;
    }

    const raw = fs.readFileSync(configPath, "utf-8");
    const cfg = JSON.parse(raw);

    // Update in-memory pointer
    activeConfigName = configName;
    activeConfig = cfg;

    return cfg;

  } catch (err) {
    console.error("[Load Config Error]", err);
    return null;
  }
}

/* ======================================================
   LIST AVAILABLE CONFIGS
====================================================== */

/**
 * List all config folders.
 *
 * @returns {string[]}
 */
function listConfigs() {
  try {
    return fs
      .readdirSync(CONFIG_ROOT)
      .filter(name => {
        const full = path.join(CONFIG_ROOT, name);
        return fs.statSync(full).isDirectory();
      });

  } catch (err) {
    console.error("[List Configs Error]", err);
    return [];
  }
}

/* ======================================================
   SET ACTIVE CONFIG
====================================================== */

/**
 * Set the active configuration.
 * (Delegates to loadConfig)
 *
 * @param {string} configName
 */
function setActiveConfig(configName) {
  return loadConfig(configName);
}

/* ======================================================
   EXPORTS
====================================================== */

module.exports = {
  loadConfig,
  setActiveConfig,
  listConfigs
};