/**
 * ======================================================
 * ui.routes.js (CLEANED — NO BEHAVIOR CHANGE)
 * ======================================================
 *
 * Responsibilities:
 * - Serve static HTML pages for the web UI
 * - Map browser URLs to files under /public
 *
 * Design:
 * - No business logic
 * - No API logic
 * - Pure routing layer
 */

const express = require("express");
const router = express.Router();

const path = require("path");

const ROOT = path.join(__dirname, "..", "..");

/* ==============================
   PATH DEFINITIONS
============================== */

const CAPTURE_DIR = path.join(ROOT, "apps", "capture", "public");
const TRAINING_DIR = path.join(ROOT, "apps", "training", "public");
const INSPECT_DIR = path.join(ROOT, "apps", "inspect", "public");

/* ==============================
   ROOT
============================== */

router.get("/", (_req, res) => {
  res.redirect("/capture");
});

/* ==============================
   CAPTURE APP
============================== */

router.get("/capture", (_req, res) => {
  res.sendFile(path.join(CAPTURE_DIR, "index.html"));
});

router.get("/labeler", (_req, res) => {
  res.sendFile(path.join(CAPTURE_DIR, "labeler.html"));
});

/* ==============================
   TRAINING APP
============================== */

router.get("/training", (_req, res) => {
  res.sendFile(path.join(TRAINING_DIR, "trainer.html"));
});

router.get("/experiments", (_req, res) => {
  res.sendFile(path.join(TRAINING_DIR, "experiments.html"));
});

router.get("/datasets", (_req, res) => {
  res.sendFile(path.join(TRAINING_DIR, "datasets.html"));
});

router.get("/settings", (_req, res) => {
  res.sendFile(path.join(TRAINING_DIR, "settings.html"));
});

/* ==============================
   INSPECT APP
============================== */

router.get("/inspect", (_req, res) => {
  res.sendFile(path.join(INSPECT_DIR, "inspect.html"));
});

module.exports = router;