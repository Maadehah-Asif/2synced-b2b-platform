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


def _naive_forecast(values: np.ndarray, horizon: int) -> np.ndarray:
    last = float(values[-1]) if values.size else 0.0
    return np.full(horizon, last, dtype=float)


def _moving_average_forecast(values: np.ndarray, horizon: int, window: int = 3) -> np.ndarray:
    working = list(float(v) for v in values.tolist())
    output = []
    for _ in range(horizon):
        recent = working[-window:] if len(working) >= window else working
        avg = float(np.mean(recent)) if recent else 0.0
        output.append(avg)
        working.append(avg)
    return np.asarray(output, dtype=float)


def _exp_smoothing_forecast(values: np.ndarray, horizon: int, alpha: float = 0.45) -> np.ndarray:
    if values.size == 0:
        return np.zeros(horizon, dtype=float)
    level = float(values[0])
    for current in values[1:]:
        level = alpha * float(current) + (1.0 - alpha) * level
    return np.full(horizon, level, dtype=float)


def _linear_regression_forecast(values: np.ndarray, horizon: int) -> tuple[np.ndarray, float]:
    t = np.arange(len(values), dtype=float).reshape(-1, 1)
    model = LinearRegression()
    model.fit(t, values.astype(float))
    future_t = np.arange(len(values), len(values) + horizon, dtype=float).reshape(-1, 1)
    prediction = model.predict(future_t)
    slope = float(model.coef_[0]) if model.coef_.size > 0 else 0.0
    return np.asarray(prediction, dtype=float), slope


def _safe_cv(values: np.ndarray) -> Optional[float]:
    if values.size == 0:
        return None
    mean = float(np.mean(values))
    if abs(mean) < 1e-9:
        return None
    return float(np.std(values) / abs(mean))


def _linear_r2(values: np.ndarray) -> Optional[float]:
    if values.size < 2:
        return None
    t = np.arange(len(values), dtype=float).reshape(-1, 1)
    model = LinearRegression()
    model.fit(t, values.astype(float))
    prediction = model.predict(t)
    total_var = float(np.sum((values - np.mean(values)) ** 2))
    if total_var <= 1e-9:
        return 1.0
    residual_var = float(np.sum((values - prediction) ** 2))
    return float(1.0 - (residual_var / total_var))


def _normalize_roi_series(values: pd.Series) -> pd.Series:
    numeric = pd.to_numeric(values, errors="coerce")
    finite = numeric[np.isfinite(numeric)]
    if finite.empty:
        return numeric.fillna(0.0)

    # The synthetic dataset stores ROI as a return ratio (for example 1.95),
    # while the forecast page presents ROI as a percentage.
    # Convert ratio-style values to percentage points once so the UI and
    # backend use the same unit.
    if float(finite.abs().quantile(0.9)) < 25.0:
        numeric = numeric * 100.0
    return numeric.fillna(float(finite.median()))


def _compute_forecast(values: np.ndarray, horizon: int, method: str) -> tuple[np.ndarray, float]:
    normalized = (method or "linear_regression").strip().lower()
    if normalized == "naive":
        return _naive_forecast(values, horizon), 0.0
    if normalized == "moving_average":
        forecast = _moving_average_forecast(values, horizon)
        slope = float(forecast[0] - values[-1]) if values.size and forecast.size else 0.0
        return forecast, slope
    if normalized == "exponential_smoothing":
        forecast = _exp_smoothing_forecast(values, horizon)
        slope = float(forecast[0] - values[-1]) if values.size and forecast.size else 0.0
        return forecast, slope
    forecast, slope = _linear_regression_forecast(values, horizon)
    return forecast, slope


def _auto_select_method(values: np.ndarray) -> tuple[str, str]:
    point_count = int(values.size)
    if point_count < 5:
        base_method = "naive"
    elif point_count < 9:
        base_method = "moving_average"
    elif point_count < 16:
        base_method = "exponential_smoothing"
    else:
        base_method = "linear_regression"

    if point_count >= 3:
        last_three = values[-3:]
        last_three_cv = _safe_cv(last_three)
        if last_three_cv is not None and last_three_cv < 0.05:
            return "naive", "flat recent history"

    if point_count >= 4:
        prior = values[:-1]
        prior_std = float(np.std(prior))
        prior_mean = float(np.mean(prior))
        if prior_std > 1e-9 and abs(float(values[-1]) - prior_mean) > (2.0 * prior_std):
            return "moving_average", "latest point behaves like an outlier"

    overall_cv = _safe_cv(values)
    if overall_cv is not None and overall_cv > 0.4:
        return "exponential_smoothing", "overall history is volatile"

    if base_method == "linear_regression":
        r2 = _linear_r2(values)
        if r2 is not None and r2 < 0.4:
            return "exponential_smoothing", "trend fit is weak"

    return base_method, "history length threshold"


def run_forecast(campaign_id: Optional[int], forecast_window: str, spend_multiplier: float, channel: Optional[str] = None, method: str = "auto") -> Dict[str, Any]:
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
            safe_spend = monthly["spend"].where(monthly["spend"] > 0, np.nan)
            monthly["roi"] = (((monthly["revenue"] - monthly["spend"]) / safe_spend) * 100.0).fillna(0.0)
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
    df["roi_clean"] = _normalize_roi_series(df["roi"])

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
    roi_values = df["roi_clean"].values.astype(float)
    selected_method, auto_reason = _auto_select_method(roi_values) if method in ("", "auto") else (method, "manual override")
    trend_future, slope = _compute_forecast(roi_values, horizon, selected_method)
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
    method_label = selected_method.replace("_", " ")
    explanation = (
        f"Forecast for {scope} over {horizon} month(s) using {method_label}. "
        f"Selection reason: {auto_reason}. "
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
        "forecast_method": selected_method,
        "selection_reason": auto_reason,
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
    parser.add_argument(
        "--method",
        type=str,
        required=False,
        default="auto",
        help="Forecast method: naive, moving_average, exponential_smoothing, linear_regression",
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

    result = run_forecast(campaign_id, args.window, args.multiplier, channel, args.method)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    _main()
