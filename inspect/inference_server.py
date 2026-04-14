"""
======================================================
inference_server.py — FINAL, CLEAN, FIXED, COMMENTED
------------------------------------------------------
ROLE:
✅ Persistent Python inference server (FastAPI)
✅ Loads YOLO model ONCE and keeps it in memory
✅ Runs inference on a fixed image (camera-simulated)
✅ Reloads model when Engineer updates active_model.json
✅ Thread-safe, GPU-aware, deterministic

THIS FILE:
- Owns ALL ML logic
- Owns PASS / FAIL decision
- Node.js only calls HTTP endpoints here
======================================================
"""

from fastapi import FastAPI
from ultralytics import YOLO
import json
import os
import threading
import torch

# ======================================================
# CONFIG (CHANGE HERE ONLY)
# ======================================================

MODEL_META = "/home/user/Documents/h1-visual-inspection/interface/models/active_model.json"

DEFAULT_MODEL = (
    "/home/user/Documents/h1-visual-inspection/interface/"
    "training/station_01-final_inspection-yolo26m-1775783357791/weights/best.pt"
)

IMAGE_PATH = (
    "/home/user/Documents/h1-visual-inspection/interface/"
    "datasets/station_01/final_inspection/images/"
    "92762c6d__331aa42d-Image__2026-03-25__15-47-02.jpg"
)

CONF_THRES = 0.25
IMG_SIZE = 640

# ======================================================
# APP INITIALIZATION
# ======================================================

app = FastAPI()

# Global model state (intentionally single instance)
model = None
model_path = None

# Device selection
device = "cuda" if torch.cuda.is_available() else "cpu"

# Prevent reload/infer race conditions
model_lock = threading.Lock()

# ======================================================
# MODEL LOADING (SAFE, SINGLE SOURCE OF TRUTH)
# ======================================================

def resolve_model_path() -> str:
    """
    Decide which model to load.
    Priority:
    1. Engineer-selected active_model.json
    2. DEFAULT_MODEL fallback
    """
    if os.path.exists(MODEL_META):
        with open(MODEL_META, "r") as f:
            return json.load(f).get("path", DEFAULT_MODEL)
    return DEFAULT_MODEL


def load_model():
    """
    Load YOLO model into memory.
    - Thread-safe
    - GPU-aware
    - Includes warm-up inference
    """
    global model, model_path

    with model_lock:
        model_path = resolve_model_path()

        print(f"[INFO] Loading model: {model_path}")
        print(f"[INFO] Using device: {device}")

        model = YOLO(model_path).to(device)

        # Warm-up (prevents first-inference latency)
        _ = model(
            IMAGE_PATH,
            imgsz=IMG_SIZE,
            conf=CONF_THRES,
            verbose=False
        )

        print("[INFO] Model loaded and warmed up")


# Load once on startup
load_model()

# ======================================================
# INFERENCE ENDPOINT
# ======================================================

@app.get("/infer")
def infer():
    """
    Run inference on the configured IMAGE_PATH.

    RETURNS:
    {
      status: "PASS" | "FAIL",
      detections: [
        { cls, conf, xyxy }
      ],
      names: model.names
    }
    """

    with model_lock:
        results = model(
            IMAGE_PATH,
            imgsz=IMG_SIZE,
            conf=CONF_THRES,
            verbose=False
        )

    detections = []

    for r in results:
        if r.boxes is None:
            continue

        for box in r.boxes:
            detections.append({
                "cls": int(box.cls),
                "conf": float(box.conf),
                "xyxy": box.xyxy[0].tolist()
            })

    # BUSINESS RULE (LOCKED)
    # Exactly ONE detection = PASS
    status = "PASS" if len(detections) == 1 else "FAIL"

    return {
        "status": status,
        "detections": detections,
        "names": model.names
    }

# ======================================================
# MODEL RELOAD (ENGINEER MODE)
# ======================================================

@app.post("/reload")
def reload_model():
    """
    Reload model after Engineer uploads a new .pt file.
    Node.js MUST call this after /model/upload.
    """
    load_model()

    return {
        "status": "ok",
        "model": model_path,
        "device": device
    }