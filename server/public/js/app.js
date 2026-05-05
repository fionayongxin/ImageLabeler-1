/**
 * ======================================================
 * app.js  (Frontend – Basler Camera, Server‑Side Controlled)
 * ------------------------------------------------------
 * Responsibility:
 * - Display live Basler camera preview (MJPEG stream)
 * - Trigger still image capture via backend
 * - Display latest captured photos
 *
 * Design principles:
 * - Browser NEVER accesses camera hardware
 * - Exactly ONE active camera owner (Python / pypylon)
 * - Frontend is view + trigger only
 * - Backend API contract is trusted
 * - Filenames / public URLs only
 *
 * Backend endpoints:
 * - POST /api/camera/capture
 * - GET  /api/camera/stream
 * - GET  /api/photos/latest
 * ======================================================
 */

document.addEventListener("DOMContentLoaded", () => {
  /* ======================================================
     DOM REFERENCES
     ------------------------------------------------------
     NOTE:
     - `video` ID is intentionally retained for layout
     - Element must be an <img>, NOT a <video>
  ====================================================== */

  const livePreview = document.getElementById("video"); // <img>
  const captureBtn = document.getElementById("captureBtn");
  const captureInfo = document.getElementById("captureInfo");
  const latestImagesContainer = document.getElementById("latestImages");

  if (!captureBtn || !latestImagesContainer) {
    console.error("Camera DOM elements missing");
    return;
  }

  /* ======================================================
     LIVE PREVIEW INITIALIZATION
     ------------------------------------------------------
     - MJPEG stream provided by Python (Basler)
     - Proxied via Node at /api/camera/stream
     - No browser permissions required
  ====================================================== */

  if (livePreview) {
    livePreview.src = "/api/camera/stream";
    livePreview.alt = "Basler Live Preview";
    livePreview.loading = "eager";
  }

  /* ======================================================
     STILL IMAGE CAPTURE (BASLER)
     ------------------------------------------------------
     - Capture is executed SERVER‑SIDE
     - Browser only sends trigger command
     - Capture button is locked during operation
  ====================================================== */

async function capturePhoto() {
  captureBtn.disabled = true;

  try {
    const response = await fetch("/api/camera/capture", {
      method: "POST"
    });

    if (!response.ok) {
      throw new Error("Basler capture failed");
    }

    // ✅ THIS updates "latest"
    await loadLatestImages();

  } catch (err) {
    console.error(err);
  } finally {
    captureBtn.disabled = false;
  }
}

  /* ======================================================
     LATEST IMAGES VIEW
     ------------------------------------------------------
     - Backend returns PUBLIC URLs only
     - Frontend never touches filesystem
  ====================================================== */

async function loadLatestImages(limit = 2) {
  const res = await fetch(`/api/photos?page=1&limit=${limit}`);
  if (!res.ok) return;

  const data = await res.json();
  const images = data.images || [];

  latestImagesContainer.innerHTML = "";
  const frag = document.createDocumentFragment();

  images.forEach(src => {
    const img = document.createElement("img");
    img.src = `${src}?t=${Date.now()}`; // cache‑bust
    img.onclick = () =>
      window.open(src.replace("/thumbs/", "/"), "_blank");
    frag.appendChild(img);
  });

  latestImagesContainer.appendChild(frag);
}

  /* ======================================================
     EVENT BINDINGS
  ====================================================== */

  captureBtn.addEventListener("click", capturePhoto);

  /* ======================================================
     INITIAL LOAD
  ====================================================== */

  loadLatestImages();
});
