from __future__ import annotations

import argparse
import calendar
from dataclasses import dataclass
from datetime import date
from pathlib import Path

import pandas as pd


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_TARGET_MONTH = pd.Timestamp(date.today().year, date.today().month, 1)


@dataclass(frozen=True)
class DatasetConfig:
    label: str
    path: Path
    column: str
    fmt: str


DATASETS = [
    DatasetConfig(
        label="m01 lead quality",
        path=REPO_ROOT / "apps" / "api" / "src" / "modules" / "m01" / "data" / "lead_quality_forecast_dataset.csv",
        column="month",
        fmt="%Y-%m",
    ),
    DatasetConfig(
        label="m02 intent",
        path=REPO_ROOT / "apps" / "api" / "src" / "modules" / "m02" / "data" / "intent_forecast_dataset.csv",
        column="month",
        fmt="%Y-%m",
    ),
    DatasetConfig(
        label="m06 roi",
        path=REPO_ROOT / "apps" / "api" / "src" / "modules" / "m06" / "data" / "full_marketing_forecast_dataset.csv",
        column="month",
        fmt="%Y-%m-%d",
    ),
    DatasetConfig(
        label="m07 funnel",
        path=REPO_ROOT / "apps" / "api" / "src" / "modules" / "m07" / "data" / "funnel_forecast_dataset.csv",
        column="month",
        fmt="%Y-%m",
    ),
]


def month_delta(later: pd.Timestamp, earlier: pd.Timestamp) -> int:
    return (later.year - earlier.year) * 12 + (later.month - earlier.month)


def add_months(ts: pd.Timestamp, months: int) -> pd.Timestamp:
    year = ts.year + ((ts.month - 1 + months) // 12)
    month = ((ts.month - 1 + months) % 12) + 1
    day = min(ts.day, calendar.monthrange(year, month)[1])
    return pd.Timestamp(year=year, month=month, day=day)


def shift_dataset(config: DatasetConfig, target_month: pd.Timestamp) -> tuple[str, str, str, int]:
    df = pd.read_csv(config.path)
    if config.column not in df.columns:
        raise ValueError(f"{config.label}: missing column {config.column}")

    original_dates = pd.to_datetime(df[config.column], errors="raise")
    original_max = pd.Timestamp(original_dates.max()).normalize()
    offset = month_delta(target_month, original_max)

    shifted_dates = original_dates.map(lambda value: add_months(pd.Timestamp(value), offset))
    df[config.column] = shifted_dates.dt.strftime(config.fmt)
    df.to_csv(config.path, index=False)

    new_min = shifted_dates.min().strftime(config.fmt)
    new_max = shifted_dates.max().strftime(config.fmt)
    return config.label, new_min, new_max, offset


def main() -> None:
    parser = argparse.ArgumentParser(description="Shift forecast dataset month ranges forward.")
    parser.add_argument(
        "--target-month",
        default=DEFAULT_TARGET_MONTH.strftime("%Y-%m"),
        help="Target latest historical month in YYYY-MM format.",
    )
    parser.add_argument(
        "--datasets",
        nargs="*",
        default=[config.label for config in DATASETS],
        help="Optional dataset labels to update.",
    )
    args = parser.parse_args()

    try:
        target_month = pd.Timestamp(f"{args.target_month}-01")
    except Exception as exc:
        raise SystemExit(f"Invalid --target-month value: {args.target_month}") from exc

    selected = [config for config in DATASETS if config.label in set(args.datasets)]
    if not selected:
        raise SystemExit("No matching dataset labels selected.")

    print(f"Target latest historical month: {target_month.strftime('%Y-%m')}")
    for config in selected:
        label, new_min, new_max, offset = shift_dataset(config, target_month)
        print(f"{label}: shifted by {offset} month(s) -> {new_min} .. {new_max}")


if __name__ == "__main__":
    main()
