/**
 * ======================================================
 system.routes.js
 * ------------------------------------------------------
 * Responsibility:
 * - HTTP API for system/environment diagnostics
 * - Thin routing layer only
 *
 * Design rules:
 * - NO system probing logic here
 * - Delegate all work to system.service
 * ======================================================
 */

const express = require("express");
const router = express.Router();

const systemService = require("../services/system.service");

/**
 * Get system and environment information.
 */
router.get("/", (_req, res) => {
  const info = systemService.getSystemInfo();
  res.json(info);
});

module.exports = router;
