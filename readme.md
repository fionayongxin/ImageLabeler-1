# Vision Trainer Web App – Developer README

This project is a **multi-page, framework-free web application** for image capture, annotation, model training, experiment tracking, and dataset inspection.

Each page is **self-contained** and communicates only with backend APIs.  
No frontend state is shared across pages.

---

## High-Level Architecture

- **Frontend**: Plain HTML, CSS, JavaScript (no frameworks)
- **Rendering**: Server-served static pages
- **State**: Page-local, in-memory only
- **Backend**: REST-style JSON APIs

---

## Page Responsibilities

### Camera Capture (`/trainer` – Camera page)

**Purpose**
- Stream camera video
- Capture still images
- Persist images to backend
- Show latest captures

**Responsibilities**
- Initialize camera via `getUserMedia`
- Capture frames using an off-screen `<canvas>`
- Mirror images before saving
- Upload images as base64 PNG
- Render latest captured thumbnails

---

### Image Labeler (`/labeler`)

**Purpose**
- Draw bounding boxes on images
- Assign class labels
- Export YOLO-format annotations

**Responsibilities**
- Load images for annotation
- Manage read/draw modes
- Handle box creation, dragging, resizing, deletion
- Render overlay annotations via canvas
- Persist annotations to backend

**State Flow**
- Canvas size always matches image natural dimensions
- All drawing is pixel-based and deterministic

---

### Model Trainer (`/trainer` – Training page)

**Purpose**
- Configure and start model training
- Monitor training progress
- Visualize metrics in real time

**Responsibilities**
- Collect training configuration
- Start and stop training jobs
- Poll backend for progress
- Render loss and mAP charts (Chart.js)

**Notes**
- Training jobs are backend-owned
- Frontend is stateless across reloads

---

### Experiments Viewer (`/experiments`)

**Purpose**
- List training experiments
- View experiment metrics
- Download trained weights

**Responsibilities**
- Paginated experiments table
- Metrics overlay with charts
- Run-specific actions (metrics, weights)

---

### Datasets Browser (`/datasets`)

**Purpose**
- Read-only dataset inspection
- Filter images by station and process

**Responsibilities**
- Load images dynamically via filters
- Paginate large image sets
- Display images without modifying backend state

---

### Settings (`/settings`)

**Purpose**
- Display system and environment configuration

**Responsibilities**
- Render read-only key/value sections
- Display backend-provided system metadata

---

## API Expectations

### Camera
- `POST /api/save-photo`
- `GET  /api/photos`
- `GET  /api/photos/latest`

### Labeler
- `POST /api/save-yolo`
- `POST /api/undo-last-save`

### Training
- `POST /api/train/start`
- `POST /api/train/stop`
- `GET  /api/train/progress`
- `GET  /api/train/metrics`

### Experiments
- `GET /api/experiments`
- `GET /api/experiments/:run/metrics`

### Datasets
- `GET /api/dataset/images?station=&process=`

### Settings
- `GET /api/settings`

All APIs are expected to return JSON and remain stable.

---

## State Flow Summary

| Page         | State Scope      | Source of Truth |
|--------------|------------------|-----------------|
| Camera       | In-memory        | Backend         |
| Labeler      | In-memory boxes  | Backend         |
| Trainer      | Poll-driven      | Backend         |
| Experiments  | In-memory list   | Backend         |
| Datasets     | In-memory images | Backend         |
| Settings     | None             | Backend         |

---

## Important Notes

- This project is **standalone** and does not integrate with external systems
- It is **fully reproducible in a local environment**
- Backend APIs are considered the authoritative source of data

---