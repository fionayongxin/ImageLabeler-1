"""
======================================================
basler_stream.py
------------------------------------------------------
Basler camera service
- Owns camera (pypylon)
- Provides MJPEG stream
- Provides still capture as IMAGE BYTES ONLY
- NEVER writes photos to disk
======================================================
"""

from pypylon import pylon
from flask import Flask, Response, jsonify
import cv2
import threading
import time
import signal
import sys

# =====================================================
# FLASK APP
# =====================================================

app = Flask(__name__)

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

try_set("TriggerSelector", "FrameStart")
try_set("TriggerMode", "Off")
try_set("AcquisitionMode", "Continuous")

# =====================================================
# AUTO EXPOSURE (ONCE)
# =====================================================

try_set("ExposureAuto", "Once")
try_set("GainAuto", "Once")

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
# FPS METRICS
# =====================================================

camera_fps = 0.0
mjpeg_fps = 0.0

# =====================================================
# CAMERA GRAB THREAD
# =====================================================

def camera_loop():
    global latest_frame, camera_fps

    camera.StartGrabbing(pylon.GrabStrategy_LatestImageOnly)
    print("[Camera] Grabbing started (auto exposure phase)")

    time.sleep(1.5)

    # Lock exposure & gain
    try_set("ExposureAuto", "Off")
    try_set("GainAuto", "Off")

    # Clamp exposure
    try:
        exp = nodemap.GetNode("ExposureTime").GetValue()
        nodemap.GetNode("ExposureTime").SetValue(min(exp, 50000.0))
    except Exception:
        pass

    # Align FPS
    try_set("AcquisitionFrameRateEnable", True)
    try_set("AcquisitionFrameRate", 10.0)

    try:
        print("[Camera] Final ExposureTime =",
              nodemap.GetNode("ExposureTime").GetValue())
        print("[Camera] Final Gain =",
              nodemap.GetNode("Gain").GetValue())
    except Exception:
        pass

    print("[Camera] Auto exposure locked, entering inspection mode")

    last_time = time.time()
    count = 0

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

                count += 1
                now = time.time()
                if now - last_time >= 1.0:
                    camera_fps = count / (now - last_time)
                    count = 0
                    last_time = now

            grab.Release()

        except Exception as e:
            print("[Camera] Grab failed:", e)

# =====================================================
# MJPEG STREAM
# =====================================================

def mjpeg_generator():
    global mjpeg_fps

    last_time = time.time()
    count = 0

    while True:
        with frame_lock:
            if latest_frame is None:
                time.sleep(0.01)
                continue
            frame = latest_frame.copy()

        cv2.putText(
            frame,
            f"CAM {camera_fps:.1f} FPS | MJPEG {mjpeg_fps:.1f} FPS",
            (10, 30),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (0, 255, 0),
            2
        )

        ok, jpg = cv2.imencode(".jpg", frame)
        if not ok:
            continue

        yield (
            b"--frame\r\n"
            b"Content-Type: image/jpeg\r\n\r\n" +
            jpg.tobytes() +
            b"\r\n"
        )

        count += 1
        now = time.time()
        if now - last_time >= 1.0:
            mjpeg_fps = count / (now - last_time)
            count = 0
            last_time = now

# =====================================================
# ROUTES
# =====================================================

@app.route("/stream")
def stream():
    return Response(
        mjpeg_generator(),
        mimetype="multipart/x-mixed-replace; boundary=frame"
    )

@app.route("/stats")
def stats():
    return jsonify({
        "camera_fps": round(camera_fps, 2),
        "mjpeg_fps": round(mjpeg_fps, 2)
    })

@app.route("/capture", methods=["POST"])
def capture():
    """
    Memory-only still capture.
    Node is the sole photo writer.
    """
    with frame_lock:
        if latest_frame is None:
            return jsonify({"error": "No frame available"}), 500

        ok, buffer = cv2.imencode(".jpg", latest_frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
        if not ok:
            return jsonify({"error": "Encode failed"}), 500

        return jsonify({
            "image": buffer.tobytes().hex()
        })

# =====================================================
# CLEAN SHUTDOWN
# =====================================================

def shutdown(sig, frame):
    print("[Camera] Shutting down")
    try:
        camera.StopGrabbing()
        camera.Close()
    except Exception:
        pass
    sys.exit(0)

signal.signal(signal.SIGINT, shutdown)
signal.signal(signal.SIGTERM, shutdown)

# =====================================================
# ENTRY POINT
# =====================================================

if __name__ == "__main__":
    print("[Server] Basler MJPEG + Capture running")
    print("[Server] MJPEG stream: http://127.0.0.1:8001/stream")
    print("[Server] Stats: http://127.0.0.1:8001/stats")

    threading.Thread(target=camera_loop, daemon=True).start()
    app.run(host="127.0.0.1", port=8001, threaded=True)
