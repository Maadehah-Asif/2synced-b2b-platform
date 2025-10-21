from .loader import load_model

def predict_lead_score(payload: dict) -> float:
    # Example only: adapt to your real features
    # X = extract_features(payload)
    model = load_model("m01")
    # y = model.predict_proba([X])[0][1]  # if classifier with proba
    # return float(y)
    return 0.85  # placeholder until your model is trained
