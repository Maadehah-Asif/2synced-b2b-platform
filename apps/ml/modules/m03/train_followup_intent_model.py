import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report
import joblib

# 1. Load dataset
df = pd.read_excel("deal_followup_dataset (2).xlsx")

target_col = "label_followup_intent"

# 2. Drop pure ID / text columns from features
X = df.drop(
    columns=[
        target_col,
        "deal_id",
        "contact_name",
        "contact_email",
        "company_name",
    ]
)
y = df[target_col]

# 3. Define categorical vs numeric
categorical_cols = ["segment", "current_stage"]
numeric_cols = [c for c in X.columns if c not in categorical_cols]

# 4. Preprocessing: one-hot for categoricals, passthrough numerics
preprocess = ColumnTransformer(
    transformers=[
        ("cat", OneHotEncoder(handle_unknown="ignore"), categorical_cols),
        ("num", "passthrough", numeric_cols),
    ]
)

# 5. Classifier: multinomial logistic regression
clf = LogisticRegression(
    multi_class="multinomial",
    max_iter=500,
    solver="lbfgs"
)

model = Pipeline(
    steps=[
        ("preprocess", preprocess),
        ("clf", clf),
    ]
)

# 6. Train / test split
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

# 7. Fit model
model.fit(X_train, y_train)

# 8. Evaluate
y_pred = model.predict(X_test)
print(classification_report(y_test, y_pred))

# 9. Save trained pipeline
joblib.dump(model, "followup_intent_model.joblib")
print("Saved model to followup_intent_model.joblib")
