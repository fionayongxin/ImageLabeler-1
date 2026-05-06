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

const { STATION, PROCESS } = require("../config/env");

/**
 * GET /api/system/identity
 * Returns fixed station & process for this PC
 */
router.get("/identity", (_req, res) => {
  res.json({
    station: STATION,
    process: PROCESS
  });
});

module.exports = router;