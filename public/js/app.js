const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const statusText = document.getElementById("status");
const captureInfo = document.getElementById("captureInfo");

navigator.mediaDevices.getUserMedia({ video: true })
  .then(stream => {
    video.srcObject = stream;
  });

function capture() {
  const cameraBox = document.querySelector(".camera-box");

  // Visual feedback
  cameraBox.classList.add("flash");
  setTimeout(() => cameraBox.classList.remove("flash"), 150);

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");

  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0);

  const data = canvas.toDataURL("image/png");

  fetch("/api/save-photo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: data })
  })
    .then(r => r.json())
    .then(d => {
      captureInfo.textContent = d.filename;
    });
}

/* ===============================
   LOAD LATEST CAPTURED IMAGES
================================ */
async function loadLatestImages(limit = 2) {
  let res;
  try {
    res = await fetch("/api/photos/latest?limit=" + limit);
  } catch {
    return;
  }

  if (!res.ok) return;

  const images = await res.json();
  if (!Array.isArray(images)) return;

  const container = document.getElementById("latestImages");
  if (!container) return;

  container.innerHTML = "";

  const fragment = document.createDocumentFragment();

  images.forEach(src => {
    const img = document.createElement("img");
    img.src = src;
    img.loading = "lazy";
    img.onclick = () => window.open(src, "_blank");
    fragment.appendChild(img);
  });

  container.appendChild(fragment);
}
document.addEventListener("DOMContentLoaded", () => loadLatestImages());

const captureBtn = document.getElementById("captureBtn");

captureBtn.addEventListener("click", async () => {
  capture();          // take & save photo
  setTimeout(() => loadLatestImages(), 150);
});
