"""
======================================================
basler_infer_stream.py
------------------------------------------------------
Basler camera service for INFERENCE ONLY

Responsibilities:
- Owns Basler camera for inference
- Forces fixed inference resolution
- Writes latest frame to shared memory

- NO MJPEG
- NO disk I/O
- NO Flask
- NO UI responsibility

This process is the ONLY writer of shared memory.
======================================================
"""

from pypylon import pylon
from multiprocessing import shared_memory
import numpy as np
import time
import signal
import sys
import cv2

# =====================================================
# SHARED MEMORY CONTRACT (MUST MATCH inference_server.py)
# =====================================================

SHM_NAME = "basler_frame"
INF_WIDTH = 1280
INF_HEIGHT = 1024
CHANNELS = 3  # BGR uint8

# =====================================================
# SHARED MEMORY INIT (WRITER)
# =====================================================

try:
    shm = shared_memory.SharedMemory(
        name=SHM_NAME,
        create=True,
        size=INF_WIDTH * INF_HEIGHT * CHANNELS
    )
    print("[InferCam] Shared memory created")
except FileExistsError:
    shm = shared_memory.SharedMemory(name=SHM_NAME)
    print("[InferCam] Shared memory attached")

frame_buf = np.ndarray(
    (INF_HEIGHT, INF_WIDTH, CHANNELS),
    dtype=np.uint8,
    buffer=shm.buf
)

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
        print(f"[InferCam] {node_name} = {value}")
    except Exception as e:
        print(f"[InferCam] {node_name} skipped:", e)

# =====================================================
# CAMERA CONFIGURATION (FIXED FOR INFERENCE)
# =====================================================

try_set("TriggerSelector", "FrameStart")
try_set("TriggerMode", "Off")
try_set("AcquisitionMode", "Continuous")

# ✅ Force inference resolution

try_set("Width", nodemap.GetNode("WidthMax").GetValue())
try_set("Height", nodemap.GetNode("HeightMax").GetValue())

try_set("OffsetX", 0)
try_set("OffsetY", 0)

# Auto exposure once
try_set("ExposureAuto", "Once")
try_set("GainAuto", "Once")

# =====================================================
# IMAGE FORMAT CONVERTER
# =====================================================

converter = pylon.ImageFormatConverter()
converter.OutputPixelFormat = pylon.PixelType_BGR8packed
converter.OutputBitAlignment = pylon.OutputBitAlignment_MsbAligned

# =====================================================
# CAMERA GRAB LOOP
# =====================================================

def camera_loop():
    camera.StartGrabbing(pylon.GrabStrategy_LatestImageOnly)
    print("[InferCam] Grabbing started")

    # Allow auto exposure to settle
    time.sleep(1.5)

    # Lock exposure & gain
    try_set("ExposureAuto", "Off")
    try_set("GainAuto", "Off")

    # Clamp exposure if supported
    try:
        exp = nodemap.GetNode("ExposureTime").GetValue()
        nodemap.GetNode("ExposureTime").SetValue(min(exp, 50000.0))
    except Exception:
        pass

    # Optional FPS limit
    try_set("AcquisitionFrameRateEnable", True)
    try_set("AcquisitionFrameRate", 10.0)

    print("[InferCam] Inference mode active")

    while camera.IsGrabbing():
        try:
            grab = camera.RetrieveResult(
                2000,
                pylon.TimeoutHandling_ThrowException
            )
            if grab.GrabSucceeded():
                image = converter.Convert(grab)
                frame = image.GetArray()  # Full sensor frame (e.g. 5496x3672)

                # ✅ FIX: resize before writing
                frame_resized = cv2.resize(frame, (INF_WIDTH, INF_HEIGHT))

                # ✅ Zero-copy write to shared memory
                frame_buf[:] = frame_resized


            grab.Release()

        except Exception as e:
            print("[InferCam] Grab failed:", e)

# =====================================================
# CLEAN SHUTDOWN
# =====================================================

def shutdown(sig, frame):
    print("[InferCam] Shutting down")
    try:
        camera.StopGrabbing()
        camera.Close()
    except Exception:
        pass

    try:
        shm.close()
        shm.unlink()
    except Exception:
        pass

    sys.exit(0)

signal.signal(signal.SIGINT, shutdown)
signal.signal(signal.SIGTERM, shutdown)

# =====================================================
# ENTRY POINT
# =====================================================

if __name__ == "__main__":
    print("[InferCam] Basler inference camera starting")
    print(f"[InferCam] Resolution: {INF_WIDTH}x{INF_HEIGHT}")

    camera_loop()