# 2Synced – Git Setup & Project Timeline

This file records the exact steps I followed while setting up the repository, branches, folder structure, scaffolds, and fixing every error that came along the way.

It’s written as a **timeline**, showing the exact sequence of what I did and how each issue was resolved.

---

## 🕒 Timeline of setup

### 🧩 Step 1 — Creating the repository and branches

1. Repository
    - I created the GitHub repository named **`b2b2synced-b2b-platform`**.
    - Description used:
       - *“AI-powered B2B marketing automation platform for SMEs to optimize leads, campaigns, and ROI.”*

2. Default branch behavior
    - By default, GitHub initializes a **main** branch, but since my first commit was on a new branch called `dev`, GitHub didn’t automatically create `main`.
    - Notes:
       - GitHub only auto-creates `main` when the repository has an initial commit (for example, a README).
       - Since the repo started empty, I had to create `main` myself.

3. Create `dev`
    - Commands used:

       ```
       git checkout -b dev
       git add .
       git commit -m "chore: initial commit"
       git push -u origin dev
       ```

    - Error encountered after the first attempt:

       ```
       error: src refspec dev does not match any
       ```

       - Cause: I hadn’t committed anything yet.
       - Fix: I made the first commit, then pushed again — this time it worked.

4. Create `main` and set as default
    - Commands used:

       ```
       git checkout -b main
       git push -u origin main
       ```

    - After creating `main`, I changed the default branch in GitHub settings to `main`.

5. Create module branches from `dev`
    - Commands used (repeat for modules m01 → m09):

       ```
       git checkout dev
       git pull
       git checkout -b modules/m01
       git push -u origin modules/m01
       git checkout dev
       ```

    - Explanation:
       - Each module branch starts from `dev`, so that when we merge, all modules follow the flow: modules → dev → main.
       - If module branches didn’t start from `dev`, their histories would diverge and make merging harder.

---

### 🧱 Step 2 — Creating the manual folder structure

- Before running any npm or pip commands, I made the base folder structure manually (with `.gitkeep` files inside empty directories so Git could track them).

Here’s what the project structure looked like at this point:

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

- I used a Copilot Agent prompt to create only the manual folders (no npm/pip installs yet). This helped keep the structure clean before any scaffolding.

---

### ⚛️ Step 3 — Setting up the web app (frontend: React + Vite + TypeScript)

- Navigate to the web app folder:

   ```
   cd apps/web
   ```

- Create the frontend scaffold:

   ```
   npx create-vite@latest . -- --template react-ts
   ```

- When prompted during scaffold:
   - “Current directory is not empty” → chose “Ignore files and continue”
   - “Use Rolldown-Vite (Experimental)?” → chose No

   - Explanation: choosing “Ignore files and continue” ensured manual folders (like `modules/m01..m09`) stayed safe. Rolldown-Vite is experimental; we skipped it for stability.

- Install dependencies:

   ```
   npm install
   ```

- Verify the dev server:

   ```
   npm run dev
   ```

   - Result: the dev server started at http://localhost:5173.

- Return to repository root:

   ```
   cd ../..
   ```

---

### 🧠 Step 4 — Setting up the API (backend: Express + TypeScript)

- Enter backend folder:

   ```
   cd apps/api
   ```

- Initialize npm and install dependencies:

   ```
   npm init -y
   npm install express cors
   npm install -D typescript @types/node @types/express @types/cors tsx
   ```

- Create TypeScript config:

   ```
   npx tsc --init --rootDir src --outDir dist --esModuleInterop --module NodeNext --target ES2020
   ```

- Create `src/index.ts`:

   ```
   import express from "express";
   import cors from "cors";

   const app = express();
   app.use(cors());
   app.use(express.json());

   app.get("/health", (_req, res) => res.json({ ok: true }));

   const PORT = process.env.PORT || 4000;
   app.listen(PORT, () => console.log(`API running on port ${PORT}`));
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

   (If a module has no changes yet, these will fast-forward cleanly.)

   ---

   ## README (project root)

   See `README.md` at repository root for run instructions and Quickstart.
