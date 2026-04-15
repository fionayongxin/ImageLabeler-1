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
  const result = yoloService.saveYolo(req.body);
  res.json(result);
});

/**
 * Undo the last YOLO save operation.
 */
router.post("/undo", (_req, res) => {
  const result = yoloService.undoLastSave();
  res.json(result);
});

module.exports = router;