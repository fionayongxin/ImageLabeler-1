/**
 * ======================================================
 * server.js
 * ======================================================
 *
 * Responsibilities:
 * - Initialize Express server
 * - Handle authentication (SSPI + custom middleware)
 * - Serve static assets
 * - Mount API and UI routes
 * - Auto-start Basler camera service
 */

const express = require("express");
const path = require("path");
const { spawn } = require("child_process");

const NodeSSPI = require("node-sspi");

const { SERVER_PORT } = require("./config/env");
const {
  PHOTOS_DIR,
  DATASET_ROOT,
  TRAINING_ROOT,
  SERVER_ROOT
} = require("./config/paths");

const authMiddleware = require("./middleware/auth");

/* ======================================================
   ROUTES
====================================================== */

const thumbsRoutes = require("./routes/thumbs.routes");

/* ======================================================
   APP INIT
====================================================== */

const app = express();

const nodeSSPI = new NodeSSPI({
  retrieveGroups: true
});

/* ======================================================
   WINDOWS AUTH (SSPI)
====================================================== */

app.use((req, res, next) => {
  nodeSSPI.authenticate(req, res, err => {
    if (err) {
      console.error("[SSPI Error]", err);
      return res.status(500).send("Windows authentication failed.");
    }

    // response may already be completed by SSPI
    if (res.finished) return;

    next();
  });
});

/* ======================================================
   DEBUG ROUTES (AUTH)
====================================================== */

app.get("/whoami", (req, res) => {
  res.json({
    user: req.connection.user || null,
    userSid: req.connection.userSid || null,
    groups: req.connection.userGroups || []
  });
});

/* ======================================================
   MIDDLEWARE
====================================================== */

app.use(express.json({ limit: "10mb" }));
app.use(authMiddleware);

/**
 * Test auth middleware / identity
 */
app.get("/api/test-db", (req, res) => {
  res.json({
    ok: true,
    user: req.user || null
  });
});

/**
 * Current authenticated user
 */
app.get("/api/me", (req, res) => {
  res.json({
    userId: req.user?.userId || null,
    fullName: [req.user?.firstName, req.user?.lastName]
      .filter(Boolean)
      .join(" ")
  });
});

/* ======================================================
   AUTO-START BASLER CAMERA SERVICE
====================================================== */

const BASLER_SCRIPT = path.join(SERVER_ROOT, "..", "basler_stream.py"); // ✅ improved

const baslerProcess = spawn("python", [BASLER_SCRIPT], {
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

// UI assets
app.use(express.static(path.join(SERVER_ROOT, "public")));

// Captured photos
app.use(
  "/photos",
  express.static(PHOTOS_DIR, {
    maxAge: "7d",
    immutable: true
  })
);

// Dataset images
app.use(
  "/datasets",
  express.static(DATASET_ROOT, {
    maxAge: "7d"
  })
);

// Training outputs
app.use(
  "/training",
  express.static(TRAINING_ROOT)
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