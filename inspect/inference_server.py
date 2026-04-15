"""
======================================================
inference_server.py
------------------------------------------------------
Responsibility:
- Industry‑grade, persistent inference server
- Single source of truth for ML / GPU logic
- Loads YOLO model once and keeps it in memory
- Exposes HTTP API for Node.js orchestration

Design rules:
- NO per-request model loading
- NO CLI / spawn usage
- Thread-safe
- FastAPI ONLY
======================================================
"""

from fastapi import FastAPI
from ultralytics import YOLO
import json
import os
import threading
import torch

# ======================================================
# CONFIG
# ======================================================

MODEL_META = "/home/user/Documents/h1-visual-inspection/interface/server/public/js/models/active_model.json"

DEFAULT_MODEL = (
    "/home/user/Documents/h1-visual-inspection/interface/server/public/js/"
    "models/station_01_final_inspection_yolo26m_best_r06.pt"
)

IMAGE_PATH = (
    "/home/user/Documents/h1-visual-inspection/interface/"
    "datasets/station_01/final_inspection/images/"
    "92762c6d__331aa42d-Image__2026-03-25__15-47-02.jpg"
)

CONF_THRES = 0.25
IMG_SIZE = 640

# ======================================================
# APP
# ======================================================

app = FastAPI()

device = "cuda" if torch.cuda.is_available() else "cpu"
model = None
model_path = None
model_lock = threading.Lock()

# ======================================================
# MODEL MANAGEMENT
# ======================================================

def resolve_model_path() -> str:
    """
    Resolve which model to load.
    Priority:
    1. active_model.json
    2. DEFAULT_MODEL
    """
    if os.path.exists(MODEL_META):
        with open(MODEL_META, "r") as f:
            data = json.load(f)
            return data.get("path", DEFAULT_MODEL)
    return DEFAULT_MODEL


def load_model():
    """
    Load YOLO model into memory (thread‑safe).
    Includes warm‑up inference.
    """
    global model, model_path

    with model_lock:
        model_path = resolve_model_path()

        model = YOLO(model_path).to(device)

        # warm‑up
        _ = model(
            IMAGE_PATH,
            imgsz=IMG_SIZE,
            conf=CONF_THRES,
            verbose=False
        )


# load once on startup
load_model()

# ======================================================
# API
# ======================================================

@app.get("/infer")
def infer():
    """
    Run inference on the configured image.
    Returns:
    {
      status: PASS | FAIL,
      detections: [...],
      names: {...}
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

    status = "PASS" if len(detections) == 1 else "FAIL"

    return {
        "status": status,
        "detections": detections,
        "names": model.names
    }


@app.post("/reload")
def reload_model():
    """
    Reload model after Node.js updates active_model.json.
    """
    load_model()
    return {
        "status": "ok",
        "model": model_path,
        "device": device
    }