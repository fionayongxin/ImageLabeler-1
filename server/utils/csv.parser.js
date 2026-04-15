/**
 * ======================================================
 * csv.parser.js
 * ------------------------------------------------------
 * Responsibility:
 * - Parse YOLO training CSV metrics into structured data
 *
 * Design rules:
 * - NO Express
 * - NO side effects beyond reading the file
 * - Pure utility
 * ======================================================
 */

const fs = require("fs");

/**
 * Parse YOLO training results CSV.
 *
 * Expected headers include:
 * - epoch
 * - train/box_loss OR train/loss
 * - metrics/mAP50*
 *
 * @param {string} csvPath
 * @returns {Array<{ epoch:number, loss:number|null, map50:number|null }>}
 */
function parseTrainingMetrics(csvPath) {
  if (!fs.existsSync(csvPath)) return [];

  const content = fs.readFileSync(csvPath, "utf8").trim();
  if (!content) return [];

  const lines = content.split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",");
  const rows = lines.slice(1);

  const epochIdx = headers.indexOf("epoch");
  if (epochIdx === -1) return [];

  const lossIdx =
    headers.indexOf("train/box_loss") !== -1
      ? headers.indexOf("train/box_loss")
      : headers.indexOf("train/loss");

  const map50Key = headers.find(h => h.startsWith("metrics/mAP50"));
  const map50Idx = map50Key ? headers.indexOf(map50Key) : -1;

  return rows.map(line => {
    const v = line.split(",");
    return {
      epoch: Number(v[epochIdx]) + 1,
      loss: lossIdx !== -1 ? Number(v[lossIdx]) : null,
      map50: map50Idx !== -1 ? Number(v[map50Idx]) : null
    };
  });
}

module.exports = {
  parseTrainingMetrics
};