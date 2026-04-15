/**
 * ======================================================
 * ui.routes.js
 * ------------------------------------------------------
 * Responsibility:
 * - Serve static HTML pages for the web UI
 * - Map browser URLs to HTML files under /public
 *
 * Design rules:
 * - NO business logic
 * - NO API logic
 * - NO filesystem mutation
 * - Express routing only
 * * ======================================================
 */

const express = require("express");
const path = require("path");

const router = express.Router();

/**
 * Absolute path to the public HTML directory.
 * All UI pages must live here.
 */
const PUBLIC_DIR = path.join(__dirname, "..", "public");

/**
 * Root entry point.
 * Redirect users to the main trainer page.
 */
router.get("/", (_req, res) => {
  res.redirect("/trainer");
});

/**
 * Trainer / labeling UI.
 */
router.get("/trainer", (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "trainer.html"));
});

/**
 * Experiments list UI.
 */
router.get("/experiments", (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "experiments.html"));
});

/**
 * Experiment details UI.
 * Uses the same HTML file; content is loaded dynamically on the client.
 */
router.get("/experiments/:name", (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "experiments.html"));
});

/**
 * Dataset browser UI.
 */
router.get("/datasets", (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "datasets.html"));
});

/**
 * System settings / environment UI.
 */
router.get("/settings", (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "settings.html"));
});

/**
 * Live inspection UI (Operator / Engineer).
 */
router.get("/inspect", (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "inspect.html"));
});

/**
 * Export router for mounting in server.js
 */
module.exports = router;
