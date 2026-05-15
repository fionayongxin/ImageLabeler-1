/**
 * ======================================================
 * yolo.format.js
 * ======================================================
 *
 * Responsibilities:
 * - Convert pixel-based bounding boxes to YOLO format
 * - Build YOLO label lines and files
 *
 * Design:
 * - No filesystem access
 * - No Express usage
 * - No side effects
 * - Deterministic input → output
 */

/* ======================================================
   NORMALIZATION
====================================================== */

/**
 * Convert absolute bounding box to YOLO normalized values.
 *
 * @param {{ x:number, y:number, w:number, h:number }} box
 * @param {number} imgW
 * @param {number} imgH
 * @returns {{ xc:number, yc:number, w:number, h:number }}
 */
function toYoloNormalized(box, imgW, imgH) {
  return {
    xc: (box.x + box.w / 2) / imgW,
    yc: (box.y + box.h / 2) / imgH,
    w: box.w / imgW,
    h: box.h / imgH
  };
}

/* ======================================================
   SINGLE LINE BUILDER
====================================================== */

/**
 * Build a YOLO label line.
 *
 * Format:
 * classId xc yc w h
 *
 * @param {number} classId
 * @param {{ x:number, y:number, w:number, h:number }} box
 * @param {number} imgW
 * @param {number} imgH
 * @param {number} precision
 * @returns {string}
 */
function buildYoloLine(
  classId,
  box,
  imgW,
  imgH,
  precision = 6
) {
  const { xc, yc, w, h } = toYoloNormalized(box, imgW, imgH);

  return [
    classId,
    xc.toFixed(precision),
    yc.toFixed(precision),
    w.toFixed(precision),
    h.toFixed(precision)
  ].join(" ");
}

/* ======================================================
   FILE BUILDER
====================================================== */

/**
 * Build YOLO label file lines.
 *
 * @param {Array<{ x:number, y:number, w:number, h:number, label:string }>} boxes
 * @param {{ [label:string]: number }} classMap
 * @param {number} imgW
 * @param {number} imgH
 * @returns {string[]}
 */
function buildYoloFile(boxes, classMap, imgW, imgH) {
  return boxes
    .map(box => {
      const classId = classMap[box.label];

      // Skip unknown labels
      if (classId === undefined) {
        return null;
      }

      return buildYoloLine(
        classId,
        box,
        imgW,
        imgH
      );
    })
    .filter(Boolean);
}

module.exports = {
  toYoloNormalized,
  buildYoloLine,
  buildYoloFile
};