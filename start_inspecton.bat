@echo off
title Inspection System Startup

echo Starting system...

:: ================================
:: Basler Inference Camera
:: ================================
start "InferCam" /min cmd /c python inspect/basler_infer_stream.py

:: Small delay to ensure camera ready
timeout /t 2 >nul

:: ================================
:: Inference Server
:: ================================
start "Inference" /min cmd /c ^
cd inspect ^&^& ^
call ..\.venv\Scripts\activate ^&^& ^
python -m uvicorn inference_server:app --host 127.0.0.1 --port 8005

:: ================================
:: MJPEG Display (optional)
:: ================================
start "Display" /min cmd /c python basler_stream.py

:: ================================
:: Node UI Server
:: ================================
start "Node" /min cmd /c node server/server.js

:: ================================
:: Open browser (nice UX)
:: ================================
timeout /t 2 >nul
start http://localhost:3000

echo System started.