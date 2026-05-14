export type AssistantPageConfig = {
  workspaceId: string;
  pageKey: string;
  title: string;
};

const PAGE_LABELS: Record<string, string> = {
  workspace_detail: "Workspace Guide",

  m01_home: "Lead Quality & Scoring Guide",
  m01_upload: "Lead Quality & Scoring Uploads Guide",
  m01_preview: "Lead Quality & Scoring Preview Guide",
  m01_merge: "Lead Quality & Scoring Merge Guide",
  m01_merged: "Lead Quality & Scoring Merged Data Guide",
  m01_leads: "Lead Quality & Scoring Leads Guide",
  m01_dashboard: "Lead Quality & Scoring Dashboard Guide",
  m01_report: "Lead Quality & Scoring Report Guide",

  m02_home: "Intent Signals Guide",
  m02_upload: "Intent Signals Uploads Guide",
  m02_preview: "Intent Signals Preview Guide",
  m02_merge: "Intent Signals Merge Guide",
  m02_merged: "Intent Signals Merged Data Guide",
  m02_leads: "Intent Signals Leads Guide",
  m02_upload_wizard: "Intent Signals Upload Wizard Guide",
  m02_generate: "Generate Intent Scores Guide",
  m02_prioritization: "Prioritization Guide",
  m02_intent_forecast: "Intent Forecast Guide",
  m02_dashboard: "Intent Signals Dashboard Guide",
  m02_report: "Intent Signals Report Guide",

  m03_home: "Conversation AI Guide",
  m03_upload: "Conversation Upload Guide",
  m03_manual_log: "Manual Conversation Log Guide",
  m03_companies: "Company Directory Guide",
  m03_explorer: "Conversation Explorer Guide",
  m03_thread_detail: "Conversation Thread Guide",
  m03_analytics: "Conversation Analytics Guide",
  m03_deal_health: "Deal Health Board Guide",
  m03_follow_ups: "Follow-Ups Guide",
  m03_org_timeline: "Organisation Timeline Guide",
  m03_report: "Conversation Intelligence Report Guide",
  m05_home: "Sales & Marketing Alignment Guide",
  m05_overview: "Sales & Marketing Alignment Overview Guide",
  m05_pipeline: "Unified Pipeline Guide",
  m05_web_engagement: "Web Engagement Data Manager Guide",
  m05_web_visualization: "Web Engagement Visualization Guide",
  m05_shortcomings: "Shortcoming Analyzer Guide",
  m05_communication: "Communication Hub Guide",
  m05_report: "Sales & Marketing Alignment Report Guide",

  m06_home: "Revenue Insight Guide",
  m06_overview: "Revenue Insight Overview Guide",
  m06_leads: "Unified Lead Intake Guide",
  m06_campaigns: "Campaign Operations Guide",
  m06_touches: "Touch Operations Guide",
  m06_deals: "Deal Operations Guide",
  m06_journeys: "Journey Preview Guide",
  m06_run_attribution: "Attribution Run Guide",
  m06_roi: "ROI Dashboard Guide",
  m06_roi_calc: "ROI Calculation Guide",
  m06_forecast: "Forecast Guide",
  m06_allocation: "Allocation Guide",
  m06_report: "Revenue Insight Report Guide",

  m07_home: "Funnel Insight Guide",
  m07_leads: "Funnel Insight Shared Leads Guide",
  m07_stages: "Stage History Guide",
  m07_stage_detail: "Stage Detail Guide",
  m07_interactions: "Interaction Guide",
  m07_interaction_detail: "Interaction Detail Guide",
  m07_overview: "Funnel Overview Guide",
  m07_leakage: "Leakage Analysis Guide",
  m07_journey: "Lead Journey Guide",
  m07_fatigue: "Fatigue Analysis Guide",
  m07_recommendations: "Recommendations Guide",
  m07_trends: "Funnel Trends Guide",
  m07_forecast: "Funnel Forecast Guide",
  m07_report: "Funnel Insight Report Guide",

  m09_home: "Campaign Performance Optimization Guide",
  m09_import: "Cross-Channel Performance Guide",
  m09_simulator: "Fatigue & Pacing Checks Guide",
  m09_simulator_dev: "Optimization Recommendations Guide",
  m09_report: "Campaign Performance Optimization Report Guide",
};

export function getAssistantPageTitle(pageKey: string) {
  return PAGE_LABELS[pageKey] || "Guided Assistant";
}

type PageMatcher = {
  test: (rest: string) => boolean;
  pageKey: string;
};

function getModule5PageKey(rest: string) {
  const [base, query = ""] = rest.split("?");
  if (base !== "m05") return null;

  const view = new URLSearchParams(query).get("view");
  if (view === "overview") return "m05_overview";
  if (view === "pipeline") return "m05_pipeline";
  if (view === "web-engagement") return "m05_web_engagement";
  if (view === "web-visualization") return "m05_web_visualization";
  if (view === "shortcomings") return "m05_shortcomings";
  if (view === "communication") return "m05_communication";
  return "m05_home";
}

function getReportPageKey(rest: string) {
  if (rest === "m08/m01") return "m01_report";
  if (rest === "m08/m02") return "m02_report";
  if (rest === "m08/m03") return "m03_report";
  if (rest === "m08/m05") return "m05_report";
  if (rest === "m08/m06") return "m06_report";
  if (rest === "m08/m07") return "m07_report";
  if (rest === "m08/m09") return "m09_report";
  return null;
}

const PAGE_MATCHERS: PageMatcher[] = [
  { test: (rest) => rest === "", pageKey: "workspace_detail" },
  { test: (rest) => getReportPageKey(rest) === "m01_report", pageKey: "m01_report" },
  { test: (rest) => getReportPageKey(rest) === "m02_report", pageKey: "m02_report" },
  { test: (rest) => getReportPageKey(rest) === "m03_report", pageKey: "m03_report" },
  { test: (rest) => getReportPageKey(rest) === "m05_report", pageKey: "m05_report" },
  { test: (rest) => getReportPageKey(rest) === "m06_report", pageKey: "m06_report" },
  { test: (rest) => getReportPageKey(rest) === "m07_report", pageKey: "m07_report" },
  { test: (rest) => getReportPageKey(rest) === "m09_report", pageKey: "m09_report" },

  { test: (rest) => rest === "m01", pageKey: "m01_home" },
  { test: (rest) => rest.startsWith("m01/dashboard"), pageKey: "m01_dashboard" },
  { test: (rest) => rest.startsWith("m01/upload/preview"), pageKey: "m01_preview" },
  { test: (rest) => rest.startsWith("m01/upload"), pageKey: "m01_upload" },
  { test: (rest) => rest.startsWith("m01/merge-columns"), pageKey: "m01_merge" },
  { test: (rest) => rest.startsWith("m01/merged/preview"), pageKey: "m01_preview" },
  { test: (rest) => rest.startsWith("m01/merged"), pageKey: "m01_merged" },
  { test: (rest) => rest.startsWith("m01/leads/preview"), pageKey: "m01_preview" },
  { test: (rest) => rest.startsWith("m01/leads"), pageKey: "m01_leads" },

  { test: (rest) => rest === "m02", pageKey: "m02_home" },
  { test: (rest) => rest.startsWith("m02/upload/preview"), pageKey: "m02_preview" },
  { test: (rest) => rest.startsWith("m02/upload-wizard"), pageKey: "m02_upload_wizard" },
  { test: (rest) => rest.startsWith("m02/upload"), pageKey: "m02_upload" },
  { test: (rest) => rest.startsWith("m02/merge-columns"), pageKey: "m02_merge" },
  { test: (rest) => rest.startsWith("m02/merged/preview"), pageKey: "m02_preview" },
  { test: (rest) => rest.startsWith("m02/merged"), pageKey: "m02_merged" },
  { test: (rest) => rest.startsWith("m02/leads/preview"), pageKey: "m02_preview" },
  { test: (rest) => rest.startsWith("m02/leads"), pageKey: "m02_leads" },
  { test: (rest) => rest.startsWith("m02/generate"), pageKey: "m02_generate" },
  { test: (rest) => rest.startsWith("m02/prioritization"), pageKey: "m02_prioritization" },
  { test: (rest) => rest.startsWith("m02/dashboard"), pageKey: "m02_dashboard" },
  { test: (rest) => rest.startsWith("m02/intent-forecast"), pageKey: "m02_intent_forecast" },

  { test: (rest) => rest === "m03", pageKey: "m03_home" },
  { test: (rest) => rest.startsWith("m03/upload"), pageKey: "m03_upload" },
  { test: (rest) => rest.startsWith("m03/manual-log"), pageKey: "m03_manual_log" },
  { test: (rest) => rest.startsWith("m03/companies"), pageKey: "m03_companies" },
  { test: (rest) => rest.startsWith("m03/explorer"), pageKey: "m03_explorer" },
  { test: (rest) => rest.startsWith("m03/conversations/"), pageKey: "m03_thread_detail" },
  { test: (rest) => rest.startsWith("m03/analytics"), pageKey: "m03_analytics" },
  { test: (rest) => rest.startsWith("m03/deal-health"), pageKey: "m03_deal_health" },
  { test: (rest) => rest.startsWith("m03/follow-ups"), pageKey: "m03_follow_ups" },
  { test: (rest) => rest.startsWith("m03/org-timeline"), pageKey: "m03_org_timeline" },
  { test: (rest) => getModule5PageKey(rest) === "m05_home", pageKey: "m05_home" },
  { test: (rest) => getModule5PageKey(rest) === "m05_overview", pageKey: "m05_overview" },
  { test: (rest) => getModule5PageKey(rest) === "m05_pipeline", pageKey: "m05_pipeline" },
  { test: (rest) => getModule5PageKey(rest) === "m05_web_engagement", pageKey: "m05_web_engagement" },
  { test: (rest) => getModule5PageKey(rest) === "m05_web_visualization", pageKey: "m05_web_visualization" },
  { test: (rest) => getModule5PageKey(rest) === "m05_shortcomings", pageKey: "m05_shortcomings" },
  { test: (rest) => getModule5PageKey(rest) === "m05_communication", pageKey: "m05_communication" },

  { test: (rest) => rest === "m06", pageKey: "m06_home" },
  { test: (rest) => rest.startsWith("m06/roi-calc"), pageKey: "m06_roi_calc" },
  { test: (rest) => rest.startsWith("m06/roi"), pageKey: "m06_roi" },
  { test: (rest) => rest.startsWith("m06/element3"), pageKey: "m06_roi" },
  { test: (rest) => rest.startsWith("m06/element1"), pageKey: "m06_overview" },
  { test: (rest) => rest.startsWith("m06/forecast"), pageKey: "m06_forecast" },
  { test: (rest) => rest.startsWith("m06/campaigns"), pageKey: "m06_campaigns" },
  { test: (rest) => rest.startsWith("m06/touch-workspace"), pageKey: "m06_touches" },
  { test: (rest) => rest.startsWith("m06/touches"), pageKey: "m06_touches" },
  { test: (rest) => rest.startsWith("m06/leads"), pageKey: "m06_leads" },
  { test: (rest) => rest.startsWith("m06/deals"), pageKey: "m06_deals" },
  { test: (rest) => rest.startsWith("m06/journeys"), pageKey: "m06_journeys" },
  { test: (rest) => rest.startsWith("m06/run-attribution"), pageKey: "m06_run_attribution" },
  { test: (rest) => rest.startsWith("m06/allocation"), pageKey: "m06_allocation" },
  { test: (rest) => rest.startsWith("m06/"), pageKey: "m06_overview" },

  { test: (rest) => rest === "m07", pageKey: "m07_home" },
  { test: (rest) => rest.startsWith("m07/overview"), pageKey: "m07_overview" },
  { test: (rest) => rest.startsWith("m07/forecast"), pageKey: "m07_forecast" },
  { test: (rest) => rest.startsWith("m07/leakage"), pageKey: "m07_leakage" },
  { test: (rest) => rest.startsWith("m07/journey/"), pageKey: "m07_journey" },
  { test: (rest) => rest.startsWith("m07/fatigue"), pageKey: "m07_fatigue" },
  { test: (rest) => rest.startsWith("m07/recommendations"), pageKey: "m07_recommendations" },
  { test: (rest) => rest.startsWith("m07/trends"), pageKey: "m07_trends" },
  { test: (rest) => rest.startsWith("m07/leads"), pageKey: "m07_leads" },
  { test: (rest) => rest.startsWith("m07/stages/upload"), pageKey: "m07_stages" },
  { test: (rest) => rest.startsWith("m07/stages/"), pageKey: "m07_stage_detail" },
  { test: (rest) => rest.startsWith("m07/stages"), pageKey: "m07_stages" },
  { test: (rest) => rest.startsWith("m07/interactions/upload"), pageKey: "m07_interactions" },
  { test: (rest) => rest.startsWith("m07/interactions/"), pageKey: "m07_interaction_detail" },
  { test: (rest) => rest.startsWith("m07/interactions"), pageKey: "m07_interactions" },

  { test: (rest) => rest === "m09", pageKey: "m09_home" },
  { test: (rest) => rest.startsWith("m09/import"), pageKey: "m09_import" },
  { test: (rest) => rest.startsWith("m09/simulator-dev"), pageKey: "m09_simulator_dev" },
  { test: (rest) => rest.startsWith("m09/simulator"), pageKey: "m09_simulator" },
];

export function getAssistantConfigFromHash(hash: string): AssistantPageConfig | null {
  const match = hash.match(/^#\/workspace\/([^/]+)(?:\/(.*))?$/);
  if (!match) return null;

  const workspaceId = match[1];
  const rest = (match[2] || "").replace(/\/+$/, "");
  const resolved = PAGE_MATCHERS.find((matcher) => matcher.test(rest));
  if (!resolved) return null;

  return {
    workspaceId,
    pageKey: resolved.pageKey,
    title: getAssistantPageTitle(resolved.pageKey),
  };
}
