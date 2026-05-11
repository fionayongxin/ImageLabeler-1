/**
 * ======================================================
 * inference.routes.js — FINAL STABLE VERSION
 * ------------------------------------------------------
 * Responsibility:
 * ✅ HTTP boundary only
 * ✅ Delegate ALL logic to inference.service
 *
 * Design rules:
 * - NO ML logic here
 * - NO filesystem logic here (except temp cleanup)
 * - FastAPI = inference runtime
 * ======================================================
 */

const express = require("express");
const router = express.Router();

const multer = require("multer");
const upload = multer({ dest: "uploads/" });

const {
  runInference,
  readInspectionState,
  setCurrentStep,
  updateInspectionConfig
} = require("../services/inference.service");

const { TRAINING_SERVER_BASE } = require("../config/env");

/* ======================================================
   INFERENCE STATUS (OPERATOR)
====================================================== */

router.get("/status", async (_req, res) => {
  try {
    const result = await runInference();
    res.json(result);
  } catch (err) {
    console.error("[INFERENCE ERROR]", err);
    res.status(500).json({ error: "Inference failed" });
  }
});

/* ======================================================
   READ INSPECTION CONFIG (ENGINEER)
====================================================== */

router.get("/config", async (_req, res) => {
  try {
    const state = await readInspectionState();
    res.json(state);
  } catch (err) {
    console.error("[READ CONFIG ERROR]", err);
    res.status(500).json({ error: "Failed to read config" });
  }
});

/* ======================================================
   SAVE INSPECTION CONFIG (ENGINEER)
====================================================== */

router.post("/config", async (req, res) => {
  try {
    // Expect FULL config object
    const updated = await updateInspectionConfig(req.body);
    res.json({ status: "ok", config: updated });
  } catch (err) {
    console.error("[SAVE CONFIG ERROR]", err);
    res.status(500).json({ error: "Failed to save config" });
  }
});

/* ======================================================
   MANUAL STEP CONTROL (ENGINEER / DEBUG)
====================================================== */

router.post("/step/:stepId", async (req, res) => {
  try {
    const stepId = req.params.stepId;
    const updated = await setCurrentStep(stepId);

    if (!updated) {
      return res.status(404).json({ error: "Config not found" });
    }

    res.json({
      status: "ok",
      currentStep: updated.currentStep
    });
  } catch (err) {
    console.error("[SET STEP ERROR]", err);
    res.status(500).json({ error: "Failed to set step" });
  }
});

/* ======================================================
   MODEL CLASS EXTRACTION (ENGINEER)
====================================================== */

router.post(
  "/model/classes",
  upload.single("model"),
  async (req, res) => {
    const fs = require("fs");
    const fetch = require("node-fetch");
    const FormData = require("form-data");

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const filePath = req.file.path;

    try {
      // Forward file to FastAPI
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
        throw new Error("FastAPI class extraction failed");
      }

      const data = await response.json();
      res.json(data);

    } catch (err) {
      console.error("[MODEL CLASS ERROR]", err);
      res.status(500).json({ error: "Failed to extract classes" });

    } finally {
      fs.unlink(filePath, err => {
        if (err) console.warn("Failed to clean upload:", err);
      });
    }
  }
);

module.exports = router;