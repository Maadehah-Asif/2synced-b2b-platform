from __future__ import annotations

import json
import sys

import joblib

from preprocess import MODEL_PATH, build_prediction_frame


def main() -> None:
    raw_input = sys.stdin.read().strip()
    if not raw_input:
        raise ValueError("Expected JSON payload on stdin.")

    payload = json.loads(raw_input)
    if not isinstance(payload, dict):
        raise ValueError("Prediction payload must be a JSON object.")

    model = joblib.load(MODEL_PATH)
    frame = build_prediction_frame(payload)
    prediction = float(model.predict(frame)[0])

    sys.stdout.write(json.dumps({"predicted_roi": round(prediction, 6)}))


if __name__ == "__main__":
    main()
