/**
 * ======================================================
 * inspect.js — FINAL, CLEAN, FIXED, COMMENTED
 * ------------------------------------------------------
 * GUARANTEES:
 * ✅ Operator mode:
 *    - Camera visible
 *    - Inference polling active
 *    - Bounding boxes drawn
 * ✅ Engineer mode:
 *    - NO camera
 *    - NO inference
 *    - Config only
 * ✅ Correct lifecycle:
 *    - Polling starts ONLY after camera loads
 *    - Polling stops when camera stops
 *    - Switching Engineer → Operator resumes inference
 * ✅ Works with .hidden class + current CSS/HTML
 * ======================================================
 */

/* ======================================================
   ENDPOINTS
====================================================== */
const VIDEO_URL  = "http://localhost:3001/video";
const STATUS_URL = "http://localhost:3001/status";

/* ======================================================
   DOM ELEMENTS
====================================================== */
const camImg        = document.getElementById("liveCam");
const placeholder   = document.getElementById("camPlaceholder");
const headerStatus  = document.getElementById("headerStatus");
const cameraResult  = document.getElementById("cameraResult");

const canvas = document.getElementById("overlayCanvas");
const ctx    = canvas.getContext("2d");

const tabOperator = document.getElementById("tabOperator");
const tabEngineer = document.getElementById("tabEngineer");

const operatorLayout = document.querySelector(".operator-layout");
const engineerLayout = document.querySelector(".engineer-layout");

/* ======================================================
   STATE
====================================================== */
let polling = false;
let pollingTimer = null;
let lastStatus = null;
let cameraReady = false;
let classNames = {};

/* ======================================================
   CLASS COLORS (MODEL-ALIGNED)
====================================================== */
const CLASS_COLORS = {
  T_Body: "#22c55e",
  T_Top_view: "#16a34a",
  T_Inner_opening: "#a855f7",
  T_Bushing: "#f97316",
  T_Hole_Plug: "#0ea5e9",
  T_SN_label: "#3b82f6",
  T_2_label: "#6366f1",

  T_Missing_2_label: "#ef4444",
  T_Missing_Hole_Plug: "#dc2626",
  T_Missing_SN_label: "#b91c1c",
  T_Without_Bushing: "#7f1d1d",

  Unassigned: "#9ca3af"
};

/* ======================================================
   STATUS UPDATE
====================================================== */
function setStatus(status, text) {
  headerStatus.textContent = text;
  cameraResult.textContent = text;

  headerStatus.className = `status-pill status-${status}`;
  cameraResult.className = `result-overlay status-${status}`;
}

/* ======================================================
   CANVAS MANAGEMENT
====================================================== */
function resizeCanvas() {
  canvas.width  = camImg.clientWidth;
  canvas.height = camImg.clientHeight;
}

window.addEventListener("resize", resizeCanvas);

/* ======================================================
   CAMERA CONTROL
====================================================== */
function startCamera() {
  cameraReady = false;
  camImg.src = VIDEO_URL;
}

function stopCamera() {
  camImg.src = "";
  cameraReady = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  placeholder.style.display = "flex";
}

/* Camera lifecycle */
camImg.onload = () => {
  resizeCanvas();
  cameraReady = true;
  placeholder.style.display = "none";

  lastStatus = null;                  // reset inference state
  setStatus("unknown", "WAITING");

  startPolling();                     // ✅ polling starts ONLY here
};

camImg.onerror = () => {
  cameraReady = false;
  placeholder.style.display = "flex";
  setStatus("unknown", "CAMERA ERROR");
};

/* ======================================================
   POLLING CONTROL
====================================================== */
function startPolling() {
  if (polling) return;
  polling = true;
  pollingTimer = setInterval(pollInspectionStatus, 1000);
}

function stopPolling() {
  polling = false;
  clearInterval(pollingTimer);
  pollingTimer = null;
}

/* ======================================================
   DRAW BOXES (LETTERBOX SAFE)
====================================================== */
function drawBoxes(detections) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!cameraReady) return;
  if (!detections || detections.length === 0) return;

  const imgW = camImg.naturalWidth;
  const imgH = camImg.naturalHeight;
  if (imgW === 0 || imgH === 0) return;

  const scale = Math.min(
    canvas.width / imgW,
    canvas.height / imgH
  );

  const offsetX = (canvas.width  - imgW * scale) / 2;
  const offsetY = (canvas.height - imgH * scale) / 2;

  detections.forEach(det => {
    if (det.conf < 0.3) return;

    const [x1, y1, x2, y2] = det.xyxy;
    const clsName = classNames[det.cls] || "Unassigned";
    const color = CLASS_COLORS[clsName] || "#facc15";

    const x = x1 * scale + offsetX;
    const y = y1 * scale + offsetY;
    const w = (x2 - x1) * scale;
    const h = (y2 - y1) * scale;

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = color;
    ctx.font = "14px sans-serif";
    ctx.fillText(
      `${clsName} ${(det.conf * 100).toFixed(1)}%`,
      x,
      Math.max(16, y - 4)
    );
  });
}

/* ======================================================
   INFERENCE POLLING
====================================================== */
async function pollInspectionStatus() {
  if (!polling) return;

  try {
    const res = await fetch(STATUS_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("Bad response");

    const data = await res.json();

    if (data.names) {
      classNames = data.names;
    }

    drawBoxes(data.detections);

    if (data.status !== lastStatus) {
      lastStatus = data.status;

      if (data.status === "PASS") {
        setStatus("pass", "PASS");
      } else if (data.status === "FAIL") {
        setStatus("fail", "FAIL");
      } else {
        setStatus("unknown", "INSPECTING");
      }
    }

  } catch {
    setStatus("unknown", "DISCONNECTED");
  }
}

/* ======================================================
   MODE SWITCHING — HARD SEPARATION
====================================================== */
tabOperator.onclick = () => {
  tabOperator.classList.add("active");
  tabEngineer.classList.remove("active");

  operatorLayout.classList.remove("hidden");
  engineerLayout.classList.add("hidden");

  stopPolling();          // safety reset
  startCamera();          // polling resumes via onload
};

tabEngineer.onclick = () => {
  tabEngineer.classList.add("active");
  tabOperator.classList.remove("active");

  operatorLayout.classList.add("hidden");
  engineerLayout.classList.remove("hidden");

  stopPolling();
  stopCamera();
};

/* ======================================================
   INITIAL LOAD — DEFAULT OPERATOR
====================================================== */
startCamera();