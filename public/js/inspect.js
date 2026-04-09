// ========================================
// Inference Service Endpoints
// ========================================
const VIDEO_URL  = "http://localhost:3001/video";
const STATUS_URL = "http://localhost:3001/status";

// ========================================
// DOM Elements
// ========================================
const camImg       = document.getElementById("liveCam");
const placeholder  = document.getElementById("camPlaceholder");
const overlay      = document.getElementById("resultOverlay");

// ========================================
// Initialize Camera Stream (Simulation / Real)
// ========================================
camImg.src = VIDEO_URL;

camImg.onload = () => {
  placeholder.style.display = "none";
};

camImg.onerror = () => {
  placeholder.style.display = "flex";
  overlay.textContent = "CAMERA ERROR";
  overlay.className = "inspect-status unknown";
};

// ========================================
// Poll Inspection Result from Inference Service
// ========================================
async function pollInspectionStatus() {
  try {
    const res = await fetch(STATUS_URL);
    if (!res.ok) throw new Error("Bad response");

    const data = await res.json();
    const status = data.status || "UNKNOWN";

    overlay.textContent = status;
    overlay.classList.remove("pass", "fail", "unknown");

    if (status === "PASS") {
      overlay.classList.add("pass");
    } else if (status === "FAIL") {
      overlay.classList.add("fail");
    } else {
      overlay.classList.add("unknown");
    }

  } catch (err) {
    console.error("Inference service disconnected", err);
    overlay.textContent = "DISCONNECTED";
    overlay.classList.remove("pass", "fail");
    overlay.classList.add("unknown");
  }
}

// Poll every 500 ms
setInterval(pollInspectionStatus, 500);