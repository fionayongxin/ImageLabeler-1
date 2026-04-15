/**
 * ======================================================
 * camera.js
 * ------------------------------------------------------
 * Responsibility:
 * - Initialize live camera preview
 * - Capture still images from webcam
 * - Send captured images to backend
 * - Display latest captured photos
 *
 * Design principles:
 * - DOM access only after DOMContentLoaded
 * - Exactly ONE active camera stream
 * - Browser autoplay and security compliant
 * - Backend API contract is trusted
 *
 * Backend endpoints:
 * - POST /api/photos/save
 * - GET  /api/photos/latest
 * ======================================================
 */

document.addEventListener("DOMContentLoaded", () => {
  /* ======================================================
     DOM REFERENCES
  ====================================================== */

  /** <video> element showing live camera stream */
  const video = document.getElementById("video");

  /** <canvas> used for frame capture */
  const canvas = document.getElementById("canvas");

  /** UI elements */
  const captureBtn = document.getElementById("captureBtn");
  const captureInfo = document.getElementById("captureInfo");
  const latestImagesContainer = document.getElementById("latestImages");

  if (!video || !canvas || !captureBtn) {
    console.error("Camera DOM elements missing");
    return;
  }

  /* ======================================================
     VIDEO ELEMENT CONFIG (AUTOPLAY SAFE)
  ====================================================== */

  video.muted = true;        // Required for autoplay
  video.playsInline = true; // Required for dashboard / embedded views
  video.autoplay = true;

  /* ======================================================
     CAMERA INITIALIZATION
  ====================================================== */

  /**
   * Request webcam access and bind stream to video element.
   */
  navigator.mediaDevices
    .getUserMedia({ video: true })
    .then(stream => {
      video.srcObject = stream;
      return video.play();
    })
    .catch(err => {
      console.error("Camera access failed:", err);
    });

  /* ======================================================
     IMAGE CAPTURE
  ====================================================== */

  /**
   * Capture current video frame, mirror horizontally,
   * encode as PNG, and send to backend.
   */
  function capturePhoto() {
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.warn("Video not ready for capture");
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");

    // Mirror horizontally (camera-style preview)
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    const imageData = canvas.toDataURL("image/png");
    saveCapturedPhoto(imageData);
  }

  /**
   * Persist captured image via backend API.
   *
   * @param {string} imageData Base64 PNG data URL
   */
  function saveCapturedPhoto(imageData) {
    fetch("/api/photos/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: imageData })
    })
      .then(res => res.json())
      .then(data => {
        if (data?.filename && captureInfo) {
          captureInfo.textContent = data.filename;
        }
        loadLatestImages();
      })
      .catch(err => {
        console.error("Failed to save photo:", err);
      });
  }

  /* ======================================================
     LATEST IMAGES VIEW
  ====================================================== */

  /**
   * Load and render latest captured images.
   *
   * @param {number} limit Maximum number of thumbnails
   */
  async function loadLatestImages(limit = 2) {
    if (!latestImagesContainer) return;

    let response;
    try {
      response = await fetch(`/api/photos/latest?limit=${limit}`);
    } catch {
      return;
    }

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
  }

  /* ======================================================
     EVENT BINDINGS
  ====================================================== */

  captureBtn.addEventListener("click", () => {
    capturePhoto();
  });

  /* ======================================================
     INITIAL LOAD
  ====================================================== */

  loadLatestImages();
});
