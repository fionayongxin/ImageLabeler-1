/* =====================================================
   CONFIG
   ===================================================== */

// Minimum allowed box size (pixels)
const MIN_BOX_SIZE = 20;

// ✅ LINE THICKNESS SETTINGS (ADJUST HERE)
const NORMAL_LINE_WIDTH   = 3;
const SELECTED_LINE_WIDTH = 6;
const PREVIEW_LINE_WIDTH  = 2;

// Resize handle size
const HANDLE_SIZE = 10;

/* =====================================================
   STATE
   ===================================================== */

let mode = "read"; // "read" | "draw"

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

/* =====================================================
   DOM
   ===================================================== */

const thumbs = document.getElementById("thumbs");
const img = document.getElementById("image");
const canvas = document.getElementById("overlay");
const ctx = canvas.getContext("2d");

const classSelect = document.getElementById("classSelect");
const statusText = document.getElementById("status");

const readBtn = document.getElementById("readModeBtn");
const drawBtn = document.getElementById("drawModeBtn");

/* =====================================================
   MODE
   ===================================================== */

function setMode(m) {
  mode = m;
  readBtn.classList.toggle("active", m === "read");
  drawBtn.classList.toggle("active", m === "draw");
  canvas.className = m === "draw" ? "draw-mode" : "read-mode";
  statusText.textContent = m === "draw"
    ? "Draw mode"
    : "Read mode";
}

readBtn.onclick = () => setMode("read");
drawBtn.onclick = () => setMode("draw");
setMode("read");

/* =====================================================
   LOAD IMAGE LIST
   ===================================================== */

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

/* =====================================================
   GEOMETRY HELPERS
   ===================================================== */

function toCanvas(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * canvas.width / r.width,
    y: (e.clientY - r.top) * canvas.height / r.height
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

function hitCorner(b, x, y, size = HANDLE_SIZE) {
  const corners = [
    ["tl", b.x, b.y],
    ["tr", b.x + b.w, b.y],
    ["bl", b.x, b.y + b.h],
    ["br", b.x + b.w, b.y + b.h]
  ];

  for (const [name, cx, cy] of corners) {
    if (
      Math.abs(x - cx) <= size &&
      Math.abs(y - cy) <= size
    ) return name;
  }
  return null;
}

/* =====================================================
   MOUSE EVENTS
   ===================================================== */

canvas.addEventListener("mousedown", e => {
  const { x, y } = toCanvas(e);

  selectedBox = -1;
  resizeHandle = null;

  // Hit test: resize > drag
  for (let i = boxes.length - 1; i >= 0; i--) {
    const b = boxes[i];
    const handle = hitCorner(b, x, y);

    if (handle) {
      selectedBox = i;
      resizing = true;
      resizeHandle = handle;
      return;
    }

    if (inside(b, x, y)) {
      selectedBox = i;
      dragging = true;
      startX = x;
      startY = y;
      redraw();
      return;
    }
  }

  // New box
  if (mode === "draw") {
    if (!classSelect.value) return alert("Select a class first");
    drawing = true;
    startX = x;
    startY = y;
  }
});

canvas.addEventListener("mousemove", e => {
  const { x, y } = toCanvas(e);

  // Move
  if (dragging && selectedBox !== -1) {
    const b = boxes[selectedBox];
    b.x += x - startX;
    b.y += y - startY;
    startX = x;
    startY = y;
    redraw();
    return;
  }

  // Resize
  if (resizing && selectedBox !== -1) {
    const b = boxes[selectedBox];

    if (resizeHandle === "br") {
      b.w = Math.max(MIN_BOX_SIZE, x - b.x);
      b.h = Math.max(MIN_BOX_SIZE, y - b.y);
    }

    if (resizeHandle === "tl") {
      const newW = b.w + (b.x - x);
      const newH = b.h + (b.y - y);

      if (newW >= MIN_BOX_SIZE) {
        b.x = x;
        b.w = newW;
      }
      if (newH >= MIN_BOX_SIZE) {
        b.y = y;
        b.h = newH;
      }
    }

    redraw();
    return;
  }

  // Draw preview
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

    boxes.push({
      x: fx,
      y: fy,
      w,
      h,
      label: classSelect.value
    });
  }

  drawing = false;
  dragging = false;
  resizing = false;
  resizeHandle = null;

  redraw();
});

/* =====================================================
   DRAWING
   ===================================================== */

function drawBox(x, y, w, h, label, preview = false, selected = false) {
  const colors = {
    ok: "#22c55e",
    defect: "#ef4444",
    scratch: "#fb923c"
  };

  ctx.strokeStyle = colors[label] || "#ffffff";

  if (preview) {
    ctx.lineWidth = PREVIEW_LINE_WIDTH;
  } else if (selected) {
    ctx.lineWidth = SELECTED_LINE_WIDTH;
  } else {
    ctx.lineWidth = NORMAL_LINE_WIDTH;
  }

  ctx.strokeRect(x, y, w, h);

  ctx.fillStyle = ctx.strokeStyle;
  ctx.font = "16px sans-serif";
  ctx.fillText(label, x + 6, y + 18);

  // Resize handles
  if (selected) {
    const s = HANDLE_SIZE;
    ctx.fillRect(x - s, y - s, s * 2, s * 2);
    ctx.fillRect(x + w - s, y + h - s, s * 2, s * 2);
  }
}

function redraw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  boxes.forEach((b, i) =>
    drawBox(b.x, b.y, b.w, b.h, b.label, false, i === selectedBox)
  );
}

/* =====================================================
   DELETE
   ===================================================== */

window.addEventListener("keydown", e => {
  if ((e.key === "Delete" || e.key === "Backspace") && selectedBox !== -1) {
    boxes.splice(selectedBox, 1);
    selectedBox = -1;
    redraw();
  }
});

/* =====================================================
   NAV + SAVE
   ===================================================== */

document.getElementById("saveBtn").onclick = () => {
  console.log("Image:", currentImage);
  console.log("Boxes:", boxes);
};

document.getElementById("nextBtn").onclick = () =>
  loadImage(currentIndex + 1);

document.getElementById("prevBtn").onclick = () =>
  loadImage(currentIndex - 1);
