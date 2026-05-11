/**
 * ======================================================
 * inference.routes.js — HARDENED & FULLY SAFE
 * ======================================================
 */

const express = require("express");
const router = express.Router();

const multer = require("multer");
const upload = multer({ dest: "uploads/" });

const fs = require("fs");
const fetch = require("node-fetch");
const FormData = require("form-data");

/* ======================================================
   LOCAL INFERENCE
====================================================== */

const {
  runInference
} = require("../services/inference.service");

/* ======================================================
   INFERENCE STATUS
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
   MODEL CLASS EXTRACTION (CRITICAL FIXED)
====================================================== */

router.post(
  "/model/classes",
  upload.single("model"),
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
      const form = new FormData();
      form.append("file", fs.createReadStream(filePath));

      // ✅ call FastAPI with timeout protection
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(
        "http://127.0.0.1:8002/model/classes",
        {
          method: "POST",
          body: form,
          headers: form.getHeaders(),
          signal: controller.signal
        }
      );

      clearTimeout(timeout);

      // ✅ handle FastAPI failure properly
      if (!response.ok) {
        const text = await response.text();
        console.error("[FASTAPI ERROR]", text);

        return res.status(500).json({
          classes: [],
          error: `FastAPI error: ${text}`
        });
      }

      let data;
      try {
        data = await response.json();
      } catch (err) {
        console.error("[JSON PARSE ERROR]", err);

        return res.status(500).json({
          classes: [],
          error: "Invalid JSON from FastAPI"
        });
      }

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
      // ✅ cleanup always
      fs.unlink(filePath, err => {
        if (err) console.warn("[CLEANUP WARNING]", err);
      });
    }
  }
);

module.exports = router;
