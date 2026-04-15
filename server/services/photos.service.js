/**
 * ======================================================
 * photos.service.js
 * ------------------------------------------------------
 * Responsibility:
 * - Business logic for captured photos
 * - Filesystem operations related to photos only
 *
 * Design rules:
 * - NO Express / HTTP handling
 * - NO request/response objects
 * - Service ALWAYS returns public URLs
 * - Filenames are internal implementation detail
 * ======================================================
 */

const fs = require("fs");
const path = require("path");
const { PHOTOS_DIR } = require("../config/paths");

/**
 * Ensure photos directory exists at startup.
 */
if (!fs.existsSync(PHOTOS_DIR)) {
  fs.mkdirSync(PHOTOS_DIR, { recursive: true });
}

/**
 * Convert internal filename to public URL.
 *
 * @param {string} filename
 * @returns {string} public URL
 */
function toPublicUrl(filename) {
  return `/photos/${filename}`;
}

/**
 * List all stored photos (newest first).
 *
 * @returns {string[]} public photo URLs
 */
function listPhotos() {
  return fs
    .readdirSync(PHOTOS_DIR)
    .filter(name => name.toLowerCase().endsWith(".png"))
    .sort((a, b) => b.localeCompare(a))
    .map(toPublicUrl);
}

/**
 * Save a base64‑encoded PNG image to disk.
 *
 * @param {string} base64Image data:image/png;base64,...
 * @returns {{ filename: string, url: string }}
 */
function savePhoto(base64Image) {
  if (!base64Image || !base64Image.startsWith("data:image")) {
    throw new Error("Invalid image data");
  }

  const data = base64Image.replace(/^data:image\/png;base64,/, "");
  const filename = `photo_${Date.now()}.png`;
  const targetPath = path.join(PHOTOS_DIR, filename);

  fs.writeFileSync(targetPath, data, "base64");

  return {
    filename,
    url: toPublicUrl(filename)
  };
}

/**
 * Delete a photo by filename.
 *
 * @param {string} imageName internal filename
 * @returns {{ success: boolean }}
 */
function deletePhoto(imageName) {
  if (!imageName) {
    throw new Error("Missing image name");
  }

  const filePath = path.join(PHOTOS_DIR, imageName);

  if (!fs.existsSync(filePath)) {
    throw new Error("Image not found");
  }

  fs.unlinkSync(filePath);

  return { success: true };
}

/**
 * Get latest N photos.
 *
 * @param {number} limit
 * @returns {string[]} public photo URLs
 */
function getLatestPhotos(limit = 5) {
  return fs
    .readdirSync(PHOTOS_DIR)
    .filter(name => name.toLowerCase().endsWith(".png"))
    .map(name => {
      const fullPath = path.join(PHOTOS_DIR, name);
      return {
        name,
        time: fs.statSync(fullPath).mtimeMs
      };
    })
    .sort((a, b) => b.time - a.time)
    .slice(0, limit)
    .map(entry => toPublicUrl(entry.name));
}

module.exports = {
  listPhotos,
  savePhoto,
  deletePhoto,
  getLatestPhotos
};
