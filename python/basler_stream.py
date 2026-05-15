"""
======================================================
basler_stream.py
======================================================

Responsibilities:
- DOES NOT own Basler camera
- Reads frames from shared memory
- Provides MJPEG stream for UI
- Provides still capture (image bytes only)

Design rules:
- No pypylon usage
- No camera ownership
- Shared memory is source of truth
"""

from flask import Flask, Response, jsonify
from multiprocessing import shared_memory

import numpy as np
import cv2

import threading
import time
import signal
import sys


# ======================================================
# SHARED MEMORY CONFIG (MUST MATCH INFERENCE PROCESS)
# ======================================================

SHM_NAME = "basler_frame"

FRAME_WIDTH = 1280
FRAME_HEIGHT = 1024
CHANNELS = 3   # BGR uint8


# ======================================================
# FLASK APP
# ======================================================

app = Flask(__name__)


# ======================================================
# SHARED MEMORY ATTACH (READ-ONLY)
# ======================================================

try:
    shm = shared_memory.SharedMemory(name=SHM_NAME)

    frame_buf = np.ndarray(
        (FRAME_HEIGHT, FRAME_WIDTH, CHANNELS),
        dtype=np.uint8,
        buffer=shm.buf
    )

    print("[Display] Shared memory attached")

except FileNotFoundError:
    shm = None
    frame_buf = None
    print("[Display] Shared memory not available")


# ======================================================
# FRAME CACHE (THREAD-SAFE)
# ======================================================

frame_lock = threading.Lock()
latest_frame = None

camera_fps = 0.0
mjpeg_fps = 0.0


# ======================================================
# FRAME READER THREAD
# ======================================================

def frame_reader_loop():
    """Continuously copy frames from shared memory."""
    global latest_frame, camera_fps

    if frame_buf is None:
        print("[Display] No shared memory — reader inactive")
        return

    last_time = time.time()
    count = 0

    while True:
        # Copy shared memory → local frame cache
        with frame_lock:
            latest_frame = frame_buf.copy()

        count += 1

        now = time.time()
        if now - last_time >= 1.0:
            camera_fps = count / (now - last_time)
            count = 0
            last_time = now

        time.sleep(0.001)  # prevent CPU spin


# ======================================================
# MJPEG STREAM GENERATOR
# ======================================================

def mjpeg_generator():
    """Yield MJPEG frames continuously."""
    global mjpeg_fps

    last_time = time.time()
    count = 0

    while True:
        with frame_lock:
            if latest_frame is None:
                time.sleep(0.01)
                continue

            frame = latest_frame.copy()

        # Overlay FPS debug info
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
            b"Content-Type: image/jpeg\r\n\r\n"
            + jpg.tobytes()
            + b"\r\n"
        )

        count += 1

        now = time.time()
        if now - last_time >= 1.0:
            mjpeg_fps = count / (now - last_time)
            count = 0
            last_time = now


# ======================================================
# ROUTES
# ======================================================

@app.route("/stream")
def stream():
    """MJPEG stream endpoint."""
    return Response(
        mjpeg_generator(),
        mimetype="multipart/x-mixed-replace; boundary=frame"
    )


@app.route("/stats")
def stats():
    """Return runtime FPS stats."""
    return jsonify({
        "camera_fps": round(camera_fps, 2),
        "mjpeg_fps": round(mjpeg_fps, 2)
    })


@app.route("/capture", methods=["POST"])
def capture():
    """
    Capture current frame (memory only).

    NOTE:
    - Node is responsible for saving images
    - Python only returns image bytes
    """
    with frame_lock:
        if latest_frame is None:
            return jsonify({"error": "No frame available"}), 500

        ok, buffer = cv2.imencode(
            ".jpg",
            latest_frame,
            [cv2.IMWRITE_JPEG_QUALITY, 85]
        )

        if not ok:
            return jsonify({"error": "Encode failed"}), 500

        return jsonify({
            "image": buffer.tobytes().hex()
        })


# ======================================================
# CLEAN SHUTDOWN
# ======================================================

def shutdown(_sig, _frame):
    print("[Display] Shutting down")

    try:
        if shm:
            shm.close()
    except Exception:
        pass

    sys.exit(0)


signal.signal(signal.SIGINT, shutdown)
signal.signal(signal.SIGTERM, shutdown)


# ======================================================
# ENTRY POINT
# ======================================================

if __name__ == "__main__":
    print("[Display] MJPEG service starting")
    print("[Display] Stream: http://127.0.0.1:8001/stream")

    threading.Thread(
        target=frame_reader_loop,
        daemon=True
    ).start()

    app.run(
        host="127.0.0.1",
        port=8001,
        threaded=True
    )