from fastapi import APIRouter
from modules.m01.inference.predict import predict_lead_score

router = APIRouter()

@router.get("/health")
def health_check():
    return {"status": "ok"}

@router.post("/predict/lead")
def lead_score(data: dict):
    score = predict_lead_score(data)
    return {"lead_score": score}

@router.post("/predict/intent")
def intent(data: dict):
    # TODO: load a trained model and return real intent label
    return {"intent_prediction": "high"}
