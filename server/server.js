/**
 * ======================================================
 * server.js  (FIXED)
 * ======================================================
 */

const express = require("express");
const path = require("path");
const { spawn } = require("child_process");
const { SERVER_PORT } = require("./config/env");
const { PHOTOS_DIR } = require("./config/paths");

const thumbsRoutes = require("./routes/thumbs.routes");

const app = express();

/* ======================================================
   MIDDLEWARE
====================================================== */

app.use(express.json({ limit: "10mb" }));

/* ======================================================
   AUTO-START BASLER CAMERA SERVICE
====================================================== */

const pythonScript = path.join(__dirname, "../basler_stream.py");

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
   STATIC ASSETS (FAST PATH)
====================================================== */

// UI assets
app.use(express.static(path.join(__dirname, "public")));

app.use(
  "/photos",
  express.static(PHOTOS_DIR, {
    maxAge: "7d",
    immutable: true
  })
);

app.use(
  "/datasets",
  express.static(path.join(__dirname, "..", "datasets"), {
    maxAge: "7d"
  })
);

app.use(
  "/training",
  express.static(path.join(__dirname, "training"))
);

/* ======================================================
   API ROUTES
====================================================== */

app.use("/api/camera", require("./routes/camera.routes"));
app.use("/api/photos", require("./routes/photos.routes"));
app.use("/api/datasets", require("./routes/datasets.routes"));
app.use("/api/yolo", require("./routes/yolo.routes"));
app.use("/api/train", require("./routes/training.routes"));
app.use("/api/experiments", require("./routes/experiments.routes"));
app.use("/api/inference", require("./routes/inference.routes"));
app.use("/api/system", require("./routes/system.routes"));
app.use("/api/configs", require("./routes/configs.routes"));
app.use("/thumbs", thumbsRoutes);

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