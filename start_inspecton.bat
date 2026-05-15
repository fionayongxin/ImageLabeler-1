@echo off
title Inspection System Startup

echo Starting system...

:: ================================
:: Basler Camera (Shared Memory)
:: ================================
start "" /b python python\basler_infer_stream.py

timeout /t 2 >nul

:: ================================
:: Inference Server
:: ================================
start "" /b cmd /c ^
cd python ^&^& ^
call ..\.venv\Scripts\activate ^&^& ^
python -m uvicorn inference_server:app --host 127.0.0.1 --port 8005

:: ================================
:: MJPEG Display
:: ================================
start "" /b python python\basler_stream.py

:: ================================
:: Backend Server
:: ================================
start "" /b cmd /c ^
cd backend ^&^& ^
node server.js

timeout /t 2 >nul

:: ================================
:: Launch UI
:: ================================
start http://localhost:3000/inspect

echo System started.