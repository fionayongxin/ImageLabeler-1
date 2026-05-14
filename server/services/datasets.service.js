/**
 * ======================================================
 * datasets.service.js
 * ======================================================
 *
 * Responsibilities:
 * - Fetch dataset images from training server
 * - Return paginated result with thumbnail URLs
 *
 * Design:
 * - Training server is the source of truth
 * - Backend acts as proxy/formatter only
 */

const fetch = require("node-fetch");

const { TRAINING_SERVER_BASE } = require("../config/env");

/* ======================================================
   LIST DATASET IMAGES (PAGINATED)
====================================================== */

/**
 * Fetch paginated dataset images.
 *
 * @param {string} station
 * @param {string} process
 * @param {number} page
 * @param {number} limit
 * @returns {{ total: number, images: string[] }}
 */
async function listDatasetImagesPaged(
  station,
  process,
  page = 1,
  limit = 24
) {
  // Defensive guard (no query if identity missing)
  if (!station || !process) {
    return { total: 0, images: [] };
  }

  const url =
    `${TRAINING_SERVER_BASE}/datasets/images` +
    `?station=${encodeURIComponent(station)}` +
    `&process=${encodeURIComponent(process)}` +
    `&page=${page}` +
    `&limit=${limit}`;

  const res = await fetch(url);

  if (!res.ok) {
    return { total: 0, images: [] };
  }

  const data = await res.json();

  // Convert image names → thumbnail URLs
  const images = (data.images || []).map(name =>
    `${TRAINING_SERVER_BASE}/datasets/${station}/${process}/images/thumbs/${name}`
  );

  return {
    total: data.total || 0,
    images
  };
}

module.exports = {
  listDatasetImagesPaged
};