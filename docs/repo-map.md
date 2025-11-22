# Repository Map — 2Synced (generated)

This document maps the repository structure, key files, runtime entrypoints, principal dataflows, and environment variables. Use this as a quick reference for onboarding, debugging, or making changes.

**Top Level**:
- `apps/`: All runnable apps (web, api, ml).
- `docs/`: Per-module documentation and this generated map.
- `README.md`: Project overview and run instructions.

**apps/api (Backend — Express + TypeScript)**
- Entry: `apps/api/src/index.ts` — sets up Express, routes, DB connection.
- Config: `apps/api/src/config/env.ts` (env loader/validation), `apps/api/src/config/db.ts` (MongoDB connection via Mongoose).
- Package: `apps/api/package.json` — `dev` uses `tsx watch src/index.ts` (ESM).
- Types: `apps/api/src/types/multer.d.ts` (multer typing).
- Feature modules: `apps/api/src/modules/` contains `core/` (auth, workspaces, shared utils) and `m01..m09/` (feature modules).

Key backend pieces:
- Auth: `apps/api/src/modules/core/auth/` — `routes.ts`, `controllers.ts`, `models/` (`User.ts`, `Workspace.ts`, `WorkspaceMember.ts`), `utils/` (JWT/password).
- Workspaces: `apps/api/src/modules/core/workspaces/` — workspace creation, join requests, members management.
- Module M01 (ingestion & leads): `apps/api/src/modules/m01/` — `routes.ts`, `controllers.ts`, `models/` (uploads, merged files, mapping templates, leads outputs), `targetSchema.ts`.
  - Uses GridFS buckets for file storage: `m01_uploads`, `m01_merged`, `m01_leads`, `m01_leads_inputs`, `m01_leads_outputs`.
  - Merge flow: uploads -> preview -> mapping templates -> merge -> save merged CSV -> generate ML input -> run local Python script -> persist model outputs -> create leads CSV.

- Module M07 (attribution & revenue): `apps/api/src/modules/m07/` — new models and APIs for `Deal`, `Campaign`, `CampaignTouch`, `AttributionRun`, `AttributionResult`, plus `GET /m07/stats` for Page 1 aggregates and protected delete endpoints.

Security & Auth:
- JWT signing/verification: `apps/api/src/modules/core/auth/utils/jwt.ts` — uses `ENV.JWT_SECRET`.
- Password hashing: `apps/api/src/modules/core/auth/utils/password.ts` (bcryptjs).
- Auth routes: `/auth/signup`, `/auth/login`, `/auth/me`, `/auth/google`, `/auth/google/callback`.

Environment variables (critical):
- `MONGO_URI`, `DB_NAME`, `JWT_SECRET`, `PORT` (see `apps/api/src/config/env.ts`).
- Optional for Google OAuth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT`, `FRONTEND_URL`.
- Frontend: `apps/web/.env` may include `VITE_API_URL`.
- ML: `apps/ml` uses Python env and may use `M01_ML_PYTHON` to point to python executable.

**apps/web (Frontend — React + Vite + TypeScript)**
- Entry: `apps/web/src/main.tsx` -> `apps/web/src/App.tsx` (simple hash-based router).
- Package: `apps/web/package.json` (Vite dev server `npm run dev` at port 5173 by default).
- Structure: `apps/web/src/modules/` mirrors backend modules: `core/` (auth, landing, profile) and `m01..m09/` for feature UIs.
- Key UI files for M01: `Upload.tsx`, `UploadPreview.tsx`, `MergedList.tsx`, `LeadsList.tsx`, `MergeCSV.tsx`.

Frontend ↔ Backend interactions:
- Frontend calls API endpoints under the API base URL (set via `VITE_API_URL`).
- Auth token (JWT) is passed as `Authorization: Bearer <token>` for protected endpoints.

**apps/ml (ML Service — Python + FastAPI)**
- FastAPI router: `apps/ml/api/routes.py` — endpoints `/health`, `/predict/lead`, `/predict/intent`.
- Local module inference: `apps/ml/modules/m01/inference/` contains `loader.py` and `predict.py` used by the FastAPI router.
- Training scripts: `apps/ml/m01/` contains training & model scripts (e.g., `model_randomforest.py`, `testing_catboost.py`).
- Model registry: `apps/ml/modules/m01/inference/loader.py` expects a `models/registry.json` and a folder layout `models/<module>/<version>/model.joblib`.

How ML integrates with backend (notable flow in M01):
- Backend `m01.generateLeadsCode` writes `sample_input.csv` under `apps/ml/data/input/` and calls a Python script (`testing_catboost.py`) by spawning `python` in `apps/ml`.
- The Python script reads the input, writes `output.csv` to `apps/ml/data/output/`, and the backend reads that output and persists predictions to GridFS.
- There are two integration patterns: a) direct subprocess invocation (used by `m01/controllers.ts`) and b) HTTP inference via FastAPI (`apps/ml/api/routes.py`) — both exist but `m01` currently uses subprocess for the local test flow.

**Docs & Per-module notes**
- `docs/modules/` contains `m01..m09/README.md` for module-specific notes.

**Data storage**
- Primary DB: MongoDB (Mongoose). Collections and models are defined under `apps/api/src/modules/*/models`.
- Large files (CSV uploads, merged outputs, model inputs/outputs) are saved in MongoDB GridFS buckets (buckets named per purpose like `m01_uploads`).

**Developer tips / run commands**
- Start web (dev):
  - `cd apps/web` then `npm install` then `npm run dev` (Vite on port 5173).
- Start API (dev):
  - `cd apps/api` then `npm install` then `npm run dev` (tsx watch, API on port 4000). Ensure `.env` with `MONGO_URI`, `DB_NAME`, `JWT_SECRET` exists.
- Start ML (dev):
  - `cd apps/ml` then create venv and `pip install -r requirements.txt`, then `uvicorn m01.main:app --reload --port 8001`.

**Next recommended actions (optional)**
- Add a `docs/repo-map.md` (this file) to source control (already created).
- Add small README.md files in `apps/api/src/modules/m02..m09/` explaining expected behavior.
- Consider replacing subprocess model invocation with HTTP calls to the ML FastAPI service for clearer separation.

If you'd like, I can:
- Expand this map with a UML-style diagram or sequence diagrams for the M01 merge → model → leads flow.
- Open a PR with this file and minor README improvements.

Generated on: 2025-11-19
