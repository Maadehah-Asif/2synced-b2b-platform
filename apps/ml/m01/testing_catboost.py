import os
import joblib
import pandas as pd
import numpy as np

# -------------------------------------------------
# CONFIG
# -------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))  # .../apps/ml/m01
ROOT_DIR = os.path.dirname(BASE_DIR)                   # .../apps/ml
DATA_DIR = os.path.join(ROOT_DIR, "data")
MODEL_DIR = os.path.join(ROOT_DIR, "models")

# pick which trained model you want to score with:
# default (Module 1) -> models/m01/catboost.pkl
# for Module 2 -> models/m02/catboost.pkl
MODULE_KEY = os.environ.get("MODULE_KEY", "m01")
if MODULE_KEY == "m02":
    MODEL_PATH = os.path.join(MODEL_DIR, "m02", "catboost.pkl")
else:
    MODEL_PATH = os.path.join(MODEL_DIR, "m01", "catboost.pkl")
# explicit override if provided
MODEL_PATH = os.environ.get("MODEL_PATH", MODEL_PATH)
# enable intent outputs only for Module 2 (or explicit override)
DO_INTENT = MODULE_KEY == "m02" or os.environ.get("ENABLE_INTENT_SCORE") == "1"

# I/O: use structured folders
INPUT_DIR = os.path.join(DATA_DIR, "input")
OUTPUT_DIR = os.path.join(DATA_DIR, "output")
INPUT_CSV = os.path.join(INPUT_DIR, "sample_input.csv")
OUTPUT_CSV = os.path.join(OUTPUT_DIR, "output.csv")

CLASS_MAP = {
    0: "LOW",
    1: "MEDIUM",
    2: "HIGH",
}

# -------------------------------------------------
# Feature prep
# -------------------------------------------------
def prep_features(df_in: pd.DataFrame) -> pd.DataFrame:
    df = df_in.copy()

    for col in df.columns:
        if pd.api.types.is_numeric_dtype(df[col]):
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)
        else:
            df[col] = (
                df[col]
                .astype(str)
                .replace("nan", "unknown")
                .replace("NaT", "unknown")
                .fillna("unknown")
            )

    return df

# -------------------------------------------------
# Load model
# -------------------------------------------------
def load_model(path: str):
    obj = joblib.load(path)
    if isinstance(obj, dict) and "model" in obj:
        return obj["model"]
    return obj

# -------------------------------------------------
# Probability extraction
# -------------------------------------------------
def get_probs(model, X: pd.DataFrame, hard_preds: np.ndarray):

    if hasattr(model, "predict_proba"):
        raw = model.predict_proba(X)
        probs = np.array(raw)

    elif hasattr(model, "decision_function"):
        raw = model.decision_function(X)
        raw = np.array(raw)

        if raw.ndim == 1:
            raw = raw.reshape(-1, 1)

        e_x = np.exp(raw - raw.max(axis=1, keepdims=True))
        probs = e_x / e_x.sum(axis=1, keepdims=True)

    else:
        classes_unique = np.array(sorted(np.unique(hard_preds)))
        n_classes = max(classes_unique) + 1
        probs = np.zeros((len(hard_preds), n_classes), dtype=float)
        for i, c in enumerate(hard_preds):
            probs[i, int(c)] = 1.0

    n_samples = probs.shape[0]

    if probs.shape[1] != 3:
        aligned = np.zeros((n_samples, 3), dtype=float)
        if hasattr(model, "classes_"):
            for class_idx, actual_label in enumerate(model.classes_):
                if actual_label in [0, 1, 2] and class_idx < probs.shape[1]:
                    aligned[:, int(actual_label)] = probs[:, class_idx]
        else:
            for i, c in enumerate(hard_preds):
                aligned[i, int(c)] = probs[:, 0][i] if probs.shape[1] > 0 else 1.0

        probs = aligned

    confidence = probs.max(axis=1)
    return probs, confidence

# -------------------------------------------------
# Map numeric score → segment (Module 2 only)
# -------------------------------------------------
def score_to_segment(s: float) -> str:
    if s < 25:
        return "COLD"
    elif s < 50:
        return "WARM"
    elif s < 75:
        return "HOT"
    else:
        return "BLAZING"

# -------------------------------------------------
# Main
# -------------------------------------------------
def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    model = load_model(MODEL_PATH)

    raw_df = pd.read_csv(INPUT_CSV)
    out_df = raw_df.copy()

    X = prep_features(raw_df)

    hard_preds = model.predict(X)
    hard_preds = np.array(hard_preds).astype(int).reshape(-1)

    probs, confidence = get_probs(model, X, hard_preds)

    p_low = probs[:, 0]
    p_medium = probs[:, 1]
    p_high = probs[:, 2]

    pred_labels = [CLASS_MAP.get(int(c), "UNKNOWN") for c in hard_preds]

    if DO_INTENT:
        numeric_tier = (0 * p_low) + (1 * p_medium) + (2 * p_high)
        intent_score = (numeric_tier / 2.0) * 100.0
        intent_score = np.round(intent_score, 1)
        intent_segment = np.array([score_to_segment(s) for s in intent_score])
    else:
        intent_score = None
        intent_segment = None

    out_df["predicted_class"] = hard_preds
    out_df["predicted_label"] = pred_labels
    out_df["confidence"] = confidence
    out_df["p_low"] = p_low
    out_df["p_medium"] = p_medium
    out_df["p_high"] = p_high
    if DO_INTENT:
        out_df["intent_score"] = intent_score
        out_df["intent_segment"] = intent_segment

    print("\n=== PREDICTIONS ===")
    cols = ["predicted_class", "predicted_label", "confidence", "p_low", "p_medium", "p_high"]
    if DO_INTENT:
        cols.insert(2, "intent_score")
        cols.insert(3, "intent_segment")
    print(out_df[cols])

    out_df.to_csv(OUTPUT_CSV, index=False)
    print(f"\nSaved scored output to: {OUTPUT_CSV}\n")

if __name__ == "__main__":
    main()
