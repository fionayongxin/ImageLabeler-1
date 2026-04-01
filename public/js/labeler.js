/* ================= CONFIG ================= */

const MIN_BOX_SIZE = 20;
const NORMAL_LINE_WIDTH = 3;
const SELECTED_LINE_WIDTH = 6;
const PREVIEW_LINE_WIDTH = 2;
const HANDLE_SIZE = 10;

/* ================= COLOR ================= */
const BOX_COLORS = {
  ok: "#22c55e",        // green
  defect: "#ef4444",   // red
  scratch: "#fb923c"   // orange
};

/* ================= STATE ================= */

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

/* ================= DOM ================= */

const thumbs = document.getElementById("thumbs");
const img = document.getElementById("image");
const canvas = document.getElementById("overlay");
const ctx = canvas.getContext("2d");

const classSelect = document.getElementById("classSelect");
const statusText = document.getElementById("status");

const readBtn = document.getElementById("readModeBtn");
const drawBtn = document.getElementById("drawModeBtn");
const saveYoloBtn = document.getElementById("saveYoloBtn");

/* ================= MODE ================= */

function setMode(m) {
  mode = m;
  readBtn.classList.toggle("active", m === "read");
  drawBtn.classList.toggle("active", m === "draw");
  canvas.className = m === "draw" ? "draw-mode" : "read-mode";
  statusText.textContent = m === "draw" ? "Draw mode" : "Read mode";
}

readBtn.onclick = () => setMode("read");
drawBtn.onclick = () => setMode("draw");
setMode("read");

/* ================= LOAD IMAGES ================= */

fetch("/api/photos")
  .then(r => r.json())
  .then(list => {
    images = list;
    list.forEach((name, i) => {
      const t = document.createElement("img");
      t.src = `/photos/${name}`;
      t.onclick = () => loadImage(i);
      thumbs.appendChild(t);
    });
  });

function loadImage(i) {
  if (i < 0 || i >= images.length) return;

  currentIndex = i;
  currentImage = images[i];
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

/* ================= CLEANUP ================= */
function loadNextImageAfterSave() {
  if (images.length === 0) {
    // No images left
    img.src = "";
    canvas.width = 0;
    canvas.height = 0;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    document.getElementById("currentImage").textContent = "No image selected";
    return;
  }

  // Load the image that now sits at the current index
  const nextIndex = Math.min(currentIndex, images.length - 1);
  loadImage(nextIndex);
}

/* ================= GEOMETRY ================= */

function toCanvas(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * canvas.width / r.width,
    y: (e.clientY - r.top) * canvas.height / r.height
  };
}

function inside(b, x, y) {
  return (
    x >= b.x && x <= b.x + b.w &&
    y >= b.y && y <= b.y + b.h
  );
}

function hitCorner(b, x, y, s = HANDLE_SIZE) {
  const corners = [
    ["tl", b.x, b.y],
    ["br", b.x + b.w, b.y + b.h]
  ];
  for (const [_, cx, cy] of corners) {
    if (Math.abs(x - cx) <= s && Math.abs(y - cy) <= s) {
      return true;
    }
  }
  return false;
}

/* ================= MOUSE ================= */

canvas.addEventListener("mousedown", e => {
  const { x, y } = toCanvas(e);
  let hit = false;

  for (let i = boxes.length - 1; i >= 0; i--) {
    if (inside(boxes[i], x, y)) {
      selectedBox = i;
      dragging = true;
      startX = x;
      startY = y;
      hit = true;
      redraw();
      return;
    }
  }

  if (!hit) {
    selectedBox = -1;
    redraw();
  }

  if (mode === "draw" && !hit) {
    if (!classSelect.value) return alert("Select class first");
    drawing = true;
    startX = x;
    startY = y;
  }
});

canvas.addEventListener("mousemove", e => {
  const { x, y } = toCanvas(e);

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

    if (w < 0) { fx += w; w = Math.abs(w); }
    if (h < 0) { fy += h; h = Math.abs(h); }

    w = Math.max(MIN_BOX_SIZE, w);
    h = Math.max(MIN_BOX_SIZE, h);

    boxes.push({ x: fx, y: fy, w, h, label: classSelect.value });
  }

  drawing = dragging = false;
  redraw();
});

/* ================= DRAW ================= */

function drawBox(x, y, w, h, label, preview = false, selected = false) {
  const color = BOX_COLORS[label] || "#ffffff";

  ctx.strokeStyle = color;
  ctx.lineWidth = preview
    ? PREVIEW_LINE_WIDTH
    : selected
      ? SELECTED_LINE_WIDTH
      : NORMAL_LINE_WIDTH;

  ctx.strokeRect(x, y, w, h);

  // ✅ draw class name
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

/* ================= DELETE ================= */

window.addEventListener("keydown", e => {
  if ((e.key === "Delete" || e.key === "Backspace") && selectedBox !== -1) {
    boxes.splice(selectedBox, 1);
    selectedBox = -1;
    redraw();
  }
});

/* ================= YOLO SAVE ================= */

const CLASS_MAP = { ok: 0, defect: 1, scratch: 2 };

saveYoloBtn.onclick = () => {
  if (!currentImage) return alert("No image selected");
  if (!boxes.length) return alert("No boxes");

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
        statusText.textContent = "❌ Save failed";
        return;
      }

      statusText.textContent = "✅ Saved";

      /* ✅ 1. Remove the saved image from thumbnails */
      thumbs.removeChild(thumbs.children[currentIndex]);
      images.splice(currentIndex, 1);

      /* ✅ 2. Reset annotation state (boxes only) */
      boxes = [];
      selectedBox = -1;
      drawing = dragging = resizing = false;

      /* ✅ 3. Auto-load next image */
      loadNextImageAfterSave();
    });

};

