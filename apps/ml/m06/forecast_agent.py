import argparse
import json
import os
from typing import Any, Dict, Optional

import numpy as np
import pandas as pd
from pandas.tseries.offsets import MonthBegin
from sklearn.linear_model import LinearRegression

CSV_NAME = "full_marketing_forecast_dataset.csv"


def _load_dataset() -> pd.DataFrame:
    here = os.path.dirname(os.path.abspath(__file__))
    repo_root = os.path.dirname(os.path.dirname(here))
    csv_path = os.path.join(repo_root, "api", "src", "modules", "m06", "data", CSV_NAME)
    df = pd.read_csv(csv_path)

    # Basic cleaning and type coercion
    if "month" in df.columns:
        df["month"] = pd.to_datetime(df["month"], errors="coerce")
        df = df.dropna(subset=["month"])

    # Ensure numeric ROI
    for col in [
        "campaign_id",
        "spend",
        "revenue",
        "roi",
    ]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    df = df.dropna(subset=["campaign_id", "roi"])
    return df


def _parse_window(window: str) -> int:
    w = (window or "").lower().strip()
    mapping = {
        "1m": 1,
        "1": 1,
        "1month": 1,
        "1_month": 1,
        "3m": 3,
        "3": 3,
        "3month": 3,
        "3_month": 3,
        "6m": 6,
        "6": 6,
        "6month": 6,
        "6_month": 6,
    }
    return mapping.get(w, 3)


def run_forecast(campaign_id: Optional[int], forecast_window: str, spend_multiplier: float, channel: Optional[str] = None) -> Dict[str, Any]:
    """Run ROI forecast for a single campaign or channel.

    Returns:
      {
        "history": [...],
        "forecast": [...],
        "baseline_roi": float,
        "scenario_roi": float,
        "confidence_low": float,
        "confidence_high": float,
        "trend": "upward|downward|flat",
        "volatility": float,
        "seasonality": float,
        "explanation": str
      }
    """

    df = _load_dataset()

    # If channel provided, aggregate by channel across campaigns; otherwise filter by campaign_id
    if channel:
        ch = str(channel).strip().lower()
        df = df[df["channel"].str.lower() == ch].copy()
        if df.empty:
            return {
                "history": [],
                "forecast": [],
                "baseline_roi": 0.0,
                "scenario_roi": 0.0,
                "confidence_low": 0.0,
                "confidence_high": 0.0,
                "trend": "flat",
                "volatility": 0.0,
                "seasonality": 0.0,
                "explanation": f"No history found for channel='{channel}'.",
            }
        # Build monthly ROI using spend-weighted approach
        if "spend" in df.columns and "revenue" in df.columns:
            monthly = df.groupby("month").agg({"spend": "sum", "revenue": "sum"}).reset_index()
            monthly["roi"] = (monthly["revenue"].where(monthly["spend"] > 0, 0) / monthly["spend"].where(monthly["spend"] > 0, 1)) * 100.0
            df = monthly
        else:
            # Fallback: average ROI per month if spend/revenue not present
            df = df.groupby("month").agg({"roi": "mean"}).reset_index()
    else:
        df = df[df["campaign_id"] == campaign_id].copy()

    if df.empty:
        return {
            "history": [],
            "forecast": [],
            "baseline_roi": 0.0,
            "scenario_roi": 0.0,
            "confidence_low": 0.0,
            "confidence_high": 0.0,
            "trend": "flat",
            "volatility": 0.0,
            "seasonality": 0.0,
            "explanation": f"No history found for campaign_id={campaign_id}.",
        }

    df = df.sort_values("month").reset_index(drop=True)
    df["roi_clean"] = df["roi"].fillna(df["roi"].median())

    # Time index for trend model
    df["t"] = np.arange(len(df))
    X = df[["t"]].values.astype(float)
    y = df["roi_clean"].values.astype(float)

    # Simple linear regression trend
    model = LinearRegression()
    model.fit(X, y)
    trend_pred = model.predict(X)
    slope = float(model.coef_[0]) if model.coef_.size > 0 else 0.0

    # Moving averages
    df["ma3"] = df["roi_clean"].rolling(window=3, min_periods=1).mean()
    df["ma6"] = df["roi_clean"].rolling(window=6, min_periods=1).mean()

    # Volatility (std dev of ROI)
    volatility = float(np.nanstd(df["roi_clean"].values))

    # Seasonality by calendar month
    df["month_num"] = df["month"].dt.month
    seasonality_table = df.groupby("month_num")["roi_clean"].mean()
    overall_mean = float(df["roi_clean"].mean()) if len(df) > 0 else 0.0
    if len(seasonality_table) > 0 and overall_mean != 0.0:
        seasonality_strength = float(
            (seasonality_table - overall_mean).abs().max() / (abs(overall_mean) + 1e-6)
        )
    else:
        seasonality_strength = 0.0

    # Determine forecast horizon
    horizon = _parse_window(forecast_window)

    last_month = df["month"].max()
    if pd.isna(last_month):
        last_month = pd.Timestamp.utcnow().normalize()

    future_index = pd.date_range(last_month + MonthBegin(1), periods=horizon, freq="MS")
    future_t = np.arange(len(df), len(df) + horizon).reshape(-1, 1)

    trend_future = model.predict(future_t)
    adj_future = []
    for i, dt in enumerate(future_index):
        mnum = int(dt.month)
        seasonal_mean = float(seasonality_table.get(mnum, overall_mean))
        adj = trend_future[i] + (seasonal_mean - overall_mean)
        adj_future.append(float(adj))

    baseline_array = np.array(adj_future, dtype=float)
    baseline_roi = float(baseline_array.mean()) if baseline_array.size > 0 else 0.0

    spend_multiplier = float(spend_multiplier) if spend_multiplier is not None else 1.0
    if spend_multiplier <= 0:
        spend_multiplier = 1.0

    # Simple scenario: scale ROI linearly by multiplier
    scenario_array = baseline_array * spend_multiplier
    scenario_roi = float(scenario_array.mean()) if scenario_array.size > 0 else 0.0

    # Confidence interval based on historical volatility
    z = 1.64  # ~90% CI
    confidence_low = float(baseline_roi - z * volatility)
    confidence_high = float(baseline_roi + z * volatility)

    # Trend direction based on slope
    if slope > 0.1:
        trend = "upward"
    elif slope < -0.1:
        trend = "downward"
    else:
        trend = "flat"

    history = [
        {
            "month": d["month"].strftime("%Y-%m"),
            "roi": float(d["roi_clean"]),
            "ma3": float(d["ma3"]),
            "ma6": float(d["ma6"]),
        }
        for _, d in df.iterrows()
    ]

    forecast = []
    for i, dt in enumerate(future_index):
        month_label = dt.strftime("%Y-%m")
        baseline_val = float(baseline_array[i])
        scenario_val = float(scenario_array[i])
        forecast.append(
            {
                "month": month_label,
                "baseline_roi": baseline_val,
                "scenario_roi": scenario_val,
                "confidence_low": float(confidence_low),
                "confidence_high": float(confidence_high),
            }
        )

    if channel:
        scope = f"channel '{channel}'"
    else:
        scope = f"campaign {campaign_id}"
    explanation = (
        f"Forecast for {scope} over {horizon} month(s). "
        f"Historical ROI trend slope: {slope:.3f}; volatility: {volatility:.2f}. "
        f"Seasonality strength (0=none, higher=stronger): {seasonality_strength:.2f}. "
        f"Scenario scales baseline ROI by spend multiplier {spend_multiplier:.2f}."
    )

    return {
        "history": history,
        "forecast": forecast,
        "baseline_roi": baseline_roi,
        "scenario_roi": scenario_roi,
        "confidence_low": confidence_low,
        "confidence_high": confidence_high,
        "trend": trend,
        "volatility": float(volatility),
        "seasonality": float(seasonality_strength),
        "explanation": explanation,
    }


def _main() -> None:
    parser = argparse.ArgumentParser(description="Module 6 marketing ROI forecasting agent")
    parser.add_argument("--campaign", type=int, required=False, help="Campaign ID")
    parser.add_argument("--channel", type=str, required=False, help="Channel key (e.g. email, ads, linkedin, webinar)")
    parser.add_argument("--window", type=str, required=True, help="Forecast window, e.g. 1m, 3m, 6m")
    parser.add_argument(
        "--multiplier",
        type=float,
        required=False,
        default=1.0,
        help="Spend multiplier scenario (e.g. 1.2 for +20%)",
    )

    args = parser.parse_args()

    # Prefer channel if provided; fallback to campaign id
    campaign_id = args.campaign if args.campaign is not None else None
    channel = args.channel if args.channel else None

    if not campaign_id and not channel:
        print(json.dumps({
            "history": [], "forecast": [],
            "baseline_roi": 0.0, "scenario_roi": 0.0,
            "confidence_low": 0.0, "confidence_high": 0.0,
            "trend": "flat", "volatility": 0.0, "seasonality": 0.0,
            "explanation": "No campaign or channel specified"
        }))
        return

    result = run_forecast(campaign_id, args.window, args.multiplier, channel)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    _main()
