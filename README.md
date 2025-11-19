# 2Synced – B2B Marketing Automation (Monorepo)

2Synced is an AI-powered B2B marketing platform that helps SME teams ingest leads, score them, understand intent, analyze conversations, track attribution/ROI, and ship data-driven optimizations.

## Why this project exists

Sales and marketing teams collect leads from many places (CSV uploads, CRM, ads, web). It’s hard to clean/merge data, prioritize leads, measure intent, keep conversations moving, and prove ROI. 2Synced gives a single place to: ingest/clean, compute features, score leads with ML, track pipeline intent and conversation health, run attribution/ROI, and generate clear reports.

## Tech stack (high level)

- Frontend: React + Vite + TypeScript (`apps/web`)
- Backend API: Node.js + Express + TypeScript (ES Modules with `tsx`) (`apps/api`)
- ML Service: Python + FastAPI (training & inference) (`apps/ml`)
- Version control: Git (main / dev / modules branches)

Dev ports (default):
- Web: 5173
- API: 4000
- ML: 8001

## Repository layout

```
apps/
	web/            # React (Vite + TS). UI and client-side routes.
		src/modules/  # m01..m09 feature folders (frontend)
	api/            # Express (TypeScript, ESM). REST API for the UI.
		src/modules/  # m01..m09 feature folders (backend)
	ml/             # FastAPI service. ML training/inference endpoints.
		api/          # FastAPI routers (e.g., /health, /predict/*)
		models/       # Trained models & artifacts (gitignored)
		data/         # Raw/processed datasets (gitignored)
docs/
	modules/        # Per-module notes (m01..m09)
.gitignore
README.md
```

🟩 <repo-root>/
├─ 🟩 apps/
│  ├─ 🟩 web/
│  │  └─ 🟩 src/
│  │     └─ 🟩 modules/
│  │        ├─ m01/ (.gitkeep)
│  │        ├─ m02/ (.gitkeep)
│  │        ├─ ...
│  │        └─ m09/ (.gitkeep)
│  │
│  ├─ 🟩 api/
│  │  └─ 🟩 src/
│  │     ├─ 🟩 index.ts
│  │     └─ 🟩 modules/
│  │        ├─ m01/ (.gitkeep)
│  │        ├─ m02/ (.gitkeep)
│  │        ├─ ...
│  │        └─ m09/ (.gitkeep)
│  │
│  └─ 🟩 ml/
│     ├─ 🟩 api/
│     ├─ 🟩 models/
│     ├─ 🟩 data/
│     ├─ 🟩 utils/
│     └─ 🟩 notebooks/
│        └─ (.gitkeep in each)
│
├─ 🟩 docs/
│  ├─ 🟩 README.md
│  ├─ 🟩 git-setup.md
│  └─ 🟩 modules/
│     ├─ m01/README.md
│     ├─ ...
│     └─ m09/README.md
│
├─ 🟩 .gitignore
└─ 🟩 README.md
```
## Getting started

### Prerequisites

- Node.js 18+ (comes with npm)
- Python 3.10+ (added to PATH)
- Git

Windows tip: open a PowerShell at the repo root. Use quotes if your path has spaces.

### Install & run — step by step

1) Clone and pick the `dev` branch

```bash
git clone <your-repo-url>
cd 2synced-b2b-platform
git checkout dev
```

2) Frontend (React + Vite)

```powershell
cd apps/web
npm install
npm run dev
# Dev server: http://localhost:5173
```

3) Backend API (Express + TypeScript, ESM)

```powershell
cd ../api
npm install
npm run dev
# API: http://localhost:4000
# Health: http://localhost:4000/health
```

4) 🧠 ML Service (FastAPI) Setup — Final Version

This section explains how to run the Machine Learning (FastAPI) service in `apps/ml`.

📦 1. Create & Activate Virtual Environment

Do this only once when setting up locally.

```powershell
cd apps/ml
python -m venv venv
venv\Scripts\activate      # Windows (PowerShell)
# source venv/bin/activate  # macOS/Linux
```

Every time you open a new terminal session, re-activate the venv:

```powershell
cd apps/ml
venv\Scripts\activate
```

📚 2. Install Dependencies (Don’t Freeze Again)

Since all dependencies are already frozen in `requirements.txt`, simply install them directly:

```powershell
pip install -r requirements.txt
```

✅ This ensures that everyone’s environment matches exactly — no need to re-run `pip freeze` unless you intentionally add new dependencies. (See the repository `requirements.txt` for the pinned packages.)

## Quick tests

API health:

```bash
curl http://localhost:4000/health
# -> {"ok":true}
```

ML health:

```bash
curl http://localhost:8001/health
# -> {"status":"ok"}
```

ML lead score (example):

```bash
curl -X POST http://localhost:8001/predict/lead -H "Content-Type: application/json" -d '{"email":"test@example.com"}'
# -> {"lead_score":0.85} (placeholder)
```
🗄️ Backend API (MongoDB + Express)
Folder structure
apps/api/
 ├─ src/
 │  ├─ index.ts          # main Express server
 │  ├─ config/
 │  │  ├─ env.ts         # loads .env and validates variables
 │  │  └─ db.ts          # MongoDB connection logic
 │  └─ modules/          # feature folders (m01..m09)
 ├─ .env                 # secrets (not committed)
 ├─ package.json
 ├─ tsconfig.json
 └─ node_modules/

Environment file (create this manually)

apps/api/.env

PORT=4000
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net
DB_NAME=twosynced_dev
## Environment variables

Create `.env` files (they are gitignored):

- `apps/api/.env` – e.g. `PORT=4000`, `DB_URL=...`
- `apps/web/.env` – e.g. `VITE_API_URL=http://localhost:4000`
- `apps/ml/` typically uses CLI args or `.env` with python-dotenv (optional)

After setting `VITE_API_URL`, restart `npm run dev` in `apps/web`.

## Branch model

- `main` – stable releases only
- `dev` – integration branch
- `modules/m01..m09` – per-module work branches

Flow: `modules/*` → `dev` → `main`

## Common scripts

API (`apps/api`)

```bash
npm run dev      # run with tsx (ESM)
npm run build    # compile TS to dist/
npm start        # run compiled build
```

Web (`apps/web`)

```bash
npm run dev      # vite dev server
npm run build    # production build to dist/
npm run preview  # preview built app
```

ML (`apps/ml`)

```powershell
venv\Scripts\activate
uvicorn main:app --reload --port 8001
```

## Troubleshooting

### Port already in use

Change ports (`--port 8010`) or stop the other process.

### `uvicorn` / `fastapi` not found

Activate venv first, then install:

```powershell
cd apps/ml
venv\Scripts\activate
pip install fastapi uvicorn
```

### API import errors (TypeScript)

Ensure `apps/api/package.json` has `"type": "module"` and you use:

```json
"scripts": { "dev": "tsx watch src/index.ts" }
```

And `tsconfig.json` uses:

```json
{ "module": "NodeNext", "moduleResolution": "NodeNext" }
```

### Web can’t reach API

Set `VITE_API_URL` in `apps/web/.env` to `http://localhost:4000`, restart Vite.

## Contributing (internal team)

1. Create/checkout your module branch:

```bash
git checkout -b modules/m0X  # base: dev
```

2. Work in your module folders:

- Frontend: `apps/web/src/modules/m0X`
- Backend: `apps/api/src/modules/m0X`
- ML (if needed): `apps/ml/api`, `apps/ml/models`, `apps/ml/utils`

3. Commit and push. Open a PR `modules/m0X` → `dev`.

4. When stable, merge `dev` → `main` for a release.

---

If you want, I can now:

- run a markdown linter / preview for both `README.md` and `docs/git-setup.md` and fix minor style issues
- create a new branch, stage these changes and open a PR for review

