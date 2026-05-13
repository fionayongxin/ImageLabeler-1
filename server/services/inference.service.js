/**
 * ======================================================
 * inference.service.js — LOCAL FILESYSTEM VERSION
 * ------------------------------------------------------
 * ✅ No server config
 * ✅ No FastAPI inference
 * ✅ Load config from local folder
 * ✅ Apply inspection rules
 * ✅ Placeholder for local detection runner
 * ======================================================
 */

const fs = require("fs");
const path = require("path");

/* ======================================================
   CONFIG ROOT
====================================================== */

const CONFIG_ROOT = path.join(__dirname, "..", "..", "config");

/* ======================================================
   CURRENT ACTIVE CONFIG (MEMORY POINTER)
====================================================== */

let activeConfigName = null;
let activeConfig = null;

/* ======================================================
   LOAD CONFIG FROM FILESYSTEM
====================================================== */

function loadConfig(configName) {
  try {
    const configPath = path.join(
      CONFIG_ROOT,
      configName,
      "config.json"
    );

    if (!fs.existsSync(configPath)) {
      console.warn("[CONFIG] Not found:", configPath);
      return null;
    }

    const raw = fs.readFileSync(configPath, "utf-8");
    const cfg = JSON.parse(raw);

    activeConfigName = configName;
    activeConfig = cfg;

    return cfg;

  } catch (err) {
    console.error("[LOAD CONFIG ERROR]", err);
    return null;
  }
}

/* ======================================================
   LIST AVAILABLE CONFIGS (FOLDERS)
====================================================== */

function listConfigs() {
  try {
    return fs.readdirSync(CONFIG_ROOT)
      .filter(name => {
        const full = path.join(CONFIG_ROOT, name);
        return fs.statSync(full).isDirectory();
      });

  } catch {
    return [];
  }
}

/* ======================================================
   SET ACTIVE CONFIG
====================================================== */

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