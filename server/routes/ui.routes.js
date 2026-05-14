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

const { SERVER_ROOT } = require("../config/paths");

/* ======================================================
   PATHS
====================================================== */

/**
 * Root directory for all UI HTML files.
 */
const PUBLIC_DIR = path.join(SERVER_ROOT, "public");

/**
 * Helper to send a page from PUBLIC_DIR.
 * (Avoid repeating path.join everywhere)
 */
function sendPage(res, file) {
  res.sendFile(path.join(PUBLIC_DIR, file));
}

/* ======================================================
   ROUTES
====================================================== */

/**
 * Root → redirect to main UI
 */
router.get("/", (_req, res) => {
  res.redirect("/trainer");
});

/**
 * Trainer UI
 */
router.get("/trainer", (_req, res) => {
  sendPage(res, "trainer.html");
});

/**
 * Experiments list UI
 */
router.get("/experiments", (_req, res) => {
  sendPage(res, "experiments.html");
});

/**
 * Experiment details
 * (same HTML, dynamic client rendering)
 */
router.get("/experiments/:name", (_req, res) => {
  sendPage(res, "experiments.html");
});

/**
 * Dataset browser UI
 */
router.get("/datasets", (_req, res) => {
  sendPage(res, "datasets.html");
});

/**
 * System settings UI
 */
router.get("/settings", (_req, res) => {
  sendPage(res, "settings.html");
});

/**
 * Live inspection UI
 */
router.get("/inspect", (_req, res) => {
  sendPage(res, "inspect.html");
});

module.exports = router;