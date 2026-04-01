const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const statusText = document.getElementById("status");
const captureInfo = document.getElementById("captureInfo");

navigator.mediaDevices.getUserMedia({ video: true })
  .then(stream => {
    video.srcObject = stream;
    statusText.textContent = "Camera streaming";
  });

function capture() {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");

  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0);

  const data = canvas.toDataURL("image/png");
  statusText.textContent = "Saving...";

  fetch("/api/save-photo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: data })
  })
    .then(r => r.json())
    .then(d => {
      statusText.textContent = "Saved";
      captureInfo.textContent = d.filename;
    });
}
``