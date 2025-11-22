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

## Element 3 — ROI Dashboard (Page 3)

Implemented features
- Purpose: historical ROI analysis and campaign-level performance. Consumes attribution results (from Element 2) and campaign spend to compute ROI, profit, and channel contributions.
- Endpoint: `GET /m07/roi?projectId=<id>[&channel=&start=&end=&minSpend=&minROI=]` returns campaign metrics, monthly attributed series, channel contributions, and top/bottom lists.
- Frontend: `apps/web/src/modules/m07/Element3Page.tsx` displays tiles (total attributed, spend, ROI), a campaign ROI table, top/bottom performers, a monthly trend chart, and basic filtering controls.

Validation & constraints (Element 3)
- Requires attribution results to exist for the project. If none are found the endpoint returns `400 { error: 'no_attribution' }` with a message instructing to run attribution first.
- Requires at least one campaign with `spend > 0`. If no campaigns report spend the endpoint returns `400 { error: 'no_campaign_spend' }` and a message to add campaign spend.
- Filters: `channel` (single or comma-separated), `start` and `end` (YYYY-MM), `minSpend` (numeric), `minROI` (percent). These are applied server-side when computing the campaigns list and monthly series.

## Element 4 — ROI Forecasting Dashboard (Page 4)

Implemented features
- Purpose: single-page forecasting dashboard that projects future ROI (3–6 months by default), shows confidence intervals, provides alerts when forecasts cross targets, and supports simple scenario testing (spend multiplier).
- Endpoint: `GET /m07/forecast?projectId=<id>&months=6&spendMultiplier=1&target=20` returns:
	- `historical`: array of `{ month, attributed }` (monthly attributed revenue)
	- `approxMonthlySpend`: approximation of monthly campaign spend (total campaign spend divided by number of historical months)
	- `predictions`: array of future months with `{ month, attributed, attributed_min, attributed_max, spend, roi, roi_min, roi_max }`
	- `model`: metadata (`name`, `trained_at`, `mae`, `mse`)
	- `alerts`: list of textual warnings (e.g., forecast drops below `target`)
	- `trend`: `up|down|stable` indicator
- Frontend: `apps/web/src/modules/m07/Element4Page.tsx` (new) contains:
	- Summary tiles: projected ROI next month, trend indicator, 80% confidence range, model accuracy tile.
	- Model Control Panel: shows current model, last trained date, and a placeholder "Retrain" button.
	- Forecast Chart: simple SVG chart plotting historical ROI and predicted ROI with a shaded confidence band.
	- Forecast Table: month-by-month predicted ROI with CI and trend arrows.
	- Alerts & Insights: automated insights (e.g., "ROI projected to fall below target in 2 months").
	- Scenario Testing (basic): change `spendMultiplier` and re-run to see impact; UI exposes months-ahead and multiplier inputs.
	- Actions: Download CSV and link back to ROI Dashboard (Page 3).

How forecasting works (plain language)
- The endpoint reads historical monthly attributed revenue (built from `AttributionResult` joined with `Deal.closed_at`).
- It requires at least 6 months of history; otherwise it returns `400 { error: 'insufficient_history' }`.
- It fits a simple linear regression to attributed revenue (time → attributed revenue), predicts future attributed revenue for the selected months ahead, and computes ROI for future months as `(predicted_attributed - approx_monthly_spend) / approx_monthly_spend * 100`.
- Confidence intervals (80%) are computed from regression residuals and returned per-month. Alerts are raised when predicted ROI falls below the `target` query parameter.

Validation & constraints (Element 4)
- REQUIRED: At least 6 months of historical attributed revenue must exist. If not, the endpoint returns `400 { error: 'insufficient_history' }`.
- Project-level spend is approximated as total campaign `spend` divided evenly across historical months. For campaign-level forecasting users should provide campaign-level monthly spend history (not currently implemented) — the approximation is documented in the UI.
- The forecasting model provided is a simple linear regression used for quick, explainable predictions. This is a safe default for a demo/preview; production should replace with ARIMA/Prophet or trained ML models, stored model metadata, and recorded training accuracy.

Next improvements (suggested)
- Persist training and model artifacts (serialize model, store accuracy metrics and last trained date) and enable server-side retrain with a dedicated job worker.
- Add campaign-level historical spend and attributed time-series to support campaign-level forecasts and better scenario testing (pause campaign, shift budget).
- Add more robust forecasting models (Prophet/ARIMA) and expose a model selector in the UI that maps to server-side implementations.

Usage notes
- Start by ensuring Page 2 (Attribution) has been run recently and campaigns have proper `spend` values.
- Visit `#/workspace/<workspaceId>/m07/element4` to see the Forecasting Dashboard.



