# Module 06 — Attribution & Revenue

This module contains models and APIs for deals, campaigns, campaign touches, and attribution runs/results. It supports computing project-level revenue, attributed/unattributed splits, and reporting by campaign/channel.

Files added:
- `apps/api/src/modules/m06/models/Deal.ts`
- `apps/api/src/modules/m06/models/Campaign.ts`
- `apps/api/src/modules/m06/models/CampaignTouch.ts`
- `apps/api/src/modules/m06/models/AttributionRun.ts`
- `apps/api/src/modules/m06/models/AttributionResult.ts`
- `apps/api/src/modules/m06/routes.ts`
- `apps/api/src/modules/m06/controllers.ts`

API endpoints:
- `GET /m06/stats?projectId=<id>` — returns totals (total revenue, attributed, unattributed), campaign counts, spend, latest attribution run, campaign and channel breakdowns.
- `DELETE /m06/campaigns/:id?workspace=<id>` — delete campaign (restricted to workspace `sales_manager` and `marketing_manager`).
- `DELETE /m06/deals/:id?workspace=<id>` — delete deal (restricted to workspace `sales_manager` and `marketing_manager`).

Frontend:
- `apps/web/src/modules/m06` contains the UI components used by the module (dropdowns, preview tiles, Element pages for detailed views).

Overview

Element 2 — Attribution Runner (Page 2)
- Preview endpoint: `GET /m06/preview?projectId=<id>`
- Run endpoint: `POST /m06/run` (body: `{ projectId, modelType }`)
- Results endpoint: `GET /m06/run/:id/results?projectId=<id>`

Element 3 — ROI Dashboard (Page 3)
- ROI endpoint: `GET /m06/roi?projectId=<id>[&channel=&start=&end=&minSpend=&minROI=]`

Element 4 — Forecasting (Page 4)
- Forecast endpoint: `GET /m06/forecast?projectId=<id>&months=6&spendMultiplier=1&target=20`

Notes
- Protect `POST /m06/run` with role-based checks in production.
- Ensure campaigns have `spend` data available to compute ROI and forecasts.

Quick test
1) Start API and web servers.
2) Open `#/workspace/<workspaceId>/m06` and navigate to module pages (element3/element4).

# Module 06 — Attribution & Revenue

This module contains models and APIs for deals, campaigns, campaign touches, and attribution runs/results. It supports computing project-level revenue, attributed/unattributed splits, and reporting by campaign/channel.

Files added:
- `apps/api/src/modules/m06/models/Deal.ts`
- `apps/api/src/modules/m06/models/Campaign.ts`
- `apps/api/src/modules/m06/models/CampaignTouch.ts`
- `apps/api/src/modules/m06/models/AttributionRun.ts`
- `apps/api/src/modules/m06/models/AttributionResult.ts`
- `apps/api/src/modules/m06/routes.ts`
- `apps/api/src/modules/m06/controllers.ts`

API endpoints:
- `GET /m06/stats?projectId=<id>` — returns totals (total revenue, attributed, unattributed), campaign counts, spend, latest attribution run, campaign and channel breakdowns.
- `DELETE /m06/campaigns/:id?workspace=<id>` — delete campaign (restricted to workspace `sales_manager` and `marketing_manager`).
- `DELETE /m06/deals/:id?workspace=<id>` — delete deal (restricted to workspace `sales_manager` and `marketing_manager`).

Frontend:
- `apps/web/src/modules/m06` contains a dropdown, rounded button, Page1 stats preview, and an Element1 page that displays full stats in workspace context.

## Scope

Describe the scope of m06.

## Branch

Branch naming and workflow for m06.

## Frontend paths

List frontend paths relevant to m06 (e.g., apps/web/src/modules/m06).

## Backend paths

List backend paths relevant to m06 (e.g., apps/api/src/modules/m06).

## Setup & Run

Instructions to set up and run m06.

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
- `GET /m06/preview?projectId=<id>` — returns recent closed deals and a `journey` array built from `CampaignTouch` entries (limited preview used by UI).
- `POST /m06/run` — request body `{ projectId, modelType }`. Runs the attribution engine and stores `AttributionRun` + `AttributionResult` rows.
- `GET /m06/run/:id/results?projectId=<id>` — fetches stored `AttributionResult` rows for a given run and project, enriched with campaign names and deal external ids.

Permissions & safety notes
- Deletes: per workspace role constraints, only `head_manager` or `sales_manager` may delete campaigns or deals. This was updated to match the workspace member roles defined in `apps/api/src/modules/core/auth/models/WorkspaceMember.ts`.
- Run protection: currently the `/m06/run` endpoint is callable by whoever can call the API with a valid token. It's recommended to add an authorization check (require `head_manager` or `sales_manager`) before allowing runs in production. The UI will work without that, but adding server-side checks prevents accidental runs.

Frontend integration
- Route: `#/workspace/<workspaceId>/m06` loads the Module 6 main dashboard (`Module6Main`).
- Workflow in UI code: the page fetches `GET /m06/preview` to build the preview table. When the user clicks `Run Attribution`, the page calls `POST /m06/run` then fetches `GET /m06/run/:id/results` to display authoritative allocations; it falls back to a client-side computed preview if the backend results are unavailable.

## Module 06 — Attribution & Revenue

This module contains models and APIs for deals, campaigns, campaign touches, and attribution runs/results. It supports computing project-level revenue, attributed/unattributed splits, and reporting by campaign/channel.

Files added:
- `apps/api/src/modules/m06/models/Deal.ts`
- `apps/api/src/modules/m06/models/Campaign.ts`
- `apps/api/src/modules/m06/models/CampaignTouch.ts`
- `apps/api/src/modules/m06/models/AttributionRun.ts`
- `apps/api/src/modules/m06/models/AttributionResult.ts`
- `apps/api/src/modules/m06/routes.ts`
- `apps/api/src/modules/m06/controllers.ts`

API endpoints:
- `GET /m06/stats?projectId=<id>` — returns totals (total revenue, attributed, unattributed), campaign counts, spend, latest attribution run, campaign and channel breakdowns.
- `DELETE /m06/campaigns/:id?workspace=<id>` — delete campaign (restricted to workspace `sales_manager` and `marketing_manager`).
- `DELETE /m06/deals/:id?workspace=<id>` — delete deal (restricted to workspace `sales_manager` and `marketing_manager`).

Frontend:
- `apps/web/src/modules/m06` contains the UI components used by the module (dropdowns, preview tiles, Element pages for detailed views).

Overview

Element 2 — Attribution Runner (Page 2)
- Preview endpoint: `GET /m06/preview?projectId=<id>`
- Run endpoint: `POST /m06/run` (body: `{ projectId, modelType }`)
- Results endpoint: `GET /m06/run/:id/results?projectId=<id>`

Element 3 — ROI Dashboard (Page 3)
- ROI endpoint: `GET /m06/roi?projectId=<id>[&channel=&start=&end=&minSpend=&minROI=]`

Element 4 — Forecasting (Page 4)
- Forecast endpoint: `GET /m06/forecast?projectId=<id>&months=6&spendMultiplier=1&target=20`

Notes
- Protect `POST /m06/run` with role-based checks in production.
- Ensure campaigns have `spend` data available to compute ROI and forecasts.

Quick test
1) Start API and web servers.
2) Open `#/workspace/<workspaceId>/m06` and navigate to module pages (element3/element4).
	- `historical`: array of `{ month, attributed }` (monthly attributed revenue)

	- `approxMonthlySpend`: approximation of monthly campaign spend (total campaign spend divided by number of historical months)

	- `predictions`: array of future months with `{ month, attributed, attributed_min, attributed_max, spend, roi, roi_min, roi_max }`

