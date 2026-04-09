// DOM element references used by the camera page
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const statusText = document.getElementById("status");
const captureInfo = document.getElementById("captureInfo");
const captureBtn = document.getElementById("captureBtn");

// Initialize live camera stream and bind it to the video element
navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
  video.srcObject = stream;
});

// Captures the current video frame, sends it to the backend, and updates UI
function capture() {
  const cameraBox = document.querySelector(".camera-box");

  // Visual flash feedback for capture action
  cameraBox.classList.add("flash");
  setTimeout(() => cameraBox.classList.remove("flash"), 150);

  // Match canvas size to the video frame
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const ctx = canvas.getContext("2d");

  // Mirror the image horizontally before capture
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0);

  // Encode captured frame as PNG data URL
  const data = canvas.toDataURL("image/png");

  // Persist captured image to backend
  fetch("/api/save-photo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: data })
  })
    .then(r => r.json())
    .then(d => {
      // Display saved filename or identifier returned by API
      captureInfo.textContent = d.filename;
    });
}

// Fetches and renders the most recently captured images
async function loadLatestImages(limit = 2) {
  let res;

  try {
    res = await fetch("/api/photos/latest?limit=" + limit);
  } catch {
    // Network failure: silently abort
    return;
  }

  if (!res.ok) return;

  const images = await res.json();
  if (!Array.isArray(images)) return;

  const container = document.getElementById("latestImages");
  if (!container) return;

  // Clear previous thumbnails
  container.innerHTML = "";

  const fragment = document.createDocumentFragment();

  images.forEach(src => {
    const img = document.createElement("img");
    img.src = src;
    img.loading = "lazy";

    // Open full image in a new tab when clicked
    img.onclick = () => window.open(src, "_blank");

    fragment.appendChild(img);
  });

  container.appendChild(fragment);
}

// Load initial thumbnails once DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  loadLatestImages();
});

// Capture button handler: take photo and refresh thumbnails
captureBtn.addEventListener("click", () => {
  capture();
  setTimeout(() => loadLatestImages(), 150);
});