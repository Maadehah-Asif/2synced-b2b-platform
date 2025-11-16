import argparse
import os
import sys
from typing import List

import pandas as pd

# Columns come from the sample template header; last_action_type is categorical, sourced from last_action_taken
CATEGORICAL = {"last_action_type"}


def read_template_columns(path: str) -> List[str]:
    cols = pd.read_csv(path, nrows=0).columns.tolist()
    if not cols:
        raise ValueError(f"Template CSV has no columns: {path}")
    return cols


def ensure_lead_id(df: pd.DataFrame) -> pd.DataFrame:
    if "lead_id" in df.columns:
        return df
    if "id" in df.columns:
        df = df.copy()
        df["lead_id"] = df["id"]
        return df
    raise ValueError("Merged CSV must contain lead_id or id column")


def normalize_action_taken_to_type(df: pd.DataFrame) -> pd.DataFrame:
    # Directly use last_action_taken to populate last_action_type per your instruction
    if "last_action_taken" in df.columns:
        s = df["last_action_taken"].astype(str).str.strip()
        s = s.replace({"nan": "unknown", "NaT": "unknown", "": "unknown"}).fillna("unknown")
        df = df.copy()
        df["last_action_type"] = s
    else:
        # If missing, create as unknown so the pipeline doesn't break
        df = df.copy()
        df["last_action_type"] = "unknown"
    return df


def coerce_numeric(series: pd.Series) -> pd.Series:
    return pd.to_numeric(series, errors="coerce").fillna(0)


def build_matrix(merged: pd.DataFrame, template_cols: List[str]) -> pd.DataFrame:
    # First, ensure lead_id and last_action_type
    merged = ensure_lead_id(merged)
    merged = normalize_action_taken_to_type(merged)

    out = pd.DataFrame(index=merged.index)

    for col in template_cols:
        if col == "last_action_type":
            out[col] = merged[col] if col in merged.columns else "unknown"
            # normalize categoricals
            out[col] = out[col].astype(str).str.strip().replace({"nan": "unknown", "NaT": "unknown", "": "unknown"}).fillna("unknown")
            continue

        if col in merged.columns:
            out[col] = coerce_numeric(merged[col])
        else:
            out[col] = 0

    # Ensure exact order from template
    out = out[template_cols]
    return out


def main():
    parser = argparse.ArgumentParser(description="Create two model input CSVs (with and without lead_id) from a merged CSV using a sample template header.")
    parser.add_argument("--merged", required=True, help="Path to merged CSV (source)")
    parser.add_argument("--template", required=True, help="Path to sample template CSV (defines columns and order)")
    parser.add_argument("--outdir", required=True, help="Directory to write outputs")
    parser.add_argument("--withid", default="model_input_with_id.csv", help="Filename for with-id CSV")
    parser.add_argument("--noid", default="model_input.csv", help="Filename for no-id CSV")

    args = parser.parse_args()

    merged_path = os.path.abspath(args.merged)
    template_path = os.path.abspath(args.template)
    outdir = os.path.abspath(args.outdir)

    if not os.path.exists(merged_path):
        print(f"ERROR: merged CSV not found: {merged_path}")
        sys.exit(1)
    if not os.path.exists(template_path):
        print(f"ERROR: template CSV not found: {template_path}")
        sys.exit(1)

    os.makedirs(outdir, exist_ok=True)

    merged_df = pd.read_csv(merged_path)
    template_cols = read_template_columns(template_path)

    # Build matrix strictly from template; last_action_type sourced from last_action_taken
    X = build_matrix(merged_df, template_cols)

    # With-id version: prepend lead_id as the first column for alignment/mapping later
    with_id = pd.concat([merged_df[["lead_id"] if "lead_id" in merged_df.columns else []], X], axis=1)
    if "lead_id" not in with_id.columns:
        # ensure we have it (ensure_lead_id already added, so safe to pull from merged_df)
        with_id.insert(0, "lead_id", merged_df["lead_id"])  # type: ignore[index]

    path_with_id = os.path.join(outdir, args.withid)
    path_no_id = os.path.join(outdir, args.noid)

    with_id.to_csv(path_with_id, index=False)
    X.to_csv(path_no_id, index=False)

    print(f"✅ Wrote with-id: {path_with_id}  (rows, cols)={with_id.shape}")
    print(f"✅ Wrote no-id:  {path_no_id}   (rows, cols)={X.shape}")
    print("Template columns count:", len(template_cols))


if __name__ == "__main__":
    main()
