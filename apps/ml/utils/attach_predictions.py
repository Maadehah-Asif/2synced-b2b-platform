import argparse
import os
import sys
import pandas as pd

PRED_COL_CANDIDATES = [
    # Standard set our RF inference writes
    "predicted_class",
    "predicted_label",
    "confidence",
    "p_low",
    "p_medium",
    "p_high",
]


def main():
    parser = argparse.ArgumentParser(description="Attach model predictions to merged CSV using lead_id from with-id input.")
    parser.add_argument("--merged", required=True, help="Path to original merged CSV")
    parser.add_argument("--withid", required=True, help="Path to model input WITH lead_id (row-aligned to predictions)")
    parser.add_argument("--predictions", required=True, help="Path to predictions CSV (row-aligned to no-id input)")
    parser.add_argument("--output", required=True, help="Path to write merged-with-predictions CSV")

    args = parser.parse_args()

    merged_path = os.path.abspath(args.merged)
    withid_path = os.path.abspath(args.withid)
    preds_path = os.path.abspath(args.predictions)
    out_path = os.path.abspath(args.output)

    for p in [merged_path, withid_path, preds_path]:
        if not os.path.exists(p):
            print(f"ERROR: File not found: {p}")
            sys.exit(1)

    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    base_df = pd.read_csv(merged_path)
    with_id_df = pd.read_csv(withid_path)
    preds_df = pd.read_csv(preds_path)

    # Sanity: with-id and preds must have same length (row alignment)
    if len(with_id_df) != len(preds_df):
        raise ValueError(
            f"Row count mismatch: with-id={len(with_id_df)} vs predictions={len(preds_df)}. Ensure you used the paired inputs."
        )

    if "lead_id" not in with_id_df.columns:
        raise ValueError("with-id input must contain lead_id column")

    # Keep only known/available prediction columns
    pred_cols = [c for c in PRED_COL_CANDIDATES if c in preds_df.columns]
    if not pred_cols:
        # If empty, attach everything from preds_df
        pred_cols = preds_df.columns.tolist()

    attach_df = pd.DataFrame({"lead_id": with_id_df["lead_id"]})
    for c in pred_cols:
        attach_df[c] = preds_df[c]

    # Merge back to base merged CSV by lead_id
    out = base_df.merge(attach_df, on="lead_id", how="left")

    out.to_csv(out_path, index=False)
    print(f"✅ Wrote: {out_path}  (rows, cols)={out.shape}")
    print("Attached columns:", [c for c in pred_cols])


if __name__ == "__main__":
    main()
