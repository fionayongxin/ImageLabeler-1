from pathlib import Path
from ultralytics import YOLO
import argparse
import json


MODEL_DIR = Path(__file__).resolve().parent.parent / "models" / "yolo"


def parse_args():
    parser = argparse.ArgumentParser("YOLO Training")
    parser.add_argument("--data", required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--epochs", type=int, default=50)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--batch", type=int, default=8)
    parser.add_argument("--name", required=True)
    parser.add_argument("--project", required=True)
    return parser.parse_args()


def main():
    args = parse_args()

    model_path = MODEL_DIR / args.model
    if not model_path.exists():
        raise FileNotFoundError(f"Model not found: {model_path}")

    run_dir = Path(args.project) / args.name
    val_dir = run_dir / "val"
    val_dir.mkdir(parents=True, exist_ok=True)

    # --------------------------------------------------
    # TRAIN
    # --------------------------------------------------
    model = YOLO(str(model_path))

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
