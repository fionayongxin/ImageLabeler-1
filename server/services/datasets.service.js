/**
 * ======================================================
 * datasets.service.js (FIXED - LOCAL ONLY)
 * ======================================================
 */

const fetch = require("node-fetch");
const { TRAINING_SERVER_BASE } = require("../config/env");

/**
 * Paginated dataset images (via training server)
 */
async function listDatasetImagesPaged(
  station,
  process,
  page = 1,
  limit = 24
) {

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

  const images = (data.images || []).map(
    name =>
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