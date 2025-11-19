import argparse
import os
import joblib
import pandas as pd
import numpy as np

# Helper: prepare features for inference (mirrors testing_catboost.py behavior)
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

# We expect a sklearn pipeline with predict_proba

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--input', required=True, help='Input CSV path without lead_id')
    ap.add_argument('--output', required=True, help='Output CSV path')
    ap.add_argument('--model', required=True, help='Path to randomforest.pkl')
    args = ap.parse_args()

    model_obj = joblib.load(args.model)
    model = model_obj['model'] if isinstance(model_obj, dict) and 'model' in model_obj else model_obj

    raw_df = pd.read_csv(args.input)
    X = prep_features(raw_df)

    # Predict hard labels
    hard_preds = model.predict(X)
    hard_preds = np.array(hard_preds).astype(int).reshape(-1)

    # Predict probabilities if available
    if hasattr(model, 'predict_proba'):
        probs = model.predict_proba(X)
        probs = np.array(probs)
        # Ensure 3 columns for LOW/MEDIUM/HIGH
        if probs.shape[1] == 2:
            # If binary, pad a third class with zeros (unlikely here)
            probs = np.hstack([probs, np.zeros((probs.shape[0], 1))])
    else:
        # Fallback: one-hot of hard preds
        classes = np.array(sorted(np.unique(hard_preds)))
        n_classes = max(classes) + 1
        probs = np.zeros((len(hard_preds), n_classes), dtype=float)
        for i, c in enumerate(hard_preds):
            probs[i, int(c)] = 1.0
        if probs.shape[1] < 3:
            probs = np.hstack([probs, np.zeros((probs.shape[0], 3 - probs.shape[1]))])

    # Align to 3 classes columns
    n = probs.shape[0]
    if probs.shape[1] != 3:
        aligned = np.zeros((n, 3), dtype=float)
        if hasattr(model, 'classes_'):
            for class_idx, actual_label in enumerate(getattr(model, 'classes_', [])):
                if class_idx < probs.shape[1] and actual_label in [0,1,2]:
                    aligned[:, int(actual_label)] = probs[:, class_idx]
        else:
            for i, c in enumerate(hard_preds):
                aligned[i, int(c)] = 1.0
        probs = aligned

    p_low = probs[:, 0]
    p_medium = probs[:, 1]
    p_high = probs[:, 2]
    CLASS_MAP = {0: 'LOW', 1: 'MEDIUM', 2: 'HIGH'}
    pred_labels = [CLASS_MAP.get(int(c), 'UNKNOWN') for c in hard_preds]
    confidence = probs.max(axis=1)

    out_df = raw_df.copy()
    out_df['predicted_class'] = hard_preds
    out_df['predicted_label'] = pred_labels
    out_df['confidence'] = confidence
    out_df['p_low'] = p_low
    out_df['p_medium'] = p_medium
    out_df['p_high'] = p_high

    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    out_df.to_csv(args.output, index=False)

if __name__ == '__main__':
    main()
