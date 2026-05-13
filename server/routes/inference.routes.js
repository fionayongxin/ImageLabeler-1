/**
 * ======================================================
 * inference.routes.js — FINAL HARDENED PRODUCTION VERSION
 * ======================================================
 *
 * ✅ Express routes use PATHS only (no full URLs)
 * ✅ Training server address used ONLY in fetch()
 * ✅ Safe temp file handling
 * ✅ Clear FastAPI error visibility
 * ✅ No feature removed
 */

const express = require("express");
const router = express.Router();

const multer = require("multer");
const upload = multer({ dest: "uploads/" });

const fs = require("fs");
const fetch = require("node-fetch");
const FormData = require("form-data");

// ✅ centralised training server address
const { TRAINING_SERVER_BASE } = require("../config/env");

// ✅ local inference (unchanged)
const {
  runInference
} = require("../services/inference.service");

/* ======================================================
   INFERENCE STATUS (LOCAL ONLY)
====================================================== */

router.get("/status", async (_req, res) => {
  try {
    const result = await runInference();
    res.json(result);

  } catch (err) {
    console.error("[INFERENCE ERROR]", err);
    res.status(500).json({
      status: "ERROR",
      error: "Local inference failed"
    });
  }
});

/* ======================================================
   MODEL CLASS EXTRACTION
   - Upload via browser
   - Forward to FastAPI training server
====================================================== */

router.post(
  "/model/classes",            // ✅ PATH ONLY (IMPORTANT)
  upload.single("model"),      // ✅ frontend must send "model"
  async (req, res) => {

    // ✅ validate upload
    if (!req.file) {
      console.error("[UPLOAD ERROR] req.file missing");
      return res.status(400).json({
        classes: [],
        error: "No file uploaded"
      });
    }

    const filePath = req.file.path;
    console.log("[UPLOAD RECEIVED]", filePath);

    try {
      // ✅ forward file to FastAPI
      const form = new FormData();
      form.append("file", fs.createReadStream(filePath));

      const response = await fetch(
        `${TRAINING_SERVER_BASE}/model/classes`,   // ✅ CORRECT TARGET
        {
          method: "POST",
          body: form,
          headers: form.getHeaders()
        }
      );

      // ✅ FastAPI error visibility
      if (!response.ok) {
        const text = await response.text();
        console.error("[FASTAPI ERROR]", text);

        return res.status(500).json({
          classes: [],
          error: text
        });
      }

      const data = await response.json();
      console.log("[CLASSES RECEIVED]", data.classes);

      res.json({
        classes: data.classes || []
      });

    } catch (err) {
      console.error("[MODEL CLASS ERROR]", err);

      res.status(500).json({
        classes: [],
        error: err.message || "Class extraction failed"
      });

    } finally {
      // ✅ ALWAYS cleanup temp file
      fs.unlink(filePath, err => {
        if (err) {
          console.warn("[CLEANUP WARNING]", err);
        }
      });
    }
  }
);

module.exports = router;