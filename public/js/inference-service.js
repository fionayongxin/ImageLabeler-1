/**
 * ======================================================
 * inference-service.js — FINAL, CLEAN, FIXED, COMMENTED
 * ------------------------------------------------------
 * RESPONSIBILITY (LOCK THIS IN):
 * ✅ Acts as an API / orchestration layer (Node.js)
 * ✅ Serves camera image
 * ✅ Manages active model selection
 * ✅ Delegates inference to Python
 * ❌ Does NOT run ML logic itself
 *
 * This file is intentionally SIMPLE and PREDICTABLE.
 * ======================================================
 */

const express = require("express");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const multer = require("multer");

const app = express();

/* ======================================================
   CORS — allow browser UI to call this service
====================================================== */
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});

/* ======================================================
   STATIC CONFIG (POC-LEVEL)
   ------------------------------------------------------
   NOTE:
   - IMAGE_PATH is a simulated camera image
   - DEFAULT_MODEL is used when no uploaded model exists
====================================================== */
const IMAGE_PATH =
  "/home/user/Documents/h1-visual-inspection/interface/datasets/station_01/final_inspection/images/92762c6d__331aa42d-Image__2026-03-25__15-47-02.jpg";

const DEFAULT_MODEL =
  "/home/user/Documents/h1-visual-inspection/interface/training/station_01-final_inspection-yolo26m-1775783357791/weights/best.pt";

const PY_INFER =
  "/home/user/Documents/h1-visual-inspection/interface/inspect/inference_service.py";

/* ======================================================
   CAMERA ENDPOINT
   ------------------------------------------------------
   PURPOSE:
   - Simulates a live camera feed
   - Frontend uses <img src="/video">
====================================================== */
app.get("/video", (req, res) => {
  if (!fs.existsSync(IMAGE_PATH)) {
    return res.status(404).send("Image not found");
  }

  const stat = fs.statSync(IMAGE_PATH);

  res.setHeader("Content-Type", "image/jpeg");
  res.setHeader("Content-Length", stat.size);
  res.setHeader("Cache-Control", "no-store");

  res.sendFile(IMAGE_PATH);
});

/* ======================================================
   MODEL STORAGE & UPLOAD
====================================================== */
const MODELS_DIR = path.join(__dirname, "models");
if (!fs.existsSync(MODELS_DIR)) {
  fs.mkdirSync(MODELS_DIR);
}

/* Multer storage: keep original filename for traceability */
const storage = multer.diskStorage({
  destination: MODELS_DIR,
  filename: (_, file, cb) => cb(null, file.originalname)
});

/* Accept ONLY .pt files */
const uploadModel = multer({
  storage,
  fileFilter: (_, file, cb) => {
    if (file.originalname.endsWith(".pt")) {
      cb(null, true);
    } else {
      cb(new Error("Only .pt files allowed"));
    }
  }
});

/* Active model metadata file */
const ACTIVE_META = path.join(MODELS_DIR, "active_model.json");

/**
 * Returns absolute path to active model if exists,
 * otherwise null.
 */
function getActiveModelPath() {
  if (!fs.existsSync(ACTIVE_META)) return null;

  const meta = JSON.parse(fs.readFileSync(ACTIVE_META, "utf8"));
  return meta.path ? path.join(__dirname, meta.path) : null;
}

/**
 * Upload + activate model
 * ------------------------------------------------------
 * This endpoint is intended for ENGINEER mode only.
 */
app.post("/model/upload", uploadModel.single("model"), (req, res) => {
  const modelPath = path.join("models", req.file.filename);

  fs.writeFileSync(
    ACTIVE_META,
    JSON.stringify({ path: modelPath }, null, 2)
  );

  res.json({
    status: "ok",
    activeModel: modelPath
  });
});

/* ======================================================
   INFERENCE ENDPOINT (SINGLE SOURCE OF TRUTH)
   ------------------------------------------------------
   FLOW:
   1. Decide which model to use
   2. Spawn Python inference script
   3. Return JSON exactly as Python prints it
====================================================== */
app.get("/status", (req, res) => {
  const modelPath = getActiveModelPath() || DEFAULT_MODEL;

  if (!fs.existsSync(modelPath)) {
    return res.json({
      status: "FAIL",
      detections: []
    });
  }

  const py = spawn("python", [
    PY_INFER,
    modelPath,
    IMAGE_PATH
  ]);

  let stdout = "";
  let stderr = "";

  py.stdout.on("data", data => {
    stdout += data.toString();
  });

  py.stderr.on("data", data => {
    stderr += data.toString();
  });

  py.on("close", () => {
    if (stderr) {
      console.error("[INFERENCE ERROR]", stderr);
      return res.json({
        status: "FAIL",
        detections: []
      });
    }

    try {
      res.json(JSON.parse(stdout));
    } catch (err) {
      console.error("[BAD JSON FROM PYTHON]", stdout);
      res.json({
        status: "FAIL",
        detections: []
      });
    }
  });
});

/* ======================================================
   START SERVER
====================================================== */
app.listen(3001, () => {
  console.log("✅ Inference service running on http://localhost:3001");
});
