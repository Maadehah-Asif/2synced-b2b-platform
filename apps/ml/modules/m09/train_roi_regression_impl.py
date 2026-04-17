from __future__ import annotations

import json
import math
from pathlib import Path

import joblib
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline

from preprocess import (
    FEATURE_COLUMNS,
    FEATURE_MANIFEST_PATH,
    METRICS_PATH,
    MODEL_DIR,
    MODEL_PATH,
    ROI_CLIP_MAX,
    ROI_CLIP_MIN,
    TARGET_COLUMN,
    build_preprocessor,
    feature_manifest_payload,
    load_training_dataframe,
    resolve_dataset_path,
    write_json,
)

OLD_METRICS_REFERENCE = {
    "mae": 38.906367,
    "rmse": 85.699883,
    "r2": 0.290784,
    "model_type": "RandomForestRegressor",
    "dataset_filename": "campaign_roi_training_synthetic.csv",
}


def evaluate_predictions(y_true, predictions) -> dict[str, float]:
    mae = mean_absolute_error(y_true, predictions)
    rmse = math.sqrt(mean_squared_error(y_true, predictions))
    r2 = r2_score(y_true, predictions)
    return {
        "mae": round(float(mae), 6),
        "rmse": round(float(rmse), 6),
        "r2": round(float(r2), 6),
    }


def build_candidate_models() -> list[tuple[str, object, dict[str, object]]]:
    return [
        (
            "RandomForestRegressor",
            RandomForestRegressor(
                n_estimators=500,
                max_depth=16,
                min_samples_split=6,
                min_samples_leaf=3,
                random_state=42,
                n_jobs=1,
            ),
            {
                "n_estimators": 500,
                "max_depth": 16,
                "min_samples_split": 6,
                "min_samples_leaf": 3,
                "random_state": 42,
                "n_jobs": 1,
            },
        ),
        (
            "GradientBoostingRegressor",
            GradientBoostingRegressor(
                n_estimators=350,
                learning_rate=0.05,
                max_depth=3,
                min_samples_split=6,
                min_samples_leaf=3,
                random_state=42,
            ),
            {
                "n_estimators": 350,
                "learning_rate": 0.05,
                "max_depth": 3,
                "min_samples_split": 6,
                "min_samples_leaf": 3,
                "random_state": 42,
            },
        ),
    ]


def load_previous_metrics(path: Path) -> dict[str, float] | None:
    if not path.exists():
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        metrics = payload.get("metrics") or {}
        model = payload.get("model") or {}
        dataset_filename = payload.get("dataset_filename") or payload.get("dataset_path", "")
        return {
            "mae": float(metrics.get("mae", 0.0)),
            "rmse": float(metrics.get("rmse", 0.0)),
            "r2": float(metrics.get("r2", 0.0)),
            "model_type": str(model.get("type", "unknown")),
            "dataset_filename": Path(str(dataset_filename)).name if dataset_filename else "unknown",
        }
    except Exception:
        return None


def main() -> None:
    dataset_path = resolve_dataset_path()
    df = load_training_dataframe(dataset_path)
    previous_metrics = load_previous_metrics(METRICS_PATH) or OLD_METRICS_REFERENCE
    raw_dataset_row_count = int(len(df))

    df = df.copy()
    df[TARGET_COLUMN] = df[TARGET_COLUMN].clip(ROI_CLIP_MIN, ROI_CLIP_MAX)
    df = df.dropna(subset=[TARGET_COLUMN]).reset_index(drop=True)
    training_row_count_after_cleaning = int(len(df))

    X = df[FEATURE_COLUMNS].copy()
    y = df[TARGET_COLUMN].copy()

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.20,
        random_state=42,
    )

    comparison_results: dict[str, dict[str, object]] = {}
    best_model_name: str | None = None
    best_model_pipeline: Pipeline | None = None
    best_model_params: dict[str, object] | None = None
    best_metrics: dict[str, float] | None = None

    for model_name, estimator, params in build_candidate_models():
        pipeline = Pipeline(
            steps=[
                ("preprocess", build_preprocessor()),
                ("regressor", estimator),
            ]
        )
        pipeline.fit(X_train, y_train)
        predictions = pipeline.predict(X_test)
        metrics = evaluate_predictions(y_test, predictions)
        comparison_results[model_name] = {
            "metrics": metrics,
            "params": params,
        }
        if best_metrics is None or metrics["r2"] > best_metrics["r2"]:
            best_model_name = model_name
            best_model_pipeline = pipeline
            best_model_params = params
            best_metrics = metrics

    if best_model_name is None or best_model_pipeline is None or best_model_params is None or best_metrics is None:
        raise RuntimeError("No model candidate could be trained.")

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(best_model_pipeline, MODEL_PATH)

    metrics_payload = {
        "dataset_filename": dataset_path.name,
        "dataset_path": str(dataset_path),
        "roi_clip_min": ROI_CLIP_MIN,
        "roi_clip_max": ROI_CLIP_MAX,
        "raw_dataset_row_count": raw_dataset_row_count,
        "training_row_count_after_cleaning": training_row_count_after_cleaning,
        "row_count_used": int(len(df)),
        "train_test_split": "80/20",
        "train_size": int(len(X_train)),
        "test_size": int(len(X_test)),
        "target_column": TARGET_COLUMN,
        "preprocessing_notes": {
            "roi_clipping_applied": True,
            "roi_clipping_rule": f"{TARGET_COLUMN} clipped to [{ROI_CLIP_MIN}, {ROI_CLIP_MAX}] before training",
        },
        "metrics": best_metrics,
        "model": {
            "type": best_model_name,
            **best_model_params,
        },
        "comparison": comparison_results,
        "previous_reference": previous_metrics,
    }

    write_json(METRICS_PATH, metrics_payload)
    write_json(FEATURE_MANIFEST_PATH, feature_manifest_payload(best_model_name))

    print("Module 9 ROI regression training complete.")
    print(f"Dataset: {dataset_path}")
    print(f"Saved model: {MODEL_PATH}")
    print(f"Saved metrics: {METRICS_PATH}")
    print(f"Saved feature manifest: {FEATURE_MANIFEST_PATH}")
    print("")
    print(f"Chosen model: {best_model_name}")
    print(f"MAE:  {best_metrics['mae']}")
    print(f"RMSE: {best_metrics['rmse']}")
    print(f"R2:   {best_metrics['r2']}")
    print("")
    print("Previous reference")
    print(f"MAE:  {previous_metrics['mae']}")
    print(f"RMSE: {previous_metrics['rmse']}")
    print(f"R2:   {previous_metrics['r2']}")


if __name__ == "__main__":
    main()
