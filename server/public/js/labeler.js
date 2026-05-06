/**
 ======================================================
 * trainer.js
 * ======================================================
 */

const MIN_BOX_SIZE = 100; // Minimum box size enforced for drawing and resizing
const NORMAL_LINE_WIDTH = 12;
const SELECTED_LINE_WIDTH = 12;
const PREVIEW_LINE_WIDTH = 12;
const HANDLE_SIZE = 12; 

const COLOR_PALETTE = [
  "#22c55e", "#ef4444", "#fb923c", "#3b82f6", "#8b5cf6", "#f59e0b",
  "#10b981", "#ec4899", "#06b6d4", "#a855f7", "#14b8a6", "#f97316",
  "#0ea5e9", "#e11d48", "#eab308", "#0f766e", "#7c3aed", "#15803d",
  "#d946ef", "#c026d3", "#fb7185", "#0f766e"
];

let BOX_COLORS = {};
let CLASS_MAP = {};
let classNames = [];

let STATION = null;
let PROCESS = null;

(async () => {
  try {
    await loadIdentity();     
    await loadClassNames();   
    setMode("read");
  } catch (err) {
    console.error(err);
    setStatus("System identity not available", "error");
  }
})();

async function loadIdentity() {
  const res = await fetch("/api/system/identity");
  if (!res.ok) {
    throw new Error("Failed to load system identity");
  }

  const data = await res.json();
  STATION = data.station;
  PROCESS = data.process;
}

async function loadClassNames() {
  try {
    const response = await fetch(`/api/yolo/classes?station=${encodeURIComponent(STATION)}&process=${encodeURIComponent(PROCESS)}`);
    if (!response.ok) {
      throw new Error(`Failed to load classes: ${response.statusText}`);
    }
    const data = await response.json();
    classNames = data.classes || [];
    populateClassSelect(classNames);
  } catch (error) {
    console.error(error);
    setStatus("Cannot load class list", "error");
  }
}

function populateClassSelect(names) {
  CLASS_MAP = {};
  BOX_COLORS = {};
  classSelect.innerHTML = "<option value=\"\">-- Select --</option>";

  names.forEach((name, index) => {
    CLASS_MAP[name] = index;
    BOX_COLORS[name] = COLOR_PALETTE[index % COLOR_PALETTE.length];

    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    classSelect.appendChild(option);
  });

  updateSaveButtonState();
}

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

/* ===================== LOAD IMAGES ===================== */

fetch("/api/photos?page=1&limit=50")
  .then(r => r.json())
  .then(data => {
    images = (data.images || []).map(url => ({
      thumbUrl: url,
      fullUrl: url.replace("/thumbs/", "/"),
      filename: url.split("/").pop()
    }));
    renderThumbnails();
  });

function renderThumbnails() {
  thumbs.innerHTML = "";
  images.forEach((imgObj, i) => {
    const t = document.createElement("img");
    t.src = imgObj.thumbUrl;
    t.onclick = () => loadImage(i);
    thumbs.appendChild(t);
  });
}

/* ===================== IMAGE LOAD ===================== */

function clearImageView() {
  currentIndex = -1;
  currentImage = null;
  boxes = [];
  selectedBox = -1;
  deleteImageBtn.disabled = true;
  img.src = "";
  img.removeAttribute("src");
  canvas.width = 0;
  canvas.height = 0;
  canvas.style.width = "0";
  canvas.style.height = "0";
  document.getElementById("currentImage").textContent = "No image selected";
  redraw();
}

function loadImage(i) {
  if (i < 0 || i >= images.length) {
    clearImageView();
    return;
  }

  currentIndex = i;
  currentImage = images[i];
  deleteImageBtn.disabled = false;

  boxes = [];
  selectedBox = -1;

  img.onload = () => {
    requestAnimationFrame(() => {
      const rect = img.getBoundingClientRect();

      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      canvasScaleX = img.naturalWidth / rect.width;
      canvasScaleY = img.naturalHeight / rect.height;

      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      canvas.style.position = "absolute";
      canvas.style.top = `${img.offsetTop}px`;
      canvas.style.left = `${img.offsetLeft}px`;

      redraw();
    });
  };

  img.src = currentImage.fullUrl;
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

function normalizeBox(startX, startY, x, y) {
  let w = x - startX;
  let h = y - startY;
  let fx = startX;
  let fy = startY;

  if (w < 0) {
    fx += w;
    w = -w;
  }

  if (h < 0) {
    fy += h;
    h = -h;
  }

  return { fx, fy, w, h, toLeft: x < startX, toTop: y < startY };
}

function normalizeMinSquareBox(startX, startY, x, y) {
  const box = normalizeBox(startX, startY, x, y);
  if (box.w < MIN_BOX_SIZE || box.h < MIN_BOX_SIZE) {
    const size = MIN_BOX_SIZE;
    if (box.toLeft) {
      box.fx = startX - size;
    }
    if (box.toTop) {
      box.fy = startY - size;
    }
    box.w = size;
    box.h = size;
  }
  return box;
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
    const rawW = x - b.x;
    const rawH = y - b.y;

    if (rawW < MIN_BOX_SIZE || rawH < MIN_BOX_SIZE) {
      b.w = MIN_BOX_SIZE;
      b.h = MIN_BOX_SIZE;
    } else {
      b.w = rawW;
      b.h = rawH;
    }

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
    const { fx, fy, w, h } = normalizeMinSquareBox(startX, startY, x, y);
    drawBox(fx, fy, w, h, classSelect.value, true);
  }
});

canvas.addEventListener("mouseup", e => {
  if (drawing) {
    const { x, y } = toCanvas(e);
    const { fx, fy, w, h } = normalizeMinSquareBox(startX, startY, x, y);

    boxes.push({
      x: fx,
      y: fy,
      w,
      h,
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

  if (images.length > 0) {
    loadImage(Math.min(currentIndex, images.length - 1));
  } else {
    clearImageView();
  }
};

/* ===================== SAVE YOLO ===================== */

classSelect.onchange = updateSaveButtonState;

saveYoloBtn.onclick = async () => {
  if (!currentImage) return;

  const response = await fetch("/api/yolo/save", {
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
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    setStatus(error?.message || "Save failed", "error");
    return;
  }

  setStatus("Saved", "success");
  updateSaveButtonState();

  images.splice(currentIndex, 1);
  renderThumbnails();

  if (images.length > 0) {
    loadImage(Math.min(currentIndex, images.length - 1));
  } else {
    clearImageView();
    setStatus("All images labeled", "success");
  }
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