/**
 * ======================================================
 * config.routes.js (SAFE VERSION)
 * ======================================================
 *
 * ✅ Features preserved:
 * - List configs
 * - Load config
 * - Save config + model
 * - Rename config via save
 * - Delete config
 *
 * ✅ Improvements:
 * - STRICT path safety (no cross-folder overwrite)
 * - Prevent root-level operations
 * - Safe model replacement (per-folder only)
 * - Clear structure + comments
 */

const express = require("express");
const router = express.Router();

const fs = require("fs");
const path = require("path");
const multer = require("multer");

const { CONFIG_ROOT } = require("../config/paths");

/* ======================================================
   MULTER (TEMP UPLOAD)
====================================================== */

const upload = multer({ dest: "uploads/" });

/* ======================================================
   PATH SAFETY HELPERS
====================================================== */

/**
 * ✅ Resolve config folder safely
 * Ensures:
 * - stays inside CONFIG_ROOT
 * - no ../ escape
 */
function getSafeConfigPath(name) {
  if (!name || typeof name !== "string") {
    throw new Error("Invalid config name");
  }

  const safeName = name.trim();

  const resolved = path.resolve(CONFIG_ROOT, safeName);
  const root = path.resolve(CONFIG_ROOT);

  if (!resolved.startsWith(root)) {
    throw new Error("Path traversal detected");
  }

  return resolved;
}

/**
 * ✅ Ensure directory exists
 */
function ensureDir(folder) {
  fs.mkdirSync(folder, { recursive: true });
}

/**
 * ✅ Get model files inside ONE folder only
 */
function getModelFiles(folder) {
  return fs.readdirSync(folder)
    .filter(f => f.endsWith(".pt"));
}

/* ======================================================
   LIST CONFIGS
   GET /api/configs
====================================================== */

router.get("/", (_req, res) => {
  try {
    if (!fs.existsSync(CONFIG_ROOT)) {
      return res.json({ configs: [] });
    }

    const configs = fs.readdirSync(CONFIG_ROOT)
      .filter(name => {
        const full = path.join(CONFIG_ROOT, name);
        return fs.existsSync(full) && fs.statSync(full).isDirectory();
      });

    res.json({ configs });

  } catch (err) {
    console.error("[LIST CONFIG ERROR]", err);
    res.status(500).json({ error: "Failed to list configs" });
  }
});

/* ======================================================
   LOAD CONFIG
   POST /api/configs/select
====================================================== */

router.post("/select", (req, res) => {
  try {
    const { name } = req.body;

    const folder = getSafeConfigPath(name);
    const configPath = path.join(folder, "config.json");

    if (!fs.existsSync(configPath)) {
      return res.status(404).json({ error: "Config not found" });
    }

    const config = JSON.parse(
      fs.readFileSync(configPath, "utf-8")
    );

    let modelFile = null;

    if (fs.existsSync(folder)) {
      const files = fs.readdirSync(folder);
      modelFile = files.find(f => f.endsWith(".pt")) || null;
    }

    res.json({
      status: "ok",
      config,
      modelFile   
    });

  } catch (err) {
    console.error("[SELECT CONFIG ERROR]", err);
    res.status(500).json({ error: "Failed to load config" });
  }
});

/* ======================================================
   SAVE CONFIG + OPTIONAL MODEL
   POST /api/configs/save
====================================================== */

router.post("/save", upload.single("model"), (req, res) => {
  try {
    const { config, oldName } = req.body;

    if (!config) {
      return res.status(400).json({ error: "Config data missing" });
    }

    const parsed = JSON.parse(config);

    if (!parsed.name) {
      return res.status(400).json({ error: "Config name required" });
    }

    const newName = parsed.name;

    let folder;

    /* =========================
       HANDLE RENAME
    ========================= */

    if (oldName && oldName !== newName) {

      const oldFolder = getSafeConfigPath(oldName);
      const newFolder = getSafeConfigPath(newName);

      if (!fs.existsSync(oldFolder)) {
        return res.status(404).json({ error: "Original config not found" });
      }

      if (fs.existsSync(newFolder)) {
        return res.status(400).json({ error: "Config already exists" });
      }

      fs.renameSync(oldFolder, newFolder);
      folder = newFolder;

    } else {
      folder = getSafeConfigPath(newName);
    }

    /* =========================
       ENSURE FOLDER EXISTS
    ========================= */

    ensureDir(folder);

    /* =========================
       SAVE CONFIG.JSON
    ========================= */

    const configPath = path.join(folder, "config.json");

    fs.writeFileSync(
      configPath,
      JSON.stringify(parsed, null, 2),
      "utf-8"
    );

    /* =========================
       SAFE MODEL HANDLING
    ========================= */

    if (req.file) {

      const models = getModelFiles(folder);

      models.forEach(file => {
        fs.unlinkSync(path.join(folder, file));
      });

      const modelPath = path.join(folder, req.file.originalname);

      fs.copyFileSync(req.file.path, modelPath);

      // cleanup temp file
      fs.unlink(req.file.path, () => {});
    }

    res.json({ status: "ok" });

  } catch (err) {
    console.error("[SAVE CONFIG ERROR]", err);
    res.status(500).json({ error: "Failed to save config" });
  }
});

/* ======================================================
   GET MODEL FILE NAME
   GET /api/configs/model-file
====================================================== */

router.get("/model-file", (req, res) => {
  try {
    const { name } = req.query;

    const folder = getSafeConfigPath(name);

    if (!fs.existsSync(folder)) {
      return res.status(404).json({ error: "Config not found" });
    }

    const modelFiles = getModelFiles(folder);

    if (modelFiles.length === 0) {
      return res.json({ modelFile: null });
    }

    const modelFile = modelFiles[0];

    res.json({
      modelFile
    });

  } catch (err) {
    console.error("[MODEL FILE ERROR]", err);
    res.status(500).json({ error: "Failed to get model file" });
  }
});

/* ======================================================
   DELETE CONFIG
   POST /api/configs/delete
====================================================== */

router.post("/delete", (req, res) => {
  try {
    const { name } = req.body;

    const folder = getSafeConfigPath(name);

    if (!fs.existsSync(folder)) {
      return res.status(404).json({ error: "Config not found" });
    }

    fs.rmSync(folder, {
      recursive: true,
      force: true
    });

    res.json({ status: "ok" });

  } catch (err) {
    console.error("[DELETE CONFIG ERROR]", err);
    res.status(500).json({ error: "Failed to delete config" });
  }
});

/* ======================================================
   CHECK MODEL EXISTS
   GET /api/configs/model-exists
====================================================== */

router.get("/model-exists", (req, res) => {
  try {
    const { name } = req.query;

    const folder = getSafeConfigPath(name);

    if (!fs.existsSync(folder)) {
      return res.json({ exists: false });
    }

    const exists = getModelFiles(folder).length > 0;

    res.json({ exists });

  } catch (err) {
    console.error("[MODEL EXISTS ERROR]", err);
    res.status(500).json({ exists: false });
  }
});

module.exports = router;