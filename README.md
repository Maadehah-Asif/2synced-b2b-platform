# 2Synced – B2B Marketing Platform (Monorepo)

AI-powered B2B marketing automation platform for SMEs to optimize leads, campaigns, and ROI.

## Monorepo Layout

```
apps/
	web/  # React (Vite + TS)
	api/  # Node/Express (TypeScript, ESM)
	ml/   # Python FastAPI (ML service)
docs/   # Project docs + module notes
```

## Prerequisites

- Node.js LTS (18+ recommended)
- npm (comes with Node)
- Python 3.10+ (added to PATH)

## Quickstart

### 1) Frontend (Vite + React)

```powershell
cd apps/web
npm install
npm run dev
# opens http://localhost:5173
```

### 2) Backend API (Express + TS)

```powershell
cd apps/api
npm install
npm run dev
# API on http://localhost:4000
# health: http://localhost:4000/health
```

### 3) ML Service (FastAPI)

```powershell
cd apps/ml
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
# ML on http://localhost:8001
# health: http://localhost:8001/health
```

Each new terminal session: re-activate venv with `cd apps/ml && venv\Scripts\activate`.

## Branching Model

- `main` – stable releases
- `dev` – integration branch
- `modules/m01..m09` – per-module feature branches

Flow: `modules/*` → `dev` → `main`.

## Scripts (API)

- `npm run dev` – run Express (ESM) with `tsx watch`
- `npm run build` – compile TypeScript to `dist/`
- `npm start` – run compiled build

## Notes

- `.gitignore` excludes Node `node_modules`, `dist`, `.env` files, and Python `venv`, caches, and large ML artifacts.
- Module-specific docs live under `docs/modules/mXX/README.md`.

---

## What to push now (and how)

1) Make sure everything is saved and you’re on `dev`:

```powershell
git checkout dev
git status
```

Commit & push using the message above:

```powershell
git add .
git commit -m "feat(ml): scaffold FastAPI service; docs: add run instructions; chore: refine .gitignore" -m "- Added apps/ml with FastAPI, /health and placeholder predict endpoints
- Updated README with Quickstart (web/api/ml)
- Kept .gitignore ready for Node and future Python artifacts"
git push
```

Sync each module branch with the latest dev:

```powershell
git checkout dev
git pull

# m01..m09
git checkout modules/m01
git merge dev
git push
git checkout dev
# repeat for modules/m02 ... modules/m09
```