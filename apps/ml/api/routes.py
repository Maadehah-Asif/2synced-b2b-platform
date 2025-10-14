from fastapi import APIRouter

router = APIRouter()

@router.get("/health")
def health_check():
    return {"status": "ok"}

@router.post("/predict/lead")
def lead_score(data: dict):
    # TODO: load a trained model and return real score
    return {"lead_score": 0.85}

@router.post("/predict/intent")
def intent(data: dict):
    # TODO: load a trained model and return real intent label
    return {"intent_prediction": "high"}
