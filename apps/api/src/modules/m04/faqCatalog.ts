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
  "topic-m03",
  "topic-m05",
  "topic-m06",
  "topic-m07",
  "topic-m09",
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
    "topic-m03",
    "I want help with conversation intelligence",
    "Conversation Intelligence turns messages, calls, meetings, and follow-up activity into thread-level insight. I can guide you through the workflow, show you where users enter conversation data, or explain what each screen means.",
    ["m03-flow", "m03-inputs", "m03-screens"]
  ),
  faq(
    "topic-m06",
    "I want help with revenue attribution and ROI",
    "Revenue Insight includes both data intake screens and revenue analysis screens. I can guide you through the workflow, show you where users enter data, or explain what each screen means.",
    ["m06-flow", "m06-inputs", "m06-screens"]
  ),
  faq(
    "topic-m05",
    "I want help with sales and marketing alignment",
    "Sales & Marketing Alignment brings together intent, shared leads, funnel progress, website engagement, and team follow-up. I can guide you through the workflow, show you where users enter data, or explain what each screen means.",
    ["m05-flow", "m05-inputs", "m05-screens"]
  ),
  faq(
    "topic-m07",
    "I want help with funnel and leakage analysis",
    "Funnel Insight depends on leads, stage history, and interactions being correct. I can guide you through the workflow, show you where users enter data, or explain what each screen means.",
    ["m07-flow", "m07-inputs", "m07-screens"]
  ),
  faq(
    "topic-m09",
    "I want help with campaign performance optimization",
    "Campaign Performance Optimization combines campaign datasets, checks pacing and fatigue, and turns cross-channel signals into recommendations. I can guide you through the workflow, show you where users prepare the data, or explain what each screen means.",
    ["m09-flow", "m09-inputs", "m09-screens"]
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
    ["m01-home-screen", "m01-upload-screen", "m01-preview-screen", "m01-merge-screen", "m01-merged-screen", "m01-leads-screen", "m01-dashboard-screen", "m01-report-screen"]
  ),
  faq("m01-home-screen", "I want to understand the Lead Quality & Scoring home screen", "The Lead Quality & Scoring home is a guidance screen. It tells the user that this area is for lead quality and scoring readiness, not advanced analytics. The page mainly points the user to the Lead View and reminds them that upload and merge work should happen first."),
  faq("m01-upload-screen", "I want to understand the Lead Quality & Scoring Uploads screen", "The Uploads screen is the first operational step for Lead Quality & Scoring. Users add raw CSV files, see active and archived uploads, preview file contents, inspect details, archive old files, and select at least two uploads when they want to merge them. This is the right place to start when the user has new lead-source files."),
  faq("m01-preview-screen", "I want to understand the Lead Quality & Scoring preview screen", "The preview screen is a verification step. It lets the user inspect rows, headers, pagination, and table width before continuing. This is where users catch bad headers, empty values, or wrong row structure before trusting the file in a merge or lead-generation step."),
  faq("m01-merge-screen", "I want to understand the Lead Quality & Scoring merge screen", "The Merge CSV screen is where the user combines multiple uploaded files into one dataset. First they choose the matching column for each file so the system knows how rows should join together. After that they map source columns into the merged target schema. Users should come here only after previewing the uploads and confirming which files belong together."),
  faq("m01-merged-screen", "I want to understand the Lead Quality & Scoring merged data screen", "The merged datasets screen is the library of combined outputs. Users can search merged files, inspect who created them, see when they were created, and open a merged preview. This screen answers: which merged dataset should I trust and use next?"),
  faq("m01-leads-screen", "I want to understand the Lead Quality & Scoring leads screen", "The Leads Code screen creates the lead-ready dataset from a merged file. The user selects one merged dataset, optionally names the new lead-ready output, and creates it. After that, they can preview the lead records and then move to downstream workflows that depend on clean lead data."),
  faq("m01-dashboard-screen", "I want to understand the Lead Quality & Scoring dashboard", "The Lead Quality & Scoring dashboard is the first analytical view after a scored lead CSV exists. The user selects one final lead-scored output and the screen summarizes label mix, confidence distribution, source pockets, and top-scoring leads so the team can quickly judge data quality and scoring shape."),
  faq("m01-report-screen", "I want to understand the Lead Quality & Scoring report page", "The Lead Quality & Scoring report page is the written management summary for lead-readiness work. It packages lead intake volumes, merge readiness, and output health into a printable report with downloadable CSV support. Use it when the user needs a formal snapshot instead of exploring one screen at a time."),

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
    ["m02-home-screen", "m02-upload-screen", "m02-wizard-screen", "m02-generate-screen", "m02-prioritization-screen", "m02-forecast-screen", "m02-dashboard-screen", "m02-report-screen"]
  ),
  faq("m02-home-screen", "I want to understand the Intent Signals home screen", "The Intent Signals home is the entry point for intent analysis. It tells the user that raw uploads now live in the workspace Data Hub, while this area focuses on generating scores, prioritizing leads, and reviewing forecast-style outputs."),
  faq("m02-upload-screen", "I want to understand the Intent Signals Uploads screen", "The Uploads screen stores the raw intent and behavior CSV batches. Users can upload files, preview them, archive them, restore them, and select multiple uploads for merging. This is the first stop when the user receives new source files for Intent Signals."),
  faq("m02-wizard-screen", "I want to understand the Intent Signals Upload Wizard", "The Upload Wizard is the most guided input screen in Intent Signals. The user first chooses the upload type: Leads plus Intent or Behavior Events. Then they preview headers and sample rows, map the required columns, choose the row range, and import the file into the expected schema. This screen is best when the user needs confidence that the incoming file matches the system correctly."),
  faq("m02-generate-screen", "I want to understand the Generate Intent Scores screen", "This screen runs the scoring step. The user selects a prepared dataset, confirms the file details, and then runs the intent scoring engine. After the run, the screen shows a preview of the generated output so the user can verify the scoring result before using it in prioritization."),
  faq("m02-prioritization-screen", "I want to understand the Prioritization Dashboard", "The prioritization dashboard is where users act on the scoring output. It ranks leads by intent, engagement, and recent behavior so the team can see who deserves attention next. It also includes quick-upload shortcuts, but the main purpose of the screen is decision-making, filtering, and lead ranking."),
  faq("m02-forecast-screen", "I want to understand the Intent Forecast screen", "The intent forecast screen is for forward-looking analysis. The user picks an intent run, chooses a scope such as all leads or one segment, asks the forecasting engine a question, and generates a forecast summary. This is the screen to use when the user wants to estimate where interest is heading, not when they are still preparing raw inputs."),
  faq("m02-dashboard-screen", "I want to understand the Intent Signals dashboard", "The Intent Signals dashboard is the visual readout for one final intent-scored CSV. The user selects a finished output and the screen summarizes intent-category mix, score bands, high-intent concentration, and top-priority leads so the team can move from scoring into action."),
  faq("m02-report-screen", "I want to understand the Intent Signals report page", "The Intent Signals report page is the written summary for intent scoring and prioritization. It condenses scoring output, segment concentration, and action-ready leads into a printable narrative with exportable supporting tables."),

  faq(
    "m03-flow",
    "I want to understand the Conversation Intelligence workflow",
    "The best Conversation Intelligence flow is: 1. import conversation records in batch or log one interaction manually, 2. review companies and thread coverage, 3. open the explorer to inspect specific thread sets, 4. use analytics to understand channel, sentiment, and message patterns, 5. use deal health and follow-ups for action management, and 6. open the organisation timeline or report when the team needs a full account story or management summary.",
    ["m03-upload-screen", "m03-manual-log-screen", "m03-companies-screen", "m03-explorer-screen", "m03-analytics-screen", "m03-deal-health-screen"]
  ),
  faq(
    "m03-inputs",
    "I want to know where to enter data for Conversation Intelligence",
    "Conversation Intelligence has two main input points. Use Conversation Upload when the user has a CSV of messages, calls, or meetings to ingest in bulk. Use Manual Conversation Log when one interaction needs to be captured directly without waiting for a file. After that, the other Conversation Intelligence screens are for exploration, insight, and follow-up.",
    ["m03-upload-screen", "m03-manual-log-screen", "m03-flow"]
  ),
  faq(
    "m03-screens",
    "I want a Conversation Intelligence screen explained",
    "Choose the Conversation Intelligence screen you want help with.",
    ["m03-home-screen", "m03-upload-screen", "m03-manual-log-screen", "m03-companies-screen", "m03-explorer-screen", "m03-thread-screen", "m03-analytics-screen", "m03-deal-health-screen", "m03-follow-ups-screen", "m03-org-timeline-screen", "m03-report-screen"]
  ),
  faq("m03-home-screen", "I want to understand the Conversation Intelligence home screen", "The Conversation Intelligence home screen is the navigation hub for the conversation intelligence workspace. It explains that this area is for conversation-driven insight, then routes the user toward upload, logging, exploration, analytics, follow-up, timeline, and reporting screens."),
  faq("m03-upload-screen", "I want to understand the Conversation Upload screen", "Conversation Upload is the batch-ingestion entry point for the conversation intelligence workspace. Users bring in conversation CSV files here so message, call, meeting, or note history can feed analytics, thread exploration, and deal-health views."),
  faq("m03-manual-log-screen", "I want to understand the Manual Conversation Log screen", "Manual Conversation Log is the direct-entry screen for one interaction at a time. It is useful when the team needs to capture a call, meeting, email, or note immediately without preparing a CSV file first."),
  faq("m03-companies-screen", "I want to understand the Company Directory screen", "Company Directory is the account-level entry point for Conversation Intelligence. It shows which organisations have tracked conversation history and helps the user jump into thread review from the account side instead of starting from one message."),
  faq("m03-explorer-screen", "I want to understand the Conversation Explorer screen", "Conversation Explorer is the main search and filtering screen for thread analysis. Users come here when they want to narrow by company, channel, health, owner, or recency and inspect the conversation set that matters right now."),
  faq("m03-thread-screen", "I want to understand the Conversation Thread screen", "The Conversation Thread detail screen is where one thread is read in full context. It helps the user inspect message sequence, recent activity, extracted insight, and account-level health before deciding what should happen next."),
  faq("m03-analytics-screen", "I want to understand the Conversation Analytics screen", "Conversation Analytics is the aggregated insight view for Conversation Intelligence. It summarizes message activity, channel mix, sentiment shape, and extracted entities so the team can understand broad communication patterns instead of one thread at a time."),
  faq("m03-deal-health-screen", "I want to understand the Deal Health Board", "Deal Health Board turns conversation patterns into account-risk and follow-up signals. It helps the user see which accounts are healthy, at risk, or waiting on action based on message recency, tone, and response patterns."),
  faq("m03-follow-ups-screen", "I want to understand the Follow-Ups screen", "Follow-Ups is the action queue for Conversation Intelligence. It keeps pending and overdue next steps visible so teams can respond to conversation risk instead of letting important threads go stale."),
  faq("m03-org-timeline-screen", "I want to understand the Organisation Timeline screen", "Organisation Timeline is the long-form account story screen. It places interactions in time order so the user can understand how communication evolved for one organisation across channels."),
  faq("m03-report-screen", "I want to understand the Conversation Intelligence report page", "The Conversation Intelligence report page is the written management summary for conversation coverage, risk, and follow-up pressure. Use it when the team wants a formal view of communication health with exportable supporting tables."),

  faq(
    "m05-flow",
    "I want to understand the Sales & Marketing Alignment workflow",
    "The best Sales & Marketing Alignment flow is: 1. start on the overview dashboard to understand the current alignment picture, 2. open the unified pipeline view if the user needs a stage-by-stage read of movement and concentration, 3. go to the Web Engagement Data Manager when website traffic or behavioral evidence still needs to be uploaded, 4. open Web Engagement Visualization after a dataset is active, 5. use the Shortcoming Analyzer to identify where flow is weak or stalled, and 6. move into the Communication Hub when the team needs ownership, discussion, or follow-up on those issues. Sales & Marketing Alignment is a coordination layer, so it works best when Intent Signals, Revenue Insight, and Funnel Insight already have usable operational data.",
    ["m05-overview-screen", "m05-pipeline-screen", "m05-web-manager-screen", "m05-web-visualization-screen", "m05-shortcomings-screen", "m05-communication-screen"]
  ),
  faq(
    "m05-inputs",
    "I want to know where to enter data for Sales & Marketing Alignment",
    "Sales & Marketing Alignment does not own every input directly. Shared commercial records still come from other workspaces: intent priority comes from Intent Signals, shared lead records come from Revenue Insight, and stage history comes from Funnel Insight. Inside Sales & Marketing Alignment itself, the main direct input areas are the Web Engagement Data Manager for website-behavior CSVs and the Communication Hub for discussion threads, blockers, follow-up items, and alignment notes.",
    ["m05-web-manager-screen", "m05-communication-screen", "m02-prioritization-screen", "m06-leads-screen", "m07-stage-screen"]
  ),
  faq(
    "m05-screens",
    "I want a Sales & Marketing Alignment screen explained",
    "Choose the Sales & Marketing Alignment screen you want help with.",
    ["m05-home-screen", "m05-overview-screen", "m05-pipeline-screen", "m05-web-manager-screen", "m05-web-visualization-screen", "m05-shortcomings-screen", "m05-communication-screen", "m05-report-screen"]
  ),
  faq("m05-home-screen", "I want to understand the Sales & Marketing Alignment home screen", "The Sales & Marketing Alignment home screen is the navigation hub for the alignment workspace. It introduces the area as a shared coordination space and points the user toward the overview dashboard, pipeline view, web engagement manager, web visualization, shortcoming analysis, communication hub, and report center. This is the right place to start when the user is not yet sure which part of the alignment workflow they need."),
  faq("m05-overview-screen", "I want to understand the alignment overview dashboard", "The overview dashboard is the best first analysis screen in Sales & Marketing Alignment. It combines intent, shared lead, and stage-history signals into one management view so the user can quickly understand handoff health, funnel coverage, stale risk, and which records need attention. Open this screen first when the question is broadly: are marketing and sales aligned right now?"),
  faq("m05-pipeline-screen", "I want to understand the unified pipeline view", "The unified pipeline view is the stage-structure screen in Sales & Marketing Alignment. It shows where records are concentrated, how much of the funnel is still early-stage, whether enough records have progressed downstream, and which stages look stagnant. Users should open this screen when they need a cleaner operational read of funnel movement than the broader overview provides."),
  faq("m05-web-manager-screen", "I want to understand the Web Engagement Data Manager", "The Web Engagement Data Manager is the main data-input screen owned by Sales & Marketing Alignment. Users upload website engagement CSV files here, validate that the file looks correct, preview the uploaded content, and manage active or archived datasets. This is the right screen when the user needs to bring website behavior into the alignment workspace before asking the system to visualize or analyze it."),
  faq("m05-web-visualization-screen", "I want to understand Web Engagement Visualization", "Web Engagement Visualization is the interpretation screen for an active website engagement dataset. After the user has uploaded a valid dataset, this screen shows traffic-source patterns, campaign activity, page-category engagement, conversion-style signals, company-level activity, and operating summaries. Open this screen when the user wants to understand what web behavior is revealing, not when they are still cleaning the upload."),
  faq("m05-shortcomings-screen", "I want to understand the Shortcoming Analyzer", "The Shortcoming Analyzer is the diagnosis screen in Sales & Marketing Alignment. It combines pipeline signals with optional web-engagement enrichment to identify bottlenecks, weak handoffs, stage stagnation, underperforming sources, or other process problems that deserve review. Users should open this screen after overview or pipeline when they want the system to point out where the current workflow appears weakest."),
  faq("m05-communication-screen", "I want to understand the Communication Hub", "The Communication Hub is the action-and-ownership screen in Sales & Marketing Alignment. It lets users create structured discussion threads, assign participants, reply inside the workspace, move threads across status columns, and keep blockers or follow-up visible. This is the right screen when the team has already found an issue and now needs coordinated action instead of more analysis."),
  faq("m05-report-screen", "I want to understand the Sales & Marketing Alignment report page", "The Sales & Marketing Alignment report page is the written executive summary for alignment health. It turns cross-module handoff, website engagement, shortcoming, and communication signals into one formal narrative with supporting downloads."),

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
    ["m06-home-screen", "m06-leads-screen", "m06-campaigns-screen", "m06-touches-screen", "m06-deals-screen", "m06-overview-screen", "m06-run-screen", "m06-roi-screen", "m06-forecast-screen", "m06-allocation-screen", "m06-journey-screen", "m06-report-screen"]
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
  faq("m06-report-screen", "I want to understand the Revenue Insight report page", "The Revenue Insight report page is the formal written summary for attribution, ROI, and revenue performance. It is the right screen when the user needs a management-ready narrative instead of moving between dashboards and tables."),

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
    ["m07-home-screen", "m07-stage-screen", "m07-interaction-screen", "m07-overview-screen", "m07-forecast-screen", "m07-leakage-screen", "m07-journey-screen", "m07-fatigue-screen", "m07-recommendations-screen", "m07-trends-screen", "m07-report-screen"]
  ),
  faq("m07-home-screen", "I want to understand the Funnel Insight home screen", "The Funnel Insight home tells the user that this area is for funnel interpretation, not for broad data maintenance. It points the user to Funnel Overview, Leakage Analysis, Lead Journey Explorer, Fatigue Analysis, Recommendations, and Funnel Trends, and reminds them to return to input screens when records need fixing."),
  faq("m07-stage-screen", "I want to understand the Stage History workspace", "The Stage History workspace is where the user manages funnel stage records. It contains a table view, a manual add form, and a CSV import flow. This is the correct place when the user needs to say when a lead entered a stage, exited it, dropped out, or moved into the next stage."),
  faq("m07-interaction-screen", "I want to understand the Interaction workspace", "The Interaction workspace is where the user manages calls, emails, meetings, demos, and related engagement activity. It supports a table view, a manual add form, and CSV import. This screen should be used when the user wants the funnel analysis to reflect actual activity history."),
  faq("m07-overview-screen", "I want to understand Funnel Overview", "Funnel Overview is the first analysis screen to open in Funnel Insight. It summarizes stage occupancy, conversion flow, lead distribution, and drilldown tables so the user can see where the pipeline currently stands before investigating one specific issue."),
  faq("m07-forecast-screen", "I want to understand Funnel Forecast", "Funnel Forecast is the forward-looking view for stage and conversion behavior. It uses the available monthly history to project what happens next, so it should be read after the user already trusts the stage and interaction records feeding Funnel Insight."),
  faq("m07-leakage-screen", "I want to understand Leakage Analysis", "Leakage Analysis is for finding where leads are being lost. It is the right screen when the user wants to know which stage is leaking, where drop-off is highest, or which part of the funnel is slowing down."),
  faq("m07-journey-screen", "I want to understand the Lead Journey Explorer", "Lead Journey Explorer focuses on one lead at a time. It combines stage history and interaction history into one timeline so the user can understand why a specific lead converted, stalled, or dropped."),
  faq("m07-fatigue-screen", "I want to understand Fatigue Analysis", "Fatigue Analysis is for over-contact and engagement pressure. Users come here when they suspect too many interactions, declining engagement quality, or lead fatigue that could hurt conversion."),
  faq("m07-recommendations-screen", "I want to understand the Recommendations screen", "The Recommendations screen turns the funnel insights into suggested next actions. It is useful after the user has already reviewed overview, leakage, fatigue, or journey context and now wants concrete action guidance."),
  faq("m07-trends-screen", "I want to understand Funnel Trends", "Funnel Trends is for time-based performance. It helps the user compare conversion pace, stage movement, and pipeline growth over time instead of only reading the current snapshot."),
  faq("m07-report-screen", "I want to understand the Funnel Insight report page", "The Funnel Insight report page is the written summary for funnel occupancy, leakage, delay, and activity pressure. It gives managers a narrative view of funnel health with downloadable evidence behind it."),

  faq(
    "m09-flow",
    "I want to understand the Campaign Performance Optimization workflow",
    "The best Campaign Performance Optimization flow is: 1. import the campaign-performance datasets, 2. validate the merged cross-channel picture, 3. open the business optimization screen to inspect pacing and fatigue pressure, 4. move into the recommendations screen for proposed actions, and 5. open the report page when the user needs a written summary with exports. Campaign Performance Optimization works best after upstream campaign and attribution data is already reasonably prepared.",
    ["m09-import-screen", "m09-simulator-screen", "m09-simulator-dev-screen", "m09-report-screen"]
  ),
  faq(
    "m09-inputs",
    "I want to know where to enter data for Campaign Performance Optimization",
    "Campaign Performance Optimization has one main data-entry area inside the workspace: the cross-channel performance import screen. That page is where campaign datasets are uploaded and merged. The other Campaign Performance Optimization pages are for interpreting pacing, fatigue, and recommendation output from the prepared data.",
    ["m09-import-screen", "m09-flow"]
  ),
  faq(
    "m09-screens",
    "I want a Campaign Performance Optimization screen explained",
    "Choose the Campaign Performance Optimization screen you want help with.",
    ["m09-home-screen", "m09-import-screen", "m09-simulator-screen", "m09-simulator-dev-screen", "m09-report-screen"]
  ),
  faq("m09-home-screen", "I want to understand the Campaign Performance Optimization home screen", "The Campaign Performance Optimization home screen is the navigation hub for campaign optimization work. It introduces the area as the place for cross-channel performance comparison, fatigue monitoring, recommendations, and reporting."),
  faq("m09-import-screen", "I want to understand the Cross-Channel Performance screen", "The cross-channel performance import screen is the operational entry point for Campaign Performance Optimization. Users upload and prepare campaign datasets here so the workspace can build one combined performance picture across channels."),
  faq("m09-simulator-screen", "I want to understand the Fatigue & Pacing Checks screen", "Fatigue & Pacing Checks is the monitoring screen for delivery pressure. It helps the user see where budget pace, contact frequency, or campaign fatigue signals suggest current execution may be losing efficiency."),
  faq("m09-simulator-dev-screen", "I want to understand the Optimization Recommendations screen", "Optimization Recommendations is the decision screen in Campaign Performance Optimization. It turns campaign signals into suggested budget shifts, refresh decisions, or channel adjustments so the team can act on the combined performance picture."),
  faq("m09-report-screen", "I want to understand the Campaign Performance Optimization report page", "The Campaign Performance Optimization report page is the written management summary for dataset readiness, merge quality, pacing, and optimization context. Use it when the team needs a formal export-friendly snapshot instead of moving through the live screens."),

  faq("conversation-restart", "Start over", "No problem. Tell me what you want to talk about and choose one of the module topics below.", MODULE_TOPIC_ROOTS),
];

function buildDefaultIntro() {
  return "Hi. I can help you understand this workspace step by step. Tell me what you want to talk about, and I'll guide you through the right module flow, the input order, and what each screen means.";
}

function page(title: string, intro: string, rootFaqIds: string[]): FaqPageConfig {
  return { title, intro, rootFaqIds, faqs: CONVERSATION_FAQS };
}

const PAGE_FAQS: Record<string, FaqPageConfig> = {
  workspace_detail: page("Workspace Guide", "Hi. What do you want to talk about? I can guide you through lead quality, intent scoring, conversation intelligence, alignment, revenue attribution, funnel analysis, or campaign optimization.", MODULE_TOPIC_ROOTS),

  m01_home: page("Lead Quality & Scoring Guide", "Hi. You're in the lead quality area. What would you like help with: the Lead Quality & Scoring workflow, the input screens, or the meaning of each screen?", ["m01-flow", "m01-inputs", "m01-screens", "topic-m02", "topic-m06", "topic-m07"]),
  m01_upload: page("Lead Quality & Scoring Uploads Guide", "Hi. You're on the Lead Quality & Scoring Uploads screen. I can explain what this screen is for, when to use it, and what should happen next.", ["m01-upload-screen", "m01-flow", "m01-merge-screen", "m01-preview-screen"]),
  m01_preview: page("Lead Quality & Scoring Preview Guide", "Hi. You're on a Lead Quality & Scoring preview screen. I can explain what to check here before you continue.", ["m01-preview-screen", "m01-flow", "m01-merge-screen", "m01-leads-screen"]),
  m01_merge: page("Lead Quality & Scoring Merge Guide", "Hi. You're on the Lead Quality & Scoring merge screen. I can explain the merge steps, the matching column choice, and what to do after merging.", ["m01-merge-screen", "m01-flow", "m01-merged-screen", "m01-leads-screen"]),
  m01_merged: page("Lead Quality & Scoring Merged Data Guide", "Hi. You're on the Lead Quality & Scoring merged data screen. I can explain how to read this list and what to open next.", ["m01-merged-screen", "m01-preview-screen", "m01-leads-screen", "m01-flow"]),
  m01_leads: page("Lead Quality & Scoring Leads Guide", "Hi. You're on the Lead Quality & Scoring leads screen. I can explain how this screen fits into the intake flow and when to use it.", ["m01-leads-screen", "m01-flow", "m01-inputs", "topic-m02"]),
  m01_dashboard: page("Lead Quality & Scoring Dashboard Guide", "Hi. You're on the Lead Quality & Scoring dashboard. I can explain what the scored CSV selector drives and how to read the visual summaries.", ["m01-dashboard-screen", "m01-leads-screen", "m01-flow", "m01-report-screen"]),
  m01_report: page("Lead Quality & Scoring Report Guide", "Hi. You're on the Lead Quality & Scoring report page. I can explain how this management summary relates back to uploads, merged datasets, and final lead outputs.", ["m01-report-screen", "m01-flow", "m01-dashboard-screen", "m01-leads-screen"]),

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
  m02_dashboard: page("Intent Signals Dashboard Guide", "Hi. You're on the Intent Signals dashboard. I can explain how the selected scored CSV drives the cards, charts, and priority summaries.", ["m02-dashboard-screen", "m02-prioritization-screen", "m02-generate-screen", "m02-report-screen"]),
  m02_report: page("Intent Signals Report Guide", "Hi. You're on the Intent Signals report page. I can explain how this written summary reflects the scoring, prioritization, and output datasets behind Intent Signals.", ["m02-report-screen", "m02-dashboard-screen", "m02-prioritization-screen", "m02-flow"]),

  m03_home: page("Conversation Intelligence Guide", "Hi. You're in the conversation intelligence area. I can explain the Conversation Intelligence workflow, show you where conversation data is entered, or explain what each conversation screen is for.", ["m03-flow", "m03-inputs", "m03-screens", "topic-m05"]),
  m03_upload: page("Conversation Upload Guide", "Hi. You're on the Conversation Upload screen. I can explain what belongs in a conversation CSV and what should happen after import.", ["m03-upload-screen", "m03-inputs", "m03-flow", "m03-explorer-screen"]),
  m03_manual_log: page("Manual Conversation Log Guide", "Hi. You're on the Manual Conversation Log screen. I can explain when direct entry is better than upload and how this record feeds later analysis.", ["m03-manual-log-screen", "m03-inputs", "m03-flow", "m03-follow-ups-screen"]),
  m03_companies: page("Company Directory Guide", "Hi. You're on the Company Directory. I can explain how to use this account-level view to move into thread exploration and organisation timelines.", ["m03-companies-screen", "m03-explorer-screen", "m03-org-timeline-screen", "m03-flow"]),
  m03_explorer: page("Conversation Explorer Guide", "Hi. You're on the Conversation Explorer. I can explain how this screen helps the user filter threads and what details to inspect next.", ["m03-explorer-screen", "m03-thread-screen", "m03-analytics-screen", "m03-flow"]),
  m03_thread_detail: page("Conversation Thread Guide", "Hi. You're on a conversation thread detail screen. I can explain how to read the thread and how it feeds health and follow-up decisions.", ["m03-thread-screen", "m03-deal-health-screen", "m03-follow-ups-screen", "m03-flow"]),
  m03_analytics: page("Conversation Analytics Guide", "Hi. You're on Conversation Analytics. I can explain what patterns this screen summarizes and when to use it instead of one-thread exploration.", ["m03-analytics-screen", "m03-explorer-screen", "m03-deal-health-screen", "m03-flow"]),
  m03_deal_health: page("Deal Health Board Guide", "Hi. You're on the Deal Health Board. I can explain how conversation signals become account-risk and follow-up priorities here.", ["m03-deal-health-screen", "m03-follow-ups-screen", "m03-analytics-screen", "m03-flow"]),
  m03_follow_ups: page("Follow-Ups Guide", "Hi. You're on the Follow-Ups screen. I can explain how this queue supports action after Conversation Intelligence detects risk or inactivity.", ["m03-follow-ups-screen", "m03-deal-health-screen", "m03-thread-screen", "m03-flow"]),
  m03_org_timeline: page("Organisation Timeline Guide", "Hi. You're on the Organisation Timeline. I can explain how to read one organisation's history across channels and why this view matters.", ["m03-org-timeline-screen", "m03-companies-screen", "m03-thread-screen", "m03-flow"]),
  m03_report: page("Conversation Intelligence Report Guide", "Hi. You're on the Conversation Intelligence report page. I can explain how this written summary relates to conversation coverage, thread health, and follow-up pressure.", ["m03-report-screen", "m03-analytics-screen", "m03-deal-health-screen", "m03-flow"]),
  m05_home: page("Sales & Marketing Alignment Guide", "Hi. You're in the sales and marketing alignment area. I can explain the Sales & Marketing Alignment workflow, show you where alignment data is entered, or explain what each screen is for.", ["m05-flow", "m05-inputs", "m05-screens", "topic-m02", "topic-m06", "topic-m07"]),
  m05_overview: page("Sales & Marketing Alignment Overview Guide", "Hi. You're on the alignment overview dashboard. I can explain what this screen is showing, what it depends on, and which alignment screen to open next.", ["m05-overview-screen", "m05-flow", "m05-pipeline-screen", "m05-shortcomings-screen"]),
  m05_pipeline: page("Unified Pipeline Guide", "Hi. You're on the unified pipeline view. I can explain what this stage-based screen means and when to use it instead of the broader overview.", ["m05-pipeline-screen", "m05-flow", "m05-overview-screen", "m05-shortcomings-screen"]),
  m05_web_engagement: page("Web Engagement Data Manager Guide", "Hi. You're on the Web Engagement Data Manager. I can explain what belongs here, what a user should upload first, and what happens after the upload succeeds.", ["m05-web-manager-screen", "m05-inputs", "m05-web-visualization-screen", "m05-flow"]),
  m05_web_visualization: page("Web Engagement Visualization Guide", "Hi. You're on Web Engagement Visualization. I can explain what this screen shows and what the user needs before this page becomes useful.", ["m05-web-visualization-screen", "m05-web-manager-screen", "m05-shortcomings-screen", "m05-flow"]),
  m05_shortcomings: page("Shortcoming Analyzer Guide", "Hi. You're on the Shortcoming Analyzer. I can explain what kinds of weakness this screen is looking for and what the user should do after issues appear here.", ["m05-shortcomings-screen", "m05-overview-screen", "m05-pipeline-screen", "m05-communication-screen"]),
  m05_communication: page("Communication Hub Guide", "Hi. You're on the Communication Hub. I can explain how this screen supports follow-up, thread ownership, and action tracking after Sales & Marketing Alignment identifies an issue.", ["m05-communication-screen", "m05-flow", "m05-shortcomings-screen", "m05-inputs"]),
  m05_report: page("Sales & Marketing Alignment Report Guide", "Hi. You're on the Sales & Marketing Alignment report page. I can explain how this written summary combines overview, pipeline, website, shortcoming, and communication signals.", ["m05-report-screen", "m05-overview-screen", "m05-shortcomings-screen", "m05-flow"]),

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
  m06_report: page("Revenue Insight Report Guide", "Hi. You're on the Revenue Insight report page. I can explain how the written report connects back to campaigns, touches, deals, attribution, and ROI.", ["m06-report-screen", "m06-roi-screen", "m06-run-screen", "m06-flow"]),

  m07_home: page("Funnel Insight Guide", "Hi. You're in the funnel analysis area. I can explain where to input records, how the funnel workflow should be followed, or what each Funnel Insight screen means.", ["m07-flow", "m07-inputs", "m07-screens", "topic-m01", "topic-m02", "topic-m06"]),
  m07_leads: page("Funnel Insight Shared Leads Guide", "Hi. You're on the shared leads path used by Funnel Insight. I can explain why this route points back to Unified Lead Intake.", ["m06-leads-screen", "m07-inputs", "m07-flow", "m07-stage-screen"]),
  m07_stages: page("Stage History Guide", "Hi. You're on the stage history workspace. I can explain what users should add here and how this screen affects funnel analysis.", ["m07-stage-screen", "m07-inputs", "m07-overview-screen", "m07-flow"]),
  m07_stage_detail: page("Stage Detail Guide", "Hi. You're on a stage detail screen. I can explain what this record means and how it fits into the funnel history.", ["m07-stage-screen", "m07-overview-screen", "m07-leakage-screen", "m07-flow"]),
  m07_interactions: page("Interaction Guide", "Hi. You're on the interaction workspace. I can explain what belongs here and how interaction history affects Funnel Insight results.", ["m07-interaction-screen", "m07-inputs", "m07-journey-screen", "m07-flow"]),
  m07_interaction_detail: page("Interaction Detail Guide", "Hi. You're on an interaction detail screen. I can explain what this record tells the user and where it shows up in analysis.", ["m07-interaction-screen", "m07-journey-screen", "m07-overview-screen", "m07-flow"]),
  m07_overview: page("Funnel Overview Guide", "Hi. You're on Funnel Overview. I can explain what the user should read here first and which screen to open next.", ["m07-overview-screen", "m07-leakage-screen", "m07-journey-screen", "m07-flow"]),
  m07_forecast: page("Funnel Forecast Guide", "Hi. You're on Funnel Forecast. I can explain what this view projects and what historical inputs need to be trusted first.", ["m07-forecast-screen", "m07-overview-screen", "m07-trends-screen", "m07-flow"]),
  m07_leakage: page("Leakage Analysis Guide", "Hi. You're on Leakage Analysis. I can explain what this screen is measuring and when to use it.", ["m07-leakage-screen", "m07-overview-screen", "m07-recommendations-screen", "m07-flow"]),
  m07_journey: page("Lead Journey Guide", "Hi. You're on the Lead Journey Explorer. I can explain how to read one lead's full story here.", ["m07-journey-screen", "m07-stage-screen", "m07-interaction-screen", "m07-flow"]),
  m07_fatigue: page("Fatigue Analysis Guide", "Hi. You're on Fatigue Analysis. I can explain what this view says about over-contact and engagement pressure.", ["m07-fatigue-screen", "m07-overview-screen", "m07-recommendations-screen", "m07-flow"]),
  m07_recommendations: page("Recommendations Guide", "Hi. You're on the Recommendations screen. I can explain how this page turns analysis into next actions.", ["m07-recommendations-screen", "m07-leakage-screen", "m07-fatigue-screen", "m07-flow"]),
  m07_trends: page("Funnel Trends Guide", "Hi. You're on Funnel Trends. I can explain what changes over time are shown here and when this screen is useful.", ["m07-trends-screen", "m07-overview-screen", "m07-leakage-screen", "m07-flow"]),
  m07_report: page("Funnel Insight Report Guide", "Hi. You're on the Funnel Insight report page. I can explain how this written summary relates to stage history, interactions, leakage, and fatigue analysis.", ["m07-report-screen", "m07-overview-screen", "m07-leakage-screen", "m07-flow"]),

  m09_home: page("Campaign Performance Optimization Guide", "Hi. You're in the campaign optimization area. I can explain the Campaign Performance Optimization workflow, show you where campaign datasets are prepared, or explain what each optimization screen is for.", ["m09-flow", "m09-inputs", "m09-screens", "topic-m06"]),
  m09_import: page("Cross-Channel Performance Guide", "Hi. You're on the cross-channel performance import screen. I can explain what datasets belong here and what to review after import.", ["m09-import-screen", "m09-inputs", "m09-flow", "m09-simulator-screen"]),
  m09_simulator: page("Fatigue & Pacing Checks Guide", "Hi. You're on the fatigue and pacing screen. I can explain what pressure signals this page is checking and when the user should move to recommendations.", ["m09-simulator-screen", "m09-simulator-dev-screen", "m09-flow", "m09-report-screen"]),
  m09_simulator_dev: page("Optimization Recommendations Guide", "Hi. You're on the optimization recommendations screen. I can explain how this page turns campaign signals into proposed actions.", ["m09-simulator-dev-screen", "m09-simulator-screen", "m09-flow", "m09-report-screen"]),
  m09_report: page("Campaign Performance Optimization Report Guide", "Hi. You're on the Campaign Performance Optimization report page. I can explain how this written summary reflects imported datasets, merge quality, and optimization context.", ["m09-report-screen", "m09-import-screen", "m09-simulator-dev-screen", "m09-flow"]),
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
  { faqId: "m03-flow", patterns: [/\b(module\s*3|conversation|thread|deal health)\b/i, /\b(flow|workflow|steps|process|start)\b/i] },
  { faqId: "m03-inputs", patterns: [/\b(module\s*3|conversation|thread|deal health)\b/i, /\b(input|upload|manual log|enter data|add data|where)\b/i] },
  { faqId: "m05-flow", patterns: [/\b(module\s*5|alignment|sales and marketing|sales marketing|web engagement)\b/i, /\b(flow|workflow|steps|process|start)\b/i] },
  { faqId: "m05-inputs", patterns: [/\b(module\s*5|alignment|sales and marketing|sales marketing|web engagement)\b/i, /\b(input|upload|enter data|add data|where)\b/i] },
  { faqId: "m05-web-manager-screen", patterns: [/\b(module\s*5|alignment|sales and marketing|sales marketing|web engagement)\b/i, /\b(upload|csv|dataset|data manager|web engagement data manager|website data)\b/i] },
  { faqId: "m05-web-visualization-screen", patterns: [/\b(module\s*5|alignment|sales and marketing|sales marketing|web engagement)\b/i, /\b(visualization|visualisation|traffic source|campaign activity|page category|web insights|website insights)\b/i] },
  { faqId: "m05-shortcomings-screen", patterns: [/\b(module\s*5|alignment|sales and marketing|sales marketing|shortcoming|bottleneck|weakness|stalled|stagnation)\b/i] },
  { faqId: "m05-communication-screen", patterns: [/\b(module\s*5|alignment|sales and marketing|sales marketing|communication hub|thread|discussion|blocker|follow[- ]?up|ownership)\b/i] },
  { faqId: "m05-overview-screen", patterns: [/\b(module\s*5|alignment|sales and marketing|sales marketing|overview|dashboard|handoff)\b/i] },
  { faqId: "m05-pipeline-screen", patterns: [/\b(module\s*5|alignment|sales and marketing|sales marketing|pipeline|stage distribution|stage summary|funnel shape)\b/i] },
  { faqId: "m06-flow", patterns: [/\b(module\s*6|roi|revenue attribution|attribution)\b/i, /\b(flow|workflow|steps|process|start)\b/i] },
  { faqId: "m06-inputs", patterns: [/\b(module\s*6|roi|revenue attribution|attribution)\b/i, /\b(input|enter data|add data|upload|where)\b/i] },
  { faqId: "m07-flow", patterns: [/\b(module\s*7|funnel|leakage)\b/i, /\b(flow|workflow|steps|process|start)\b/i] },
  { faqId: "m07-inputs", patterns: [/\b(module\s*7|funnel|leakage)\b/i, /\b(input|enter data|add data|upload|where)\b/i] },
  { faqId: "m09-flow", patterns: [/\b(module\s*9|optimization|campaign performance|pacing|fatigue)\b/i, /\b(flow|workflow|steps|process|start)\b/i] },
  { faqId: "m09-inputs", patterns: [/\b(module\s*9|optimization|campaign performance|pacing|fatigue)\b/i, /\b(input|upload|enter data|add data|where)\b/i] },
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
  m01_dashboard: [
    { faqId: "m01-dashboard-screen", patterns: [/.+/i] },
  ],
  m01_report: [
    { faqId: "m01-report-screen", patterns: [/.+/i] },
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
  m02_dashboard: [
    { faqId: "m02-dashboard-screen", patterns: [/.+/i] },
  ],
  m02_report: [
    { faqId: "m02-report-screen", patterns: [/.+/i] },
  ],
  m03_home: [
    { faqId: "m03-flow", patterns: [/\b(flow|workflow|steps|process|start)\b/i] },
    { faqId: "m03-inputs", patterns: [/\b(input|upload|manual log|enter data|where|add data)\b/i] },
    { faqId: "m03-screens", patterns: [/\b(screen|page|what does this mean|what is this)\b/i] },
  ],
  m03_upload: [
    { faqId: "m03-upload-screen", patterns: [/.+/i] },
  ],
  m03_manual_log: [
    { faqId: "m03-manual-log-screen", patterns: [/.+/i] },
  ],
  m03_companies: [
    { faqId: "m03-companies-screen", patterns: [/.+/i] },
  ],
  m03_explorer: [
    { faqId: "m03-explorer-screen", patterns: [/.+/i] },
  ],
  m03_thread_detail: [
    { faqId: "m03-thread-screen", patterns: [/.+/i] },
  ],
  m03_analytics: [
    { faqId: "m03-analytics-screen", patterns: [/.+/i] },
  ],
  m03_deal_health: [
    { faqId: "m03-deal-health-screen", patterns: [/.+/i] },
  ],
  m03_follow_ups: [
    { faqId: "m03-follow-ups-screen", patterns: [/.+/i] },
  ],
  m03_org_timeline: [
    { faqId: "m03-org-timeline-screen", patterns: [/.+/i] },
  ],
  m03_report: [
    { faqId: "m03-report-screen", patterns: [/.+/i] },
  ],
  m05_home: [
    { faqId: "m05-flow", patterns: [/\b(flow|workflow|steps|process|start)\b/i] },
    { faqId: "m05-inputs", patterns: [/\b(input|upload|enter data|where|add data)\b/i] },
    { faqId: "m05-web-manager-screen", patterns: [/\b(upload|csv|dataset|data manager|website data)\b/i] },
    { faqId: "m05-web-visualization-screen", patterns: [/\b(visualization|visualisation|traffic source|campaign|page category|web insights)\b/i] },
    { faqId: "m05-shortcomings-screen", patterns: [/\b(shortcoming|bottleneck|weakness|issue|stalled|stagnation)\b/i] },
    { faqId: "m05-communication-screen", patterns: [/\b(communication|thread|discussion|blocker|follow[- ]?up|owner|ownership)\b/i] },
    { faqId: "m05-overview-screen", patterns: [/\b(overview|dashboard|handoff)\b/i] },
    { faqId: "m05-pipeline-screen", patterns: [/\b(pipeline|stage|funnel)\b/i] },
    { faqId: "m05-screens", patterns: [/\b(screen|page|what does this mean|what is this)\b/i] },
  ],
  m05_overview: [
    { faqId: "m05-flow", patterns: [/\b(flow|workflow|steps|process|start|next)\b/i] },
    { faqId: "m05-pipeline-screen", patterns: [/\b(pipeline|stage|funnel)\b/i] },
    { faqId: "m05-shortcomings-screen", patterns: [/\b(shortcoming|bottleneck|issue|weakness)\b/i] },
    { faqId: "m05-overview-screen", patterns: [/.+/i] },
  ],
  m05_pipeline: [
    { faqId: "m05-overview-screen", patterns: [/\b(overview|dashboard|handoff)\b/i] },
    { faqId: "m05-shortcomings-screen", patterns: [/\b(shortcoming|bottleneck|issue|weakness|stalled|stagnation)\b/i] },
    { faqId: "m05-pipeline-screen", patterns: [/.+/i] },
  ],
  m05_web_engagement: [
    { faqId: "m05-web-visualization-screen", patterns: [/\b(visualization|visualisation|analy[sz]e|after upload|next)\b/i] },
    { faqId: "m05-inputs", patterns: [/\b(where|what first|input|upload|csv|dataset)\b/i] },
    { faqId: "m05-web-manager-screen", patterns: [/.+/i] },
  ],
  m05_web_visualization: [
    { faqId: "m05-web-manager-screen", patterns: [/\b(upload|csv|dataset|data manager|change dataset)\b/i] },
    { faqId: "m05-shortcomings-screen", patterns: [/\b(shortcoming|bottleneck|issue|weakness|what next)\b/i] },
    { faqId: "m05-web-visualization-screen", patterns: [/.+/i] },
  ],
  m05_shortcomings: [
    { faqId: "m05-communication-screen", patterns: [/\b(communication|thread|discussion|follow[- ]?up|owner|ownership|action)\b/i] },
    { faqId: "m05-pipeline-screen", patterns: [/\b(pipeline|stage|funnel)\b/i] },
    { faqId: "m05-web-visualization-screen", patterns: [/\b(web|traffic|campaign|source|dataset)\b/i] },
    { faqId: "m05-shortcomings-screen", patterns: [/.+/i] },
  ],
  m05_communication: [
    { faqId: "m05-shortcomings-screen", patterns: [/\b(shortcoming|bottleneck|issue|weakness|why am i here)\b/i] },
    { faqId: "m05-inputs", patterns: [/\b(where|input|add|create thread|discussion)\b/i] },
    { faqId: "m05-communication-screen", patterns: [/.+/i] },
  ],
  m05_report: [
    { faqId: "m05-report-screen", patterns: [/.+/i] },
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
  m06_report: [{ faqId: "m06-report-screen", patterns: [/.+/i] }],
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
  m07_forecast: [{ faqId: "m07-forecast-screen", patterns: [/.+/i] }],
  m07_leakage: [{ faqId: "m07-leakage-screen", patterns: [/.+/i] }],
  m07_journey: [{ faqId: "m07-journey-screen", patterns: [/.+/i] }],
  m07_fatigue: [{ faqId: "m07-fatigue-screen", patterns: [/.+/i] }],
  m07_recommendations: [{ faqId: "m07-recommendations-screen", patterns: [/.+/i] }],
  m07_trends: [{ faqId: "m07-trends-screen", patterns: [/.+/i] }],
  m07_report: [{ faqId: "m07-report-screen", patterns: [/.+/i] }],
  m09_home: [
    { faqId: "m09-flow", patterns: [/\b(flow|workflow|steps|process|start)\b/i] },
    { faqId: "m09-inputs", patterns: [/\b(input|upload|enter data|where|add data)\b/i] },
    { faqId: "m09-screens", patterns: [/\b(screen|page|what does this mean|what is this)\b/i] },
  ],
  m09_import: [{ faqId: "m09-import-screen", patterns: [/.+/i] }],
  m09_simulator: [{ faqId: "m09-simulator-screen", patterns: [/.+/i] }],
  m09_simulator_dev: [{ faqId: "m09-simulator-dev-screen", patterns: [/.+/i] }],
  m09_report: [{ faqId: "m09-report-screen", patterns: [/.+/i] }],
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
