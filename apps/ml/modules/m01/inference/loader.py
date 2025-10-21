import json
from pathlib import Path
import joblib

ROOT = Path(__file__).resolve().parents[3]        # .../apps/ml
MODELS_DIR = ROOT / "models"
REGISTRY = MODELS_DIR / "registry.json"

_cache = {}

def get_active_model_path(module_key: str) -> Path:
    with open(REGISTRY, "r", encoding="utf-8") as f:
        reg = json.load(f)
    active_ver = reg[module_key]["active_version"]
    return MODELS_DIR / module_key / active_ver / "model.joblib"

def load_model(module_key: str = "m01"):
    if module_key in _cache:
        return _cache[module_key]
    model_path = get_active_model_path(module_key)
    model = joblib.load(model_path)
    _cache[module_key] = model
    return model
