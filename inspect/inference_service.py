import os
import cv2
from ultralytics import YOLO
from flask import Flask, Response, jsonify, request

# ================================
# Configuration
# ================================

MODEL_PATH = (
    "/home/user/Documents/h1-visual-inspection/interface/training/"
    "station_01-final_inspection-yolo26m_pt-20260403-140421/"
    "weights/best.pt"
)

CAMERA_INDEX = 0               # USB camera for demo
DEFAULT_CONFIDENCE = 0.5

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
cap = cv2.VideoCapture(CAMERA_INDEX)

required_classes = set()
confidence_threshold = DEFAULT_CONFIDENCE

last_status = {
    "result": "UNKNOWN",
    "detected": []
}

# ================================
# Routes
# ================================

@app.route("/configure", methods=["POST"])
def configure():
    global required_classes, confidence_threshold
    data = request.json

    required_classes = set(data.get("required_classes", []))
    confidence_threshold = float(data.get("confidence", DEFAULT_CONFIDENCE))

    print(f"✅ Config updated | Required: {required_classes}, Conf: {confidence_threshold}")

    return jsonify({"ok": True})


def generate_frames():
    global last_status

    while True:
        ret, frame = cap.read()
        if not ret:
            continue

        result = model(frame, conf=confidence_threshold)[0]
        names = model.names

        detected_classes = {
            names[int(cls_id)]
            for cls_id in result.boxes.cls
        } if result.boxes is not None else set()

        passed = required_classes.issubset(detected_classes)

        last_status = {
            "result": "PASS" if passed else "FAIL",
            "detected": list(detected_classes)
        }

        annotated = result.plot()
        ret, buffer = cv2.imencode(".jpg", annotated)

        if not ret:
            continue

        frame_bytes = buffer.tobytes()

        yield (
            b"--frame\r\n"
            b"Content-Type: image/jpeg\r\n\r\n"
            + frame_bytes
            + b"\r\n"
        )


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
    app.run(host="0.0.0.0", port=8000)
