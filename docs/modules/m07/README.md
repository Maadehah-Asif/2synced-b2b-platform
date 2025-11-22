# Module 07 — Attribution & Revenue

This module contains models and APIs for deals, campaigns, campaign touches, and attribution runs/results. It supports computing project-level revenue, attributed/unattributed splits, and reporting by campaign/channel.

Files added:
- `apps/api/src/modules/m07/models/Deal.ts`
- `apps/api/src/modules/m07/models/Campaign.ts`
- `apps/api/src/modules/m07/models/CampaignTouch.ts`
- `apps/api/src/modules/m07/models/AttributionRun.ts`
- `apps/api/src/modules/m07/models/AttributionResult.ts`
- `apps/api/src/modules/m07/routes.ts`
- `apps/api/src/modules/m07/controllers.ts`

API endpoints:
- `GET /m07/stats?projectId=<id>` — returns totals (total revenue, attributed, unattributed), campaign counts, spend, latest attribution run, campaign and channel breakdowns.
- `DELETE /m07/campaigns/:id?workspace=<id>` — delete campaign (restricted to workspace `sales_manager` and `marketing_manager`).
- `DELETE /m07/deals/:id?workspace=<id>` — delete deal (restricted to workspace `sales_manager` and `marketing_manager`).

Frontend:
- `apps/web/src/modules/m07` contains a dropdown, rounded button, Page1 stats preview, and an Element1 page that displays full stats in workspace context.
# m07

## Scope

Describe the scope of m07.

## Branch

Branch naming and workflow for m07.

## Frontend paths

List frontend paths relevant to m07 (e.g., apps/web/src/modules/m07).

## Backend paths

List backend paths relevant to m07 (e.g., apps/api/src/modules/m07).

## Setup & Run

Instructions to set up and run m07.

## Notes

Additional notes and links.

## Element 2 — Attribution Runner (Page 2)

Overview
- Purpose: a control room for running the attribution engine for a workspace/project. Analysts and marketers pick a model, preview sample deals and journeys, execute a run, and inspect stored allocation results.

UI (what the user sees and does)
- Model selection: radio buttons for `First-Touch`, `Last-Touch`, `Linear` (current supported models). Each has a short description under it.
- Deal & journey preview: a small table with recent closed deals (external id, revenue, simple journey string built from `CampaignTouch` ordered by `touched_at`). This helps users trust the chosen model.
- Run Attribution button + progress area: a prominent `Run Attribution` button. On click the UI shows progress messages: "Collecting deals…", "Building journeys…", "Applying model…", "Validating totals…", and final status (Done / Error). A short summary appears (deals processed, total revenue, attributed, rows written).
- Results summary: after the run finishes the page shows a sample allocations table (Deal / Revenue / Campaign / Assigned). The UI attempts to fetch the authoritative stored rows from the backend; if unavailable it falls back to a locally computed preview.

Backend workflow (plain english, step-by-step)
0) Context: the run knows which `projectId` (workspace) and which `model` was selected.
1) Collect deals: query `Deal` documents for `project_id` and `closed_won = true` (these are the revenues to attribute).
2) Build journeys: for each deal, use its `lead_id` to fetch `CampaignTouch` rows; filter touches to campaigns that belong to the same project; sort by `touched_at` to form the ordered journey.
3) Apply model: for each deal, depending on `modelType`:
	 - `first_touch`: assign 100% to the first campaign in the journey.
	 - `last_touch`: assign 100% to the last campaign in the journey.
	 - `linear`: split equally across unique campaigns in the journey (basic rounding handled; last share adjusted to preserve total).
4) Save results: create an `AttributionRun` document (status `running` then `success`/`error`) and create `AttributionResult` rows — one per (deal, campaign, share) with `revenue_share`.
5) Validation: for each deal the system checks assigned sums against original deal revenue and increments a validation counter on mismatches.
6) Summarize: run metadata records deals processed, total revenue, total attributed, number of rows created, validation errors; this is returned to the API caller and stored on the `AttributionRun`.

API endpoints (added/used by Element 2)
- `GET /m07/preview?projectId=<id>` — returns recent closed deals and a `journey` array built from `CampaignTouch` entries (limited preview used by UI).
	- Response shape: `{ ok: true, deals: [{ dealId, deal_external_id, revenue, lead_id, closed_at, journey: [{ campaign_id, touched_at, campaignName, type }, ...] }, ...] }`
- `POST /m07/run` — request body `{ projectId, modelType }`. Runs the attribution engine and stores `AttributionRun` + `AttributionResult` rows.
	- Response shape (success): `{ ok: true, runId, runName, dealsProcessed, totalRevenue, totalAttributed, resultCount, validationErrors }`.
- `GET /m07/run/:id/results?projectId=<id>` — fetches stored `AttributionResult` rows for a given run and project, enriched with campaign names and deal external ids.
	- Response shape: `{ ok: true, results: [{ deal_id, deal_external_id, campaign_id, campaignName, revenue_share }, ...] }`

Permissions & safety notes
- Deletes: per workspace role constraints, only `head_manager` or `sales_manager` may delete campaigns or deals. This was updated to match the workspace member roles defined in `apps/api/src/modules/core/auth/models/WorkspaceMember.ts`.
- Run protection: currently the `/m07/run` endpoint is callable by whoever can call the API with a valid token. It's recommended to add an authorization check (require `head_manager` or `sales_manager`) before allowing runs in production. The UI will work without that, but adding server-side checks prevents accidental runs.

Frontend integration
- Route: `#/workspace/<workspaceId>/m07/element2` loads Page 2. The component is implemented at `apps/web/src/modules/m07/Element2Page.tsx`.
- Workflow in UI code: the page fetches `GET /m07/preview` to build the preview table. When the user clicks `Run Attribution`, the page calls `POST /m07/run` then fetches `GET /m07/run/:id/results` to display authoritative allocations; it falls back to a client-side computed preview if the backend results are unavailable.

Quick test steps (local)
1) Start API server (from `apps/api`) and web server (from `apps/web`) as you normally do.
2) Seed demo data (if needed) so the workspace has campaigns, touches and deals.
3) Open browser to: `#/workspace/<workspaceId>/m07/element2`.
4) Select a model and click `Run Attribution`.
5) Observe progress messages and the final Run Summary showing stored allocations.

Example curl requests
- Preview:
```
curl "http://localhost:4000/m07/preview?projectId=<id>"
```
- Run:
```
curl -X POST "http://localhost:4000/m07/run" -H "Content-Type: application/json" -d '{"projectId":"<id>","modelType":"linear"}'
```
- Fetch run results:
```
curl "http://localhost:4000/m07/run/<runObjectId>/results?projectId=<id>"
```

Notes and next improvements
- Protect `/m07/run` with role-based checks before allowing runs (recommended).
- Add pagination or filtering to the results endpoint for very large runs.
- Add a UI page to list past runs and inspect them (run history), and an option to re-run with the same parameters.


