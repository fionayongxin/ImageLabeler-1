"""
======================================================
basler_stream.py
------------------------------------------------------
Responsibility:
- Own the Basler camera (pypylon)
- Configure camera for continuous free‑run
- Grab frames in a background thread
- Serve MJPEG live preview over HTTP
- Handle still image capture from latest frame

Design principles:
- Exactly ONE camera owner
- Stream and capture share same acquisition loop
- Thread‑safe frame access
- Deterministic configuration
======================================================
"""

from pypylon import pylon
import cv2
from flask import Flask, Response, jsonify
import threading
import time
from pathlib import Path

# =====================================================
# Flask app
# =====================================================

app = Flask(__name__)

# =====================================================
# Output directory (MUST match Node static /photos)
# =====================================================

PHOTOS_DIR = Path(__file__).parent / "server" / "photos"
PHOTOS_DIR.mkdir(parents=True, exist_ok=True)

# =====================================================
# Camera initialization
# =====================================================

camera = pylon.InstantCamera(
    pylon.TlFactory.GetInstance().CreateFirstDevice()
)

camera.Open()
nodemap = camera.GetNodeMap()


def try_set(node, value):
    try:
        nodemap.GetNode(node).SetValue(value)
        print(f"[Camera] {node} = {value}")
    except Exception as e:
        print(f"[Camera] {node} skipped:", e)


# =====================================================
# Camera configuration (FREE RUN)
# =====================================================

try_set("TriggerSelector", "FrameStart")
try_set("TriggerMode", "Off")
try_set("AcquisitionMode", "Continuous")

# Exposure & Gain (tune here)
try_set("ExposureAuto", "Off")
try_set("GainAuto", "Off")
try_set("ExposureTime", 12000.0)  # µs
try_set("Gain", 4.0)              # dB

# =====================================================
# Image converter
# =====================================================

converter = pylon.ImageFormatConverter()
converter.OutputPixelFormat = pylon.PixelType_BGR8packed
converter.OutputBitAlignment = pylon.OutputBitAlignment_MsbAligned

# =====================================================
# Shared frame buffer
# =====================================================

frame_lock = threading.Lock()
latest_frame = None

# =====================================================
# Camera grab thread
# =====================================================

def camera_loop():
    global latest_frame

    camera.StartGrabbing(pylon.GrabStrategy_LatestImageOnly)
    print("[Camera] Grabbing started")

    while camera.IsGrabbing():
        try:
            grab = camera.RetrieveResult(
                2000,
                pylon.TimeoutHandling_ThrowException
            )

            if grab.GrabSucceeded():
                image = converter.Convert(grab)
                frame = image.GetArray()

                with frame_lock:
                    latest_frame = frame

            grab.Release()
        except Exception as e:
            print("[Camera] Grab failed:", e)


threading.Thread(target=camera_loop, daemon=True).start()

# =====================================================
# MJPEG stream
# =====================================================

def mjpeg_generator():
    while True:
        with frame_lock:
            if latest_frame is None:
                continue

            ok, jpg = cv2.imencode(".jpg", latest_frame)
            if not ok:
                continue

            frame_bytes = jpg.tobytes()

        yield (
            b"--frame\r\n"
            b"Content-Type: image/jpeg\r\n\r\n" +
            frame_bytes +
            b"\r\n"
        )

        time.sleep(0.05)  # ~20 FPS


@app.route("/stream")
def stream():
    return Response(
        mjpeg_generator(),
        mimetype="multipart/x-mixed-replace; boundary=frame"
    )

# =====================================================
# STILL IMAGE CAPTURE (IMPORTANT)
# =====================================================

@app.route("/capture", methods=["POST"])
def capture():
    global latest_frame

    with frame_lock:
        if latest_frame is None:
            return jsonify({"error": "No frame available"}), 500

        filename = f"photo_{int(time.time()*1000)}.png"
        path = PHOTOS_DIR / filename

        cv2.imwrite(str(path), latest_frame)

    print(f"[Capture] Saved {filename}")
    return jsonify({"filename": filename})


# =====================================================
# Entry point
# =====================================================

if __name__ == "__main__":
    print("[Server] MJPEG + Capture running at http://127.0.0.1:8001")
    app.run(host="127.0.0.1", port=8001, threaded=True)
