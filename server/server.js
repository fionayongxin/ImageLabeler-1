/**
 * ======================================================
 * server.js
 * ------------------------------------------------------
 * Responsibility:
 * - Express server bootstrap
 * - Static asset exposure
 * - API route registration
 * - Auto-start Basler camera service (Python)
 *
 * Design principles:
 * - Basler camera owned by Python only
 * - Node orchestrates services
 * - Frontend never touches camera hardware
 * ======================================================
 */

const express = require("express");
const path = require("path");
const { spawn } = require("child_process");
const { SERVER_PORT } = require("./config/env");

const app = express();

/* ======================================================
   MIDDLEWARE
====================================================== */

app.use(express.json({ limit: "10mb" }));

/* ======================================================
   AUTO-START BASLER CAMERA SERVICE (OPTION 2)
====================================================== */

const pythonScript = path.join(
  __dirname,
  "../basler_stream.py"
);

const baslerProcess = spawn("python", [pythonScript], {
  stdio: "inherit"
});

baslerProcess.on("error", err => {
  console.error("[Basler] Failed to start basler_stream.py:", err);
});

process.on("exit", () => {
  console.log("[Server] Shutting down Basler camera service");
  baslerProcess.kill();
});

/* ======================================================
   STATIC ASSETS
====================================================== */

app.use(express.static(path.join(__dirname, "public")));
app.use("/photos", express.static(path.join(__dirname, "photos")));
app.use("/datasets", express.static(path.join(__dirname, "..", "datasets")));
app.use("/training", express.static(path.join(__dirname, "training")));

/* ======================================================
   API ROUTES
====================================================== */

// Basler camera APIs
app.use("/api/camera", require("./routes/camera.routes"));

// Existing APIs (unchanged)
app.use("/api/photos", require("./routes/photos.routes"));
app.use("/api/datasets", require("./routes/datasets.routes"));
app.use("/api/yolo", require("./routes/yolo.routes"));
app.use("/api/train", require("./routes/training.routes"));
app.use("/api/experiments", require("./routes/experiments.routes"));
app.use("/api/inference", require("./routes/inference.routes"));
app.use("/api/system", require("./routes/system.routes"));

/* ======================================================
   UI ROUTES (LAST)
====================================================== */

app.use("/", require("./routes/ui.routes"));

/* ======================================================
   START SERVER
====================================================== */

app.listen(SERVER_PORT, () => {
  console.log(`Server running at http://localhost:${SERVER_PORT}`);
  console.log("[Server] Basler camera service auto-started");
});
``