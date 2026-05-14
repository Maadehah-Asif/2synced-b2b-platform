import os
import pandas as pd
import numpy as np
import joblib

from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.preprocessing import OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.ensemble import RandomForestClassifier

# -------------------------------------------------
# Paths
# -------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
MODEL_DIR = os.path.join(BASE_DIR, "models")

INPUT_PATH   = os.path.join(DATA_DIR, "checkmergedtrainable.csv")
MODEL_PATH   = os.path.join(MODEL_DIR, "m01", "catboost.pkl")
REPORT_PATH  = os.path.join(MODEL_DIR, "m01", "report_rf.txt")

TARGET_COL = "intent_tier"

# Columns we do not want to feed to the model
BLOCKED_COLS = set([
    "lead_id",
    "id",
    "lead_priority_flag",
    "p_low", "p_medium", "p_high",
    "predicted_class", "predicted_label", "confidence",
    "p_class0", "p_class1", "p_class2",
    "engagement_recent",
    "reply_behavior_score",
    "meeting_signal",
    "activity_per_touch",
    "account_engaged",
    "activity_intensity",
    "engagement_score_recent",
    "demo_interest_score",
    "reply_rate",
])

RNG = np.random.default_rng(1234)

# -------------------------------------------------
# 1. Load dataset
# -------------------------------------------------
df = pd.read_csv(INPUT_PATH)

if TARGET_COL not in df.columns:
    raise ValueError(f"{TARGET_COL} not found in {INPUT_PATH}")

y = df[TARGET_COL].astype(int)

# keep only allowed feature columns
feature_cols = [
    c for c in df.columns
    if c not in BLOCKED_COLS
    and c != TARGET_COL
]

X = df[feature_cols].copy()

# -------------------------------------------------
# 2. Split early (so we can treat train data like "historical logging")
# -------------------------------------------------
X_train, X_test, y_train, y_test = train_test_split(
    X, y,
    test_size=0.20,
    random_state=42,
    stratify=y
)

# -------------------------------------------------
# 3. Light historical normalization on TRAIN ONLY
#    (Same logic you've been using)
# -------------------------------------------------
def soften_numeric_frame(df_in: pd.DataFrame) -> pd.DataFrame:
    df_out = df_in.copy()

    numeric_cols_local = [
        col for col in df_out.columns
        if pd.api.types.is_numeric_dtype(df_out[col])
    ]

    for col in numeric_cols_local:
        col_vals = pd.to_numeric(df_out[col], errors="coerce").fillna(0.0).astype(float)

        # small per-row scale tweak around 1.0 ± ~4%
        scale_factor = RNG.normal(loc=1.0, scale=0.04, size=len(col_vals))
        adjusted = col_vals * scale_factor

        # clamp / rounding for operational-style logging columns
        if (
            "count" in col.lower() or
            "actions" in col.lower() or
            "visits" in col.lower() or
            "duration" in col.lower() or
            "days_since" in col.lower() or
            "emails" in col.lower() or
            "risk" in col.lower() or
            "score" in col.lower() or
            "index" in col.lower()
        ):
            adjusted = np.clip(adjusted, 0, None)
            if any(k in col.lower() for k in ["count", "emails", "actions", "visits"]):
                adjusted = np.rint(adjusted)
            else:
                adjusted = np.round(adjusted, 1)

        df_out[col] = adjusted

    # fill non-numeric text cols with "unknown"
    non_numeric_cols_local = [
        col for col in df_out.columns
        if not pd.api.types.is_numeric_dtype(df_out[col])
    ]
    for col in non_numeric_cols_local:
        df_out[col] = (
            df_out[col]
            .astype(str)
            .replace("nan", "unknown")
            .replace("NaT", "unknown")
            .fillna("unknown")
        )

    return df_out

X_train_processed = soften_numeric_frame(X_train)
X_test_processed  = X_test.copy()

# -------------------------------------------------
# 4. Basic fill on TEST (no scaling here)
# -------------------------------------------------
for col in X_test_processed.columns:
    if pd.api.types.is_numeric_dtype(X_test_processed[col]):
        X_test_processed[col] = pd.to_numeric(
            X_test_processed[col],
            errors="coerce"
        ).fillna(0.0)
    else:
        X_test_processed[col] = (
            X_test_processed[col]
            .astype(str)
            .replace("nan", "unknown")
            .replace("NaT", "unknown")
            .fillna("unknown")
        )

# -------------------------------------------------
# 5. Figure out numeric vs categorical AFTER processing
# -------------------------------------------------
numeric_features = []
categorical_features = []

for col in X_train_processed.columns:
    if pd.api.types.is_numeric_dtype(X_train_processed[col]):
        numeric_features.append(col)
    else:
        categorical_features.append(col)

numeric_transform = Pipeline(steps=[
    ("imputer", SimpleImputer(strategy="constant", fill_value=0.0)),
])

categorical_transform = Pipeline(steps=[
    ("imputer", SimpleImputer(strategy="constant", fill_value="unknown")),
    ("onehot", OneHotEncoder(handle_unknown="ignore")),
])

preprocess = ColumnTransformer(
    transformers=[
        ("num", numeric_transform, numeric_features),
        ("cat", categorical_transform, categorical_features),
    ]
)

# -------------------------------------------------
# 6. Random Forest
# -------------------------------------------------
rf = RandomForestClassifier(
    n_estimators=200,
    max_depth=3,
    min_samples_split=30,
    min_samples_leaf=15,
    random_state=42,
    n_jobs=-1
)

clf = Pipeline(steps=[
    ("prep", preprocess),
    ("rf", rf),
])

# -------------------------------------------------
# 7. Fit & Evaluate
# -------------------------------------------------
clf.fit(X_train_processed, y_train)

y_pred = clf.predict(X_test_processed)
probs = clf.predict_proba(X_test_processed)

acc = accuracy_score(y_test, y_pred)
report = classification_report(y_test, y_pred)
cm = confusion_matrix(y_test, y_pred)

print("\n================ RF HOLDOUT (80/20) ================")
print("Accuracy:", acc)
print("\nClassification Report:\n", report)
print("\nConfusion Matrix:\n", cm)
print("====================================================\n")

# -------------------------------------------------
# 8. Save model + report
# -------------------------------------------------
os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
joblib.dump({
    "model": clf,
    "numeric_features": numeric_features,
    "categorical_features": categorical_features,
}, MODEL_PATH)

os.makedirs(os.path.dirname(REPORT_PATH), exist_ok=True)
with open(REPORT_PATH, "w") as f:
    f.write("Accuracy:\n")
    f.write(str(acc) + "\n\n")
    f.write("Classification Report:\n")
    f.write(report + "\n\n")
    f.write("Confusion Matrix:\n")
    f.write(str(cm) + "\n")
