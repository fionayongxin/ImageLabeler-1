/**
 ======================================================
 * trainer.js
 * ======================================================
 */

const MIN_BOX_SIZE = 20;
const NORMAL_LINE_WIDTH = 3;
const SELECTED_LINE_WIDTH = 6;
const PREVIEW_LINE_WIDTH = 2;
const HANDLE_SIZE = 10;

const BOX_COLORS = {
  ok: "#22c55e",
  defect: "#ef4444",
  scratch: "#fb923c"
};

const CLASS_MAP = { ok: 0, defect: 1, scratch: 2 };
const STATION = "station1";
const PROCESS = "processA";

/* ===================== STATE ===================== */

let images = [];
let currentIndex = -1;
let currentImage = null;

let mode = "read";
let boxes = [];
let selectedBox = -1;

let drawing = false;
let dragging = false;
let resizing = false;

let startX = 0;
let startY = 0;
let lastUndo = null;

let canvasScaleX = 1; // Track X scale ratio
let canvasScaleY = 1; // Track Y scale ratio

/* ===================== DOM ===================== */

const thumbs = document.getElementById("thumbs");
const img = document.getElementById("image");
const canvas = document.getElementById("overlay");
const ctx = canvas.getContext("2d");

const classSelect = document.getElementById("classSelect");
const statusText = document.getElementById("status");

const readBtn = document.getElementById("readModeBtn");
const drawBtn = document.getElementById("drawModeBtn");
const saveYoloBtn = document.getElementById("saveYoloBtn");
const deleteImageBtn = document.getElementById("deleteImageBtn");

deleteImageBtn.disabled = true;

/* ===================== STATUS ===================== */

function setStatus(msg, type = "info") {
  statusText.textContent = msg;
  statusText.className = `status status-${type}`;
}

function updateSaveButtonState() {
  const canSave =
    mode === "draw" &&
    boxes.length > 0 &&
    classSelect.value !== "";

  saveYoloBtn.disabled = !canSave;
  saveYoloBtn.classList.toggle("disabled", !canSave);
}

/* ===================== MODE ===================== */

function setMode(m) {
  mode = m;
  readBtn.classList.toggle("active", m === "read");
  drawBtn.classList.toggle("active", m === "draw");
  readBtn.disabled = m === "read";
  drawBtn.disabled = m === "draw";
  canvas.classList.toggle("read-mode", m === "read");
  canvas.classList.toggle("draw-mode", m === "draw");
  canvas.style.pointerEvents = m === "draw" ? "auto" : "none";
  canvas.style.cursor = m === "draw" ? "crosshair" : "default";
  setStatus(m === "draw" ? "Draw mode" : "Read mode");
  updateSaveButtonState();
}

readBtn.onclick = () => setMode("read");
drawBtn.onclick = () => setMode("draw");
setMode("read");

/* ===================== LOAD IMAGES ===================== */

fetch("/api/photos")
  .then(r => r.json())
  .then(list => {
    images = list.map(url => ({
      url,
      filename: url.split("/").pop()
    }));
    renderThumbnails();
  });

function renderThumbnails() {
  thumbs.innerHTML = "";
  images.forEach((imgObj, i) => {
    const t = document.createElement("img");
    t.src = imgObj.url;
    t.onclick = () => loadImage(i);
    thumbs.appendChild(t);
  });
}

/* ===================== IMAGE LOAD ===================== */

function loadImage(i) {
  if (i < 0 || i >= images.length) return;

  currentIndex = i;
  currentImage = images[i];
  deleteImageBtn.disabled = false;

  boxes = [];
  selectedBox = -1;

  img.onload = () => {
    
  console.log(
    canvas.width, canvas.height,
    img.clientWidth, img.clientHeight
  );

    // Wait for layout to settle before measuring
    requestAnimationFrame(() => {
      const rect = img.getBoundingClientRect();
      
      // Set canvas internal resolution to natural image size

      canvas.width = rect.width;
      canvas.height = rect.height;

      // Calculate scale factors for both axes
      canvasScaleX = img.naturalWidth / rect.width;
      canvasScaleY = img.naturalHeight / rect.height;

      console.log("Image loaded:", {
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        displayWidth: rect.width,
        displayHeight: rect.height,
        scaleX: canvasScaleX,
        scaleY: canvasScaleY
      });

      // Set canvas display size to match image display size
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      redraw();
    });
  };

  img.src = currentImage.url;
  document.getElementById("currentImage").textContent =
    currentImage.filename;
}

/* ===================== GEOMETRY ===================== */

function toCanvas(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * canvasScaleX,
    y: (e.clientY - r.top) * canvasScaleY
  };
}

function inside(b, x, y) {
  return (
    x >= b.x && x <= b.x + b.w &&
    y >= b.y && y <= b.y + b.h
  );
}

function hitCorner(b, x, y) {
  return (
    Math.abs(x - b.x) <= HANDLE_SIZE ||
    Math.abs(x - (b.x + b.w)) <= HANDLE_SIZE ||
    Math.abs(y - b.y) <= HANDLE_SIZE ||
    Math.abs(y - (b.y + b.h)) <= HANDLE_SIZE
  );
}

/* ===================== CANVAS EVENTS ===================== */

canvas.addEventListener("mousedown", e => {
  const { x, y } = toCanvas(e);

  for (let i = boxes.length - 1; i >= 0; i--) {
    if (hitCorner(boxes[i], x, y)) {
      selectedBox = i;
      resizing = true;
      startX = x;
      startY = y;
      redraw();
      return;
    }
  }

  for (let i = boxes.length - 1; i >= 0; i--) {
    if (inside(boxes[i], x, y)) {
      selectedBox = i;
      dragging = true;
      startX = x;
      startY = y;
      redraw();
      return;
    }
  }

  selectedBox = -1;
  redraw();

  if (mode !== "draw" || !classSelect.value) return;

  drawing = true;
  startX = x;
  startY = y;
});

canvas.addEventListener("mousemove", e => {
  const { x, y } = toCanvas(e);

  if (resizing && selectedBox !== -1) {
    const b = boxes[selectedBox];
    b.w = Math.max(MIN_BOX_SIZE, x - b.x);
    b.h = Math.max(MIN_BOX_SIZE, y - b.y);
    redraw();
    return;
  }

  if (dragging && selectedBox !== -1) {
    const b = boxes[selectedBox];
    b.x += x - startX;
    b.y += y - startY;
    startX = x;
    startY = y;
    redraw();
    return;
  }

  if (drawing) {
    redraw();
    drawBox(startX, startY, x - startX, y - startY, classSelect.value, true);
  }
});

canvas.addEventListener("mouseup", e => {
  if (drawing) {
    const { x, y } = toCanvas(e);

    let w = x - startX;
    let h = y - startY;
    let fx = startX;
    let fy = startY;

    if (w < 0) { fx += w; w = -w; }
    if (h < 0) { fy += h; h = -h; }

    boxes.push({
      x: fx,
      y: fy,
      w: Math.max(MIN_BOX_SIZE, w),
      h: Math.max(MIN_BOX_SIZE, h),
      label: classSelect.value
    });

    setStatus(`${boxes.length} box(es) · Not saved`, "warning");
  }

  resizing = dragging = drawing = false;
  redraw();
  updateSaveButtonState();
});

/* ===================== DRAW ===================== */

function drawBox(x, y, w, h, label, preview = false, selected = false) {
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = BOX_COLORS[label];
  ctx.lineWidth = preview
    ? PREVIEW_LINE_WIDTH
    : selected
    ? SELECTED_LINE_WIDTH
    : NORMAL_LINE_WIDTH;

  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = BOX_COLORS[label];
  ctx.fillText(label, x + 6, y + 18);
  ctx.restore();
}

function redraw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  boxes.forEach((b, i) =>
    drawBox(b.x, b.y, b.w, b.h, b.label, false, i === selectedBox)
  );
}

/* ===================== DELETE ===================== */

// Delete selected box with DELETE or BACKSPACE
window.addEventListener("keydown", e => {
  if ((e.key === "Delete" || e.key === "Backspace") && selectedBox !== -1) {
    boxes.splice(selectedBox, 1);
    selectedBox = -1;
    redraw();
    updateSaveButtonState();
    setStatus("Box deleted", "warning");
  }
});

deleteImageBtn.onclick = async () => {
  if (!currentImage) return;
  if (!confirm(`Delete "${currentImage.filename}"?`)) return;

  await fetch("/api/photos/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: currentImage.filename })
  });

  images.splice(currentIndex, 1);
  renderThumbnails();
  loadImage(Math.min(currentIndex, images.length - 1));
};

/* ===================== SAVE YOLO ===================== */

saveYoloBtn.onclick = () => {
  fetch("/api/yolo/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image: currentImage.filename,
      width: canvas.width,
      height: canvas.height,
      boxes,
      classMap: CLASS_MAP,
      station: STATION,
      process: PROCESS
    })
  }).then(() => {
    setStatus("Saved", "success");
    updateSaveButtonState();
    
    // Remove current image from list and load next
    images.splice(currentIndex, 1);
    renderThumbnails();
    loadImage(Math.min(currentIndex, images.length - 1));
  });
};

/* ===================== UNDO ===================== */

window.addEventListener("keydown", e => {
  if (e.ctrlKey && e.key.toLowerCase() === "z" && lastUndo) {
    fetch("/api/yolo/undo", { method: "POST" })
      .then(() => {
        images.splice(lastUndo.index, 0, lastUndo.image);
        renderThumbnails();
        loadImage(lastUndo.index);
        lastUndo = null;
        setStatus("Undo successful", "success");
      });
  }
});