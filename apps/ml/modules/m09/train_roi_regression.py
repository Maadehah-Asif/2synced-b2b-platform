from train_roi_regression_impl import main as delegated_main

if __name__ == "__main__":
    delegated_main()
    raise SystemExit

# legacy: from __future__ import annotations

import math

from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline

from preprocess import (
    FEATURE_COLUMNS,
    FEATURE_MANIFEST_PATH,
    METRICS_PATH,
    MODEL_DIR,
    MODEL_PATH,
    TARGET_COLUMN,
    build_preprocessor,
    feature_manifest_payload,
    load_training_dataframe,
    resolve_dataset_path,
    write_json,
)


def main() -> None:
    dataset_path = resolve_dataset_path()
    df = load_training_dataframe(dataset_path)

    X = df[FEATURE_COLUMNS].copy()
    y = df[TARGET_COLUMN].copy()

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.20,
        random_state=42,
    )

    model = Pipeline(
        steps=[
            ("preprocess", build_preprocessor()),
            (
                "regressor",
                RandomForestRegressor(
                    n_estimators=300,
                    random_state=42,
                    n_jobs=1,
                ),
            ),
        ]
    )

    model.fit(X_train, y_train)
    predictions = model.predict(X_test)

    mae = mean_absolute_error(y_test, predictions)
    rmse = math.sqrt(mean_squared_error(y_test, predictions))
    r2 = r2_score(y_test, predictions)

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_PATH)

    metrics_payload = {
        "dataset_path": str(dataset_path),
        "row_count": int(len(df)),
        "train_size": int(len(X_train)),
        "test_size": int(len(X_test)),
        "target_column": TARGET_COLUMN,
        "metrics": {
            "mae": round(float(mae), 6),
            "rmse": round(float(rmse), 6),
            "r2": round(float(r2), 6),
        },
        "model": {
            "type": "RandomForestRegressor",
            "random_state": 42,
            "n_estimators": 300,
            "n_jobs": 1,
        },
    }

    write_json(METRICS_PATH, metrics_payload)
    write_json(FEATURE_MANIFEST_PATH, feature_manifest_payload())

    print("Module 9 ROI regression training complete.")
    print(f"Dataset: {dataset_path}")
    print(f"Saved model: {MODEL_PATH}")
    print(f"Saved metrics: {METRICS_PATH}")
    print(f"Saved feature manifest: {FEATURE_MANIFEST_PATH}")
    print("")
    print("Metrics")
    print(f"MAE:  {metrics_payload['metrics']['mae']}")
    print(f"RMSE: {metrics_payload['metrics']['rmse']}")
    print(f"R²:   {metrics_payload['metrics']['r2']}")


if __name__ == "__main__":
    main()
