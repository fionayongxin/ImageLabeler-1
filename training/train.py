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

    # # --------------------------------------------------
    # # VALIDATE (SINGLE, CORRECT CALL)
    # # --------------------------------------------------
    # best_pt = run_dir / "weights" / "best.pt"
    # if not best_pt.exists():
    #     raise FileNotFoundError(f"best.pt not found: {best_pt}")

    # val_model = YOLO(str(best_pt))

    # val_results = val_model.val(
    #     data=args.data,
    #     project=run_dir,
    #     name="val",
    #     verbose=True,
    #     save_conf=True,
    #     plots=True
    # )

    # # --------------------------------------------------
    # # EXPORT PER-CLASS METRICS (THIS WAS MISSING)
    # # --------------------------------------------------
    
    # metrics = val_results.box
    # names = val_results.names  # dict: {class_id: class_name}

    # per_class = []

    # # ✅ Loop over metric slots, not class names
    # for i in range(metrics.nc):
    #     p, r, ap50, ap = metrics.class_result(i)
    #     class_id = metrics.ap_class_index[i]

    #     per_class.append({
    #         "class": names[class_id],
    #         "precision": float(p),
    #         "recall": float(r),
    #         "map50": float(ap50),
    #         "map5095": float(ap)
    #     })

    # metrics_path = val_dir / "metrics.json"
    # with open(metrics_path, "w") as f:
    #     json.dump(
    #         {
    #             "all": {
    #                 "precision": float(metrics.mp),
    #                 "recall": float(metrics.mr),
    #                 "map50": float(metrics.map50),
    #                 "map5095": float(metrics.map)
    #             },
    #             "per_class": per_class
    #         },
    #         f,
    #         indent=2
    #     )

    # print(f"✅ Validation metrics saved to: {metrics_path}")

if __name__ == "__main__":
    main()
