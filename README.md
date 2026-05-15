# 📘 Vision Inspection System
## Overview
This project is a full-stack industrial vision inspection system designed for:


- 📸 Image capture (Basler camera)
- 🧠 AI inference (YOLO)
- 🏷️ Image labeling
- 📊 Dataset + training management
- 🏭 Live PCB inspection (operator + engineer UI)

The system is designed to run locally on a factory PC, with optional integration to a remote training server.

## 🧩 System Architecture
This system consists of 3 core layers:

```
[Frontend (HTML/JS)]
      ↓ HTTP
[Node.js Backend] 
      ↓ HTTP / Shared State
[Python Services]
````


## ⚙️ Components
### 1. Python Services (Compute Layer)
Located at:

```python/```

#### **a. Basler Inference Camera**

**File**: ```python/basler_infer_stream.py```

**Role**: 

- Owns the Basler camera
- Captures frames
- Writes frames into shared memory

#### **b. Inference Server (YOLO)**

**File**: ```python/inference_server.py```

**Role**:

- Loads .pt model dynamically
- Reads frames from shared memory
- Performs inference
- Applies step-based inspection rules

#### **c. Display / MJPEG Server**

**File**: ```python/basler_stream.py```

**Role**:

- Reads shared memory
- Provides live MJPEG stream
- Provides image capture endpoint

------------------------------------

### 2. Backend (Node.js API Layer)

Located at:

- ```backend/```

**Responsibilities**:

- API gateway
- Filesystem management (configs, images, metadata)

**Proxy layer**:

- Camera → Python
- Inference → Python
- Training → Remote server



### Key Features:

- Config management (/api/configs)
- Inspection state control (inspection_state.json)
- Dataset + experiment proxy
- Photo storage + thumbnails
- YOLO labeling pipeline

---

### 3. Frontend (Web UI)
Located at:
```apps/```

#### **Inspection**
- Live camera + inference results
- Step-based inspection UI

#### **Labeling Tool**

- Draw YOLO bounding boxes
- Upload to training server

#### **Training System**

- Managing the full training lifecycle
- Acts as a control + monitoring interface for the remote training server.
--- 
### **📂 Key Folders**

```
project-root/
│
├── apps/                  # Frontend applications
│   ├── capture/
│   ├── training/
│   └── inspect/
│
├── backend/               # Node.js backend
│   ├── routes/
│   ├── services/
│   ├── config/
│   ├── utils/
│   └── photos/
│
├── python/                # Python services
│   ├── basler_infer_stream.py
│   ├── inference_server.py
│   └── basler_stream.py
│
├── config/                # Runtime configs
│   └── inspection_state.json
│
├── start_system.bat       # 🔑 Main startup script
└── README.md
```
---

### ▶️ How to Start the System

✅ Recommended (One-click)

Run:
```start_inspecton.bat```

This will:

1. Start Basler camera process
2. Start inference server
3. Start MJPEG display server
4. Start Node backend
5. Open browser at: http://localhost:3000

🔧 Manual Start (for debugging)
1. Camera (shared memory writer) 
```
python python/basler_infer_stream.py
```

2. Inference server
``` 
cd python
python -m uvicorn inference_server:app --host 127.0.0.1 --port 8005
```

3. Display (MJPEG)
```
python python/basler_stream.py
```

4. Backend
```
cd backend
node server.js
```

5. Open UI
**http://localhost:3000**

---
### 🌐 Key Endpoints

#### Camera

- /api/camera/stream → MJPEG stream
- /api/camera/capture → capture image

#### Inference

- /api/inference/status → get result
- /api/inference/state → update inspection state
- /api/inference/reload → reload model

#### Config

- /api/configs → list configs
- /api/configs/save → save config + model

#### Training (Remote)

- /api/train/start
- /api/train/progress
- /api/train/metrics

---

### 🧠 Data Flow (Important)

Inspection Flow
```
Camera → Shared Memory
        → Inference → Decision
        → Node → UI
```

Labeling Flow
```
Capture → Photos
        → Labeler UI
        → YOLO format
        → Upload to training server
```

Training Flow
```
Frontend → Node → Training Server
                     ↓
                 Metrics
                     ↓
                 Frontend
```