/**
 * ======================================================
 * config.routes.js — FILESYSTEM ONLY (STEP 5 FINAL)
 * ======================================================
 *
 * Responsibilities:
 * - List available configs (folders)
 * - Load config.json
 * - Save config.json + optional model
 * - Delete config folder
 *
 * Design rules:
 * - ❌ NO active config in memory
 * - ❌ NO inference logic
 * - ✅ Filesystem is the source of truth
 */
const express = require("express");
const router = express.Router();

const fs = require("fs");
const path = require("path");
const multer = require("multer");

/* ======================================================
   PATHS
====================================================== */

const CONFIG_ROOT = path.join(__dirname, "..", "..", "config");
const upload = multer({ dest: "uploads/" });

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
        return fs.statSync(full).isDirectory();
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
    if (!name) {
      return res.status(400).json({ error: "Config name required" });
    }

    const configPath = path.join(CONFIG_ROOT, name, "config.json");
    if (!fs.existsSync(configPath)) {
      return res.status(404).json({ error: "Config not found" });
    }

    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    res.json({ status: "ok", config });

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
    const { config } = req.body;
    if (!config) {
      return res.status(400).json({ error: "Config data missing" });
    }

    const parsed = JSON.parse(config);
    if (!parsed.name) {
      return res.status(400).json({ error: "Config name required" });
    }

    const folder = path.join(CONFIG_ROOT, parsed.name);
    fs.mkdirSync(folder, { recursive: true });

    // save config.json
    fs.writeFileSync(
      path.join(folder, "config.json"),
      JSON.stringify(parsed, null, 2),
      "utf-8"
    );

    // save model if provided
    if (req.file) {
      const modelPath = path.join(folder, req.file.originalname);
      fs.copyFileSync(req.file.path, modelPath);
      fs.unlink(req.file.path, () => {});
    }

    res.json({ status: "ok" });

  } catch (err) {
    console.error("[SAVE CONFIG ERROR]", err);
    res.status(500).json({ error: "Failed to save config" });
  }
});

/* ======================================================
   DELETE CONFIG
   POST /api/configs/delete
====================================================== */

router.post("/delete", (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Config name required" });
    }

    const folder = path.join(CONFIG_ROOT, name);
    if (!fs.existsSync(folder)) {
      return res.status(404).json({ error: "Config not found" });
    }

    fs.rmSync(folder, { recursive: true, force: true });
    res.json({ status: "ok" });

  } catch (err) {
    console.error("[DELETE CONFIG ERROR]", err);
    res.status(500).json({ error: "Failed to delete config" });
  }
});

module.exports = router;