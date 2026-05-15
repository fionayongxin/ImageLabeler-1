/**
 * ======================================================
 * app.js (Frontend – Basler Camera, Server‑Side Controlled)
 * ======================================================
 *
 * RESPONSIBILITY:
 * - Display live Basler MJPEG stream (via backend proxy)
 * - Trigger server-side image capture
 * - Render latest captured images
 *
 * DESIGN CONSTRAINTS:
 * - Browser NEVER accesses camera hardware
 * - Exactly ONE active camera owner (Python / pypylon)
 * - Frontend is strictly view + trigger layer
 * - Backend API contract is trusted
 * - All image sources are public URLs only
 *
 * BACKEND ENDPOINTS:
 * - POST /api/camera/capture
 * - GET  /api/camera/stream
 * - GET  /api/photos (paginated)
 */

document.addEventListener("DOMContentLoaded", () => {

  /* ======================================================
     DOM REFERENCES
     ====================================================== */

  // NOTE:
  // - "video" ID retained for layout compatibility
  // - Element MUST be <img>, NOT <video>

  const livePreview = document.getElementById("video"); // <img>
  const captureBtn = document.getElementById("captureBtn");
  const captureInfo = document.getElementById("captureInfo"); // currently unused but kept
  const latestImagesContainer = document.getElementById("latestImages");

  // Guard clause — prevent runtime errors if DOM is incomplete
  if (!captureBtn || !latestImagesContainer) {
    console.error("[Camera] Required DOM elements missing");
    return;
  }

  /* ======================================================
     LIVE PREVIEW INITIALIZATION
     ====================================================== */

  function initLivePreview() {
    if (!livePreview) return;

    livePreview.src = "/api/camera/stream";
    livePreview.alt = "Basler Live Preview";
    livePreview.loading = "eager";
  }

  /* ======================================================
     CAPTURE PHOTO (SERVER-SIDE TRIGGER)
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

      // Refresh latest images after successful capture
      await loadLatestImages();

    } catch (err) {
      console.error("[Camera Capture Error]", err);
    } finally {
      captureBtn.disabled = false;
    }
  }

  /* ======================================================
     LOAD LATEST IMAGES
     ====================================================== */

  async function loadLatestImages(limit = 2) {
    try {
      const res = await fetch(`/api/photos?page=1&limit=${limit}`);
      if (!res.ok) return;

      const data = await res.json();
      const images = data.images || [];

      // Clear existing thumbnails
      latestImagesContainer.innerHTML = "";

      const fragment = document.createDocumentFragment();

      images.forEach(src => {
        const img = document.createElement("img");

        // Cache-busting (force reload of latest image)
        img.src = `${src}?t=${Date.now()}`;

        // Open full image (replace thumbnail path)
        img.onclick = () => {
          window.open(src.replace("/thumbs/", "/"), "_blank");
        };

        // Remove invalid / broken thumbnails
        img.onerror = () => {
          console.warn("[Camera] Thumbnail missing:", src);
          img.remove();
        };

        fragment.appendChild(img);
      });

      latestImagesContainer.appendChild(fragment);

    } catch (err) {
      console.error("[Latest Images Error]", err);
    }
  }

  /* ======================================================
     EVENT BINDINGS
     ====================================================== */

  captureBtn.addEventListener("click", capturePhoto);

  /* ======================================================
     INITIALIZATION
     ====================================================== */

  initLivePreview();
  loadLatestImages();

});