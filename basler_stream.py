"""
======================================================
basler_stream.py — DISPLAY‑ONLY VERSION
------------------------------------------------------
Responsibilities:
- DOES NOT own Basler camera
- Reads frames from shared memory
- Provides MJPEG stream for UI
- Provides still capture (image bytes only)
- NEVER touches pypylon
- NEVER opens camera
======================================================
"""

from flask import Flask, Response, jsonify
from multiprocessing import shared_memory
import numpy as np
import cv2
import threading
import time
import signal
import sys

# =====================================================
# SHARED MEMORY CONTRACT (MUST MATCH infer process)
# =====================================================

SHM_NAME = "basler_frame"
FRAME_WIDTH = 1280
FRAME_HEIGHT = 1024
CHANNELS = 3  # BGR uint8

# =====================================================
# FLASK APP
# =====================================================

app = Flask(__name__)

# =====================================================
# SHARED MEMORY ATTACH (READ‑ONLY)
# =====================================================

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

# =====================================================
# LOCAL FRAME CACHE (FOR MJPEG / CAPTURE)
# =====================================================

frame_lock = threading.Lock()
latest_frame = None

camera_fps = 0.0
mjpeg_fps = 0.0

# =====================================================
# FRAME READER THREAD
# =====================================================

def frame_reader_loop():
    global latest_frame, camera_fps

    if frame_buf is None:
        print("[Display] No shared memory, waiting...")
        return

    last_time = time.time()
    count = 0

    while True:
        # Copy shared memory into local buffer
        with frame_lock:
            latest_frame = frame_buf.copy()

        count += 1
        now = time.time()
        if now - last_time >= 1.0:
            camera_fps = count / (now - last_time)
            count = 0
            last_time = now

        time.sleep(0.001)  # avoid busy loop

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
    Memory‑only still capture.
    Node is the sole photo writer.
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

# =====================================================
# CLEAN SHUTDOWN
# =====================================================

def shutdown(sig, frame):
    print("[Display] Shutting down")
    try:
        shm.close()
    except Exception:
        pass
    sys.exit(0)

signal.signal(signal.SIGINT, shutdown)
signal.signal(signal.SIGTERM, shutdown)

# =====================================================
# ENTRY POINT
# =====================================================

if __name__ == "__main__":
    print("[Display] MJPEG service starting")
    print("[Display] MJPEG stream: http://127.0.0.1:8001/stream")

    threading.Thread(
        target=frame_reader_loop,
        daemon=True
    ).start()

    app.run(host="127.0.0.1", port=8001, threaded=True)