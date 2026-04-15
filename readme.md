## Vision Trainer Web App – Developer

This project is a multi‑page, framework‑free web application for camera capture, image annotation, model training, experiment tracking, dataset browsing, and live visual inspection. Each page is self‑contained and communicates only with backend APIs. There is no shared frontend state across pages.

### High‑Level Architecture
Browser (**HTML** / **CSS** / **JavaScript**)
   ↓
Node.js Server (Static assets + REST APIs)
   ↓
### Python Services
    ├─ Training (Ultralytics YOLO)
    └─ Inference (FastAPI, persistent runtime)

### Startup / Run Guide Prerequisites
Node.js (v18+) Python 3.9+ Python virtual environment with:

ultralytics fastapi uvicorn torch (**GPU** optional)

Activate your Python virtual environment before running services. Start Inference Server (FastAPI) 
`cd interface/inspect` 

`uvicorn inference_server:app --host 0.0.0.0 --port 8001`

Start Node.js Server 
`cd interface/server node server.js`

Expected output: Server running on [http://localhost:3000](http://localhost:**3000**)

### Application URLs
Camera: http://localhost:3000/
Labeler: http://localhost:3000/labeler
Trainer: http://localhost:3000/trainer
Experiments: http://localhost:3000/experiments
Datasets: http://localhost:3000/datasets
Inspection: http://localhost:3000/inspect
Settings: http://localhost:3000/settings

### Directory Tree

interface/interface/
├─ server/
│  ├─ server.js
│  ├─ routes/
│  ├─ services/
│  ├─ config/
│  ├─ public/
│  │  ├─ css/
│  │  ├─ js/
│  │  └─ *.html
│  └─ training/
│     └─ <run-name>/
│
├─ training/
│  └─ train.py
│
├─ inspect/
│  └─ inference_server.py
│
├─ datasets/
│  └─ \<station>/\<process>/
│     ├─ images/
│     ├─ labels/
│     └─ dataset.yaml
│
└─ photos/

### Page Responsibilities

#### Camera Capture

Live webcam preview using getUserMedia Capture still images via off‑screen canvas Mirror image before saving Persist images to backend Display latest captured thumbnails

#### Image Labeler

Draw bounding boxes Assign class labels Read / draw modes Pixel‑based deterministic annotation Save YOLO labels Undo last annotation save

#### Model Trainer

Configure training parameters Start and stop training jobs Poll backend for progress Display live loss and mAP charts

#### Experiments 

Paginated experiment list Per‑run metrics visualization Download trained weights

#### Datasets 

Read‑only dataset inspection Filter by station and process Paginated image display

#### Live Inspection

Run inference via FastAPI Persistent model runtime Poll inference results Draw bounding boxes Display **PASS** / **FAIL** status

#### Settings 

Display backend system diagnostics Read‑only key/value data

### API Endpoints 

#### Camera / Photos
**GET**  /api/photos 
**GET**  /api/photos/latest 
**POST** /api/photos/save 
**POST** /api/photos/delete

#### Labeling
**POST** /api/yolo/save 
**POST** /api/yolo/undo

#### Training
**POST** /api/train/start 
**POST** /api/train/stop
**GET**  /api/train/progress 
**GET**  /api/train/metrics

#### Experiments
**GET** /api/experiments 
**GET** /api/experiments/:run/metrics 
**GET** /api/experiments/:run/weights

#### Datasets
**GET** /api/datasets/images?station=&process=

#### Inference
**GET**  /api/inference/status 
**POST** /api/inference/model/upload

#### System
**GET** /api/system