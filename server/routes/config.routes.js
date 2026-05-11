/**
 * ======================================================
 * config.routes.js — CLEAN & HARDENED VERSION
 * ======================================================
 */

const express = require("express");
const router = express.Router();

const fs = require("fs");
const path = require("path");
const multer = require("multer");

const {
  setActiveConfig,
  listConfigs
} = require("../services/inference.service");

/* ======================================================
   CONFIG ROOT
====================================================== */

const CONFIG_ROOT = path.join(__dirname, "..", "..", "config");

/* ======================================================
   MULTER (TEMP UPLOAD)
====================================================== */

const upload = multer({ dest: "uploads/" });

/* ======================================================
   LIST CONFIGS
====================================================== */

router.get("/", (_req, res) => {
  try {
    const configs = listConfigs();
    res.json({ configs });

  } catch (err) {
    console.error("[LIST CONFIG ERROR]", err);
    res.status(500).json({ error: "Failed to list configs" });
  }
});

/* ======================================================
   SELECT CONFIG
====================================================== */

router.post("/select", (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Config name required" });
    }

    const cfg = setActiveConfig(name);

    if (!cfg) {
      return res.status(404).json({ error: "Config not found" });
    }

    res.json({ status: "ok", config: cfg });

  } catch (err) {
    console.error("[SELECT CONFIG ERROR]", err);
    res.status(500).json({ error: "Failed to load config" });
  }
});

/* ======================================================
   SAVE CONFIG ✅ FIXED
====================================================== */

router.post("/save", upload.single("model"), (req, res) => {
  try {
    const { config } = req.body;
    const file = req.file;

    if (!config) {
      return res.status(400).json({ error: "Config data missing" });
    }

    let parsed;
    try {
      parsed = JSON.parse(config);
    } catch (err) {
      console.error("[JSON PARSE ERROR]", err);
      return res.status(400).json({ error: "Invalid JSON config" });
    }

    if (!parsed.name || parsed.name.trim() === "") {
      return res.status(400).json({ error: "Config name required" });
    }

    const folderPath = path.join(CONFIG_ROOT, parsed.name);

    // ✅ ensure folder exists
    fs.mkdirSync(folderPath, { recursive: true });

    // ✅ save config.json
    const jsonPath = path.join(folderPath, "config.json");
    fs.writeFileSync(jsonPath, JSON.stringify(parsed, null, 2));

    // ✅ save model (ONLY if provided)
    if (file) {
      try {
        const modelPath = path.join(folderPath, file.originalname);

        fs.copyFileSync(file.path, modelPath);

        // ✅ cleanup temp file safely
        fs.unlink(file.path, err => {
          if (err) console.warn("[CLEANUP ERROR]", err);
        });

        console.log("[MODEL SAVED]", modelPath);

      } catch (err) {
        console.error("[MODEL SAVE ERROR]", err);
      }
    } else {
      console.log("[SAVE CONFIG] No model uploaded (allowed update)");
    }

    res.json({ status: "ok" });

  } catch (err) {
    console.error("[SAVE CONFIG ERROR]", err);
    res.status(500).json({ error: "Failed to save config" });
  }
});

/* ======================================================
   DELETE CONFIG ✅ FIXED
====================================================== */

router.post("/delete", (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Config name required" });
    }

    const folderPath = path.join(CONFIG_ROOT, name);

    if (!fs.existsSync(folderPath)) {
      return res.status(404).json({ error: "Config not found" });
    }

    fs.rmSync(folderPath, {
      recursive: true,
      force: true
    });

    console.log("[CONFIG DELETED]", name);

    res.json({ status: "ok" });

  } catch (err) {
    console.error("[DELETE CONFIG ERROR]", err);
    res.status(500).json({ error: "Failed to delete config" });
  }
});

module.exports = router;
