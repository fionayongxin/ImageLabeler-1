@echo off
title Inspection System Startup

echo ========================================
echo Cleaning old processes...
echo ========================================

:: Kill previous python + node processes (safe reset)
taskkill /IM python.exe /F >nul 2>&1
taskkill /IM node.exe /F >nul 2>&1


echo ========================================
echo Starting system...
echo ========================================

:: ================================
:: 1. Basler Camera (Shared Memory)
:: ================================
echo [1/4] Starting Basler Inference Stream...
start "" python python\basler_infer_stream.py

timeout /t 2 >nul


:: ================================
:: 2. Inference Server (FastAPI)
:: ================================
echo [2/4] Starting Inference Server...

start "" cmd /c ^
cd python ^&^& ^
call ..\.venv\Scripts\activate ^&^& ^
uvicorn inference_server:app --host 127.0.0.1 --port 8005

timeout /t 2 >nul


:: ================================
:: 3. MJPEG Display
:: ================================
echo [3/4] Starting MJPEG Stream...
start "" python python\basler_stream.py


:: ================================
:: 4. Backend Server (Node.js)
:: ================================
echo [4/4] Starting Backend Server...

start "" cmd /c ^
cd backend ^&^& ^
node server.js

timeout /t 2 >nul


:: ================================
:: 5. Launch UI
:: ================================
echo Launching UI...
start http://localhost:3000/inspect


echo ========================================
echo System started successfully
echo ========================================
pause
