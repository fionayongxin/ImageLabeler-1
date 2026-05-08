/**
 * ======================================================
 * inference.routes.js
 * ------------------------------------------------------
 * Responsibility:
 * - HTTP boundary for inference
 * - Delegate all work to inference.service
 *
 * Design rules:
 * - NO ML logic
 * - NO filesystem logic
 * - FastAPI
 * ======================================================
 */


const express = require("express");
const router = express.Router();
const { TRAINING_SERVER_BASE } = require("../config/env");

const {
  runInference,
  readInspectionState,
  setCurrentStep,
  updateInspectionConfig
} = require("../services/inference.service");

// -----------------------------------------------------------------------------
// EXISTING INFERENCE ENDPOINT
// -----------------------------------------------------------------------------

router.get("/status", async (_req, res) => {
  try {
    const result = await runInference();
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Inference failed" });
  }
});

// -----------------------------------------------------------------------------
// ENGINEER: READ INSPECTION STATE
// -----------------------------------------------------------------------------

router.get("/config", async (_req, res) => {
  const state = await readInspectionState();
  res.json(state);
});

// -----------------------------------------------------------------------------
// ENGINEER: UPDATE FULL / PARTIAL CONFIG
// -----------------------------------------------------------------------------

router.post("/config", async (req, res) => {
  const updated = await updateInspectionConfig(req.body);
  res.json({ status: "ok", config: updated });
});

// -----------------------------------------------------------------------------
// ENGINEER: MANUAL STEP CONTROL
// -----------------------------------------------------------------------------

router.post("/step/:step", async (req, res) => {
  const step = Number(req.params.step);
  const updated = await setCurrentStep(step);
  res.json({ status: "ok", currentStep: updated.currentStep });
});

const multer = require("multer");
const upload = multer({ dest: "uploads/" });

router.post("/model/classes", upload.single("model"), async (req, res) => {
  try {
    const fs = require("fs");
    const path = require("path");
    const fetch = require("node-fetch");
    const FormData = require("form-data");

    const filePath = req.file.path;

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

    const data = await response.json();

    fs.unlink(filePath, (err) => {
      if (err) console.warn("Failed to clean upload:", err);
    });

    res.json(data);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to extract classes" });
  }
});

module.exports = router;
