/* =========================================================
   CONFIGURATION
   Shared constants controlling geometry and rendering
   ========================================================= */

const MIN_BOX_SIZE = 20;
const NORMAL_LINE_WIDTH = 3;
const SELECTED_LINE_WIDTH = 6;
const PREVIEW_LINE_WIDTH = 2;
const HANDLE_SIZE = 10;

/* =========================================================
   COLOR DEFINITIONS
   Box stroke colors by class label
   ========================================================= */

const BOX_COLORS = {
  ok: "#22c55e",
  defect: "#ef4444",
  scratch: "#fb923c"
};


/*===========================================================
  APPLICATION STATE
  ========================================================= */

let mode = "read";

let images = [];
let currentIndex = -1;
let currentImage = null;

let boxes = [];
let selectedBox = -1;

let drawing = false;
let dragging = false;
let resizing = false;
let resizeHandle = null;

let startX = 0;
let startY = 0;

let lastUndo = null;

/* =========================================================
   DOM REFERENCES
   ========================================================= */

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

/* =========================================================
   STATUS MANAGEMENT
   ========================================================= */

function setStatus(message, type = "info") {
  statusText.textContent = message;
  statusText.className = `status status-${type}`;
}

/* =========================================================
   SAVE BUTTON STATE
   ========================================================= */

function updateSaveButtonState() {
  const canSave =
    mode === "draw" &&
    boxes.length > 0 &&
    classSelect.value !== "";

  saveYoloBtn.disabled = !canSave;
  saveYoloBtn.classList.toggle("disabled", !canSave);
}

/* =========================================================
   MODE HANDLING
   ========================================================= */

function setMode(m) {
  mode = m;

  readBtn.classList.toggle("active", m === "read");
  drawBtn.classList.toggle("active", m === "draw");

  canvas.className = m === "draw" ? "draw-mode" : "read-mode";

  setStatus(m === "draw" ? "Draw mode" : "Read mode");
  updateSaveButtonState();
}

readBtn.onclick = () => setMode("read");
drawBtn.onclick = () => setMode("draw");
setMode("read");

/* =========================================================
   CLASS SELECTION
   ========================================================= */

classSelect.addEventListener("change", () => {
  if (classSelect.value && mode === "read") {
    setMode("draw");
  }
  updateSaveButtonState();
});

/* =========================================================
   INITIAL IMAGE LOAD
   ========================================================= */

fetch("/api/photos")
  .then(r => r.json())
  .then(list => {
    images = list;
    renderThumbnails();
  });
  
function renderThumbnails() {
  thumbs.innerHTML = "";

  images.forEach((name, i) => {
    const t = document.createElement("img");
    t.src = `/photos/${name}`;
    t.dataset.index = i; 
    thumbs.appendChild(t);
  });
}

thumbs.addEventListener("click", e => {
  const thumb = e.target.closest("img");
  if (!thumb) return;

  const index = Number(thumb.dataset.index);
  loadImage(index);
});


/* =========================================================
   LOAD SINGLE IMAGE
   ========================================================= */

function loadImage(i) {
  if (i < 0 || i >= images.length) return;

  currentIndex = i;
  currentImage = images[i];

  deleteImageBtn.disabled = false;

  boxes = [];
  selectedBox = -1;

  [...thumbs.children].forEach(el => el.classList.remove("active"));
  thumbs.children[i].classList.add("active");

  document.getElementById("currentImage").textContent = currentImage;

  img.onload = () => {
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    redraw();
    setMode("read");
  };

  img.src = `/photos/${currentImage}`;
}

/* =========================================================
   LOAD NEXT IMAGE (AFTER SAVE / DELETE)
   ========================================================= */

function loadNextImageAfterSave() {
  if (!images.length) {
    img.src = "";
    canvas.width = canvas.height = 0;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    document.getElementById("currentImage").textContent = "No image selected";
    deleteImageBtn.disabled = true;
    setStatus("No images remaining");
    return;
  }

  const nextIndex = Math.min(currentIndex, images.length - 1);
  loadImage(nextIndex);
}

/* =========================================================
   GEOMETRY UTILITIES
   ========================================================= */

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

/* =========================================================
   MOUSE INTERACTION
   ========================================================= */

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
    setStatus("Switch to Draw mode to annotate", "warning");
    return;
  }

  if (!classSelect.value) {
    setStatus("Select a class before drawing", "warning");
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

    w = Math.max(MIN_BOX_SIZE, w);
    h = Math.max(MIN_BOX_SIZE, h);

    boxes.push({ x: fx, y: fy, w, h, label: classSelect.value });
    setStatus(`${boxes.length} box(es) · Not saved`, "warning");
  }

  resizing = dragging = drawing = false;
  redraw();
  updateSaveButtonState();
});

/* =========================================================
   DRAWING
   ========================================================= */

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

/* =========================================================
   DELETE BOX SHORTCUT
   ========================================================= */

window.addEventListener("keydown", e => {
  if (
    (e.key === "Delete" || e.key === "Backspace") &&
    selectedBox !== -1
  ) {
    boxes.splice(selectedBox, 1);
    selectedBox = -1;
    redraw();
    setStatus(`${boxes.length} box(es) · Not saved`, "warning");
    updateSaveButtonState();
  }
});

/* =========================================================
   DELETE IMAGE
   ========================================================= */

deleteImageBtn.onclick = async () => {
  if (!currentImage || currentIndex === -1) return;

  if (!confirm(`Delete image "${currentImage}"?\nThis cannot be undone.`)) {
    return;
  }

  const deletedIndex = currentIndex;

  try {
    const res = await fetch("/api/delete-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: currentImage })
    });

    if (!res.ok) throw new Error("Delete failed");


    images.splice(deletedIndex, 1);
    renderThumbnails();

    let nextIndex = images.length
      ? Math.min(deletedIndex, images.length - 1)
      : -1;

    currentImage = null;
    currentIndex = -1;
    boxes = [];
    selectedBox = -1;

    img.src = "";
    canvas.width = canvas.height = 0;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    deleteImageBtn.disabled = true;
    setStatus("Image deleted");

    document.getElementById("currentImage").textContent =
      images.length ? "Image deleted" : "No image selected";

    if (nextIndex !== -1) {
      loadImage(nextIndex);
    }

  } catch (err) {
    console.error(err);
    alert("Error deleting image");
  }
};

/* =========================================================
   SAVE YOLO
   ========================================================= */

const CLASS_MAP = { ok: 0, defect: 1, scratch: 2 };

saveYoloBtn.onclick = () => {
  if (!currentImage || !boxes.length) return;

  fetch("/api/save-yolo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image: currentImage,
      width: canvas.width,
      height: canvas.height,
      boxes,
      classMap: CLASS_MAP
    })
  })
    .then(r => r.json())
    .then(res => {
      if (res.error) {
        setStatus("Save failed", "error");
        return;
      }

      setStatus("Saved", "success");
      lastUndo = { image: currentImage, index: currentIndex };

      images.splice(currentIndex, 1);
      renderThumbnails();

      boxes = [];
      selectedBox = -1;

      loadNextImageAfterSave();
    });
};

/* =========================================================
   UNDO SAVE
   ========================================================= */
function undoLastSave() {
  if (!lastUndo) {
    alert("Nothing to undo");
    return;
  }

  fetch("/api/undo-last-save", { method: "POST" })
    .then(r => r.json())
    .then(() => {
      const restoreIndex = Math.min(lastUndo.index, images.length);

      // ✅ Restore image in state
      images.splice(restoreIndex, 0, lastUndo.image);

      // ✅ Re-render thumbnails (single source of truth)
      renderThumbnails();

      // ✅ Load restored image
      loadImage(restoreIndex);

      lastUndo = null;
      setStatus("Undo successful");
    })
    .catch(err => {
      console.error(err);
      alert("Undo failed");
    });
}

window.addEventListener("keydown", e => {
  if (e.ctrlKey && e.key.toLowerCase() === "z") {
    e.preventDefault();
    undoLastSave();
  }
});
