from fastapi import FastAPI
from api.routes import router

app = FastAPI(title="2Synced ML Service")
app.include_router(router)

# run with: uvicorn main:app --reload --port 8001
