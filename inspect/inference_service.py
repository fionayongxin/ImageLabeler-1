import os
import cv2
import time
import requests
import numpy as np
from collections import deque
from flask import Flask, Response, jsonify

# ================================
# SIMULATION MODE
# ================================
SIMULATION_MODE = True

# ================================
# Configuration
# ================================
CRITERIA_URL = "http://localhost:3000/api/inspect/criteria"
RESULT_URL   = "http://localhost:3000/api/inspect/result"

DEFAULT_CONFIDENCE = 0.5
CRITERIA_REFRESH_SEC = 1.0

WINDOW_SIZE = 5
PASS_THRESHOLD = 4

# ================================
# Init
# ================================
app = Flask(__name__)

criteria = {
    "required": ["T_Body", "T_Bushing", "T_SN_label"],
    "forbidden": [],
    "confidence": DEFAULT_CONFIDENCE
}

last_fetch = 0

frame_buffer = deque(maxlen=WINDOW_SIZE)
product_status = "UNKNOWN"

last_status = {
    "status": "UNKNOWN",
    "frame": "UNKNOWN",
    "buffer": [],
    "detected": []
}

# ================================
# Helper
# ================================
def fetch_criteria():
    global criteria
    try:
        r = requests.get(CRITERIA_URL, timeout=0.5)
        if r.status_code == 200:
            criteria = r.json()
    except:
        pass

# ================================
# Video generator
# ================================
def generate_frames():
    global last_fetch, product_status, last_status

    while True:
        # ----------------------------
        # Dummy frame (simulation)
        # ----------------------------
        frame = 255 * np.ones((480, 640, 3), dtype=np.uint8)

        # ----------------------------
        # Refresh criteria
        # ----------------------------
        if time.time() - last_fetch > CRITERIA_REFRESH_SEC:
            fetch_criteria()
            last_fetch = time.time()

        required = set(criteria.get("required", []))
        forbidden = set(criteria.get("forbidden", []))

        # ----------------------------
        # SIMULATED DETECTION
        # ----------------------------
        detected = {"T_Body", "T_Bushing", "T_SN_label"}

        # Simulate fault every 8 seconds
        if int(time.time()) % 8 == 0:
            detected.remove("T_SN_label")

        # ----------------------------
        # Reset logic (no body)
        # ----------------------------
        if "T_Body" not in detected:
            frame_buffer.clear()
            product_status = "UNKNOWN"

        # ----------------------------
        # Layer 2: Frame decision
        # ----------------------------
        missing_required = required - detected
        detected_forbidden = forbidden & detected

        if missing_required or detected_forbidden:
            frame_result = "FAIL"
        else:
            frame_result = "PASS"

        # ----------------------------
        # Layer 3: Sliding window
        # ----------------------------
        frame_buffer.append(frame_result)
        product_status = "UNKNOWN"

        if len(frame_buffer) == WINDOW_SIZE:
            if frame_buffer.count("PASS") >= PASS_THRESHOLD:
                product_status = "PASS"
            else:
                product_status = "FAIL"

        # ----------------------------
        # Status payload
        # ----------------------------
        last_status = {
            "status": product_status,
            "frame": frame_result,
            "buffer": list(frame_buffer),
            "detected": list(detected)
        }

        try:
            requests.post(RESULT_URL, json=last_status, timeout=0.2)
        except:
            pass

        # ----------------------------
        # Visualization
        # ----------------------------
        if product_status == "PASS":
            color = (0, 255, 0)
        elif product_status == "FAIL":
            color = (0, 0, 255)
        else:
            color = (0, 255, 255)

        cv2.putText(frame, f"PRODUCT: {product_status}", (20, 40),
                    cv2.FONT_HERSHEY_SIMPLEX, 1.1, color, 3)

        cv2.putText(frame, f"FRAME: {frame_result}", (20, 80),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 0, 0), 2)

        ret, buffer = cv2.imencode(".jpg", frame)
        if not ret:
            continue

        yield (
            b"--frame\r\n"
            b"Content-Type: image/jpeg\r\n\r\n" +
            buffer.tobytes() +
            b"\r\n"
        )

        time.sleep(0.15)

# ================================
# Routes
# ================================
@app.route("/video")
def video():
    return Response(generate_frames(),
                    mimetype="multipart/x-mixed-replace; boundary=frame")

@app.route("/status")
def status():
    return jsonify(last_status)

# ================================
# Main
# ================================
if __name__ == "__main__":
    print("AOI simulation service running (NO camera, NO YOLO)")
    app.run(host="0.0.0.0", port=3001, threaded=True)