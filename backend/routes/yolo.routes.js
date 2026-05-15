/**
 * ======================================================
 * yolo.routes.js (CLEANED — NO BEHAVIOR CHANGE)
 * ======================================================
 *
 * Responsibilities:
 * - Provide HTTP API for YOLO labeling operations
 * - Delegate all logic to yolo.service
 *
 * Design:
 * - NO filesystem logic
 * - NO YOLO math
 * - Thin routing layer only
 *
 * Endpoints:
 * - POST /api/yolo/save
 * - GET  /api/yolo/classes
 * - POST /api/yolo/undo
 */

const express = require("express");
const router = express.Router();

const yoloService = require("../services/yolo.service");

/* ======================================================
   SAVE YOLO LABELS
   POST /api/yolo/save
====================================================== */

router.post("/save", (req, res) => {
  try {
    const result = yoloService.saveYolo(req.body);

    res.json(result);

  } catch (err) {
    console.error("[YOLO Save Error]", err);

    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
});

/* ======================================================
   GET CLASS LIST
   GET /api/yolo/classes
====================================================== */

router.get("/classes", async (req, res) => {
  try {
    const { station, process } = req.query;

    const classes = await yoloService.getClasses(
      station,
      process
    );

    res.json({ classes });

  } catch (err) {
    console.error("[YOLO Classes Error]", err);

    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
});

/* ======================================================
   UNDO LAST SAVE
   POST /api/yolo/undo
====================================================== */

router.post("/undo", (_req, res) => {
  try {
    const result = yoloService.undoLastSave();

    res.json(result);

  } catch (err) {
    console.error("[YOLO Undo Error]", err);

    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
});

module.exports = router;