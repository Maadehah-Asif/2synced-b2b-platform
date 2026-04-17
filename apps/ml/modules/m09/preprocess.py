from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
MODEL_DIR = BASE_DIR.parents[1] / "models" / "m09" / "v1"

FINAL_DATASET_PATH = DATA_DIR / "module9_traning_data_final.csv"
MODEL_PATH = MODEL_DIR / "model.joblib"
METRICS_PATH = MODEL_DIR / "metrics.json"
FEATURE_MANIFEST_PATH = MODEL_DIR / "feature_manifest.json"

NUMERIC_FEATURES = [
    "spend",
    "touches_per_user",
    "campaign_duration_days",
    "fatigue_score",
    "ctr",
    "conversion_rate",
    "mql_rate",
    "sql_rate",
    "impressions_per_spend",
    "clicks_per_spend",
    "engagement_efficiency_score",
    "timing_score",
    "channel_quality_score",
    "segment_quality_score",
]

CATEGORICAL_FEATURES = [
    "channel",
    "campaign_type",
    "launch_weekday",
    "launch_hour_bucket",
    "segment",
]

FEATURE_COLUMNS = [*NUMERIC_FEATURES, *CATEGORICAL_FEATURES]
TARGET_COLUMN = "roi"
ROI_CLIP_MIN = -1.0
ROI_CLIP_MAX = 5.0

EXCLUDED_COLUMNS = [
    "pipeline_revenue",
    "cpl",
    "roi",
    "scenario_band",
    "campaign_id",
    "campaign_name",
    "owner_company",
    "platform",
    "region",
    "period_start",
    "period_end",
]

# These defaults keep the simulator payload simple while still satisfying the
# richer feature contract expected by the trained model.
DEFAULT_PREDICTION_VALUES: dict[str, Any] = {
    "campaign_duration_days": 14.0,
    "fatigue_score": 0.45,
    "ctr": 0.018,
    "conversion_rate": 0.045,
    "mql_rate": 0.62,
    "sql_rate": 0.34,
    "impressions_per_spend": 88.0,
    "clicks_per_spend": 1.45,
    "engagement_efficiency_score": 0.19,
    "timing_score": 1.0,
    "channel_quality_score": 1.0,
    "segment_quality_score": 0.92,
    "campaign_type": "paid_acquisition",
    "segment": "mid_market",
}

CHANNEL_BASELINES: dict[str, dict[str, Any]] = {
    "display": {
        "channel_quality_score": 0.88,
        "ctr": 0.0060,
        "conversion_rate": 0.0168,
        "engagement_efficiency_score": 0.1387,
        "impressions_per_spend": 118.0,
        "clicks_per_spend": 0.71,
        "campaign_type": "paid_acquisition",
    },
    "content_syndication": {
        "channel_quality_score": 0.95,
        "ctr": 0.0113,
        "conversion_rate": 0.0377,
        "engagement_efficiency_score": 0.1808,
        "impressions_per_spend": 96.0,
        "clicks_per_spend": 1.08,
        "campaign_type": "outbound",
    },
    "email": {
        "channel_quality_score": 0.96,
        "ctr": 0.0165,
        "conversion_rate": 0.0320,
        "engagement_efficiency_score": 0.1850,
        "impressions_per_spend": 76.0,
        "clicks_per_spend": 1.25,
        "campaign_type": "nurture",
    },
    "paid_search": {
        "channel_quality_score": 1.03,
        "ctr": 0.0211,
        "conversion_rate": 0.0680,
        "engagement_efficiency_score": 0.1991,
        "impressions_per_spend": 78.0,
        "clicks_per_spend": 1.65,
        "campaign_type": "paid_acquisition",
    },
    "linkedin": {
        "channel_quality_score": 1.08,
        "ctr": 0.0171,
        "conversion_rate": 0.0594,
        "engagement_efficiency_score": 0.2232,
        "impressions_per_spend": 72.0,
        "clicks_per_spend": 1.23,
        "campaign_type": "abm",
    },
    "webinar": {
        "channel_quality_score": 1.18,
        "ctr": 0.0121,
        "conversion_rate": 0.1267,
        "engagement_efficiency_score": 0.2797,
        "impressions_per_spend": 44.0,
        "clicks_per_spend": 0.54,
        "campaign_type": "product_launch",
    },
}

TIMING_BASELINES: dict[tuple[str, str], float] = {
    ("friday", "16:00-18:00"): 0.8372,
    ("friday", "14:00-16:00"): 0.9373,
    ("thursday", "14:00-16:00"): 1.0609,
    ("thursday", "10:00-12:00"): 1.1227,
    ("tuesday", "10:00-12:00"): 1.1772,
}

SEGMENT_BASELINES: dict[str, float] = {
    "smb": 0.84,
    "mid_market": 0.92,
    "enterprise": 1.08,
}


def _normalize_channel(value: Any) -> str | None:
    text = str(value or "").strip().lower()
    return text or None


def _normalize_weekday(value: Any) -> str | None:
    text = str(value or "").strip().lower()
    return text or None


def _normalize_hour_bucket(value: Any) -> str | None:
    text = str(value or "").strip()
    return text or None


def _safe_number(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number


def _derive_fatigue_score(payload: dict[str, Any]) -> float:
    touches = _safe_number(payload.get("touches_per_user"))
    if touches is None:
        return float(DEFAULT_PREDICTION_VALUES["fatigue_score"])
    if touches <= 2:
        return 0.10
    if touches <= 4:
        return 0.25
    if touches <= 6:
        return 0.45
    if touches <= 8:
        return 0.70
    return 0.95


def _derive_timing_score(payload: dict[str, Any]) -> float:
    weekday = _normalize_weekday(payload.get("launch_weekday"))
    hour_bucket = _normalize_hour_bucket(payload.get("launch_hour_bucket"))
    if weekday and hour_bucket:
        score = TIMING_BASELINES.get((weekday, hour_bucket))
        if score is not None:
            return score
    return float(DEFAULT_PREDICTION_VALUES["timing_score"])


def _resolve_channel_defaults(payload: dict[str, Any]) -> dict[str, Any]:
    channel = _normalize_channel(payload.get("channel"))
    if not channel:
        return DEFAULT_PREDICTION_VALUES
    return CHANNEL_BASELINES.get(channel, DEFAULT_PREDICTION_VALUES)


def _derive_segment(payload: dict[str, Any]) -> str:
    channel = _normalize_channel(payload.get("channel"))
    if channel == "webinar":
        return "enterprise"
    if channel == "display":
        return "smb"
    return str(DEFAULT_PREDICTION_VALUES["segment"])


def _derive_segment_quality_score(segment: str) -> float:
    return float(SEGMENT_BASELINES.get(segment, DEFAULT_PREDICTION_VALUES["segment_quality_score"]))


def _derive_ratio_defaults(payload: dict[str, Any]) -> dict[str, Any]:
    channel_defaults = _resolve_channel_defaults(payload)
    segment = _derive_segment(payload)
    return {
        "fatigue_score": _derive_fatigue_score(payload),
        "timing_score": _derive_timing_score(payload),
        "channel_quality_score": float(channel_defaults.get("channel_quality_score", DEFAULT_PREDICTION_VALUES["channel_quality_score"])),
        "ctr": float(channel_defaults.get("ctr", DEFAULT_PREDICTION_VALUES["ctr"])),
        "conversion_rate": float(channel_defaults.get("conversion_rate", DEFAULT_PREDICTION_VALUES["conversion_rate"])),
        "engagement_efficiency_score": float(channel_defaults.get("engagement_efficiency_score", DEFAULT_PREDICTION_VALUES["engagement_efficiency_score"])),
        "impressions_per_spend": float(channel_defaults.get("impressions_per_spend", DEFAULT_PREDICTION_VALUES["impressions_per_spend"])),
        "clicks_per_spend": float(channel_defaults.get("clicks_per_spend", DEFAULT_PREDICTION_VALUES["clicks_per_spend"])),
        "campaign_type": str(channel_defaults.get("campaign_type", DEFAULT_PREDICTION_VALUES["campaign_type"])),
        "segment": segment,
        "segment_quality_score": _derive_segment_quality_score(segment),
    }


def _build_prediction_defaults(payload: dict[str, Any]) -> dict[str, Any]:
    derived = _derive_ratio_defaults(payload)
    return {
        **DEFAULT_PREDICTION_VALUES,
        **derived,
    }


def resolve_dataset_path() -> Path:
    if FINAL_DATASET_PATH.exists():
        return FINAL_DATASET_PATH
    raise FileNotFoundError(f"Could not find training dataset at {FINAL_DATASET_PATH}")


def load_training_dataframe(path: Path | None = None) -> pd.DataFrame:
    dataset_path = path or resolve_dataset_path()
    df = pd.read_csv(dataset_path)
    required = set(FEATURE_COLUMNS + [TARGET_COLUMN])
    missing = sorted(required.difference(df.columns))
    if missing:
        raise ValueError(f"Training dataset is missing required columns: {missing}")
    return df


def build_preprocessor() -> ColumnTransformer:
    numeric_pipeline = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
        ]
    )
    categorical_pipeline = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="constant", fill_value="unknown")),
            ("onehot", OneHotEncoder(handle_unknown="ignore")),
        ]
    )
    return ColumnTransformer(
        transformers=[
            ("num", numeric_pipeline, NUMERIC_FEATURES),
            ("cat", categorical_pipeline, CATEGORICAL_FEATURES),
        ]
    )


def _normalize_payload_value(feature: str, payload: dict[str, Any]) -> Any:
    if feature in payload and payload[feature] is not None:
        return payload[feature]
    defaults = _build_prediction_defaults(payload)
    return defaults.get(feature)


def build_prediction_frame(payload: dict[str, Any]) -> pd.DataFrame:
    row: dict[str, Any] = {}
    for feature in FEATURE_COLUMNS:
        row[feature] = _normalize_payload_value(feature, payload)
    return pd.DataFrame([row], columns=FEATURE_COLUMNS)


def feature_manifest_payload(model_type: str) -> dict[str, Any]:
    return {
        "dataset_filename_used": resolve_dataset_path().name,
        "feature_names": FEATURE_COLUMNS,
        "numeric_columns": NUMERIC_FEATURES,
        "categorical_columns": CATEGORICAL_FEATURES,
        "target_column": TARGET_COLUMN,
        "model_type_saved": model_type,
        "roi_clip_min": ROI_CLIP_MIN,
        "roi_clip_max": ROI_CLIP_MAX,
        "excluded_columns": EXCLUDED_COLUMNS,
        "prediction_defaults": DEFAULT_PREDICTION_VALUES,
    }


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
