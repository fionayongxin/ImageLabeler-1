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
        throw new Error("Basler capture request failed");
      }

      const result = await response.json();

      if (result?.filename && captureInfo) {
        captureInfo.textContent = result.filename;
      }

      await loadLatestImages();
    } catch (err) {
      console.error("Failed to capture photo:", err);
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
    try {
      const response = await fetch(`/api/photos/latest?limit=${limit}`);
      if (!response.ok) return;

      const images = await response.json();
      if (!Array.isArray(images)) return;

      latestImagesContainer.innerHTML = "";

      const fragment = document.createDocumentFragment();

      images.forEach(publicUrl => {
        const img = document.createElement("img");
        img.src = publicUrl;
        img.loading = "lazy";
        img.onclick = () => window.open(publicUrl, "_blank");
        fragment.appendChild(img);
      });

      latestImagesContainer.appendChild(fragment);
    } catch (err) {
      console.error("Failed to load latest images:", err);
    }
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
