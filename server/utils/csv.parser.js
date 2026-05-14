/**
 * ======================================================
 * csv.parser.js 
 * ======================================================
 *
 * Responsibilities:
 * - Parse YOLO training CSV metrics into structured objects
 *
 * Design:
 * - No Express usage
 * - No side effects (read-only)
 * - Pure utility function
 */

const fs = require("fs");

/* ======================================================
   PARSE TRAINING METRICS
====================================================== */

/**
 * Parse YOLO training results CSV file.
 *
 * Expected headers:
 * - epoch
 * - train/box_loss OR train/loss
 * - metrics/mAP50*
 *
 * @param {string} csvPath
 * @returns {Array<{ epoch:number, loss:number|null, map50:number|null }>}
 */
function parseTrainingMetrics(csvPath) {
  if (!fs.existsSync(csvPath)) {
    return [];
  }

  const content = fs.readFileSync(csvPath, "utf8").trim();

  if (!content) {
    return [];
  }

  const lines = content.split("\n");

  // Need at least header + one data row
  if (lines.length < 2) {
    return [];
  }

  const headers = lines[0].split(",");
  const rows = lines.slice(1);

  /* ---------- column detection ---------- */

  const epochIdx = headers.indexOf("epoch");

  if (epochIdx === -1) {
    return [];
  }

  const lossIdx =
    headers.indexOf("train/box_loss") !== -1
      ? headers.indexOf("train/box_loss")
      : headers.indexOf("train/loss");

  const map50Key = headers.find(h =>
    h.startsWith("metrics/mAP50")
  );

  const map50Idx = map50Key
    ? headers.indexOf(map50Key)
    : -1;

  /* ---------- parse rows ---------- */

  return rows.map(line => {
    const values = line.split(",");

    return {
      // YOLO epochs are 0-based → +1 for display
      epoch: Number(values[epochIdx]) + 1,

      loss:
        lossIdx !== -1
          ? Number(values[lossIdx])
          : null,

      map50:
        map50Idx !== -1
          ? Number(values[map50Idx])
          : null
    };
  });
}

module.exports = {
  parseTrainingMetrics
};