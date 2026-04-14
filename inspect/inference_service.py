"""
======================================================
inference_service.py — FINAL, CLEAN, FIXED, COMMENTED
------------------------------------------------------
ROLE:
✅ Stateless Python inference runner (spawn-based)
✅ Used by Node.js inference-service
✅ Loads model per execution (POC / fallback mode)
✅ Always returns a stable JSON contract
✅ No stdout pollution (JSON only)

INPUT:
  argv[1] -> MODEL_PATH (.pt)
  argv[2] -> IMAGE_PATH (.jpg / .png)

OUTPUT (stdout, JSON):
{
  "status": "PASS" | "FAIL",
  "detections": [{ cls, conf, xyxy }],
  "names": { class_id: class_name }
}
"""

from ultralytics import YOLO
import json
import sys
import os

# ======================================================
# ARGUMENTS
# ======================================================
if len(sys.argv) < 3:
    print(json.dumps({
        "status": "FAIL",
        "detections": [],
        "names": {}
    }))
    sys.exit(0)

MODEL_PATH = sys.argv[1]
IMAGE_PATH = sys.argv[2]

# ======================================================
# DEFAULT RESPONSE (STABLE CONTRACT)
# ======================================================
response = {
    "status": "FAIL",
    "detections": [],
    "names": {}
}

# ======================================================
# VALIDATE INPUT FILES
# ======================================================
if not os.path.exists(MODEL_PATH):
    print(json.dumps(response))
    sys.exit(0)

if not os.path.exists(IMAGE_PATH):
    print(json.dumps(response))
    sys.exit(0)

# ======================================================
# LOAD MODEL
# ======================================================
# NOTE:
# This script intentionally loads the model per run.
# Use inference_server.py (FastAPI) for production speed.
model = YOLO(MODEL_PATH)

# Class name mapping (id -> label)
response["names"] = model.names

# ======================================================
# RUN INFERENCE
# ======================================================
results = model(
    IMAGE_PATH,
    conf=0.30,
    imgsz=640,
    verbose=False
)

# ======================================================
# COLLECT DETECTIONS
# ======================================================
for r in results:
    if r.boxes is None:
        continue

    for box in r.boxes:
        response["detections"].append({
            "cls": int(box.cls),
            "conf": float(box.conf),
            "xyxy": box.xyxy[0].tolist()
        })

# ======================================================
# BUSINESS RULE
# ======================================================
response["status"] = (
    "PASS" if len(response["detections"]) >= 1 else "FAIL"
)

# ======================================================
# OUTPUT (JSON ONLY)
# ======================================================
print(json.dumps(response))