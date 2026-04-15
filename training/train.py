"""
======================================================
train.py
------------------------------------------------------
Responsibility:
- Train a YO using Ultralytics
- Accept all configuration via CLI arguments
- Write results under the given project/run directory

Design rules:
- Do NOT hardcode model paths
- Do NOT assume filesystem layout
- Let Node.js decide what to train
======================================================
"""

import argparse
from ultralytics import YOLO


def parse_args():
    """Parse CLI arguments passed from Node.js."""
    parser = argparse.ArgumentParser("YOLO Training")

    parser.add_argument("--data", required=True, help="Path to dataset.yaml")
    parser.add_argument("--model", required=True, help="Model name or .pt path")
    parser.add_argument("--epochs", type=int, default=50)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--batch", type=int, default=8)
    parser.add_argument("--name", required=True, help="Run name")
    parser.add_argument("--project", required=True, help="Training output root")

    return parser.parse_args()


def main():
    args = parse_args()

    # --------------------------------------------------
    # TRAIN
    # --------------------------------------------------
    # args.model can be:
    #   - "yolo26n.pt"
    #   - "yolov8n.pt"
    #   - "/absolute/path/to/model.pt"
    # Ultralytics resolves all correctly.
    model = YOLO(args.model)

    model.train(
        data=args.data,
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        name=args.name,
        project=args.project,
        exist_ok=True,
        verbose=True
    )


if __name__ == "__main__":
    main()
