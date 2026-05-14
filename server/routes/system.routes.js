/**
 * ======================================================
 * system.routes.js
 * ======================================================
 *
 * Responsibilities:
 * - Provide system/environment diagnostics via HTTP API
 * - Expose fixed station identity for this machine
 *
 * Design:
 * - Thin routing layer ONLY
 * - All system logic delegated to system.service
 * - No probing logic inside routes
 */

const express = require("express");
const router = express.Router();

const { STATION, PROCESS } = require("../config/env");
const { getSystemInfo } = require("../services/system.service");

/* ======================================================
   SYSTEM INFO
   GET /api/system
====================================================== */

router.get("/", (_req, res) => {
  const info = getSystemInfo();
  res.json(info);
});

/* ======================================================
   SYSTEM IDENTITY
   GET /api/system/identity
====================================================== */

router.get("/identity", (_req, res) => {
  res.json({
    station: STATION,
    process: PROCESS
  });
});

module.exports = router;