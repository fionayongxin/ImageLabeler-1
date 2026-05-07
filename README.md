# Vision Inspection System

A comprehensive computer vision inspection system for automated quality control using Basler cameras, YOLO object detection, and real-time inference. Built with Node.js, Python FastAPI, and Ultralytics YOLO.

## Features

### 🔍 **Live Inspection**
- Real-time camera streaming via Basler cameras
- Step-based inspection rules with required/forbidden classes
- PASS/FAIL/WAITING status with confidence thresholds
- Engineer mode for configuration and testing

### 📷 **Camera Integration**
- Basler camera control via pypylon
- MJPEG streaming for live preview
- Still image capture and storage
- Automatic camera discovery and configuration

### 🏷️ **Image Labeling**
- Canvas-based annotation interface
- Dynamic class loading from dataset configuration
- YOLO format export with normalized coordinates
- Thumbnail navigation and batch processing

### 🤖 Model Training (Orchestration)
- Training job orchestration and control
- Training progress and metrics visualization
- Experiment history and model management
- Delegates training execution to Training Server

### 📊 **Experiment Management**
- Training run history and metrics
- Model performance comparison
- Weights download and deployment
- Loss and mAP visualization

### 📁 **Dataset Management**
- Hierarchical dataset organization (station/process)
- Image browsing with pagination
- Dataset statistics and validation
- YAML configuration management

## Architecture

```
Browser (HTML/CSS/JS)
    ↓ HTTP
Node.js Express Server (Port 3000)
    ↓ REST APIs
├── Camera Service (Python/Flask - Port 8001)
├── Inference Service (Python/FastAPI - Port 8000)
├── Training Server (Python/FastAPI - Port 8002)
└── File System (Datasets, Models, Photos)
```

### Service Responsibilities

- **Node.js Server**: HTTP API gateway, static assets, service orchestration
- **Camera Service**: Basler camera control, MJPEG streaming, image capture
- **Inference Service**: YOLO model loading, real-time inference, inspection logic
- **Training Server**: YOLO training execution, experiment tracking, metrics, model export

## Prerequisites

### System Requirements
- **Windows 10/11** (tested on Windows)
- **Node.js** v18+ (LTS recommended)
- **Python** 3.12 
- **Basler Camera** with pylon SDK (optional for development)

### Python Environment
```bash
# Create virtual environment
python -m venv yolo-env

# Activate environment
yolo-env\Scripts\activate  # Windows
# source yolo-env/bin/activate  # Linux/Mac
```

### Dependency management
This project uses `pip-tools` to keep dependencies reproducible.

1. Install `pip-tools` inside the virtual environment:
   ```bash
   pip install pip-tools
   ```

2. Generate the pinned requirements file:
   ```bash
   cd interface
   pip-compile requirements.in
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

### Required Packages
- `node-fetch / axios` (service communication)
- `chart.js` (metrics visualization)
- `opencv-python` (optional, inspection utilities)
- `torch` - PyTorch (with CUDA support for GPU)
- `opencv-python` - Image processing
- `flask` - Camera streaming service
- `pypylon` - Basler camera SDK (optional)

## Service Compatibility

This repository contains the **PC / Control Plane** of the Vision Inspection System.
It depends on external backend services that are versioned and deployed independently.

### Training Server

- **Repository**: https://github.com/yang-githubb/imagelabeler-server
- **Required Version**: **>= v0.1.0**

The training server is responsible for:
- YOLO model training
- Experiment tracking
- Metrics generation
- Model weight export

The PC application communicates with the training server via REST APIs and assumes
the following endpoints are available:

- `POST /train/start`
- `POST /train/stop`
- `GET /train/progress`
- `GET /train/metrics`
- `GET /experiments`

### Compatibility Notes

- `station` and `process` are **fixed per PC**

## Installation

1. **Clone/Download the project**
   ```bash
   cd path/to/your/projects
   # Place the interface folder here
   ```

2. **Install Node.js dependencies**
   ```bash
   cd interface
   npm install
   ```

3. **Setup Python environment**
   ```bash
   # Create virtual environment
   python -m venv yolo-env

   # Activate environment
   yolo-env\Scripts\activate

   # Install Python packages
   pip install -r requirements.txt
   ```

4. **Configure paths** (if needed)
   - Update `server/config/paths.js` for custom directories
   - Update `server/config/env.js` for different ports
   - Ensure dataset paths in `datasets/station_01/final_inspection/dataset.yaml` are correct

## Usage

### Starting the System

1. **Activate Python environment**
   ```bash
   cd interface
   yolo-env\Scripts\activate
   ```

2. **Start Inference Service** (FastAPI)
   ```bash
   cd inspect
   uvicorn inference_server:app --host 0.0.0.0 --port 8000
   ```

3. **Start Main Server** (Node.js)
   ```bash
   cd server
   node server.js
   ```

4. **Access the application**
   - Open browser: `http://localhost:3000`
   - Default page redirects to training interface

### Application Pages

| Page | URL | Description |
|------|-----|-------------|
| **Training** | `/` or `/trainer` | Configure and start YOLO training |
| **Labeler** | `/labeler` | Annotate images for training |
| **Experiments** | `/experiments` | View training history and metrics |
| **Datasets** | `/datasets` | Browse dataset images |
| **Inspection** | `/inspect` | Live inspection with camera |
| **Settings** | `/settings` | System diagnostics and info |

### Workflow

1. **Setup Dataset**
   - Place images in `datasets/station_01/final_inspection/images/`
   - Configure classes in `dataset.yaml`

2. **Label Images**
   - Go to `/labeler`
   - Select images, draw bounding boxes
   - Choose classes and save annotations

3. **Train Model**
   - Go to `/trainer`
   - Select dataset, model, and parameters
   - Start training and monitor progress

4. **Deploy Model**
   - Trained models appear in `/experiments`
   - Download weights or set as active model

5. **Live Inspection**
   - Go to `/inspect`
   - Configure inspection rules per step
   - Monitor real-time PASS/FAIL results

## Configuration

### Dataset Configuration
Located: `datasets/station_01/final_inspection/dataset.yaml`

```yaml
path: "C:/Users/username/Documents/AISetup/interface"
train: "C:/Users/username/Documents/AISetup/interface/datasets/station_01/final_inspection/images"
val: "C:/Users/username/Documents/AISetup/interface/datasets/station_01/final_inspection/validation/images"

names:
  0: T_2_label
  1: T_Body
  2: T_Bushing
  # ... more classes
```

### Active Model
Located: `server/public/js/models/active_model.json`

```json
{
  "path": "C:/path/to/trained/model.pt"
}
```

## API Reference

### Camera APIs
- `GET /api/camera/stream` - MJPEG camera stream
- `POST /api/camera/capture` - Capture still image

### Inference APIs
- `GET /api/inference/status` - Get inspection result
- `GET /api/inference/config` - Get inspection configuration
- `POST /api/inference/config` - Update inspection config

### Training APIs
- `POST /api/train/start` - Start training run
- `POST /api/train/stop` - Stop active training
- `GET /api/train/progress` - Get training progress

### Labeling APIs
- `GET /api/yolo/classes` - Get available classes
- `POST /api/yolo/save` - Save YOLO annotations
- `POST /api/yolo/undo` - Undo last save

### Dataset APIs
- `GET /api/datasets` - List datasets
- `GET /api/datasets/images` - Get dataset images