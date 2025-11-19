import argparse
import os
import sys
from typing import List, Dict

import pandas as pd

# Single explicit alias per your request
ALIASES: Dict[str, str] = {
    "last_action_type": "last_action_taken",
}

# Known categorical columns for default fill
CATEGORICAL_COLS = {"last_action_type"}


def normalize_action_series(s: pd.Series) -> pd.Series:
    s = s.astype(str).str.strip()
    return s.replace({"nan": "unknown", "NaT": "unknown", "": "unknown"}).fillna("unknown")


def read_template_header(template_csv: str) -> List[str]:
    # Use pandas to read only the header
    cols = pd.read_csv(template_csv, nrows=0).columns.tolist()
    if not cols:
        raise ValueError(f"Template has no columns: {template_csv}")
    return cols


def ensure_last_action_type(df: pd.DataFrame) -> pd.DataFrame:
    if "last_action_type" in df.columns:
        df["last_action_type"] = normalize_action_series(df["last_action_type"])  # type: ignore[index]
        return df
    alias = ALIASES.get("last_action_type")
    if alias and alias in df.columns:
        df["last_action_type"] = normalize_action_series(df[alias])  # type: ignore[index]
    else:
        df["last_action_type"] = "unknown"
    return df


def build_model_input(merged: pd.DataFrame, template_cols: List[str]) -> pd.DataFrame:
    # First, make sure alias-mapped column exists
    merged = ensure_last_action_type(merged)

    out = pd.DataFrame(index=merged.index)

    for col in template_cols:
        # Exact match first
        if col in merged.columns:
            out[col] = merged[col]
            continue

        # Alias mapping
        alias = ALIASES.get(col)
        if alias and alias in merged.columns:
            if col == "last_action_type":
                out[col] = normalize_action_series(merged[alias])  # type: ignore[index]
            else:
                out[col] = merged[alias]
            continue

        # Fallback default
        if col in CATEGORICAL_COLS:
            out[col] = "unknown"
        else:
            # Numeric-safe default; user can adjust if needed
            out[col] = 0

    # Reorder exactly as template
    out = out[template_cols]

    return out


def main():
    parser = argparse.ArgumentParser(description="Prepare model-ready input from a merged CSV using a template header.")
    parser.add_argument("--merged", required=True, help="Path to merged CSV (source)")
    parser.add_argument("--template", required=True, help="Path to template CSV whose header defines required columns")
    parser.add_argument("--output", required=True, help="Where to write the model-ready CSV")

    args = parser.parse_args()

    merged_path = os.path.abspath(args.merged)
    template_path = os.path.abspath(args.template)
    output_path = os.path.abspath(args.output)

    if not os.path.exists(merged_path):
        print(f"ERROR: merged CSV not found: {merged_path}")
        sys.exit(1)
    if not os.path.exists(template_path):
        print(f"ERROR: template CSV not found: {template_path}")
        sys.exit(1)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    merged_df = pd.read_csv(merged_path)
    template_cols = read_template_header(template_path)

    model_input = build_model_input(merged_df, template_cols)

    model_input.to_csv(output_path, index=False)

    print(f"✅ Wrote: {output_path}")
    print("Rows, Cols:", model_input.shape)
    print("First 5 columns:", model_input.columns[:5].tolist())


if __name__ == "__main__":
    main()
