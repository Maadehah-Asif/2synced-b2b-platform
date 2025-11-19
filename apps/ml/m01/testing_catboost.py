import os
import joblib
import pandas as pd
import numpy as np

# -------------------------------------------------
# CONFIG (edit these before running)
# -------------------------------------------------
BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
DATA_DIR   = os.path.join(BASE_DIR, "data")
MODEL_DIR  = os.path.join(BASE_DIR, "models")

# pick which trained model you want to score with:
# default to RandomForest saved under models/m01/randomforest.pkl
MODEL_PATH = os.path.join(MODEL_DIR, "m01", "randomforest.pkl")
# To use CatBoost again, switch to:
# MODEL_PATH = os.path.join(MODEL_DIR, "m01", "catboost.pkl")
# Other examples:
# MODEL_PATH = os.path.join(MODEL_DIR, "logisticregression.pkl")
# MODEL_PATH = os.path.join(MODEL_DIR, "svm_linear.pkl")
# MODEL_PATH = os.path.join(MODEL_DIR, "deeplearnnetwork.pkl")
# etc. just change this path when you test another .pkl

# I/O: use structured folders
INPUT_DIR  = os.path.join(DATA_DIR, "input")
OUTPUT_DIR = os.path.join(DATA_DIR, "output")
INPUT_CSV  = os.path.join(INPUT_DIR, "sample_input.csv")
OUTPUT_CSV = os.path.join(OUTPUT_DIR, "output.csv")

CLASS_MAP = {
    0: "LOW",
    1: "MEDIUM",
    2: "HIGH",
}

# -------------------------------------------------
# Helper: prepare features for inference
# -------------------------------------------------
def prep_features(df_in: pd.DataFrame) -> pd.DataFrame:
    """
    Light cleanup:
    - Do NOT drop any columns here because we assume sample_input.csv
      was already aligned with the model's training features.
    - Just fill NAs so inference never crashes.
    """
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
# Helper: load model or wrapped pipeline
# -------------------------------------------------
def load_model(path: str):
    """
    Sometimes we save raw sklearn/CatBoost model directly.
    Sometimes we save dicts like {"model": pipeline, ...}.
    This returns the actual thing with .predict().
    """
    obj = joblib.load(path)
    if isinstance(obj, dict) and "model" in obj:
        return obj["model"]
    return obj

# -------------------------------------------------
# Helper: safe probability extraction
# -------------------------------------------------
def get_probs(model, X: pd.DataFrame, hard_preds: np.ndarray):
    """
    Returns:
    - probs matrix shape [n,3] if we can
    - confidence vector shape [n]
    If model doesn't support predict_proba, will try decision_function,
    else fallback to 1.0 confidence on the predicted class.
    """

    # case 1: native predict_proba
    if hasattr(model, "predict_proba"):
        raw = model.predict_proba(X)

        # many sklearn models return shape [n_classes], CatBoost returns [n,3]
        # If binary this would be [n,2]; we assume 3-class so should be [n,3].
        probs = np.array(raw)

    # case 2: decision_function (SVM without prob=True, etc.)
    elif hasattr(model, "decision_function"):
        raw = model.decision_function(X)
        raw = np.array(raw)

        # If shape is [n_classes], we softmax it ourselves
        if raw.ndim == 1:
            raw = raw.reshape(-1, 1)

        # softmax
        e_x = np.exp(raw - raw.max(axis=1, keepdims=True))
        probs = e_x / e_x.sum(axis=1, keepdims=True)

    # fallback: no score info at all
    else:
        # Build dummy probs: 1.0 on predicted class, 0 elsewhere
        classes_unique = np.array(sorted(np.unique(hard_preds)))
        n_classes = max(classes_unique) + 1  # assume classes are 0,1,2
        probs = np.zeros((len(hard_preds), n_classes), dtype=float)
        for i, c in enumerate(hard_preds):
            probs[i, int(c)] = 1.0

    # ensure we always have columns 0,1,2 in order
    # if model ended up giving (n,2) or weird order, we need to align.
    # We assume the class labels are [0,1,2]; let's try to detect that.

    n_samples = probs.shape[0]

    # If probs not 3-wide, try to expand/reindex
    if probs.shape[1] != 3:
        # build all-zero 3-col
        aligned = np.zeros((n_samples, 3), dtype=float)

        # try to infer class order from model.classes_ if present
        if hasattr(model, "classes_"):
            # model.classes_ is like array([0,1,2])
            for class_idx, actual_label in enumerate(model.classes_):
                if actual_label in [0,1,2] and class_idx < probs.shape[1]:
                    aligned[:, int(actual_label)] = probs[:, class_idx]
        else:
            # fallback: just put everything in the predicted bucket
            for i, c in enumerate(hard_preds):
                aligned[i, int(c)] = 1.0

        probs = aligned

    # confidence = max prob per row
    confidence = probs.max(axis=1)

    return probs, confidence

# -------------------------------------------------
# Main
# -------------------------------------------------
def main():
    # ensure output folder exists
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    # 1. load model
    model = load_model(MODEL_PATH)

    # 2. read input rows to score
    raw_df = pd.read_csv(INPUT_CSV)

    # keep original columns for output
    out_df = raw_df.copy()

    # 3. prepare features for inference
    X = prep_features(raw_df)

    # 4. hard predictions
    hard_preds = model.predict(X)
    hard_preds = np.array(hard_preds).astype(int).reshape(-1)

    # 5. probabilities / confidence
    probs, confidence = get_probs(model, X, hard_preds)

    p_low    = probs[:, 0]
    p_medium = probs[:, 1]
    p_high   = probs[:, 2]

    # map numeric class -> label text
    pred_labels = [CLASS_MAP.get(int(c), "UNKNOWN") for c in hard_preds]

    # 6. attach predictions to output
    out_df["predicted_class"] = hard_preds
    out_df["predicted_label"] = pred_labels
    out_df["confidence"] = confidence
    out_df["p_low"] = p_low
    out_df["p_medium"] = p_medium
    out_df["p_high"] = p_high

    # 7. print and save
    print("\n=== PREDICTIONS ===")
    print(
        out_df[
            ["predicted_class", "predicted_label", "confidence", "p_low", "p_medium", "p_high"]
        ]
    )

    out_df.to_csv(OUTPUT_CSV, index=False)
    print(f"\nSaved scored output to: {OUTPUT_CSV}\n")

if __name__ == "__main__":
    main()
