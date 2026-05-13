"""
======================================================
inference_server.py — FINAL CONFIG-DRIVEN VERSION
------------------------------------------------------
Responsibilities:
- Persistent YOLO inference runtime
- Reads LIVE Basler frames from shared memory
- Loads model based on operator-selected config
- Applies step-based inspection rules
- Serves PASS / FAIL / WAITING

Design rules:
- NO hardcoded model paths
- NO per-request model loading
- NO camera ownership
- NO dataset dependency
- NO filesystem image reads (except config + model)
======================================================
"""

from fastapi import FastAPI
from ultralytics import YOLO
from multiprocessing import shared_memory
import json
import os
import threading
import torch
import numpy as np
from typing import Dict, Any, Optional

# ======================================================
# SHARED MEMORY CONFIG (MUST MATCH basler_stream.py)
# ======================================================

SHM_NAME = "basler_frame"
FRAME_WIDTH = 1280
FRAME_HEIGHT = 1024
FRAME_CHANNELS = 3  # BGR uint8

# ======================================================
# PATH CONFIGURATION
# ======================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_ROOT = os.path.join(BASE_DIR, "..", "config")
INSPECTION_STATE_PATH = os.path.join(CONFIG_ROOT, "inspection_state.json")

# ======================================================
# INFERENCE PARAMETERS
# ======================================================

IMG_SIZE = 960
STABLE_FRAMES_REQUIRED = 3

# ======================================================
# FASTAPI APP
# ======================================================

app = FastAPI()

# ======================================================
# GLOBAL STATE (THREAD-SAFE)
# ======================================================

device = "cuda" if torch.cuda.is_available() else "cpu"

model: Optional[YOLO] = None
model_path: Optional[str] = None
model_lock = threading.Lock()

inspection_cfg: Optional[Dict[str, Any]] = None
inspection_mtime: Optional[float] = None
cfg_lock = threading.Lock()

last_decision: Optional[str] = None
stable_count = 0

# ======================================================
# SHARED MEMORY ATTACH
# ======================================================

try:
    shm = shared_memory.SharedMemory(name=SHM_NAME)
    frame_buf = np.ndarray(
        (FRAME_HEIGHT, FRAME_WIDTH, FRAME_CHANNELS),
        dtype=np.uint8,
        buffer=shm.buf
    )
    print("[Inference] Shared memory attached")
except FileNotFoundError:
    shm = None
    frame_buf = None
    print("[Inference] Shared memory not available")

# ======================================================
# INSPECTION STATE LOADING
# ======================================================

def load_inspection_config() -> Dict[str, Any]:
    """
    Load inspection_state.json with mtime tracking.
    This file is the SINGLE source of runtime truth.
    """
    global inspection_cfg, inspection_mtime

    with cfg_lock:
        if not os.path.exists(INSPECTION_STATE_PATH):
            return {}

        stat = os.stat(INSPECTION_STATE_PATH)

        if inspection_cfg is None or stat.st_mtime != inspection_mtime:
            with open(INSPECTION_STATE_PATH, "r") as f:
                inspection_cfg = json.load(f)
            inspection_mtime = stat.st_mtime
            print("[Inference] Inspection state reloaded")

        return inspection_cfg

# ======================================================
# MODEL RESOLUTION (CONFIG-DRIVEN)
# ======================================================

def resolve_model_path(cfg: Dict[str, Any]) -> Optional[str]:
    """
    Resolve model path from selected config folder.
    """
    config_name = cfg.get("configName")
    if not config_name:
        return None

    config_dir = os.path.join(CONFIG_ROOT, config_name)
    if not os.path.isdir(config_dir):
        return None

    for f in os.listdir(config_dir):
        if f.endswith(".pt"):
            return os.path.join(config_dir, f)

    return None


def load_model_for_config(cfg: Dict[str, Any]) -> None:
    """
    Load YOLO model ONLY when config changes.
    """
    global model, model_path

    with model_lock:
        path = resolve_model_path(cfg)

        if not path:
            if model is not None:
                print("[Inference] Model cleared (no config / no model)")
            model = None
            model_path = None
            return

        if path == model_path:
            return  # already loaded

        print(f"[Inference] Loading model: {path}")
        model = YOLO(path).to(device)
        model_path = path

# ======================================================
# INFERENCE ENDPOINT
# ======================================================

@app.get("/infer")
def infer() -> Dict[str, Any]:
    global last_decision, stable_count

    if frame_buf is None:
        return {"status": "WAITING"}

    cfg = load_inspection_config()
    load_model_for_config(cfg)

    if model is None:
        return {"status": "WAITING"}

    confidence = float(cfg.get("confidence", 0.25))
    current_step_id = cfg.get("currentStep")

    step_cfg = next(
        (s for s in cfg.get("steps", []) if s.get("id") == current_step_id),
        None
    )

    if not step_cfg:
        return {"status": "WAITING"}

    with model_lock:
        results = model(
            frame_buf,
            imgsz=IMG_SIZE,
            conf=confidence,
            verbose=False
        )

    detected_classes = set()
    detections = []

    for r in results:
        for box in r.boxes or []:
            cls_id = int(box.cls)
            cls_name = model.names.get(cls_id, "Unassigned")

            detected_classes.add(cls_name)
            detections.append({
                "cls": cls_id,
                "name": cls_name,
                "conf": float(box.conf),
                "xyxy": box.xyxy[0].tolist()
            })

    required = set(step_cfg.get("required", []))
    forbidden = set(step_cfg.get("forbidden", []))

    missing = required - detected_classes
    violated = forbidden & detected_classes

    if not detected_classes:
        decision = "WAITING"
    elif missing or violated:
        decision = "FAIL"
    else:
        decision = "PASS"

    if decision == last_decision:
        stable_count += 1
    else:
        stable_count = 1
        last_decision = decision

    if stable_count < STABLE_FRAMES_REQUIRED:
        decision = "WAITING"

    return {
        "status": decision,
        "currentStep": current_step_id,
        "missing": list(missing),
        "forbidden": list(violated),
        "detections": detections,
        "names": model.names
    }

# ======================================================
# MODEL RELOAD (OPTIONAL MANUAL TRIGGER)
# ======================================================

@app.post("/reload")
def reload_model():
    """
    Force model reload from inspection_state.json.
    """
    cfg = load_inspection_config()
    load_model_for_config(cfg)
    return {
        "status": "ok",
        "model": model_path,
        "device": device
    }
