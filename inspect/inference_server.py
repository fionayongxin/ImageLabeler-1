"""
======================================================
inference_server.py
------------------------------------------------------
Responsibility:
- Persistent inference runtime (FastAPI)
- Single source of truth for inspection decisions
- Uses LIVE Basler frames written by basler_stream.py
- Applies Engineer-defined step-based inspection rules
- Serves PASS / FAIL / WAITING to Node.js

Design rules:
- NO per-request model loading
- NO camera ownership here
- NO dataset dependency
- Thread-safe
======================================================
"""

from fastapi import FastAPI
from ultralytics import YOLO
import json
import os
import threading
import torch
from typing import Dict, Any

# ======================================================
# PATH CONFIGURATION (WINDOWS ONLY)
# ======================================================

# Active model metadata written by Node.js
MODEL_META_PATH = (
    r"C:\Users\pnayeuoo\OneDrive - Flex\Documents\AISetup\interface"
    r"\server\public\js\models\active_model.json"
)

# Fallback model if active_model.json is missing or invalid
DEFAULT_MODEL_PATH = (
    r"C:\Users\pnayeuoo\OneDrive - Flex\Documents\AISetup\interface"
    r"\server\training"
    r"\station_01-final_inspection-yolo26m-1777254365548"
    r"\weights\best.pt"
)

# LIVE Basler latest frame (written continuously by basler_stream.py)
LATEST_FRAME_PATH = (
    r"C:\Users\pnayeuoo\OneDrive - Flex\Documents\AISetup\interface"
    r"\server\runtime\basler_latest.jpg"
)

# Engineer inspection configuration
INSPECTION_CONFIG_PATH = (
    r"C:\Users\pnayeuoo\OneDrive - Flex\Documents\AISetup\interface"
    r"\server\config\inspection_state.json"
)

# Inference parameters
IMG_SIZE = 640
STABLE_FRAMES_REQUIRED = 3

# ======================================================
# FASTAPI APP
# ======================================================

app = FastAPI()

# ======================================================
# GLOBAL STATE (THREAD-SAFE)
# ======================================================

device = "cuda" if torch.cuda.is_available() else "cpu"

model = None
model_path = None
model_lock = threading.Lock()

inspection_cfg: Dict[str, Any] | None = None
inspection_mtime: float | None = None
cfg_lock = threading.Lock()

# Decision stability (anti-flicker)
last_decision = None
stable_count = 0

# ======================================================
# MODEL MANAGEMENT
# ======================================================

def resolve_model_path() -> str:
    """
    Resolve YOLO model path.
    Priority:
    1. active_model.json (Engineer selection)
    2. DEFAULT_MODEL_PATH
    """
    if os.path.exists(MODEL_META_PATH):
        try:
            with open(MODEL_META_PATH, "r") as f:
                meta = json.load(f)
                return meta.get("path", DEFAULT_MODEL_PATH)
        except Exception as e:
            print("[Inference] Failed to read active_model.json:", e)

    return DEFAULT_MODEL_PATH


def load_model() -> None:
    """
    Load YOLO model into memory.
    Called ONLY on startup or explicit reload.
    """
    global model, model_path

    with model_lock:
        model_path = resolve_model_path()
        print(f"[Inference] Loading model: {model_path}")

        model = YOLO(model_path).to(device)

        # Optional warm-up using current Basler frame
        if os.path.exists(LATEST_FRAME_PATH):
            try:
                _ = model(
                    LATEST_FRAME_PATH,
                    imgsz=IMG_SIZE,
                    conf=0.01,
                    verbose=False
                )
                print("[Inference] Warm-up complete")
            except Exception as e:
                print("[Inference] Warm-up skipped:", e)


# Load model once on startup
load_model()

# ======================================================
# INSPECTION CONFIG MANAGEMENT
# ======================================================

def load_inspection_config() -> Dict[str, Any]:
    """
    Load Engineer inspection configuration with file change detection.
    """
    global inspection_cfg, inspection_mtime

    with cfg_lock:
        stat = os.stat(INSPECTION_CONFIG_PATH)

        if inspection_cfg is None or stat.st_mtime != inspection_mtime:
            with open(INSPECTION_CONFIG_PATH, "r") as f:
                inspection_cfg = json.load(f)
            inspection_mtime = stat.st_mtime
            print("[Inference] Inspection config reloaded")

        return inspection_cfg

# ======================================================
# INFERENCE ENDPOINT
# ======================================================

@app.get("/infer")
def infer() -> Dict[str, Any]:
    """
    Run inspection on live Basler frame.
    Returns ONLY operator-safe states:
    - WAITING
    - PASS
    - FAIL
    """
    global last_decision, stable_count

    # --------------------------------------------------
    # Load inspection configuration
    # --------------------------------------------------
    cfg = load_inspection_config()

    confidence = float(cfg.get("confidence", 0.25))
    step_id = int(cfg.get("currentStep", 1))

    step_cfg = next(
        (s for s in cfg.get("steps", []) if s.get("step") == step_id),
        None
    )

    if not step_cfg:
        return {
            "status": "WAITING",
            "detections": [],
            "names": {}
        }

    # --------------------------------------------------
    # Verify live Basler frame exists
    # --------------------------------------------------
    if not os.path.exists(LATEST_FRAME_PATH):
        return {
            "status": "WAITING",
            "detections": [],
            "names": model.names
        }

    # --------------------------------------------------
    # Run YOLO inference (thread-safe)
    # --------------------------------------------------
    with model_lock:
        results = model(
            LATEST_FRAME_PATH,
            imgsz=IMG_SIZE,
            conf=confidence,
            verbose=False
        )

    detections = []
    detected_classes = set()

    for r in results:
        if not r.boxes:
            continue

        for box in r.boxes:
            cls_id = int(box.cls)
            cls_name = model.names.get(cls_id, "Unassigned")

            detections.append({
                "cls": cls_id,
                "name": cls_name,
                "conf": float(box.conf),
                "xyxy": box.xyxy[0].tolist()
            })

            detected_classes.add(cls_name)

    # --------------------------------------------------
    # Step-based inspection logic
    # --------------------------------------------------
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

    # --------------------------------------------------
    # Decision stabilization (anti-flicker)
    # --------------------------------------------------
    if decision == last_decision:
        stable_count += 1
    else:
        stable_count = 1
        last_decision = decision

    if stable_count < STABLE_FRAMES_REQUIRED:
        decision = "WAITING"

    # --------------------------------------------------
    # Operator-facing response
    # --------------------------------------------------
    return {
        "status": decision,
        "currentStep": step_id,
        "missing": list(missing),
        "forbidden": list(violated),
        "detections": detections,
        "names": model.names
    }

# ======================================================
# MODEL RELOAD ENDPOINT
# ======================================================

@app.post("/reload")
def reload_model():
    """
    Reload YOLO model after Engineer updates active_model.json.
    """
    load_model()
    return {
        "status": "ok",
        "model": model_path,
        "device": device
    }