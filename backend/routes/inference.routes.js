/**
 * ======================================================
 * inference.routes.js 
 * ======================================================
 *
 * Responsibilities:
 * - Proxy inference status (Node → Python)
 * - Persist inspection runtime state (JSON)
 * - Forward model class extraction to training server
 *
 * Design Rules:
 * - No inference logic in Node
 * - Python is the single source of truth
 * - Node handles HTTP + filesystem boundary
 */

const express = require("express");
const router = express.Router();

const multer = require("multer");
const upload = multer({ dest: "uploads/" });

const fs = require("fs");
const fetch = require("node-fetch");
const FormData = require("form-data");

const {
  TRAINING_SERVER_BASE,
  INFERENCE_SERVER_BASE
} = require("../config/env");

const {
  INSPECTION_STATE_PATH
} = require("../config/paths"); 

/* ======================================================
   INFERENCE STATUS (PROXY)
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
      console.error("[Inference Proxy Error]", text);

      return res.status(500).json({
        status: "ERROR",
        error: "Inference server error"
      });
    }

    const data = await response.json();
    res.json(data);

  } catch (err) {
    console.error("[Inference Proxy Failed]", err);

    res.status(500).json({
      status: "ERROR",
      error: "Inference server unavailable"
    });
  }
});


/* ======================================================
   MODEL CLASS EXTRACTION (ENGINEER)
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
        console.error("[Class Extraction Error]", text);

        return res.status(500).json({
          classes: [],
          error: text
        });
      }

      const data = await response.json();

      res.json({
        classes: data.classes || []
      });

    } catch (err) {
      console.error("[Model Class Error]", err);

      res.status(500).json({
        classes: [],
        error: err.message
      });

    } finally {
      // Cleanup temp upload file
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
    console.error("[Inspection State Error]", err);

    res.status(500).json({
      status: "error",
      message: "Failed to save inspection state"
    });
  }
});

/* ======================================================
   RELOAD MODEL (NODE → PYTHON)
   POST /api/inference/reload
====================================================== */

router.post("/reload", async (_req, res) => {
  try {
    const response = await fetch(
      `${INFERENCE_SERVER_BASE}/reload`,
      { method: "POST" }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error("[Reload Proxy Error]", text);

      return res.status(500).json({
        status: "ERROR",
        error: "Inference reload failed"
      });
    }

    const data = await response.json();

    res.json({
      status: "ok",
      data
    });

  } catch (err) {
    console.error("[Reload Failed]", err);

    res.status(500).json({
      status: "ERROR",
      error: "Inference server unavailable"
    });
  }
});

module.exports = router;
