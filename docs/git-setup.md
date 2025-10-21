# 2Synced – Git Setup & Project Timeline

This file records the exact steps I followed while setting up the repository, branches, folder structure, scaffolds, and fixing every error that came along the way.

It’s written as a **timeline**, showing the exact sequence of what I did and how each issue was resolved.

---

### 🧪 Step 13 — ML module layout, registry, and inference wiring (per-module)

Goal: organize ML code per module, version models safely, and expose one clean prediction path to FastAPI.

✅ Updated ML folder structure (and what each part is for)

```text
apps/ml/
  api/                    # FastAPI routes (HTTP endpoints)
  models/                 # ❗binary artifacts (gitignored)
    m01/                  # models for Module 1
      v1/                 # versioned model builds
        model.joblib
        meta.json         # (optional: metrics, features used, etc.)
      v2/
        model.joblib
        meta.json
    registry.json         # points each module to the active version
  modules/                # per-module ML source code (tracked in git)
    m01/
      dataset/            # tiny sample data for tests (OK in git)
      training/           # training scripts (Python)
        train.py
        eval.py
      inference/          # code used in production inference
        loader.py         # loads active model (reads registry.json)
        predict.py        # transforms request → features → predict
  notebooks/              # experiments & EDA (not production code)
    m01/
      EDA.ipynb
      train_v1.ipynb
  utils/                  # shared helpers (feature engineering, IO)
  main.py                 # FastAPI app entry
  requirements.txt        # locked Python dependencies
```

Why this layout works

- `models/` keeps heavy binaries out of Git (tracked by the filesystem, not by git history).
- `modules/m01/...` keeps code versioned and reviewable.
- `registry.json` lets you switch model versions without changing code.
- `api/routes.py` is a thin HTTP layer — logic stays in `modules/m01/inference`.

📇 `models/registry.json` — one place to pick the active model version

```json
{
  "m01": { "active_version": "v2" }
}
```

What it does: tells the loader which version to load for module `m01`.

Why: deploy a new model by changing a small JSON file (not code). If not: you’d hardcode paths and risk shipping the wrong version.

🧠 `modules/m01/inference/loader.py` — safe, cached model loading

```python
# apps/ml/modules/m01/inference/loader.py
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
```

What: reads `registry.json`, loads `model.joblib`, and caches it in memory.

Why: avoids reloading the model on every request → faster predictions.

🧩 `modules/m01/inference/predict.py` — one function to call from the API

```python
# apps/ml/modules/m01/inference/predict.py
from .loader import load_model

def predict_lead_score(payload: dict) -> float:
    """
    1) Extract features from payload
    2) Call model.predict / predict_proba
    3) Return a float probability/score
    """
    # TODO: real feature extraction (placeholder below)
    model = load_model("m01")
    # X = extract_features(payload)
    # y = model.predict_proba([X])[0][1]
    # return float(y)
    return 0.85  # placeholder until training code is wired
```

What: stable function API for the web layer to call.

Why: keeps HTTP concerns out of ML logic; easier to test.

🌐 `api/routes.py` — wire the endpoint to your predictor

```python
# apps/ml/api/routes.py
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
    # placeholder – implement later
    return {"intent_prediction": "high"}
```

What: thin HTTP routes that delegate to ML code.

Why: clear separation: HTTP in `api/`, ML logic in `modules/`.

🔒 .gitignore confirmed (why we ignore these)

 - `apps/ml/models/` → large binaries (use registry to choose versions)
 - `apps/ml/data/` → real datasets (use small samples under `modules/m01/dataset/` only)
 - `apps/ml/venv/`, `__pycache__/`, `*.pyc` → environment/cache files
 - `apps/ml/notebooks/.ipynb_checkpoints/` → noisy notebook autosaves

If not ignored: repo gets huge, slow, and hard to clone.

▶️ How I tested

```powershell
cd apps/ml
venv\Scripts\activate
uvicorn main:app --reload --port 8001
# Health: http://localhost:8001/health
# Predict (example):
# curl -X POST http://localhost:8001/predict/lead -H "Content-Type: application/json" -d "{\"email\":\"test@example.com\"}"
```

With a real `model.joblib` at `apps/ml/models/m01/v2/model.joblib`, the loader picks v2.

To switch versions, edit `models/registry.json` (change `"active_version"`).

💬 Commit message I used

```
ml(m01): structure per-module ML folders; add registry file; wire loader & predict into FastAPI

(Body)
- models/: versioned artifacts; registry.json picks active version
- modules/m01/: dataset, training, inference folders
- loader caches model in-memory; predict stub returns placeholder score
- routes.py calls predict_lead_score
```

---
   ```

- Update `package.json` scripts:

   ```
   "type": "module",
   "main": "dist/index.js",
   "scripts": {
       "dev": "tsx watch src/index.ts",
       "build": "tsc -p tsconfig.json",
       "start": "node dist/index.js"
   }
   ```

- Run the server:

   ```
   npm run dev
   ```

- Error encountered:

   ```
   Must use import to load ES Module: src/index.ts
   ```

   - Cause: `ts-node-dev` doesn’t support ES Modules.
   - Fix: switched dev runner to `tsx` and reinstalled Node types.

   ```
   npm i -D tsx @types/node
   ```

   - After this, `npm run dev` worked and the server ran successfully on port 4000.

---

### ⚙️ Step 5 — Understanding and fixing the ESM error

- Problem explanation:
   - My code used `import`/`export` (ESM syntax).
   - TypeScript and `ts-node-dev` expected CommonJS (`require()`), so Node couldn’t load the file because it wasn’t compiled yet and didn’t know it was ESM.

- How it was fixed:
   - Added `"type": "module"` in `package.json`.
   - Set `module: "NodeNext"` and `moduleResolution: "NodeNext"` in `tsconfig.json`.
   - Switched dev runner from `ts-node-dev` → `tsx`.
   - Installed Node typings:

      ```
      npm i -D @types/node
      ```

   - Changed `"main": "index.ts"` to `"main": "dist/index.js"` since compiled files run in JS, not TS.

   - After aligning these, Node, TypeScript, and the code all used ES Modules.

   - Final result: `npm run dev` starts a clean Express server on port 4000.

---

### 🧬 Step 6 — Verifying everything and committing

After confirming both frontend (`apps/web`) and backend (`apps/api`) were running:

- Update `.gitignore` before committing

   - Reason: I stopped a mid-push to ensure large dependency folders and environment files would not be accidentally committed. Without exclusions, folders like `node_modules/` or `dist/`, and future Python virtual environments could bloat the repo or leak machine-specific files.

   - What I added to the root `.gitignore`:

      - `node_modules/` and `dist/` (for both `apps/web` and `apps/api`)
      - `.env` files (to protect secrets and local configs)
      - `apps/ml/venv/`, `__pycache__/`, and `*.pyc`, `*.pyo` (Python caches)
      - `apps/ml/models/`, `apps/ml/data/`, and Jupyter notebook checkpoints
      - Generic `*.log`, temp files, and IDE folders (e.g., `.vscode/`, `.idea/`)

   - Text Added:

      ```powershell
      # =========================================
      # 2Synced – Global .gitignore
      # Covers Node (React + Express) + Python ML
      # =========================================

      # --- Node / npm ---
      node_modules/
      npm-debug.log*
      yarn-debug.log*
      yarn-error.log*
      pnpm-debug.log*
      package-lock.json
      dist/
      .DS_Store

      # --- React (Vite) ---
      apps/web/.env
      apps/web/.env.local
      apps/web/.env.*.local
      apps/web/node_modules/
      apps/web/dist/

      # --- API (Express + TS) ---
      apps/api/.env
      apps/api/.env.local
      apps/api/.env.*.local
      apps/api/node_modules/
      apps/api/dist/

      # --- Python (FastAPI / ML) ---
      apps/ml/venv/
      apps/ml/__pycache__/
      apps/ml/*.pyc
      apps/ml/*.pyo
      apps/ml/*.pyd
      apps/ml/models/
      apps/ml/data/
      apps/ml/notebooks/.ipynb_checkpoints/

      # --- Logs / temporary ---
      *.log
      *.tmp
      *.bak
      *.swp
      *.swo
      *.cache/
      __pycache__/

      # --- OS generated ---
      Thumbs.db
      ehthumbs.db
      Icon?
      .DS_Store
      desktop.ini

      # --- Editor / IDE specific ---
      .vscode/
      .idea/
      *.code-workspace
      .specstory/
      ```

   - Why this matters:
      - Keeps Git history light and clean
      - Prevents accidental upload of huge dependency folders or virtual environments
      - Ensures sensitive or machine-specific files never leave local systems

   - After saving `.gitignore`, the commands I ran:

      ```
      git add .
      git commit -m "chore: scaffold frontend & backend structure, add global .gitignore for Node and future Python setup"
      git push
      ```

      Note: the commit message above was added via the text editor (pasted into the commit message editor) rather than entered inline with `-m`.

   Commit message details:

   ```
   chore: scaffold frontend & backend structure, add global .gitignore for Node and future Python setup

   - Created base folder structure for apps/web (Vite + React) and apps/api (Express + TS)
   - Initialized Git branches (main, dev, modules/m01–m09)
   - Configured .gitignore to exclude node_modules, dist, env files, and Python venv paths
   ```

Then merged the structure into each module branch:

```
git checkout dev
git pull
git checkout modules/m01
git merge dev
git push
```

---


### 🧠 Step 7 — Key takeaways

- Summary table (area / problem / fix):

   - Git push failed
      - Problem: No commits before pushing
      - Fix: Committed first

   - Vite setup
      - Problem: Pre-existing folders caused warning
      - Fix: Chose “Ignore files and continue” during scaffold

   - Rolldown
      - Problem: Experimental
      - Fix: Chose “No” during scaffold

   - Backend error
      - Problem: “Must use import to load ES Module”
      - Fix: Switched to `tsx` and adjusted ESM config

   - Type definitions
      - Problem: Missing Node types
      - Fix: Installed `@types/node`

- Status:

   - Frontend (React/Vite): running at http://localhost:5173
   - Backend (Express/TS): running at http://localhost:4000
   - Branches: `main`, `dev`, `modules/m01..m09` — all clean
   - Docs folder: `docs/git-setup.md` tracks all progress

---
 
   ### 🧪 Step 8: ML Service (Python + FastAPI) — Scaffold & Verify

   Where I worked: `apps/ml`

   1. Created & activated virtual env

      ```powershell
      cd apps/ml
      python -m venv venv
      venv\Scripts\activate
      ```

      - Why: keeps Python packages isolated per project
      - If not: risk version conflicts across projects

   2. Installed FastAPI + basic ML libs and locked versions

      ```powershell
      pip install fastapi uvicorn scikit-learn pandas numpy joblib
      pip freeze > requirements.txt
      ```

   3. Created minimal app files

      - `main.py`

        ```python
        from fastapi import FastAPI
        from api.routes import router

        app = FastAPI(title="2Synced ML Service")
        app.include_router(router)

        # Optional friendly root
        @app.get("/")
        def root():
            return {"message": "2Synced ML Service is running"}
        ```

      - `api/routes.py`

        ```python
        from fastapi import APIRouter

        router = APIRouter()

        @router.get("/health")
        def health_check():
            return {"status": "ok"}

        @router.post("/predict/lead")
        def lead_score(data: dict):
            return {"lead_score": 0.85}

        @router.post("/predict/intent")
        def intent(data: dict):
            return {"intent_prediction": "high"}
        ```

   4. Run the ML service

      ```powershell
      uvicorn main:app --reload --port 8001
      ```

      - Tested: `http://127.0.0.1:8001/health` → `{ "status": "ok" }`
      - Note: GET `/` and `/favicon.ico` 404 is normal unless a root route is added (added above).

   5. Deactivate env when done

      - Ctrl + C
      - `deactivate`

   Issues & fixes

   - `uvicorn` not found → venv wasn’t active → activated then `pip install uvicorn`
   - `ModuleNotFoundError: fastapi` → packages installed to wrong env → re-activated venv, reinstalled
   - Port in use → changed to `--port 8010`

   ### 🧾 Step 9: Update README with run instructions (web, api, ml)

   I created/updated `README.md` at repo root so anyone can run the project locally. See README for prerequisites, Quickstart, and scripts.

   ### 🚀 Step 10: Commit & Push (dev)

   I committed all scaffold + docs updates with a clear, single-line message and a short body:

   ```bash
   git add .
   git commit -m "feat(ml): scaffold FastAPI service; docs: add run instructions; chore: refine .gitignore" -m "- Added apps/ml with FastAPI, /health and placeholder predict endpoints
   - Updated README with Quickstart (web/api/ml)
   - Kept .gitignore ready for Node and future Python artifacts"
   git push   # or: git push -u origin dev (if first push on dev)
   ```

   ### 🔄 Step 11: Sync module branches with latest dev

   After pushing, merge `dev` → each module so everyone gets the new structure and docs.

   ```bash
   git checkout dev
   git pull

   # repeat for all nine modules
   git checkout modules/m01
   git merge dev
   git push

   git checkout dev
   # (then m02..m09 in the same way)
   ```

  

   ---

---
 
### ✅ Step 12: Local commit recorded

After updating `README.md` with the final ML instructions and a few minor edits, I committed the change locally using a short, focused message.

Command used locally (PowerShell):

```powershell
git add README.md
git commit -m "Updated README."
```

Notes:

- This commit was made on the `modules/m09` branch (local workspace). The commit completed successfully (exit code 0 in my terminal session).
- The message is intentionally concise — you can expand it later w  ---
 
### ✅ Step 12: Local commit recorded

After updating `README.md` with the final ML instructions and a few minor edits, I committed the change locally using a short, focused message.

Command used locally (PowerShell):

```powershell
git add README.md
git commit -m "Updated README."
```

Notes:

- This commit was made on the `modules/m09` branch (local workspace). The commit completed successfully (exit code 0 in my terminal session).
- The message is intentionally concise — you can expand it later when squashing or creating a PR (for example: `docs: update README with ML service setup`).
- Next steps: push this branch to the remote and open a PR into `dev`, or merge/cherry-pick the change into `dev` depending on your workflow:

```powershell
git push -u origin modules/m09
# then open PR modules/m09 -> dev on GitHub
```

   ---

### 🧪 Step 13 — ML module layout, registry, and inference wiring (per-module)

Goal: organize ML code per module, version models safely, and expose one clean prediction path to FastAPI.

✅ Updated ML folder structure (and what each part is for)
apps/ml/
   api/
      routes.py               # FastAPI routes (HTTP endpoints)
   models/                   # ❗binary artifacts (gitignored)
      m01/                    # models for Module 1
         v1/                   # versioned model builds
            model.joblib
            meta.json           # (optiona
   l### 🧪 Step 13 — ML module layout, registry, and inference wiring (per-module)

Goal: organize ML code per module, version models safely, and expose one clean prediction path to FastAPI.

✅ Updated ML folder structure (and what each part is for)
apps/ml/
   api/
      routes.py               # FastAPI routes (HTTP endpoints)
   models/                   # ❗binary artifacts (gitignored)
      m01/                    # models for Module 1
         v1/                   # versioned model builds
            model.joblib
            meta.json           # (optional: metrics, features used, etc.)
         v2/
            model.joblib
            meta.json
      registry.json           # points each module to the active version
   modules/                  # per-module ML source code (tracked in git)
      m01/
         dataset/              # tiny sample data for tests (OK in git)
         training/             # training scripts (Python)
            train.py
            eval.py
         inference/            # code used in production inference
            loader.py           # loads active model (reads registry.json)
            predict.py          # transforms request → features → predict
   notebooks/                # experiments & EDA (not production code)
      m01/
         EDA.ipynb
         train_v1.ipynb
   utils/                    # shared helpers (feature engineering, IO)
   main.py                   # FastAPI app entry
   requirements.txt          # locked Python dependencies


Why this layout works

models/ keeps heavy binaries out of Git (tracked by the filesystem, not by git history).

modules/m01/... keeps code versioned and reviewable.

registry.json lets you switch model versions without changing code.

api/routes.py is a thin HTTP layer — logic stays in modules/m01/inference.

📇 models/registry.json — one place to pick the active model version
{
   "m01": { "active_version": "v2" }
}


What it does: tells the loader which version to load for module m01.

Why: deploy a new model by changing a small JSON file (not code).

If not: you’d hardcode paths in code and risk shipping the wrong version.

🧠 modules/m01/inference/loader.py — safe, cached model loading
# apps/ml/modules/m01/inference/loader.py
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


What: reads registry.json, loads model.joblib, and caches it in memory.

Why: avoids reloading the model on every request → faster predictions.

If not: every request would hit the filesystem → slow API.

🧩 modules/m01/inference/predict.py — one function to call from the API
# apps/ml/modules/m01/inference/predict.py
from .loader import load_model

def predict_lead_score(payload: dict) -> float:
      """
      1) Extract features from payload
      2) Call model.predict / predict_proba
      3) Return a float probability/score
      """
      # TODO: real feature extraction (placeholder below)
      model = load_model("m01")
      # X = extract_features(payload)
      # y = model.predict_proba([X])[0][1]
      # return float(y)
      return 0.85  # placeholder until training code is wired


What: stable function API for the web layer to call.

Why: keeps HTTP concerns out of ML logic; easier to test.

If not: logic leaks into routes and becomes hard to maintain.

🌐 api/routes.py — wire the endpoint to your predictor
# apps/ml/api/routes.py
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
      # placeholder – implement later
      return {"intent_prediction": "high"}


What: thin HTTP routes that delegate to ML code.

Why: clear separation: HTTP in api/, ML logic in modules/.

🔒 .gitignore confirmed (why we ignore these)

apps/ml/models/ → large binaries (use registry to choose versions)

apps/ml/data/ → real datasets (use small samples under modules/m01/dataset/ only)

apps/ml/venv/, __pycache__/, *.pyc → environment/cache files

apps/ml/notebooks/.ipynb_checkpoints/ → noisy notebook autosaves

If not ignored: repo gets huge, slow, and hard to clone.

▶️ How I tested
cd apps/ml
venv\Scripts\activate
uvicorn main:app --reload --port 8001
# Health: http://localhost:8001/health
# Predict (example):
# curl -X POST http://localhost:8001/predict/lead -H "Content-Type: application/json" -d "{\"email\":\"test@example.com\"}"


With a real model.joblib at apps/ml/models/m01/v2/model.joblib, the loader picks v2.

To switch versions, I only edit models/registry.json ("active_version": "v1").

💬 Commit message I used
ml(m01): structure per-module ML folders; add registry file; wire loader & predict into FastAPI


(Body)

- models/: versioned artifacts; registry.json picks active version
- modules/m01/: dataset, training, inference folders
- loader caches model in-memory; predict stub returns placeholder score
- routes.py calls predict_lead_score
 ADD THIS AS STEP 13 AT THE END OF THIS GITSETUP FIEL AN DSTRCUTURE AND ARRANGE ETXT ACCORDINGLY THE ONE IM PASTIGN AND DONT HCNAGE CNYAHTING ELS EIN FILE
: m