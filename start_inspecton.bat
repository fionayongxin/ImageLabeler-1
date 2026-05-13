@echo off
title Inspection System Startup

echo ================================
echo Starting Basler Inference Camera
echo ================================
start "InferCam" cmd /k python inspect/basler_infer_stream.py

timeout /t 3 >nul

echo ================================
echo Starting Inference Server
echo ================================
start "Inference" cmd /k ^
cd inspect ^&^& ^
call ..\.venv\Scripts\activate ^&^& ^
python -m uvicorn inference_server:app --host 127.0.0.1 --port 8005
timeout /t 2 >nul

echo ================================
echo Starting MJPEG Display
echo ================================
start "Display" cmd /k python basler_stream.py

timeout /t 2 >nul

echo ================================
echo Starting Node UI Server
echo ================================
start "Node" cmd /k node server/server.js

echo ================================
echo System startup complete
echo ================================