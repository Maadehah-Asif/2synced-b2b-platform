export type GuidedAssistantFaq = {
  id: string;
  label: string;
  answer: string;
  followUpIds?: string[];
};

type FaqPageConfig = {
  title: string;
  intro: string;
  rootFaqIds: string[];
  faqs: GuidedAssistantFaq[];
};

function faq(id: string, label: string, answer: string, followUpIds: string[] = []): GuidedAssistantFaq {
  return { id, label, answer, followUpIds };
}

const MODULE_TOPIC_ROOTS = [
  "topic-m01",
  "topic-m02",
  "topic-m06",
  "topic-m07",
];

const CONVERSATION_FAQS: GuidedAssistantFaq[] = [
  faq(
    "topic-m01",
    "I want help with lead quality and scoring",
    "Lead Quality & Scoring is about preparing lead data so the rest of the workspace can trust it. I can guide you through the workflow, show you where users enter data, or explain what each screen means.",
    ["m01-flow", "m01-inputs", "m01-screens"]
  ),
  faq(
    "topic-m02",
    "I want help with intent scoring and prioritization",
    "Intent Signals turns lead and behavior data into prioritization decisions. I can guide you through the workflow, show you where users enter data, or explain what each screen means.",
    ["m02-flow", "m02-inputs", "m02-screens"]
  ),
  faq(
    "topic-m06",
    "I want help with revenue attribution and ROI",
    "Revenue Insight includes both data intake screens and revenue analysis screens. I can guide you through the workflow, show you where users enter data, or explain what each screen means.",
    ["m06-flow", "m06-inputs", "m06-screens"]
  ),
  faq(
    "topic-m07",
    "I want help with funnel and leakage analysis",
    "Funnel Insight depends on leads, stage history, and interactions being correct. I can guide you through the workflow, show you where users enter data, or explain what each screen means.",
    ["m07-flow", "m07-inputs", "m07-screens"]
  ),

  faq(
    "m01-flow",
    "I want to understand the Lead Quality & Scoring workflow",
    "The best Lead Quality & Scoring flow is: 1. upload raw lead CSV files, 2. preview each upload to confirm rows and headers, 3. merge uploads when the same lead data is split across files, 4. review the merged dataset, 5. create the lead-ready dataset from a merged file, and 6. open the lead records preview before moving into later workflows. Lead Quality & Scoring is meant to clean and stabilize lead intake before intent, attribution, or funnel analysis uses the same records.",
    ["m01-upload-screen", "m01-merge-screen", "m01-merged-screen", "m01-leads-screen"]
  ),
  faq(
    "m01-inputs",
    "I want to know where to enter data for Lead Quality & Scoring",
    "Lead Quality & Scoring data input starts on the Uploads screen. Users add raw CSV files there. If the lead information is split across files, the next input step is the Merge CSV screen, where users pick a matching column and map source columns into the merged schema. After a merged file is ready, the Leads Code screen creates the lead-ready dataset that Lead Quality & Scoring will use downstream.",
    ["m01-upload-screen", "m01-merge-screen", "m01-leads-screen"]
  ),
  faq(
    "m01-screens",
    "I want a Lead Quality & Scoring screen explained",
    "Choose the Lead Quality & Scoring screen you want help with.",
    ["m01-home-screen", "m01-upload-screen", "m01-preview-screen", "m01-merge-screen", "m01-merged-screen", "m01-leads-screen"]
  ),
  faq("m01-home-screen", "I want to understand the Lead Quality & Scoring home screen", "The Lead Quality & Scoring home is a guidance screen. It tells the user that this area is for lead quality and scoring readiness, not advanced analytics. The page mainly points the user to the Lead View and reminds them that upload and merge work should happen first."),
  faq("m01-upload-screen", "I want to understand the Lead Quality & Scoring Uploads screen", "The Uploads screen is the first operational step for Lead Quality & Scoring. Users add raw CSV files, see active and archived uploads, preview file contents, inspect details, archive old files, and select at least two uploads when they want to merge them. This is the right place to start when the user has new lead-source files."),
  faq("m01-preview-screen", "I want to understand the Lead Quality & Scoring preview screen", "The preview screen is a verification step. It lets the user inspect rows, headers, pagination, and table width before continuing. This is where users catch bad headers, empty values, or wrong row structure before trusting the file in a merge or lead-generation step."),
  faq("m01-merge-screen", "I want to understand the Lead Quality & Scoring merge screen", "The Merge CSV screen is where the user combines multiple uploaded files into one dataset. First they choose the matching column for each file so the system knows how rows should join together. After that they map source columns into the merged target schema. Users should come here only after previewing the uploads and confirming which files belong together."),
  faq("m01-merged-screen", "I want to understand the Lead Quality & Scoring merged data screen", "The merged datasets screen is the library of combined outputs. Users can search merged files, inspect who created them, see when they were created, and open a merged preview. This screen answers: which merged dataset should I trust and use next?"),
  faq("m01-leads-screen", "I want to understand the Lead Quality & Scoring leads screen", "The Leads Code screen creates the lead-ready dataset from a merged file. The user selects one merged dataset, optionally names the new lead-ready output, and creates it. After that, they can preview the lead records and then move to downstream workflows that depend on clean lead data."),

  faq(
    "m02-flow",
    "I want to understand the Intent Signals workflow",
    "The best Intent Signals flow is: 1. prepare lead and behavior inputs in the upload and wizard screens, 2. make sure the required headers are mapped correctly, 3. generate intent scores from a prepared dataset, 4. open the prioritization dashboard to rank leads, and 5. use the intent forecast screen when the user wants a forward-looking view of intent direction. Intent Signals should be used after lead intake is already stable.",
    ["m02-upload-screen", "m02-wizard-screen", "m02-generate-screen", "m02-prioritization-screen", "m02-forecast-screen"]
  ),
  faq(
    "m02-inputs",
    "I want to know where to enter data for Intent Signals",
    "Users can add raw Intent Signals files on the Uploads screen, but the more guided setup is the Upload Wizard. In the wizard, the user chooses whether they are uploading a Leads plus Intent file or a Behavior Events file, then maps the required headers before import. Quick uploads also exist from the prioritization dashboard, but the wizard is better when the user needs to confirm mappings carefully.",
    ["m02-upload-screen", "m02-wizard-screen", "m02-prioritization-screen"]
  ),
  faq(
    "m02-screens",
    "I want an Intent Signals screen explained",
    "Choose the Intent Signals screen you want help with.",
    ["m02-home-screen", "m02-upload-screen", "m02-wizard-screen", "m02-generate-screen", "m02-prioritization-screen", "m02-forecast-screen"]
  ),
  faq("m02-home-screen", "I want to understand the Intent Signals home screen", "The Intent Signals home is the entry point for intent analysis. It tells the user that raw uploads now live in the workspace Data Hub, while this area focuses on generating scores, prioritizing leads, and reviewing forecast-style outputs."),
  faq("m02-upload-screen", "I want to understand the Intent Signals Uploads screen", "The Uploads screen stores the raw intent and behavior CSV batches. Users can upload files, preview them, archive them, restore them, and select multiple uploads for merging. This is the first stop when the user receives new source files for Intent Signals."),
  faq("m02-wizard-screen", "I want to understand the Intent Signals Upload Wizard", "The Upload Wizard is the most guided input screen in Intent Signals. The user first chooses the upload type: Leads plus Intent or Behavior Events. Then they preview headers and sample rows, map the required columns, choose the row range, and import the file into the expected schema. This screen is best when the user needs confidence that the incoming file matches the system correctly."),
  faq("m02-generate-screen", "I want to understand the Generate Intent Scores screen", "This screen runs the scoring step. The user selects a prepared dataset, confirms the file details, and then runs the intent scoring engine. After the run, the screen shows a preview of the generated output so the user can verify the scoring result before using it in prioritization."),
  faq("m02-prioritization-screen", "I want to understand the Prioritization Dashboard", "The prioritization dashboard is where users act on the scoring output. It ranks leads by intent, engagement, and recent behavior so the team can see who deserves attention next. It also includes quick-upload shortcuts, but the main purpose of the screen is decision-making, filtering, and lead ranking."),
  faq("m02-forecast-screen", "I want to understand the Intent Forecast screen", "The intent forecast screen is for forward-looking analysis. The user picks an intent run, chooses a scope such as all leads or one segment, asks the forecasting engine a question, and generates a forecast summary. This is the screen to use when the user wants to estimate where interest is heading, not when they are still preparing raw inputs."),

  faq(
    "m06-flow",
    "I want to understand the Revenue Insight workflow",
    "For Revenue Insight, the cleanest order is: 1. make sure shared leads exist, 2. add campaigns, 3. add campaign touches, 4. add deals, 5. check the journey preview if the user wants to confirm the touch path, 6. run attribution, and 7. move into the overview, ROI, forecast, or allocation screens. The operational records must be correct first, otherwise the analytics screens will look empty or misleading.",
    ["m06-leads-screen", "m06-campaigns-screen", "m06-touches-screen", "m06-deals-screen", "m06-run-screen", "m06-roi-screen"]
  ),
  faq(
    "m06-inputs",
    "I want to know where to enter data for Revenue Insight",
    "Users input Revenue Insight data in the shared operational workspaces: Unified Lead Intake for leads, Campaign Operations for campaigns, Campaign Touch Operations for touches, and Deal Operations for revenue records. Those four screens create the data foundation. After that, the user moves into journey preview, attribution runs, ROI, forecasts, and allocation.",
    ["m06-leads-screen", "m06-campaigns-screen", "m06-touches-screen", "m06-deals-screen"]
  ),
  faq(
    "m06-screens",
    "I want a Revenue Insight screen explained",
    "Choose the Revenue Insight screen you want help with.",
    ["m06-home-screen", "m06-leads-screen", "m06-campaigns-screen", "m06-touches-screen", "m06-deals-screen", "m06-overview-screen", "m06-run-screen", "m06-roi-screen", "m06-forecast-screen", "m06-allocation-screen", "m06-journey-screen"]
  ),
  faq("m06-home-screen", "I want to understand the Revenue Insight home screen", "The Revenue Insight home explains that this area is for revenue attribution and ROI interpretation. It points the user toward dashboard, ROI, forecast, journey, run attribution, and allocation pages, and reminds them that campaign, touch, deal, and shared lead intake should already be prepared first."),
  faq("m06-leads-screen", "I want to understand Unified Lead Intake", "Unified Lead Intake is the shared lead table used by Revenue Insight and Funnel Insight. The user can review existing lead records, add a single lead manually, or validate and import a lead CSV. This is the right screen when a campaign, touch, deal, stage, or interaction needs to reference a lead that does not exist yet."),
  faq("m06-campaigns-screen", "I want to understand Campaign Operations", "Campaign Operations is where the user maintains campaign records. The screen includes a campaign table, a manual form, and a CSV import flow. Users should come here before touches or attribution runs, because touches and ROI logic need valid campaigns to attach to."),
  faq("m06-touches-screen", "I want to understand the touch workspace", "Campaign Touch Operations is where the user records marketing touches such as email opens, clicks, webinar events, or form submits. The user can review touches in a table, create one touch manually, or upload a touch CSV. Touches are essential for journey building and attribution."),
  faq("m06-deals-screen", "I want to understand Deal Operations", "Deal Operations is where the user stores revenue records. The screen supports a deal table, single-deal form, and CSV import. A deal should be linked to an existing lead and should contain revenue, currency, win state, and close date. Attribution and ROI screens depend heavily on this data."),
  faq("m06-overview-screen", "I want to understand the main revenue dashboard", "The main revenue dashboard is the overview screen. It summarizes revenue movement and channel contribution so the user can understand the current picture before drilling deeper into ROI, forecasting, journeys, or budget allocation."),
  faq("m06-run-screen", "I want to understand the attribution run screen", "The Attribution Run Builder is where the user runs the attribution engine. They choose the model, preview deal and journey context, and launch the run. This screen should only be used after campaigns, touches, leads, and deals are already linked correctly."),
  faq("m06-roi-screen", "I want to understand the ROI dashboard", "The ROI dashboard compares spend against attributed revenue. It helps the user answer which campaigns and channels are creating return, which ones are underperforming, and where profit is strongest or weakest."),
  faq("m06-forecast-screen", "I want to understand the forecast screen", "The forecast screen projects revenue and ROI trends using the current attribution context. Users come here after they already trust the underlying attribution and spend data and want to estimate what happens next."),
  faq("m06-allocation-screen", "I want to understand the allocation screen", "The allocation dashboard is for budget-allocation insight. It helps the user compare where spend is currently going versus where results suggest spend should be focused."),
  faq("m06-journey-screen", "I want to understand the journey preview screen", "The journey screen helps the user inspect the touch path behind deals. It is useful for checking whether the touch history looks believable before or after attribution results are reviewed."),

  faq(
    "m07-flow",
    "I want to understand the Funnel Insight workflow",
    "The best Funnel Insight flow is: 1. make sure shared leads exist, 2. add or correct stage history records, 3. add or correct interaction records, 4. open Funnel Overview to understand current stage occupancy, 5. move into Leakage, Journey, Fatigue, Recommendations, or Trends depending on the question, and 6. return to the input screens if the user discovers bad records. Funnel Insight is strongest when the input history is already clean and chronological.",
    ["m07-stage-screen", "m07-interaction-screen", "m07-overview-screen", "m07-leakage-screen", "m07-journey-screen"]
  ),
  faq(
    "m07-inputs",
    "I want to know where to enter data for Funnel Insight",
    "Funnel Insight still has two main input workspaces: Stage History and Interactions. Shared lead input now lives in Unified Lead Intake, because Revenue Insight and Funnel Insight use the same lead records. So if a lead is missing, start there. If the funnel path is wrong, fix stage history. If the activity trail is wrong, fix interactions.",
    ["m06-leads-screen", "m07-stage-screen", "m07-interaction-screen"]
  ),
  faq(
    "m07-screens",
    "I want a Funnel Insight screen explained",
    "Choose the Funnel Insight screen you want help with.",
    ["m07-home-screen", "m07-stage-screen", "m07-interaction-screen", "m07-overview-screen", "m07-leakage-screen", "m07-journey-screen", "m07-fatigue-screen", "m07-recommendations-screen", "m07-trends-screen"]
  ),
  faq("m07-home-screen", "I want to understand the Funnel Insight home screen", "The Funnel Insight home tells the user that this area is for funnel interpretation, not for broad data maintenance. It points the user to Funnel Overview, Leakage Analysis, Lead Journey Explorer, Fatigue Analysis, Recommendations, and Funnel Trends, and reminds them to return to input screens when records need fixing."),
  faq("m07-stage-screen", "I want to understand the Stage History workspace", "The Stage History workspace is where the user manages funnel stage records. It contains a table view, a manual add form, and a CSV import flow. This is the correct place when the user needs to say when a lead entered a stage, exited it, dropped out, or moved into the next stage."),
  faq("m07-interaction-screen", "I want to understand the Interaction workspace", "The Interaction workspace is where the user manages calls, emails, meetings, demos, and related engagement activity. It supports a table view, a manual add form, and CSV import. This screen should be used when the user wants the funnel analysis to reflect actual activity history."),
  faq("m07-overview-screen", "I want to understand Funnel Overview", "Funnel Overview is the first analysis screen to open in Funnel Insight. It summarizes stage occupancy, conversion flow, lead distribution, and drilldown tables so the user can see where the pipeline currently stands before investigating one specific issue."),
  faq("m07-leakage-screen", "I want to understand Leakage Analysis", "Leakage Analysis is for finding where leads are being lost. It is the right screen when the user wants to know which stage is leaking, where drop-off is highest, or which part of the funnel is slowing down."),
  faq("m07-journey-screen", "I want to understand the Lead Journey Explorer", "Lead Journey Explorer focuses on one lead at a time. It combines stage history and interaction history into one timeline so the user can understand why a specific lead converted, stalled, or dropped."),
  faq("m07-fatigue-screen", "I want to understand Fatigue Analysis", "Fatigue Analysis is for over-contact and engagement pressure. Users come here when they suspect too many interactions, declining engagement quality, or lead fatigue that could hurt conversion."),
  faq("m07-recommendations-screen", "I want to understand the Recommendations screen", "The Recommendations screen turns the funnel insights into suggested next actions. It is useful after the user has already reviewed overview, leakage, fatigue, or journey context and now wants concrete action guidance."),
  faq("m07-trends-screen", "I want to understand Funnel Trends", "Funnel Trends is for time-based performance. It helps the user compare conversion pace, stage movement, and pipeline growth over time instead of only reading the current snapshot."),

  faq("conversation-restart", "Start over", "No problem. Tell me what you want to talk about and choose one of the module topics below.", MODULE_TOPIC_ROOTS),
];

function buildDefaultIntro() {
  return "Hi. I can help you understand this workspace step by step. Tell me what you want to talk about, and I'll guide you through the right module flow, the input order, and what each screen means.";
}

function page(title: string, intro: string, rootFaqIds: string[]): FaqPageConfig {
  return { title, intro, rootFaqIds, faqs: CONVERSATION_FAQS };
}

const PAGE_FAQS: Record<string, FaqPageConfig> = {
  workspace_detail: page("Workspace Guide", "Hi. What do you want to talk about? I can guide you through lead quality, intent scoring, revenue attribution, or funnel analysis.", MODULE_TOPIC_ROOTS),

  m01_home: page("Lead Quality & Scoring Guide", "Hi. You're in the lead quality area. What would you like help with: the Lead Quality & Scoring workflow, the input screens, or the meaning of each screen?", ["m01-flow", "m01-inputs", "m01-screens", "topic-m02", "topic-m06", "topic-m07"]),
  m01_upload: page("Lead Quality & Scoring Uploads Guide", "Hi. You're on the Lead Quality & Scoring Uploads screen. I can explain what this screen is for, when to use it, and what should happen next.", ["m01-upload-screen", "m01-flow", "m01-merge-screen", "m01-preview-screen"]),
  m01_preview: page("Lead Quality & Scoring Preview Guide", "Hi. You're on a Lead Quality & Scoring preview screen. I can explain what to check here before you continue.", ["m01-preview-screen", "m01-flow", "m01-merge-screen", "m01-leads-screen"]),
  m01_merge: page("Lead Quality & Scoring Merge Guide", "Hi. You're on the Lead Quality & Scoring merge screen. I can explain the merge steps, the matching column choice, and what to do after merging.", ["m01-merge-screen", "m01-flow", "m01-merged-screen", "m01-leads-screen"]),
  m01_merged: page("Lead Quality & Scoring Merged Data Guide", "Hi. You're on the Lead Quality & Scoring merged data screen. I can explain how to read this list and what to open next.", ["m01-merged-screen", "m01-preview-screen", "m01-leads-screen", "m01-flow"]),
  m01_leads: page("Lead Quality & Scoring Leads Guide", "Hi. You're on the Lead Quality & Scoring leads screen. I can explain how this screen fits into the intake flow and when to use it.", ["m01-leads-screen", "m01-flow", "m01-inputs", "topic-m02"]),

  m02_home: page("Intent Signals Guide", "Hi. You're in the intent scoring area. I can explain the workflow, the input setup, or what each Intent Signals screen is for.", ["m02-flow", "m02-inputs", "m02-screens", "topic-m01", "topic-m06", "topic-m07"]),
  m02_upload: page("Intent Signals Uploads Guide", "Hi. You're on the Intent Signals Uploads screen. I can explain what belongs here and when the user should move into the wizard or scoring screens.", ["m02-upload-screen", "m02-flow", "m02-wizard-screen", "m02-generate-screen"]),
  m02_preview: page("Intent Signals Preview Guide", "Hi. You're on an Intent Signals preview screen. I can explain what the user should verify before importing or scoring data.", ["m02-upload-screen", "m02-wizard-screen", "m02-generate-screen", "m02-flow"]),
  m02_merge: page("Intent Signals Merge Guide", "Hi. You're on the Intent Signals merge screen. I can explain how the user should combine files before running intent scoring.", ["m02-upload-screen", "m02-flow", "m02-wizard-screen", "m02-generate-screen"]),
  m02_merged: page("Intent Signals Merged Data Guide", "Hi. You're on the Intent Signals merged data screen. I can explain how this output fits into scoring and prioritization.", ["m02-flow", "m02-generate-screen", "m02-prioritization-screen", "m02-upload-screen"]),
  m02_leads: page("Intent Signals Leads Guide", "Hi. You're on the Intent Signals leads screen. I can explain how this prepared dataset is used in later intent work.", ["m02-flow", "m02-generate-screen", "m02-prioritization-screen", "m02-forecast-screen"]),
  m02_upload_wizard: page("Intent Signals Upload Wizard Guide", "Hi. You're on the Intent Signals Upload Wizard. I can explain the mapping steps, the upload types, and what the user should import first.", ["m02-wizard-screen", "m02-inputs", "m02-flow", "m02-generate-screen"]),
  m02_generate: page("Generate Intent Scores Guide", "Hi. You're on the Generate Intent Scores screen. I can explain when this step should be run and what the result means.", ["m02-generate-screen", "m02-flow", "m02-prioritization-screen", "m02-forecast-screen"]),
  m02_prioritization: page("Prioritization Guide", "Hi. You're on the Prioritization Dashboard. I can explain what this screen tells the user and what actions usually come next.", ["m02-prioritization-screen", "m02-wizard-screen", "m02-generate-screen", "m02-forecast-screen"]),
  m02_intent_forecast: page("Intent Forecast Guide", "Hi. You're on the Intent Forecast screen. I can explain when to use this view and what the user needs before running a forecast.", ["m02-forecast-screen", "m02-generate-screen", "m02-prioritization-screen", "m02-flow"]),

  m03_home: page("Conversation Intelligence Guide", buildDefaultIntro(), MODULE_TOPIC_ROOTS),
  m05_home: page("Sales & Marketing Alignment Guide", buildDefaultIntro(), MODULE_TOPIC_ROOTS),

  m06_home: page("Revenue Insight Guide", "Hi. You're in the revenue attribution and ROI area. I can explain the operational intake order, the analysis flow, or what each Revenue Insight screen means.", ["m06-flow", "m06-inputs", "m06-screens", "topic-m01", "topic-m02", "topic-m07"]),
  m06_overview: page("Revenue Insight Overview Guide", "Hi. You're on the main Revenue Insight dashboard. I can explain what this overview is showing and where the user should go next.", ["m06-overview-screen", "m06-run-screen", "m06-roi-screen", "m06-flow"]),
  m06_leads: page("Unified Lead Intake Guide", "Hi. You're on Unified Lead Intake. I can explain what belongs here and why this screen supports both Revenue Insight and Funnel Insight.", ["m06-leads-screen", "m06-inputs", "m06-flow", "m07-inputs"]),
  m06_campaigns: page("Campaign Operations Guide", "Hi. You're on Campaign Operations. I can explain what this screen stores and why campaign data must be correct before touches and ROI analysis.", ["m06-campaigns-screen", "m06-inputs", "m06-touches-screen", "m06-flow"]),
  m06_touches: page("Touch Operations Guide", "Hi. You're on the touch workspace. I can explain how touch records affect journeys and attribution.", ["m06-touches-screen", "m06-inputs", "m06-journey-screen", "m06-flow"]),
  m06_deals: page("Deal Operations Guide", "Hi. You're on Deal Operations. I can explain how this screen feeds attribution, ROI, and forecast outputs.", ["m06-deals-screen", "m06-inputs", "m06-run-screen", "m06-roi-screen"]),
  m06_journeys: page("Journey Preview Guide", "Hi. You're on the journey preview screen. I can explain what the user should validate here before trusting attribution results.", ["m06-journey-screen", "m06-touches-screen", "m06-run-screen", "m06-flow"]),
  m06_run_attribution: page("Attribution Run Guide", "Hi. You're on the attribution run screen. I can explain what must be ready first and what this run produces.", ["m06-run-screen", "m06-flow", "m06-roi-screen", "m06-overview-screen"]),
  m06_roi: page("ROI Dashboard Guide", "Hi. You're on the ROI dashboard. I can explain what this screen means and what data it depends on.", ["m06-roi-screen", "m06-run-screen", "m06-forecast-screen", "m06-allocation-screen"]),
  m06_roi_calc: page("ROI Calculation Guide", "Hi. You're on the ROI calculation screen. I can explain how this screen fits into the wider Revenue Insight flow.", ["m06-roi-screen", "m06-run-screen", "m06-flow", "m06-forecast-screen"]),
  m06_forecast: page("Forecast Guide", "Hi. You're on the forecast screen. I can explain what this view predicts and when the user should trust it.", ["m06-forecast-screen", "m06-roi-screen", "m06-run-screen", "m06-flow"]),
  m06_allocation: page("Allocation Guide", "Hi. You're on the allocation screen. I can explain what the user should learn from this budget view.", ["m06-allocation-screen", "m06-roi-screen", "m06-forecast-screen", "m06-flow"]),

  m07_home: page("Funnel Insight Guide", "Hi. You're in the funnel analysis area. I can explain where to input records, how the funnel workflow should be followed, or what each Funnel Insight screen means.", ["m07-flow", "m07-inputs", "m07-screens", "topic-m01", "topic-m02", "topic-m06"]),
  m07_leads: page("Funnel Insight Shared Leads Guide", "Hi. You're on the shared leads path used by Funnel Insight. I can explain why this route points back to Unified Lead Intake.", ["m06-leads-screen", "m07-inputs", "m07-flow", "m07-stage-screen"]),
  m07_stages: page("Stage History Guide", "Hi. You're on the stage history workspace. I can explain what users should add here and how this screen affects funnel analysis.", ["m07-stage-screen", "m07-inputs", "m07-overview-screen", "m07-flow"]),
  m07_stage_detail: page("Stage Detail Guide", "Hi. You're on a stage detail screen. I can explain what this record means and how it fits into the funnel history.", ["m07-stage-screen", "m07-overview-screen", "m07-leakage-screen", "m07-flow"]),
  m07_interactions: page("Interaction Guide", "Hi. You're on the interaction workspace. I can explain what belongs here and how interaction history affects Funnel Insight results.", ["m07-interaction-screen", "m07-inputs", "m07-journey-screen", "m07-flow"]),
  m07_interaction_detail: page("Interaction Detail Guide", "Hi. You're on an interaction detail screen. I can explain what this record tells the user and where it shows up in analysis.", ["m07-interaction-screen", "m07-journey-screen", "m07-overview-screen", "m07-flow"]),
  m07_overview: page("Funnel Overview Guide", "Hi. You're on Funnel Overview. I can explain what the user should read here first and which screen to open next.", ["m07-overview-screen", "m07-leakage-screen", "m07-journey-screen", "m07-flow"]),
  m07_leakage: page("Leakage Analysis Guide", "Hi. You're on Leakage Analysis. I can explain what this screen is measuring and when to use it.", ["m07-leakage-screen", "m07-overview-screen", "m07-recommendations-screen", "m07-flow"]),
  m07_journey: page("Lead Journey Guide", "Hi. You're on the Lead Journey Explorer. I can explain how to read one lead's full story here.", ["m07-journey-screen", "m07-stage-screen", "m07-interaction-screen", "m07-flow"]),
  m07_fatigue: page("Fatigue Analysis Guide", "Hi. You're on Fatigue Analysis. I can explain what this view says about over-contact and engagement pressure.", ["m07-fatigue-screen", "m07-overview-screen", "m07-recommendations-screen", "m07-flow"]),
  m07_recommendations: page("Recommendations Guide", "Hi. You're on the Recommendations screen. I can explain how this page turns analysis into next actions.", ["m07-recommendations-screen", "m07-leakage-screen", "m07-fatigue-screen", "m07-flow"]),
  m07_trends: page("Funnel Trends Guide", "Hi. You're on Funnel Trends. I can explain what changes over time are shown here and when this screen is useful.", ["m07-trends-screen", "m07-overview-screen", "m07-leakage-screen", "m07-flow"]),

  m09_home: page("Campaign Performance Optimization Guide", buildDefaultIntro(), MODULE_TOPIC_ROOTS),
};

export function getAssistantPageConfig(pageKey: string) {
  const base = PAGE_FAQS[pageKey] || page("Guided Assistant", buildDefaultIntro(), MODULE_TOPIC_ROOTS);
  return {
    title: base.title,
    intro: base.intro,
    rootFaqIds: base.rootFaqIds,
    faqs: base.faqs,
  };
}

export function findFaqById(pageKey: string, faqId: string) {
  const { faqs } = getAssistantPageConfig(pageKey);
  return faqs.find((item) => item.id === faqId) || null;
}

type MatchRule = {
  faqId: string;
  patterns: RegExp[];
};

const GENERIC_MATCH_RULES: MatchRule[] = [
  { faqId: "m01-flow", patterns: [/\b(module\s*1|lead quality|lead scoring)\b/i, /\b(flow|workflow|steps|process|start)\b/i] },
  { faqId: "m01-inputs", patterns: [/\b(module\s*1|lead quality|lead scoring)\b/i, /\b(input|upload|enter data|add data|where)\b/i] },
  { faqId: "m02-flow", patterns: [/\b(module\s*2|intent)\b/i, /\b(flow|workflow|steps|process|start)\b/i] },
  { faqId: "m02-inputs", patterns: [/\b(module\s*2|intent)\b/i, /\b(input|upload|wizard|enter data|add data|where)\b/i] },
  { faqId: "m06-flow", patterns: [/\b(module\s*6|roi|revenue attribution|attribution)\b/i, /\b(flow|workflow|steps|process|start)\b/i] },
  { faqId: "m06-inputs", patterns: [/\b(module\s*6|roi|revenue attribution|attribution)\b/i, /\b(input|enter data|add data|upload|where)\b/i] },
  { faqId: "m07-flow", patterns: [/\b(module\s*7|funnel|leakage)\b/i, /\b(flow|workflow|steps|process|start)\b/i] },
  { faqId: "m07-inputs", patterns: [/\b(module\s*7|funnel|leakage)\b/i, /\b(input|enter data|add data|upload|where)\b/i] },
];

const PAGE_MATCH_RULES: Partial<Record<string, MatchRule[]>> = {
  m01_home: [
    { faqId: "m01-flow", patterns: [/\b(flow|workflow|steps|process|start)\b/i] },
    { faqId: "m01-inputs", patterns: [/\b(input|upload|enter data|where|add data)\b/i] },
    { faqId: "m01-screens", patterns: [/\b(screen|page|what does this mean|what is this)\b/i] },
  ],
  m01_upload: [
    { faqId: "m01-upload-screen", patterns: [/.+/i] },
  ],
  m01_preview: [
    { faqId: "m01-preview-screen", patterns: [/.+/i] },
  ],
  m01_merge: [
    { faqId: "m01-merge-screen", patterns: [/.+/i] },
  ],
  m01_merged: [
    { faqId: "m01-merged-screen", patterns: [/.+/i] },
  ],
  m01_leads: [
    { faqId: "m01-leads-screen", patterns: [/.+/i] },
  ],
  m02_home: [
    { faqId: "m02-flow", patterns: [/\b(flow|workflow|steps|process|start)\b/i] },
    { faqId: "m02-inputs", patterns: [/\b(input|upload|wizard|enter data|where|add data)\b/i] },
    { faqId: "m02-screens", patterns: [/\b(screen|page|what does this mean|what is this)\b/i] },
  ],
  m02_upload: [
    { faqId: "m02-upload-screen", patterns: [/.+/i] },
  ],
  m02_upload_wizard: [
    { faqId: "m02-wizard-screen", patterns: [/.+/i] },
  ],
  m02_generate: [
    { faqId: "m02-generate-screen", patterns: [/.+/i] },
  ],
  m02_prioritization: [
    { faqId: "m02-prioritization-screen", patterns: [/.+/i] },
  ],
  m02_intent_forecast: [
    { faqId: "m02-forecast-screen", patterns: [/.+/i] },
  ],
  m06_home: [
    { faqId: "m06-flow", patterns: [/\b(flow|workflow|steps|process|start)\b/i] },
    { faqId: "m06-inputs", patterns: [/\b(input|upload|enter data|where|add data)\b/i] },
    { faqId: "m06-screens", patterns: [/\b(screen|page|what does this mean|what is this)\b/i] },
  ],
  m06_leads: [{ faqId: "m06-leads-screen", patterns: [/.+/i] }],
  m06_campaigns: [{ faqId: "m06-campaigns-screen", patterns: [/.+/i] }],
  m06_touches: [{ faqId: "m06-touches-screen", patterns: [/.+/i] }],
  m06_deals: [{ faqId: "m06-deals-screen", patterns: [/.+/i] }],
  m06_overview: [{ faqId: "m06-overview-screen", patterns: [/.+/i] }],
  m06_run_attribution: [{ faqId: "m06-run-screen", patterns: [/.+/i] }],
  m06_roi: [{ faqId: "m06-roi-screen", patterns: [/.+/i] }],
  m06_roi_calc: [{ faqId: "m06-roi-screen", patterns: [/.+/i] }],
  m06_forecast: [{ faqId: "m06-forecast-screen", patterns: [/.+/i] }],
  m06_allocation: [{ faqId: "m06-allocation-screen", patterns: [/.+/i] }],
  m06_journeys: [{ faqId: "m06-journey-screen", patterns: [/.+/i] }],
  m07_home: [
    { faqId: "m07-flow", patterns: [/\b(flow|workflow|steps|process|start)\b/i] },
    { faqId: "m07-inputs", patterns: [/\b(input|upload|enter data|where|add data)\b/i] },
    { faqId: "m07-screens", patterns: [/\b(screen|page|what does this mean|what is this)\b/i] },
  ],
  m07_stages: [{ faqId: "m07-stage-screen", patterns: [/.+/i] }],
  m07_stage_detail: [{ faqId: "m07-stage-screen", patterns: [/.+/i] }],
  m07_interactions: [{ faqId: "m07-interaction-screen", patterns: [/.+/i] }],
  m07_interaction_detail: [{ faqId: "m07-interaction-screen", patterns: [/.+/i] }],
  m07_overview: [{ faqId: "m07-overview-screen", patterns: [/.+/i] }],
  m07_leakage: [{ faqId: "m07-leakage-screen", patterns: [/.+/i] }],
  m07_journey: [{ faqId: "m07-journey-screen", patterns: [/.+/i] }],
  m07_fatigue: [{ faqId: "m07-fatigue-screen", patterns: [/.+/i] }],
  m07_recommendations: [{ faqId: "m07-recommendations-screen", patterns: [/.+/i] }],
  m07_trends: [{ faqId: "m07-trends-screen", patterns: [/.+/i] }],
};

function normalizeText(input: string) {
  return input.toLowerCase().replace(/\s+/g, " ").trim();
}

function textMatchesRule(text: string, rule: MatchRule) {
  return rule.patterns.every((pattern) => pattern.test(text));
}

export function matchFaqFromText(pageKey: string, text: string) {
  const normalized = normalizeText(text);
  if (!normalized) return null;

  const pageRules = PAGE_MATCH_RULES[pageKey] || [];
  for (const rule of pageRules) {
    if (textMatchesRule(normalized, rule)) {
      return findFaqById(pageKey, rule.faqId);
    }
  }

  for (const rule of GENERIC_MATCH_RULES) {
    if (textMatchesRule(normalized, rule)) {
      return findFaqById(pageKey, rule.faqId);
    }
  }

  return null;
}
