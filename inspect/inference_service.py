import os
import cv2
import time
import requests
from ultralytics import YOLO
from flask import Flask, Response, jsonify

# ================================
# Configuration
# ================================
MODEL_PATH = (
    "/home/user/Documents/h1-visual-inspection/interface/training/"
    "station_01-final_inspection-yolo26m_pt-20260403-140421/"
    "weights/best.pt"
)

CAMERA_INDEX = 0
CRITERIA_URL = "http://localhost:3000/api/inspect/criteria"
RESULT_URL = "http://localhost:3000/api/inspect/result"

DEFAULT_CONFIDENCE = 0.5
CRITERIA_REFRESH_SEC = 1.0

# ================================
# Safety check
# ================================
if not os.path.exists(MODEL_PATH):
    raise FileNotFoundError(f"YOLO model not found: {MODEL_PATH}")

print(f"✅ Using YOLO model: {MODEL_PATH}")

# ================================
# Init
# ================================
app = Flask(__name__)

model = YOLO(MODEL_PATH)
class_names = model.names

cap = cv2.VideoCapture(CAMERA_INDEX)
if not cap.isOpened():
    raise RuntimeError("❌ Camera not accessible")

criteria = {
    "required": [],
    "forbidden": [],
    "confidence": DEFAULT_CONFIDENCE
}

last_fetch = 0
last_status = {
    "status": "UNKNOWN",
    "detected": []
}

# ================================
# Helper
# ================================
def fetch_criteria():
    global criteria
    try:
        r = requests.get(CRITERIA_URL, timeout=0.5)
        criteria = r.json()
    except:
        pass

# ================================
# Video generator
# ================================
def generate_frames():
    global last_fetch, last_status

    while True:
        ret, frame = cap.read()
        if not ret:
            continue

        # Refresh criteria
        if time.time() - last_fetch > CRITERIA_REFRESH_SEC:
            fetch_criteria()
            last_fetch = time.time()

        required = set(criteria.get("required", []))
        forbidden = set(criteria.get("forbidden", []))
        conf = float(criteria.get("confidence", DEFAULT_CONFIDENCE))

        result = model(frame, conf=conf, verbose=False)[0]

        detected = set()
        if result.boxes is not None:
            for cls_id in result.boxes.cls:
                detected.add(class_names[int(cls_id)])

        # PASS / FAIL logic
        missing_required = required - detected
        detected_forbidden = forbidden & detected

        if missing_required or detected_forbidden:
            status = "FAIL"
            color = (0, 0, 255)
        else:
            status = "PASS"
            color = (0, 255, 0)

        last_status = {
            "status": status,
            "detected": list(detected)
        }

        # Send result to backend
        try:
            r = requests.post(
                RESULT_URL,
                json=last_status,
                timeout=0.5
            )
            if r.status_code != 200:
                print("❌ Result POST failed:", r.status_code, r.text)
            else:
                print("✅ Result POST:", last_status)
        except Exception as e:
            print("❌ Result POST exception:", e)

        annotated = result.plot()

        cv2.putText(
            annotated,
            f"STATUS: {status}",
            (20, 40),
            cv2.FONT_HERSHEY_SIMPLEX,
            1.2,
            color,
            3
        )

        ret, buffer = cv2.imencode(".jpg", annotated)
        if not ret:
            continue

        yield (
            b"--frame\r\n"
            b"Content-Type: image/jpeg\r\n\r\n" +
            buffer.tobytes() +
            b"\r\n"
        )

# ================================
# Routes
# ================================
@app.route("/video")
def video():
    return Response(
        generate_frames(),
        mimetype="multipart/x-mixed-replace; boundary=frame"
    )

@app.route("/status")
def status():
    return jsonify(last_status)

# ================================
# Main
# ================================
if __name__ == "__main__":
    print("🚀 Starting inspection inference service...")
    app.run(host="0.0.0.0", port=8000, threaded=True)
