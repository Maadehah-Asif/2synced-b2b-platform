import os
import pandas as pd
import numpy as np
import joblib
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from catboost import CatBoostClassifier

# -------------------------------------------------
# Paths
# -------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")

BEHAV_PATH        = os.path.join(DATA_DIR, "behvioural.csv")
LEADS_PATH        = os.path.join(DATA_DIR, "Leads__sanitized.csv")
CONNECTIONS_PATH  = os.path.join(DATA_DIR, "Connections.csv")
ENRICH_PATH       = os.path.join(DATA_DIR, "enrichment.csv")

OUTPUT_CSV_PATH   = os.path.join(DATA_DIR, "checkmergedtrainable.csv")
MODEL_OUT_PATH    = os.path.join(BASE_DIR, "models", "m01", "catboost.pkl")

TARGET_COL = "intent_tier"  # 0 / 1 / 2

# -------------------------------------------------
# Columns we will EXCLUDE from training
# (anything that directly exposes the label or is an ID)
# -------------------------------------------------
EXCLUDE_COLS_LABELY = [
    "lead_priority_flag",
    "p_low", "p_medium", "p_high",
    "predicted_class", "predicted_label", "confidence",

    "engagement_recent",
    "reply_behavior_score",
    "meeting_signal",
    "activity_per_touch",
    "account_engaged",
    "activity_intensity",
    "engagement_score_recent",
    "demo_interest_score",
    "reply_rate",

    "p_class0", "p_class1", "p_class2",
]

EXCLUDE_COLS_ID = [
    "lead_id",
    "id",
]

# -------------------------------------------------
# 1. Load behavioral
# -------------------------------------------------
beh = pd.read_csv(BEHAV_PATH)

# If intent_tier is missing, fall back to predicted_class
if TARGET_COL not in beh.columns:
    if "predicted_class" in beh.columns:
        beh[TARGET_COL] = beh["predicted_class"]
    else:
        raise ValueError("No intent_tier or predicted_class found in behvioural.csv.")

# Make sure we have lead_id to join on
if "lead_id" not in beh.columns:
    if "id" in beh.columns:
        beh["lead_id"] = beh["id"]
    else:
        raise ValueError("behvioural.csv needs lead_id or id")

# -------------------------------------------------
# 2. Load enrichment (extra org-level / account context)
# -------------------------------------------------
enr = pd.read_csv(ENRICH_PATH)

if "lead_id" not in enr.columns:
    if "id" in enr.columns:
        enr["lead_id"] = enr["id"]
    else:
        raise ValueError("enrichment.csv needs lead_id or id")

enr_cols_keep = [
    "lead_id",
    "sales_pressure_index",
    "is_urgent_escalation",
    "rep_priority_bucket",
    "escalation_risk_score",
    "crm_anomaly_flag",
    "random_spike_factor",
]
enr_slim = enr[enr_cols_keep].copy()

# -------------------------------------------------
# 3. Leads (pull basic engagement_score if present)
# -------------------------------------------------
leads = pd.read_csv(LEADS_PATH)

if "lead_id" not in leads.columns:
    if "id" in leads.columns:
        leads["lead_id"] = leads["id"]
    else:
        raise ValueError("Leads__sanitized.csv needs id/lead_id")

keep_from_leads = []
if "engagement_score" in leads.columns:
    keep_from_leads.append("engagement_score")

leads_slim = leads[["lead_id"] + keep_from_leads].drop_duplicates("lead_id")

# -------------------------------------------------
# 4. Connections (pull latest last_action_type per lead)
# -------------------------------------------------
conns = pd.read_csv(CONNECTIONS_PATH)

if "lead_id" not in conns.columns:
    if "id" in conns.columns:
        conns["lead_id"] = conns["id"]
    else:
        raise ValueError("Connections.csv needs id/lead_id")

conns_agg = (
    conns.groupby("lead_id")
    .agg(
        last_action_type=("last_action_taken", "last")
    )
    .reset_index()
)

# -------------------------------------------------
# 5. Merge everything
# -------------------------------------------------
merged = (
    beh
    .merge(enr_slim,    on="lead_id", how="left")
    .merge(leads_slim,  on="lead_id", how="left")
    .merge(conns_agg,   on="lead_id", how="left")
)

# -------------------------------------------------
# 6. Basic cleanup
# -------------------------------------------------

# last_action_type is categorical text. Fill blanks.
if "last_action_type" in merged.columns:
    merged["last_action_type"] = (
        merged["last_action_type"]
        .astype(str)
        .replace("nan", "unknown")
        .replace("NaT", "unknown")
        .fillna("unknown")
    )

# numeric fill for columns we know should be numeric
numeric_fill_cols = [
    "engagement_score",
    "sales_pressure_index",
    "is_urgent_escalation",
    "rep_priority_bucket",
    "escalation_risk_score",
    "crm_anomaly_flag",
    "random_spike_factor",
]
for c in numeric_fill_cols:
    if c in merged.columns:
        merged[c] = pd.to_numeric(merged[c], errors="coerce").fillna(0)

# drop columns that are 100% NaN (except target)
for col in list(merged.columns):
    if col != TARGET_COL and merged[col].isna().all():
        merged.drop(columns=[col], inplace=True)

# -------------------------------------------------
# 7. Build X / y
# -------------------------------------------------
y = merged[TARGET_COL].astype(int)

# Which columns are allowed as features?
cols_to_exclude = set([TARGET_COL] + EXCLUDE_COLS_LABELY + EXCLUDE_COLS_ID)
feature_cols = [c for c in merged.columns if c not in cols_to_exclude]

X_full = merged[feature_cols].copy()

# Split train/test
X_train, X_test, y_train, y_test = train_test_split(
    X_full,
    y,
    test_size=0.20,
    random_state=42,
    stratify=y
)

# CatBoost categorical feature indices
cat_cols = [c for c in X_full.columns if X_full[c].dtype == "object"]
cat_feature_indices = [X_full.columns.get_loc(c) for c in cat_cols if c in X_train.columns]

# -------------------------------------------------
# 8. Train model
# -------------------------------------------------
model = CatBoostClassifier(
    iterations=200,           # fewer trees, less capacity
    learning_rate=0.1,        # slightly higher step so it can't fine-tune tiny boundaries slowly
    depth=4,                  # shallower trees, simpler rules
    loss_function="MultiClass",
    random_seed=42,
    early_stopping_rounds=20, # stop earlier if it's not improving
    l2_leaf_reg=50,           # way stronger regularization (penalize overfitting)
    verbose=100
)


model.fit(
    X_train,
    y_train,
    eval_set=(X_test, y_test),
    cat_features=cat_feature_indices
)

# -------------------------------------------------
# 9. Evaluate
# -------------------------------------------------
y_pred = model.predict(X_test).astype(int).reshape(-1)

probs = model.predict_proba(X_test)
acc = accuracy_score(y_test, y_pred)
print("\n================ Catboost FINAL HOLDOUT (80/20) ================")
print("Accuracy:", acc)
print("\nClassification Report:\n", classification_report(y_test, y_pred))
print("\nConfusion Matrix:\n", confusion_matrix(y_test, y_pred))
print("=======================================================\n")

# -------------------------------------------------
# 10. Save final merged training data + model
# -------------------------------------------------
merged.to_csv(OUTPUT_CSV_PATH, index=False)
os.makedirs(os.path.dirname(MODEL_OUT_PATH), exist_ok=True)
joblib.dump(model, MODEL_OUT_PATH)

print("Saved merged training data to:", OUTPUT_CSV_PATH)
print("Saved model to:", MODEL_OUT_PATH)
print("Feature columns used for training (in order):")
print(feature_cols)
