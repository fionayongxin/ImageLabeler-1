"""
======================================================
basler_stream.py
------------------------------------------------------
Responsibility:
- Own the Basler camera (pypylon)
- Configure camera for stable inspection imaging
- Perform auto-exposure ONCE at startup, then lock
- Grab frames continuously in background
- Serve MJPEG live preview over HTTP
- Save latest frame for inference consumption

Design principles:
- Exactly ONE camera owner
- Auto exposure only during calibration phase
- Stable brightness during inspection
- Thread-safe frame access
- Windows-safe filesystem paths
======================================================
"""

from pypylon import pylon
from flask import Flask, Response, jsonify
import cv2
import threading
import time
from pathlib import Path

# =====================================================
# FLASK APP
# =====================================================

app = Flask(__name__)

# =====================================================
# PROJECT PATHS (WINDOWS SAFE)
# =====================================================

BASE_DIR = Path(
    r"C:\Users\pnayeuoo\OneDrive - Flex\Documents\AISetup\interface"
)

PHOTOS_DIR = BASE_DIR / "server" / "photos"
RUNTIME_DIR = BASE_DIR / "server" / "runtime"

PHOTOS_DIR.mkdir(parents=True, exist_ok=True)
RUNTIME_DIR.mkdir(parents=True, exist_ok=True)

# Shared frame path (read by inference server)
LATEST_FRAME_PATH = RUNTIME_DIR / "basler_latest.jpg"

# =====================================================
# CAMERA INITIALIZATION
# =====================================================

camera = pylon.InstantCamera(
    pylon.TlFactory.GetInstance().CreateFirstDevice()
)

camera.Open()
nodemap = camera.GetNodeMap()

# =====================================================
# NODE SET HELPER
# =====================================================

def try_set(node_name: str, value):
    try:
        nodemap.GetNode(node_name).SetValue(value)
        print(f"[Camera] {node_name} = {value}")
    except Exception as e:
        print(f"[Camera] {node_name} skipped:", e)

# =====================================================
# BASIC CAMERA CONFIGURATION
# =====================================================

# Continuous free run
try_set("TriggerSelector", "FrameStart")
try_set("TriggerMode", "Off")
try_set("AcquisitionMode", "Continuous")

# =====================================================
# AUTO EXPOSURE & GAIN (INSPECTION PATTERN)
# =====================================================

# Enable auto exposure ONCE
try_set("ExposureAuto", "Once")
try_set("GainAuto", "Once")

# Constrain auto range (prevents extreme values)
try_set("ExposureTimeLowerLimit", 2000.0)    # µs
try_set("ExposureTimeUpperLimit", 20000.0)   # µs
try_set("GainLowerLimit", 0.0)
try_set("GainUpperLimit", 6.0)

# =====================================================
# IMAGE FORMAT CONVERTER
# =====================================================

converter = pylon.ImageFormatConverter()
converter.OutputPixelFormat = pylon.PixelType_BGR8packed
converter.OutputBitAlignment = pylon.OutputBitAlignment_MsbAligned

# =====================================================
# SHARED FRAME BUFFER
# =====================================================

frame_lock = threading.Lock()
latest_frame = None

# =====================================================
# CAMERA GRAB THREAD
# =====================================================

def camera_loop():
    """
    Background acquisition loop.
    Owns camera grabbing and frame updates.
    """

    global latest_frame

    camera.StartGrabbing(pylon.GrabStrategy_LatestImageOnly)
    print("[Camera] Grabbing started (auto exposure phase)")

    # Allow auto exposure to converge
    time.sleep(1.5)

    # Lock exposure and gain (VERY IMPORTANT)
    try_set("ExposureAuto", "Off")
    try_set("GainAuto", "Off")

    try:
        print(
            "[Camera] Final ExposureTime =",
            nodemap.GetNode("ExposureTime").GetValue()
        )
        print(
            "[Camera] Final Gain =",
            nodemap.GetNode("Gain").GetValue()
        )
    except Exception:
        pass

    print("[Camera] Auto exposure locked, entering inspection mode")

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
                    cv2.imwrite(str(LATEST_FRAME_PATH), frame)

            grab.Release()

        except Exception as e:
            print("[Camera] Grab failed:", e)

# Start grab thread
threading.Thread(target=camera_loop, daemon=True).start()

# =====================================================
# MJPEG STREAM
# =====================================================

def mjpeg_generator():
    """
    Yield MJPEG frames for browser <img>.
    """
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
# STILL IMAGE CAPTURE (DATASET CREATION)
# =====================================================

@app.route("/capture", methods=["POST"])
def capture():
    """
    Save the latest frame to photos directory.
    """
    with frame_lock:
        if latest_frame is None:
            return jsonify({"error": "No frame available"}), 500

        filename = f"photo_{int(time.time() * 1000)}.png"
        path = PHOTOS_DIR / filename
        cv2.imwrite(str(path), latest_frame)

    print(f"[Capture] Saved {filename}")
    return jsonify({"filename": filename})

# =====================================================
# ENTRY POINT
# =====================================================

if __name__ == "__main__":
    print("[Server] Basler MJPEG + Capture running")
    print(f"[Server] MJPEG stream: http://127.0.0.1:8001/stream")
    app.run(host="127.0.0.1", port=8001, threaded=True)
