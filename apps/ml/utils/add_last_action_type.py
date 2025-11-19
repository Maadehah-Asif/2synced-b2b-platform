import argparse
import os
import sys
import pandas as pd


ALIASES = [
    # Primary source used in your original pipeline
    "last_action_taken",
    # Reasonable fallbacks if naming varies
    "last_action_type",
    "last_action",
    "latest_action",
    "recent_action_type",
]


def normalize_action_series(s: pd.Series) -> pd.Series:
    """Normalize action text: cast to string, replace NaNs/NaT/empty with 'unknown'."""
    s = s.astype(str)
    s = s.str.strip()
    s = s.replace({"nan": "unknown", "NaT": "unknown", "": "unknown"})
    s = s.fillna("unknown")
    return s


def add_last_action_type(df: pd.DataFrame) -> pd.DataFrame:
    """
    Ensure a column last_action_type exists.
    - Prefer copying from last_action_taken (as per the original Connections aggregation),
      otherwise use the first present alias.
    - Normalize values to avoid NaN/NaT/empty strings.
    """
    source_col = None

    # If it's already there, just normalize and return
    if "last_action_type" in df.columns:
        df["last_action_type"] = normalize_action_series(df["last_action_type"])  # type: ignore[index]
        return df

    # Find the best available alias to copy from (most expected first)
    for cand in ALIASES:
        if cand in df.columns:
            source_col = cand
            break

    if source_col is not None:
        df["last_action_type"] = normalize_action_series(df[source_col])  # type: ignore[index]
    else:
        # No usable source found; create with 'unknown'
        df["last_action_type"] = "unknown"

    return df


def main():
    parser = argparse.ArgumentParser(description="Add/compute last_action_type for a merged CSV.")
    parser.add_argument("--input", required=True, help="Path to input merged CSV")
    parser.add_argument("--output", required=True, help="Path to write updated CSV")

    args = parser.parse_args()

    in_path = os.path.abspath(args.input)
    out_path = os.path.abspath(args.output)

    if not os.path.exists(in_path):
        print(f"ERROR: Input file not found: {in_path}")
        sys.exit(1)

    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    df = pd.read_csv(in_path)

    # Best-effort creation/normalization of last_action_type
    df = add_last_action_type(df)

    df.to_csv(out_path, index=False)

    print(f"✅ Wrote: {out_path}")
    print("Rows, Cols:", df.shape)
    print("Has last_action_type:", "last_action_type" in df.columns)
    if "last_action_type" in df.columns:
        print("Sample values:", df["last_action_type"].dropna().astype(str).head(5).tolist())


if __name__ == "__main__":
    main()
