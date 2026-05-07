/**
 * ======================================================
 * yolo.routes.js
 * ------------------------------------------------------
 * Responsibility:
 * - HTTP API for YOLO labeling actions
 * - Thin routing layer only
 *
 * Design rules:
 * - NO filesystem logic here
 * - NO YOLO math here
 * - Delegate all work to yolo.service
 *
 * Endpoints:
 * - POST /api/yolo/save   → save YOLO labels + move image
 * - POST /api/yolo/undo   → undo last save
 * ======================================================
 */

const express = require("express");
const router = express.Router();

const yoloService = require("../services/yolo.service");

/**
 * Save YOLO labels for a labeled image.
 * Body expects:
 * {
 *   image: string,
 *   width: number,
 *   height: number,
 *   boxes: [{ x, y, w, h, label }],
 *   classMap: { labelName: classId },
 *   station: string,
 *   process: string
 * }
 */
router.post("/save", (req, res) => {
  try {
    const result = yoloService.saveYolo(req.body);
    res.json(result);
  } catch (error) {
    console.error("[YOLO] save error", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

router.get("/classes", async (req, res) => {
  try {
    const { station, process } = req.query;
    const classes = await yoloService.getClasses(station, process);
    res.json({ classes });
  } catch (error) {
    console.error("[YOLO] classes error", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

/**
 * Undo the last YOLO save operation.
 */
router.post("/undo", (_req, res) => {
  try {
    const result = yoloService.undoLastSave();
    res.json(result);
  } catch (error) {
    console.error("[YOLO] undo error", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

module.exports = router;