import sys
import json
from ultralytics import YOLO

model_path = sys.argv[1]

model = YOLO(model_path)

# ✅ YOLO reads dataset from training metadata
metrics = model.val(verbose=False)

names = model.names
per_class = []

for cls_idx in metrics.box.ap_class_index:
    p, r, ap50, ap5095 = metrics.box.class_result(int(cls_idx))
    per_class.append({
        "class": names[int(cls_idx)],
        "precision": float(p),
        "recall": float(r),
        "map50": float(ap50),
        "map5095": float(ap5095)
    })

output = {
    "overall": {
        "precision": float(metrics.box.mp),
        "recall": float(metrics.box.mr),
        "map50": float(metrics.box.map50),
        "map5095": float(metrics.box.map),
    },
    "per_class": per_class
}

print(json.dumps(output))
