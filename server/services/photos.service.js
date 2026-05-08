/**
 * ======================================================
 * photos.service.js  (UNIFIED – NO THUMB LOGIC)
 * ======================================================
 */

const fs = require("fs");
const path = require("path");
const { PHOTOS_DIR } = require("../config/paths");

const IMAGE_REGEX = /\.(png|jpg|jpeg)$/i;

if (!fs.existsSync(PHOTOS_DIR)) {
  fs.mkdirSync(PHOTOS_DIR, { recursive: true });
}

/* ======================================================
   PAGINATED LISTING
====================================================== */

function listPhotosPaged(page = 1, limit = 24) {
  
  const files = fs
    .readdirSync(PHOTOS_DIR)
    .filter(name => IMAGE_REGEX.test(name))
    .sort((a, b) => b.localeCompare(a)); 

  const total = files.length;
  const start = (page - 1) * limit;
  const slice = files.slice(start, start + limit);

  return {
    total,
    images: slice.map(name => `/thumbs/photos/${name}`)
  };
}

/* ======================================================
   SAVE PHOTO (FULL IMAGE ONLY)
====================================================== */

async function savePhoto(base64Image) {
  const match = base64Image.match(/^data:image\/\w+;base64,(.+)$/);
  if (!match) throw new Error("Invalid image");

  const buffer = Buffer.from(match[1], "base64");

  const filename = `photo_${Date.now()}.png`;
  const fullPath = path.join(PHOTOS_DIR, filename);

  fs.writeFileSync(fullPath, buffer);

  return {
    filename,
    url: `/photos/${filename}`
  };
}

/* ======================================================
   DELETE
====================================================== */

function deletePhoto(imageName) {
  const fullPath = path.join(PHOTOS_DIR, imageName);
  const thumbPath = path.join(PHOTOS_DIR, "thumbs", imageName);

  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }

  if (fs.existsSync(thumbPath)) {
    fs.unlinkSync(thumbPath);
  }

  return { success: true };
}

module.exports = {
  listPhotosPaged,
  savePhoto,
  deletePhoto
};