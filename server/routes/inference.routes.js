/**
 * ======================================================
 * inference.routes.js — FINAL LOCAL‑ONLY VERSION (FIXED)
 * ======================================================
 *
 * RESPONSIBILITY:
 * - Proxy inference status to Python inference server
 * - Persist inspection runtime state (JSON)
 * - Handle model class extraction (training-time only)
 *
 * DESIGN RULES:
 * - ❌ NO inference logic in Node
 * - ❌ NO runInference()
 * - ✅ Python is the single source of truth
 * - ✅ Node is HTTP + filesystem boundary only
 */

const express = require("express");
const router = express.Router();

const multer = require("multer");
const upload = multer({ dest: "uploads/" });

const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");
const FormData = require("form-data");

const { TRAINING_SERVER_BASE, INFERENCE_SERVER_BASE} = require("../config/env");


/* ======================================================
   RUNTIME INSPECTION STATE PATH (CRITICAL)
====================================================== */

const INSPECTION_STATE_PATH = path.join(
  __dirname,
  "..",
  "..",
  "config",
  "inspection_state.json"
);

/* ======================================================
   INFERENCE STATUS (PROXY ONLY)
   Browser → Node → Python
====================================================== */

router.get("/status", async (_req, res) => {
  try {

    const response = await fetch(
      `${INFERENCE_SERVER_BASE}/infer`,
      { method: "GET" }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error("[INFERENCE PROXY ERROR]", text);
      return res.status(500).json({
        status: "ERROR",
        error: "Inference server error"
      });
    }

    const data = await response.json();
    res.json(data);

  } catch (err) {
    console.error("[INFERENCE PROXY FAILED]", err);
    res.status(500).json({
      status: "ERROR",
      error: "Inference server unavailable"
    });
  }
});


/* ======================================================
   MODEL CLASS EXTRACTION (ENGINEER ONLY)
====================================================== */

router.post(
  "/model/classes",
  upload.single("model"),
  async (req, res) => {

    if (!req.file) {
      return res.status(400).json({
        classes: [],
        error: "No file uploaded"
      });
    }

    const filePath = req.file.path;

    try {
      const form = new FormData();
      form.append("file", fs.createReadStream(filePath));

      const response = await fetch(
        `${TRAINING_SERVER_BASE}/model/classes`,
        {
          method: "POST",
          body: form,
          headers: form.getHeaders()
        }
      );

      if (!response.ok) {
        const text = await response.text();
        console.error("[CLASS EXTRACTION ERROR]", text);
        return res.status(500).json({
          classes: [],
          error: text
        });
      }

      const data = await response.json();
      res.json({ classes: data.classes || [] });

    } catch (err) {
      console.error("[MODEL CLASS ERROR]", err);
      res.status(500).json({
        classes: [],
        error: err.message
      });

    } finally {
      fs.unlink(filePath, () => {});
    }
  }
);

/* ======================================================
   INSPECTION STATE (UI → PYTHON BRIDGE)
====================================================== */

router.post("/state", (req, res) => {
  try {
    const state = req.body;

    if (!state || !state.steps || !state.currentStep) {
      return res.status(400).json({
        status: "error",
        message: "Invalid inspection state"
      });
    }

    fs.writeFileSync(
      INSPECTION_STATE_PATH,
      JSON.stringify(state, null, 2),
      "utf-8"
    );

    res.json({ status: "ok" });

  } catch (err) {
    console.error("[INSPECTION STATE ERROR]", err);
    res.status(500).json({
      status: "error",
      message: "Failed to save inspection state"
    });
  }
});

module.exports = router;