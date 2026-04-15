/**
 * ======================================================
 * trainer.js
 * ------------------------------------------------------
 * Responsibility:
 * - Display captured photos
 * - Allow bounding‑box labeling
 * - Save YOLO annotations
 * - Delete photos
 * - Undo last YOLO save
 *
 * Design rules:
 * - Frontend never touches filesystem
 * - APIs receive FILENAMES only
 * - UI uses PUBLIC URLs only (/photos/*)
 *
 * Aligned backend endpoints:
 * - GET  /api/photos
 * - POST /api/photos/delete
 * - POST /api/yolo/save
 * - POST /api/yolo/undo
 * ======================================================
 */

/* ======================================================
   CONFIG
====================================================== */

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

/* ======================================================
   STATE
====================================================== */

/**
 * images[] item shape:
 * {
 *   filename: "photo_xxx.png",
 *   url: "/photos/photo_xxx.png"
 * }
 */
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

/**
 * Undo buffer:
 * {
 *   image: { filename, url },
 *   index: number
 * }
 */
let lastUndo = null;

/* ======================================================
   DOM REFERENCES
====================================================== */

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

/* ======================================================
   STATUS
====================================================== */

function setStatus(message, type = "info") {
  statusText.textContent = message;
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

/* ======================================================
   MODE
====================================================== */

function setMode(m) {
  mode = m;
  readBtn.classList.toggle("active", m === "read");
  drawBtn.classList.toggle("active", m === "draw");
  canvas.className = `${m}-mode`;
  setStatus(m === "draw" ? "Draw mode" : "Read mode");
  updateSaveButtonState();
}

readBtn.onclick = () => setMode("read");
drawBtn.onclick = () => setMode("draw");
setMode("read");

/* ======================================================
   INITIAL LOAD
====================================================== */

fetch("/api/photos")
  .then(r => r.json())
  .then(list => {
    // Backend returns PUBLIC URLs → normalize into objects
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
    t.dataset.index = i;
    thumbs.appendChild(t);
  });
}

thumbs.addEventListener("click", e => {
  const thumb = e.target.closest("img");
  if (!thumb) return;
  loadImage(Number(thumb.dataset.index));
});

/* ======================================================
   IMAGE LOADING
====================================================== */

function loadImage(i) {
  if (i < 0 || i >= images.length) return;

  currentIndex = i;
  currentImage = images[i];
  deleteImageBtn.disabled = false;

  boxes = [];
  selectedBox = -1;

  [...thumbs.children].forEach(el => el.classList.remove("active"));
  thumbs.children[i].classList.add("active");

  document.getElementById("currentImage").textContent =
    currentImage.filename;

  img.onload = () => {
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    redraw();
    setMode("read");
  };

  img.src = currentImage.url;
}

/* ======================================================
   GEOMETRY HELPERS
====================================================== */

function toCanvas(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) * canvas.width) / r.width,
    y: ((e.clientY - r.top) * canvas.height) / r.height
  };
}

function inside(b, x, y) {
  return (
    x >= b.x &&
    x <= b.x + b.w &&
    y >= b.y &&
    y <= b.y + b.h
  );
}

function hitCorner(b, x, y) {
  return (
    (Math.abs(x - b.x) <= HANDLE_SIZE ||
      Math.abs(x - (b.x + b.w)) <= HANDLE_SIZE) &&
    (Math.abs(y - b.y) <= HANDLE_SIZE ||
      Math.abs(y - (b.y + b.h)) <= HANDLE_SIZE)
  );
}

/* ======================================================
   CANVAS INTERACTION
====================================================== */

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

  if (mode !== "draw") {
    setStatus("Switch to Draw mode", "warning");
    return;
  }

  if (!classSelect.value) {
    setStatus("Select class before drawing", "warning");
    return;
  }

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

/* ======================================================
   DRAWING
====================================================== */

function drawBox(x, y, w, h, label, preview = false, selected = false) {
  const color = BOX_COLORS[label] || "#fff";
  ctx.strokeStyle = color;
  ctx.lineWidth = preview
    ? PREVIEW_LINE_WIDTH
    : selected
    ? SELECTED_LINE_WIDTH
    : NORMAL_LINE_WIDTH;

  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.font = "16px sans-serif";
  ctx.fillText(label, x + 6, y + 18);
}

function redraw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  boxes.forEach((b, i) =>
    drawBox(b.x, b.y, b.w, b.h, b.label, false, i === selectedBox)
  );
}

/* ======================================================
   DELETE IMAGE
====================================================== */

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

/* ======================================================
   SAVE YOLO
====================================================== */

saveYoloBtn.onclick = () => {
  fetch("/api/yolo/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image: currentImage.filename,
      width: canvas.width,
      height: canvas.height,
      boxes,
      classMap: CLASS_MAP
    })
  })
    .then(() => {
      setStatus("Saved", "success");

      lastUndo = {
        image: currentImage,
        index: currentIndex
      };

      images.splice(currentIndex, 1);
      renderThumbnails();
      boxes = [];
      loadImage(Math.min(currentIndex, images.length - 1));
    });
};

/* ======================================================
   UNDO (Ctrl + Z)
====================================================== */

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