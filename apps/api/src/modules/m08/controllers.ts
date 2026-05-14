import type { Request, Response } from 'express';
import UploadFile from '../m01/models/UploadFile.js';
import MergedFile from '../m01/models/MergedFile.js';
import LeadsCodeFile from '../m01/models/LeadsCodeFile.js';
import MappingTemplate from '../m01/models/MappingTemplate.js';
import IntentRun from '../m02/models/IntentRun.js';
import M2LeadIntentSummary from '../m02/models/M2LeadIntentSummary.js';
import M2LeadBehaviorEvent from '../m02/models/M2LeadBehaviorEvent.js';
import Company from '../m03/models/Company.js';
import ConversationMessage from '../m03/models/ConversationMessage.js';
import ConversationThread from '../m03/models/ConversationThreads.js';
import DealHealth from '../m03/models/DealHealth.js';
import FollowUpReminder from '../m03/models/FollowUpReminder.js';
import CommunicationThread from '../m05/models/CommunicationThread.js';
import { Module6Lead } from '../m06/models/Module6Lead.js';
import { Campaign } from '../m06/models/Campaign.js';
import { Deal } from '../m06/models/Deal.js';
import { CampaignTouch } from '../m06/models/CampaignTouch.js';
import { AttributionRun } from '../m06/models/AttributionRun.js';
import { AttributionResult } from '../m06/models/AttributionResult.js';
import FunnelLead from '../m07/models/FunnelLead.js';
import StageHistory from '../m07/models/StageHistory.js';
import Interaction from '../m07/models/Interaction.js';
import MergedDataset from '../m09/models/MergedDataset.js';

type ModuleKey = 'm01' | 'm02' | 'm03' | 'm05' | 'm06' | 'm07' | 'm09';
const MODULE5_UPLOAD_PREFIX = 'm05-web-engagement__';

type ReportMetric = {
  label: string;
  value: string;
  helper: string;
  statusLabel?: string;
  statusTone?: 'healthy' | 'warning' | 'critical' | 'neutral';
};

type ReportSection = {
  key: string;
  title: string;
  description: string;
  columns: string[];
  rows: Array<Array<string | number>>;
};

type ReportExport = {
  key: string;
  label: string;
  description: string;
  filename: string;
};

type ReportPayload = {
  ok: true;
  moduleKey: ModuleKey;
  title: string;
  subtitle: string;
  generatedAt: string;
  reportStatusLabel?: string;
  reportStatusTone?: 'healthy' | 'warning' | 'critical' | 'neutral';
  reportStatusSummary?: string;
  overviewTitle: string;
  overviewBody: string[];
  recommendations: string[];
  metricCards: ReportMetric[];
  highlights: string[];
  sections: ReportSection[];
  exports: ReportExport[];
};

type CsvExportSpec = {
  filename: string;
  header: string[];
  rows: Array<Array<string | number | null | undefined>>;
};

type ReportBundle = {
  payload: ReportPayload;
  csv: Record<string, CsvExportSpec>;
};

function getWorkspaceId(req: Request) {
  return String(
    req.query.workspaceId
    || req.query.workspace
    || req.query.projectId
    || req.body?.workspaceId
    || req.body?.workspace
    || req.body?.projectId
    || ''
  ).trim();
}

function isModuleKey(value: string): value is ModuleKey {
  return value === 'm01' || value === 'm02' || value === 'm03' || value === 'm05' || value === 'm06' || value === 'm07' || value === 'm09';
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return 'N/A';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toISOString().slice(0, 10);
}

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return 'N/A';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toISOString().replace('T', ' ').slice(0, 16);
}

function formatNumber(value: number | null | undefined, digits = 0) {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return '0';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(num);
}

function formatPercent(value: number | null | undefined, digits = 1) {
  return `${formatNumber(value, digits)}%`;
}

function formatCurrency(value: number | null | undefined) {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(num);
}

function csvEscape(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function csvText(header: string[], rows: Array<Array<string | number | null | undefined>>) {
  return [header, ...rows]
    .map((row) => row.map((cell) => csvEscape(cell ?? '')).join(','))
    .join('\n');
}

function statusFromLevel(level: 'healthy' | 'warning' | 'critical' | 'neutral', label: string) {
  return { statusTone: level, statusLabel: label };
}

function getUploadModuleTag(item: any) {
  return String(item?.module || item?.metadata?.module || '').toLowerCase();
}

async function buildM03Report(workspaceId: string): Promise<ReportBundle> {
  const [companies, threads, messages, healthRows, followUps] = await Promise.all([
    Company.find({ workspaceId }).sort({ createdAt: -1 }).lean(),
    ConversationThread.find({ workspaceId }).sort({ lastMessageAt: -1, updatedAt: -1 }).lean(),
    ConversationMessage.find({ workspaceId }).sort({ sentAt: -1 }).lean(),
    DealHealth.find({ workspaceId }).sort({ lastComputedAt: -1 }).lean(),
    FollowUpReminder.find({ workspaceId }).sort({ dueAt: 1, createdAt: -1 }).lean(),
  ]);

  const threadIdsSeen = new Set<string>();
  const latestHealthByThread = [];
  for (const row of healthRows as any[]) {
    const key = String(row.threadId || '');
    if (!key || threadIdsSeen.has(key)) continue;
    threadIdsSeen.add(key);
    latestHealthByThread.push(row);
  }

  const now = Date.now();
  const pendingFollowUps = (followUps as any[]).filter((item) => item.status === 'pending');
  const overdueFollowUps = pendingFollowUps.filter((item) => item.dueAt && new Date(item.dueAt).getTime() < now);
  const channelCounts = new Map<string, number>();
  const sourceCounts = new Map<string, number>();
  const companyThreadCounts = new Map<string, number>();
  const bandCounts = new Map<string, number>();

  for (const thread of threads as any[]) {
    const channel = thread.channel || 'other';
    channelCounts.set(channel, (channelCounts.get(channel) || 0) + 1);
    const source = thread.source || 'upload';
    sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
    const companyId = thread.companyId ? String(thread.companyId) : 'unassigned';
    companyThreadCounts.set(companyId, (companyThreadCounts.get(companyId) || 0) + 1);
  }

  for (const health of latestHealthByThread as any[]) {
    const band = health.band || 'steady';
    bandCounts.set(band, (bandCounts.get(band) || 0) + 1);
  }

  const channelSummary = Array.from(channelCounts.entries())
    .map(([channel, count]) => ({ channel, count, share: threads.length > 0 ? (count / threads.length) * 100 : 0 }))
    .sort((a, b) => b.count - a.count);
  const sourceSummary = Array.from(sourceCounts.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);
  const bandSummary = Array.from(bandCounts.entries())
    .map(([band, count]) => ({ band, count }))
    .sort((a, b) => b.count - a.count);

  const companiesById = new Map((companies as any[]).map((company) => [String(company._id), company]));
  const topCompanies = Array.from(companyThreadCounts.entries())
    .map(([companyId, count]) => ({
      companyId,
      name: companyId === 'unassigned' ? 'Unassigned company' : (companiesById.get(companyId)?.name || 'Unknown company'),
      domain: companyId === 'unassigned' ? '' : (companiesById.get(companyId)?.primaryDomain || ''),
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const atRiskCount = bandCounts.get('at_risk') || 0;
  const healthyCount = bandCounts.get('healthy') || 0;
  const latestThread = (threads as any[])[0];
  const busiestChannel = channelSummary[0];

  return {
    payload: {
      ok: true,
      moduleKey: 'm03',
      title: 'Conversation Intelligence Report',
      subtitle: 'Workspace-level view of conversation coverage, channel activity, deal health pressure, and follow-up workload.',
      generatedAt: new Date().toISOString(),
      reportStatusLabel: threads.length === 0 ? 'Critical Setup Gap' : overdueFollowUps.length > 0 || atRiskCount > 0 ? 'Needs Attention' : 'Ready',
      reportStatusTone: threads.length === 0 ? 'critical' : overdueFollowUps.length > 0 || atRiskCount > 0 ? 'warning' : 'healthy',
      reportStatusSummary: threads.length === 0
        ? 'No conversation thread history is available yet, so Module 3 cannot support risk reading or action planning.'
        : overdueFollowUps.length > 0
          ? `${formatNumber(overdueFollowUps.length)} follow-up items are already overdue, so current conversation visibility is not yet translating into timely action.`
          : `Conversation coverage is active and the current follow-up queue is broadly under control, which makes this module usable as a management signal layer.`,
      overviewTitle: 'Executive Summary',
      overviewBody: [
        `Conversation Intelligence is the message-level operating layer for commercial teams. Its purpose is to convert conversation records into visibility on account activity, follow-up pressure, and health signals that help sales and marketing respond faster.`,
        threads.length > 0
          ? `${formatNumber(threads.length)} conversation threads and ${formatNumber(messages.length)} messages are currently available. ${busiestChannel ? `${busiestChannel.channel} is the busiest tracked channel at ${formatPercent(busiestChannel.share, 1)} of thread volume.` : ''}`
          : 'No conversation threads are currently stored, so conversation reporting is still in setup mode.',
        latestHealthByThread.length > 0
          ? `${formatNumber(atRiskCount)} latest deal-health records are currently marked at risk, while ${formatNumber(healthyCount)} are healthy. ${formatNumber(overdueFollowUps.length)} follow-ups are already overdue and should be reviewed first.`
          : 'Deal-health records have not been computed yet, so the report is currently focused on raw conversation coverage rather than account risk.',
      ],
      recommendations: [
        threads.length === 0 ? 'Import or manually log conversation records first so account-level insight can be generated from real communication history.' : 'Keep conversation intake current so health scoring and follow-up decisions continue to reflect recent account behavior.',
        overdueFollowUps.length > 0 ? `Clear the ${formatNumber(overdueFollowUps.length)} overdue follow-ups first; aging follow-up backlog usually weakens response quality and deal momentum.` : 'The current follow-up queue is not showing overdue backlog pressure.',
        atRiskCount > 0 ? `Review the ${formatNumber(atRiskCount)} at-risk deal-health records with thread context so commercial teams can intervene before engagement weakens further.` : 'No at-risk deal-health band is dominating the current workspace, so teams can focus more on consistency than rescue work.',
      ],
      metricCards: [
        { label: 'Tracked Companies', value: formatNumber(companies.length), helper: `${formatNumber(topCompanies.length)} companies currently appear in thread activity summaries.`, ...statusFromLevel(companies.length > 0 ? 'healthy' : 'critical', companies.length > 0 ? 'Coverage Active' : 'No Coverage') },
        { label: 'Conversation Threads', value: formatNumber(threads.length), helper: `${formatNumber(messages.length)} total messages are linked to those threads.`, ...statusFromLevel(threads.length > 0 ? 'healthy' : 'critical', threads.length > 0 ? 'Thread History Active' : 'No Thread History') },
        { label: 'At-Risk Deals', value: formatNumber(atRiskCount), helper: `${formatNumber(healthyCount)} latest health records are currently healthy.`, ...statusFromLevel(atRiskCount === 0 ? 'healthy' : atRiskCount <= 5 ? 'warning' : 'critical', atRiskCount === 0 ? 'Stable' : atRiskCount <= 5 ? 'Watchlist' : 'Risk Pressure') },
        { label: 'Pending Follow-Ups', value: formatNumber(pendingFollowUps.length), helper: `${formatNumber(overdueFollowUps.length)} are already overdue.`, ...statusFromLevel(overdueFollowUps.length === 0 ? 'healthy' : overdueFollowUps.length <= 5 ? 'warning' : 'critical', overdueFollowUps.length === 0 ? 'Controlled' : overdueFollowUps.length <= 5 ? 'Backlog Building' : 'Backlog Risk') },
      ],
      highlights: [
        latestThread ? `The latest tracked thread is "${latestThread.subject || 'Untitled thread'}", which confirms current activity, but managers should compare that recency against the overdue follow-up queue before assuming response discipline is healthy.` : 'No tracked conversation thread exists yet.',
        busiestChannel ? `${busiestChannel.channel} is the most visible conversation channel. If one channel dominates heavily, managers should check whether response quality in other channels is being under-read.` : 'No channel mix can be calculated yet.',
        latestHealthByThread.length > 0 ? `${formatNumber(latestHealthByThread.length)} latest deal-health records exist, which means Module 3 is now capable of management-level risk reading rather than just message storage.` : 'No latest deal-health records are available yet.',
      ],
      sections: [
        {
          key: 'coverage-summary',
          title: 'Conversation Coverage Summary',
          description: 'Current state of account coverage, communication activity, and action workload in Module 3.',
          columns: ['Area', 'Current State', 'Interpretation'],
          rows: [
            ['Tracked companies', formatNumber(companies.length), companies.length > 0 ? 'Account-level conversation coverage exists.' : 'No company coverage is available yet.'],
            ['Conversation threads', formatNumber(threads.length), threads.length > 0 ? 'Thread-level communication history is available.' : 'No thread history is stored yet.'],
            ['Deal health records', formatNumber(latestHealthByThread.length), latestHealthByThread.length > 0 ? 'Health signals are available for risk reading.' : 'Health scoring has not been generated yet.'],
            ['Overdue follow-ups', formatNumber(overdueFollowUps.length), overdueFollowUps.length > 0 ? 'Action backlog is visible and needs response discipline.' : 'No overdue follow-up backlog is visible.'],
          ],
        },
        {
          key: 'channel-mix',
          title: 'Channel and Source Mix',
          description: 'Where conversation volume is coming from and how records are entering the workspace.',
          columns: ['Type', 'Category', 'Count', 'Share / Commentary'],
          rows: [
            ...channelSummary.slice(0, 6).map((item) => ['Channel', item.channel, item.count, formatPercent(item.share, 1)]),
            ...sourceSummary.slice(0, 3).map((item) => ['Source', item.source, item.count, 'Conversation ingestion source']),
          ],
        },
        {
          key: 'deal-health',
          title: 'Deal Health Distribution',
          description: 'Latest available health status across conversation-linked accounts and deals.',
          columns: ['Health Band', 'Count', 'Interpretation'],
          rows: bandSummary.map((item) => [
            item.band,
            item.count,
            item.band === 'at_risk' ? 'Requires intervention and follow-up attention.' : item.band === 'healthy' ? 'Strong communication health signal.' : 'Stable but should continue to be monitored.',
          ]),
        },
        {
          key: 'follow-up-queue',
          title: 'Follow-Up Queue',
          description: 'Current follow-up reminders that represent pending or overdue action for the commercial team.',
          columns: ['Status', 'Due', 'Thread ID', 'Reason'],
          rows: (followUps as any[]).slice(0, 12).map((item) => [
            item.status || 'pending',
            formatDateTime(item.snoozedUntil || item.dueAt),
            String(item.threadId || ''),
            item.reason || 'No reason recorded',
          ]),
        },
        {
          key: 'company-activity',
          title: 'Most Active Companies',
          description: 'Companies with the highest visible conversation-thread volume in the workspace.',
          columns: ['Company', 'Primary Domain', 'Thread Count'],
          rows: topCompanies.map((item) => [item.name, item.domain || 'N/A', item.count]),
        },
      ],
      exports: [
        { key: 'companies', label: 'Companies CSV', description: 'Tracked companies with conversation coverage in this workspace.', filename: 'm03_companies_report.csv' },
        { key: 'threads', label: 'Conversation Threads CSV', description: 'Thread-level activity and recency records.', filename: 'm03_conversation_threads_report.csv' },
        { key: 'messages', label: 'Messages CSV', description: 'Message-level records supporting analytics and health signals.', filename: 'm03_messages_report.csv' },
        { key: 'deal-health', label: 'Deal Health CSV', description: 'Latest and historical deal-health scoring records.', filename: 'm03_deal_health_report.csv' },
        { key: 'follow-ups', label: 'Follow-Ups CSV', description: 'Follow-up reminder queue and due-state detail.', filename: 'm03_followups_report.csv' },
      ],
    },
    csv: {
      companies: {
        filename: 'm03_companies_report.csv',
        header: ['company_id', 'name', 'primary_domain', 'aliases', 'created_at'],
        rows: (companies as any[]).map((item) => [String(item._id), item.name || '', item.primaryDomain || '', Array.isArray(item.aliases) ? item.aliases.join(' | ') : '', formatDateTime(item.createdAt)]),
      },
      threads: {
        filename: 'm03_conversation_threads_report.csv',
        header: ['thread_id', 'subject', 'channel', 'source', 'message_count', 'first_message_at', 'last_message_at'],
        rows: (threads as any[]).map((item) => [String(item._id), item.subject || '', item.channel || 'other', item.source || 'upload', Number(item.messageCount || 0), formatDateTime(item.firstMessageAt), formatDateTime(item.lastMessageAt)]),
      },
      messages: {
        filename: 'm03_messages_report.csv',
        header: ['message_id', 'thread_id', 'channel', 'direction', 'sender_name', 'sender_role', 'sent_at', 'subject'],
        rows: (messages as any[]).map((item) => [String(item._id), String(item.threadId || ''), item.channel || 'other', item.direction || 'inbound', item.sender?.name || '', item.sender?.role || '', formatDateTime(item.sentAt), item.subject || '']),
      },
      'deal-health': {
        filename: 'm03_deal_health_report.csv',
        header: ['thread_id', 'deal_id', 'score', 'band', 'trend', 'probability_healthy', 'last_computed_at', 'summary'],
        rows: (healthRows as any[]).map((item) => [String(item.threadId || ''), item.dealId ? String(item.dealId) : '', Number(item.score || 0), item.band || 'steady', item.trend || 'flat', Number(item.probabilityHealthy || 0), formatDateTime(item.lastComputedAt), item.summary || '']),
      },
      'follow-ups': {
        filename: 'm03_followups_report.csv',
        header: ['followup_id', 'thread_id', 'status', 'due_at', 'snoozed_until', 'reason', 'created_at'],
        rows: (followUps as any[]).map((item) => [String(item._id), String(item.threadId || ''), item.status || 'pending', formatDateTime(item.dueAt), formatDateTime(item.snoozedUntil), item.reason || '', formatDateTime(item.createdAt)]),
      },
    },
  };
}

async function buildM01Report(workspaceId: string): Promise<ReportBundle> {
  const [uploads, mergedFiles, leadOutputs, templateCount] = await Promise.all([
    UploadFile.find({ workspace: workspaceId }).sort({ createdAt: -1 }).lean(),
    MergedFile.find({ workspace: workspaceId }).sort({ createdAt: -1 }).lean(),
    LeadsCodeFile.find({ workspace: workspaceId }).sort({ createdAt: -1 }).lean(),
    MappingTemplate.countDocuments({ workspace: workspaceId }),
  ]);

  const activeUploads = uploads.filter((item: any) => item.status !== 'archived');
  const archivedUploads = uploads.filter((item: any) => item.status === 'archived');
  const totalUploadBytes = uploads.reduce((sum: number, item: any) => sum + Number(item.length || 0), 0);
  const latestUpload = uploads[0];
  const latestMerge = mergedFiles[0];
  const latestLeadOutput = leadOutputs[0];
  const mergeCoverage = activeUploads.length > 0 ? (mergedFiles.length / activeUploads.length) * 100 : 0;
  const artifactCoverage = mergedFiles.length > 0 ? (leadOutputs.length / mergedFiles.length) * 100 : 0;
  const processingGap = Math.max(0, mergedFiles.length - leadOutputs.length);
  const readinessLevel = leadOutputs.length > 0
    ? (processingGap === 0 ? 'High' : 'Moderate')
    : 'Low';

  return {
    payload: {
      ok: true,
      moduleKey: 'm01',
      title: 'Lead Intake and Scoring Readiness Report',
      subtitle: 'Executive view of source intake, transformation progress, and readiness of lead datasets for downstream decision modules.',
      generatedAt: new Date().toISOString(),
      reportStatusLabel: readinessLevel === 'High' ? 'Ready' : readinessLevel === 'Moderate' ? 'Needs Attention' : 'Critical Setup Gap',
      reportStatusTone: readinessLevel === 'High' ? 'healthy' : readinessLevel === 'Moderate' ? 'warning' : 'critical',
      reportStatusSummary: processingGap > 0
        ? `${formatNumber(processingGap)} merged dataset(s) still have not been converted into lead-ready outputs, so downstream modules are working with incomplete intake coverage.`
        : `Merged-to-output conversion is currently controlled, which means Module 1 is operating as a dependable intake gate for downstream scoring and analysis.`,
      overviewTitle: 'Executive Summary',
      overviewBody: [
        `Lead Quality & Scoring is the workspace intake-control layer. Its purpose is to convert raw lead-source files into standardized, decision-ready assets that downstream scoring, attribution, and funnel workflows can rely on.`,
        `Current readiness is assessed as ${readinessLevel}. ${formatNumber(activeUploads.length)} active uploads have produced ${formatNumber(mergedFiles.length)} merged datasets and ${formatNumber(leadOutputs.length)} generated lead artifacts, which means the pipeline is ${formatPercent(artifactCoverage, 1)} covered from merged output into scored lead output.`,
        processingGap > 0
          ? `There are still ${formatNumber(processingGap)} merged datasets without corresponding lead-ready outputs. This indicates that operational intake has not yet been fully converted into downstream-ready lead assets.`
          : `Merged datasets are being translated into lead-ready outputs without a current backlog, indicating strong operational readiness for downstream analytics and activation use.`,
      ],
      recommendations: [
        processingGap > 0 ? `${formatNumber(processingGap)} merged dataset(s) are still waiting for lead-output generation. Clear that backlog before the next scoring or attribution cycle.` : 'No merged-output backlog is visible. Preserve the current conversion cadence so every new merge produces a lead-ready artifact quickly.',
        templateCount === 0 ? 'No approved mapping template is stored for this workspace. Create one before the next major intake batch to reduce merge inconsistency.' : `${formatNumber(templateCount)} mapping template(s) are available. Keep using them so field structure stays stable across uploads.`,
        latestUpload && !latestLeadOutput ? `The latest uploaded batch (${latestUpload.originalName || latestUpload.filename}) has not yet produced a lead-ready artifact. Pause downstream operational use until that conversion is complete.` : 'The latest uploaded and generated assets are aligned closely enough for downstream review, subject to normal validation checks.',
      ],
      metricCards: [
        { label: 'Source Batches', value: formatNumber(activeUploads.length), helper: `${formatNumber(archivedUploads.length)} archived batches retained for audit history.`, ...statusFromLevel(activeUploads.length > 0 ? 'healthy' : 'critical', activeUploads.length > 0 ? 'Active Intake' : 'No Intake') },
        { label: 'Merged Datasets', value: formatNumber(mergedFiles.length), helper: `${formatPercent(mergeCoverage, 1)} of active uploads have a merged output.`, ...statusFromLevel(mergeCoverage >= 80 ? 'healthy' : mergeCoverage >= 40 ? 'warning' : 'critical', mergeCoverage >= 80 ? 'Strong Coverage' : mergeCoverage >= 40 ? 'Partial Coverage' : 'Weak Coverage') },
        { label: 'Lead-Ready Outputs', value: formatNumber(leadOutputs.length), helper: `${formatPercent(artifactCoverage, 1)} of merged datasets have generated lead artifacts.`, ...statusFromLevel(artifactCoverage >= 80 ? 'healthy' : artifactCoverage >= 40 ? 'warning' : 'critical', artifactCoverage >= 80 ? 'Operational' : artifactCoverage >= 40 ? 'Incomplete' : 'Blocked') },
        { label: 'Pipeline Backlog', value: formatNumber(processingGap), helper: `${formatNumber(totalUploadBytes / (1024 * 1024), 1)} MB of intake volume tracked across the workspace.`, ...statusFromLevel(processingGap === 0 ? 'healthy' : processingGap <= 2 ? 'warning' : 'critical', processingGap === 0 ? 'Controlled' : processingGap <= 2 ? 'Open Backlog' : 'Backlog Risk') },
      ],
      highlights: [
        latestUpload ? `Source intake is active, but management should confirm whether ${latestUpload.originalName || latestUpload.filename} has already moved into merge and lead-output conversion.` : 'No source uploads have been recorded yet, so Module 1 cannot currently support downstream scoring readiness.',
        latestMerge ? `${formatNumber(mergedFiles.length)} merged dataset(s) are available, which means standardization is happening, but only ${formatNumber(leadOutputs.length)} lead-ready artifact(s) exist behind them.` : 'No merged datasets exist yet, so raw intake has not progressed into a usable standard structure.',
        latestLeadOutput ? `${latestLeadOutput.filename} is the latest generated asset, which means downstream modules can work from an output file rather than raw intake, provided backlog remains controlled.` : 'No lead-ready output has been generated yet, which means downstream users are still blocked at the intake-preparation stage.',
      ],
      sections: [
        {
          key: 'pipeline-health',
          title: 'Pipeline Readiness Summary',
          description: 'Operational progression from raw lead intake to standardized and generated lead assets.',
          columns: ['Stage', 'Count', 'Business Meaning'],
          rows: [
            ['Raw source batches', activeUploads.length, 'Uploaded input files awaiting or supporting transformation.'],
            ['Merged datasets', mergedFiles.length, 'Standardized datasets prepared for lead quality and scoring workflows.'],
            ['Lead-ready outputs', leadOutputs.length, 'Generated artifacts ready for downstream use in Intent Signals, Revenue Insight, or related analysis.'],
            ['Unconverted merged backlog', processingGap, 'Merged datasets still waiting for lead-output generation.'],
          ],
        },
        {
          key: 'output-readiness',
          title: 'Downstream Readiness Assessment',
          description: 'Whether the current intake state is sufficient for later scoring, prioritization, and revenue workflows.',
          columns: ['Readiness Area', 'Status', 'Commentary'],
          rows: [
            ['Intake continuity', activeUploads.length > 0 ? 'Active' : 'Missing', activeUploads.length > 0 ? 'The workspace is receiving lead source files.' : 'No current source activity is recorded.'],
            ['Standardization', mergedFiles.length > 0 ? 'Available' : 'Missing', mergedFiles.length > 0 ? 'Merged datasets are present for normalized lead structure.' : 'No merged dataset exists for downstream use.'],
            ['Scoring readiness', leadOutputs.length > 0 ? 'Available' : 'Missing', leadOutputs.length > 0 ? 'At least one generated lead artifact is available for downstream modules.' : 'Generated lead outputs are missing.'],
            ['Operational backlog', processingGap === 0 ? 'Controlled' : 'Open', processingGap === 0 ? 'No unprocessed merged backlog is visible.' : `${formatNumber(processingGap)} merged dataset(s) still need lead-output generation.`],
          ],
        },
        {
          key: 'latest-assets',
          title: 'Latest Operational Assets',
          description: 'Most recent intake, merge, and generated assets available to business users.',
          columns: ['Asset Type', 'Name', 'Created', 'Use'],
          rows: [
            ['Latest upload', latestUpload?.originalName || latestUpload?.filename || 'N/A', formatDateTime(latestUpload?.createdAt), 'Most recent raw intake source.'],
            ['Latest merged dataset', latestMerge?.name || latestMerge?.filename || 'N/A', formatDateTime(latestMerge?.createdAt), 'Current standardized source for lead processing.'],
            ['Latest lead artifact', latestLeadOutput?.name || latestLeadOutput?.filename || 'N/A', formatDateTime(latestLeadOutput?.createdAt), 'Most recent downstream-ready lead output.'],
            ['Mapping templates', formatNumber(templateCount), 'Current', templateCount > 0 ? 'Reusable merge logic exists.' : 'Merge logic is still manual or ad hoc.'],
          ],
        },
        {
          key: 'uploads',
          title: 'Recent Source Intake',
          description: 'Latest raw lead-source files entering the intake workflow.',
          columns: ['File', 'Status', 'Size KB', 'Created'],
          rows: uploads.slice(0, 8).map((item: any) => [
            item.originalName || item.filename || 'Untitled upload',
            item.status || 'active',
            formatNumber((Number(item.length || 0) / 1024), 1),
            formatDateTime(item.createdAt),
          ]),
        },
        {
          key: 'merged',
          title: 'Merged Dataset Register',
          description: 'Standardized datasets prepared for scoring and downstream use.',
          columns: ['Dataset', 'Source Files', 'Size KB', 'Created'],
          rows: mergedFiles.slice(0, 8).map((item: any) => [
            item.name || item.filename || 'Merged dataset',
            Array.isArray(item.uploadNames) ? item.uploadNames.length : Array.isArray(item.uploadIds) ? item.uploadIds.length : 0,
            formatNumber((Number(item.length || 0) / 1024), 1),
            formatDateTime(item.createdAt),
          ]),
        },
        {
          key: 'outputs',
          title: 'Generated Lead Outputs',
          description: 'Lead-ready outputs produced by the intake and standardization pipeline.',
          columns: ['Artifact', 'Merged Source', 'Size KB', 'Created'],
          rows: leadOutputs.slice(0, 8).map((item: any) => [
            item.name || item.filename || 'Lead output',
            item.mergedId ? String(item.mergedId) : 'N/A',
            formatNumber((Number(item.length || 0) / 1024), 1),
            formatDateTime(item.createdAt),
          ]),
        },
      ],
      exports: [
        { key: 'uploads', label: 'Uploads CSV', description: 'All raw upload records for this workspace.', filename: 'm01_uploads_report.csv' },
        { key: 'merged-files', label: 'Merged Files CSV', description: 'Merged dataset inventory and provenance.', filename: 'm01_merged_files_report.csv' },
        { key: 'lead-outputs', label: 'Lead Outputs CSV', description: 'Generated lead-ready artifact inventory.', filename: 'm01_lead_outputs_report.csv' },
      ],
    },
    csv: {
      uploads: {
        filename: 'm01_uploads_report.csv',
        header: ['filename', 'original_name', 'status', 'size_bytes', 'created_at'],
        rows: uploads.map((item: any) => [item.filename, item.originalName || '', item.status || 'active', Number(item.length || 0), formatDateTime(item.createdAt)]),
      },
      'merged-files': {
        filename: 'm01_merged_files_report.csv',
        header: ['name', 'filename', 'source_file_count', 'size_bytes', 'created_at'],
        rows: mergedFiles.map((item: any) => [
          item.name || '',
          item.filename || '',
          Array.isArray(item.uploadNames) ? item.uploadNames.length : Array.isArray(item.uploadIds) ? item.uploadIds.length : 0,
          Number(item.length || 0),
          formatDateTime(item.createdAt),
        ]),
      },
      'lead-outputs': {
        filename: 'm01_lead_outputs_report.csv',
        header: ['name', 'filename', 'merged_id', 'size_bytes', 'created_at', 'input_filename', 'output_filename'],
        rows: leadOutputs.map((item: any) => [
          item.name || '',
          item.filename || '',
          item.mergedId ? String(item.mergedId) : '',
          Number(item.length || 0),
          formatDateTime(item.createdAt),
          item.inputFilename || '',
          item.outputFilename || '',
        ]),
      },
    },
  };
}

async function buildM02Report(workspaceId: string): Promise<ReportBundle> {
  const [latestRun, intentDocs, behaviorDocs] = await Promise.all([
    IntentRun.findOne({ workspace: workspaceId }).sort({ createdAt: -1 }).lean(),
    M2LeadIntentSummary.find({ workspaceId }).sort({ intentScore: -1 }).lean(),
    M2LeadBehaviorEvent.find({ workspaceId }).sort({ timestamp: -1 }).lean(),
  ]);

  const totalLeads = intentDocs.length;
  const totalBehaviorEvents = behaviorDocs.length;
  const avgIntent = totalLeads ? intentDocs.reduce((sum, item: any) => sum + Number(item.intentScore || 0), 0) / totalLeads : 0;
  const urgentCount = intentDocs.filter((item: any) => item.isUrgentEscalation).length;

  const segmentStats = ['BLAZING', 'HOT', 'WARM', 'COLD'].map((segment) => {
    const rows = intentDocs.filter((item: any) => item.intentSegment === segment);
    const avgSegmentIntent = rows.length ? rows.reduce((sum, item: any) => sum + Number(item.intentScore || 0), 0) / rows.length : 0;
    return { segment, count: rows.length, avgIntent: avgSegmentIntent };
  });

  const behaviorByTypeMap = new Map<string, { count: number; scoreSum: number }>();
  for (const item of behaviorDocs) {
    const key = item.eventType || 'unknown';
    const bucket = behaviorByTypeMap.get(key) || { count: 0, scoreSum: 0 };
    bucket.count += 1;
    bucket.scoreSum += Number(item.engagementScore || 0);
    behaviorByTypeMap.set(key, bucket);
  }
  const behaviorByType = Array.from(behaviorByTypeMap.entries())
    .map(([eventType, bucket]) => ({
      eventType,
      count: bucket.count,
      avgEngagement: bucket.count ? bucket.scoreSum / bucket.count : 0,
    }))
    .sort((a, b) => b.count - a.count);
  const hotPipeline = (segmentStats.find((item) => item.segment === 'HOT')?.count || 0) + (segmentStats.find((item) => item.segment === 'BLAZING')?.count || 0);
  const hotShare = totalLeads > 0 ? (hotPipeline / totalLeads) * 100 : 0;
  const topBehavior = behaviorByType[0];
  const avgBehaviorEngagement = totalBehaviorEvents
    ? behaviorDocs.reduce((sum, item: any) => sum + Number(item.engagementScore || 0), 0) / totalBehaviorEvents
    : 0;

  return {
    payload: {
      ok: true,
      moduleKey: 'm02',
      title: 'Intent Prioritization Report',
      subtitle: 'Current intent mix, lead urgency, and observed behavior momentum for the workspace.',
      generatedAt: new Date().toISOString(),
      reportStatusLabel: totalLeads === 0 ? 'Critical Setup Gap' : hotShare >= 20 && totalBehaviorEvents > 0 ? 'Ready' : 'Needs Attention',
      reportStatusTone: totalLeads === 0 ? 'critical' : hotShare >= 20 && totalBehaviorEvents > 0 ? 'healthy' : 'warning',
      reportStatusSummary: totalLeads === 0
        ? 'No scored leads are currently available, so the prioritization layer is not yet usable for revenue-facing decisions.'
        : totalBehaviorEvents === 0
          ? 'Leads are scored, but the report is missing behavior telemetry, so intent confidence is weaker than the headline queue suggests.'
          : `Intent prioritization is active with ${formatNumber(hotPipeline)} HOT/BLAZING leads in view, but managers should still validate whether that queue is being acted on quickly enough.`,
      overviewTitle: 'Executive Summary',
      overviewBody: [
        `Intent Signals converts prepared lead data into action priority. Its purpose is to show which leads deserve immediate outreach, which should be nurtured, and where engagement is still too weak for commercial follow-up.`,
        totalLeads > 0
          ? `${formatNumber(totalLeads)} scored leads are currently available. ${formatNumber(hotPipeline)} of them sit in the HOT or BLAZING segments, representing ${formatPercent(hotShare, 1)} of the active opportunity pool.`
          : 'No scored leads are currently available, so prioritization is not yet operational.',
        totalBehaviorEvents > 0
          ? `Behavior telemetry is active, with ${formatNumber(totalBehaviorEvents)} recorded events. The most common activity type is ${topBehavior?.eventType || 'unknown'}, indicating the current dominant engagement pattern feeding prioritization logic.`
          : 'Behavior telemetry has not been uploaded yet, which limits confidence in intent interpretation.',
      ],
      recommendations: [
        hotPipeline > 0 ? `${formatNumber(hotPipeline)} HOT/BLAZING leads are already visible. Route them into an explicit same-day follow-up lane instead of leaving them inside the general queue.` : 'No high-intent opportunity pool is visible yet. Refresh scored lead output before using Module 2 for action planning.',
        totalBehaviorEvents === 0 ? 'Behavior-event coverage is missing. Upload telemetry before the next prioritization review so urgency is based on live engagement rather than static scores alone.' : `Behavior telemetry is active across ${formatNumber(totalBehaviorEvents)} events. Keep refreshing it so current engagement can continue to reshape the queue.`,
        urgentCount > 0 ? `${formatNumber(urgentCount)} urgent-escalation leads should be handled as a separate management list so they are not diluted by standard nurture traffic.` : 'No urgent escalation cohort is currently flagged, so the normal priority sequence can remain unchanged.',
      ],
      metricCards: [
        { label: 'Scored Leads', value: formatNumber(totalLeads), helper: latestRun ? `Latest run status: ${latestRun.status}.` : 'No scoring run recorded yet.', ...statusFromLevel(totalLeads > 0 ? 'healthy' : 'critical', totalLeads > 0 ? 'Queue Available' : 'No Queue') },
        { label: 'Average Intent', value: formatPercent(avgIntent, 1), helper: 'Mean intent score across stored intent-scoring leads.', ...statusFromLevel(avgIntent >= 60 ? 'healthy' : avgIntent >= 35 ? 'warning' : 'critical', avgIntent >= 60 ? 'Strong Demand' : avgIntent >= 35 ? 'Mixed Demand' : 'Weak Demand') },
        { label: 'Urgent Escalations', value: formatNumber(urgentCount), helper: 'Leads marked for immediate follow-up.', ...statusFromLevel(urgentCount === 0 ? 'healthy' : urgentCount <= 10 ? 'warning' : 'critical', urgentCount === 0 ? 'Controlled' : urgentCount <= 10 ? 'Watchlist' : 'Escalation Risk') },
        { label: 'Behavior Events', value: formatNumber(totalBehaviorEvents), helper: `Mean event engagement score: ${formatNumber(avgBehaviorEngagement, 2)}.`, ...statusFromLevel(totalBehaviorEvents > 0 ? 'healthy' : 'critical', totalBehaviorEvents > 0 ? 'Telemetry Active' : 'Telemetry Missing') },
      ],
      highlights: [
        latestRun ? `The latest intent run completed with status ${latestRun.status}. Management should treat that run as the active decision baseline until the next scoring refresh.` : 'No intent scoring run exists yet, so Module 2 is not ready for action planning.',
        totalLeads > 0 ? `${formatNumber(segmentStats.find((item) => item.segment === 'HOT')?.count || 0)} HOT and ${formatNumber(segmentStats.find((item) => item.segment === 'BLAZING')?.count || 0)} BLAZING leads are surfaced, which means the queue contains a real immediate-action cohort rather than just nurture traffic.` : 'No prioritized leads are stored yet.',
        totalBehaviorEvents > 0 ? `${behaviorByType[0]?.eventType || 'Current'} behavior currently dominates telemetry, which should guide which outreach motion gets commercial attention first.` : 'Behavior telemetry has not been uploaded yet, so score confidence is weaker than it should be.',
      ],
      sections: [
        {
          key: 'commercial-readiness',
          title: 'Prioritization Readiness Summary',
          description: 'How the current scored population translates into immediate sales and nurture action.',
          columns: ['Readiness Area', 'Current State', 'Interpretation'],
          rows: [
            ['Priority opportunity pool', formatNumber(hotPipeline), hotPipeline > 0 ? 'High-intent opportunities are present for immediate action.' : 'No high-intent cluster is currently visible.'],
            ['Average intent level', formatPercent(avgIntent, 1), avgIntent >= 60 ? 'Intent environment is commercially strong.' : avgIntent >= 35 ? 'Intent environment is mixed and requires selective follow-up.' : 'Intent environment is weak and should remain nurture-led.'],
            ['Urgent escalations', formatNumber(urgentCount), urgentCount > 0 ? 'A subset of leads requires faster human review.' : 'No immediate escalation set is visible.'],
            ['Behavior coverage', formatNumber(totalBehaviorEvents), totalBehaviorEvents > 0 ? 'Behavior signals are available to support prioritization quality.' : 'Behavior data is missing, reducing confidence.'],
          ],
        },
        {
          key: 'segments',
          title: 'Intent Segment Mix',
          description: 'Distribution of stored leads by intent segment.',
          columns: ['Segment', 'Lead Count', 'Average Intent'],
          rows: segmentStats.map((item) => [item.segment, item.count, formatPercent(item.avgIntent, 1)]),
        },
        {
          key: 'priority-leads',
          title: 'Immediate Action Queue',
          description: 'Top-ranked leads by intent score for the next sales-action window.',
          columns: ['Lead ID', 'Name', 'Company', 'Intent', 'Segment', 'Last Action'],
          rows: intentDocs.slice(0, 10).map((item: any) => [
            item.leadId,
            item.fullName || [item.firstName, item.lastName].filter(Boolean).join(' ') || 'Unknown',
            item.company || 'Unknown',
            formatPercent(Number(item.intentScore || 0), 1),
            item.intentSegment || 'COLD',
            formatDate(item.lastActionDate),
          ]),
        },
        {
          key: 'behavior-mix',
          title: 'Behavior Signal Profile',
          description: 'Observed engagement activity currently influencing prioritization outputs.',
          columns: ['Event Type', 'Count', 'Average Engagement'],
          rows: behaviorByType.slice(0, 10).map((item) => [item.eventType, item.count, formatNumber(item.avgEngagement, 2)]),
        },
      ],
      exports: [
        { key: 'leads', label: 'Prioritized Leads CSV', description: 'Lead-level intent and readiness fields.', filename: 'm02_prioritized_leads_report.csv' },
        { key: 'behaviors', label: 'Behavior Events CSV', description: 'Uploaded engagement events used by Intent Signals.', filename: 'm02_behavior_events_report.csv' },
        { key: 'segments', label: 'Segment Summary CSV', description: 'Intent segment counts and average scores.', filename: 'm02_segment_summary_report.csv' },
      ],
    },
    csv: {
      leads: {
        filename: 'm02_prioritized_leads_report.csv',
        header: ['lead_id', 'full_name', 'company', 'intent_score', 'intent_segment', 'engagement_score', 'urgent_escalation', 'last_action_date'],
        rows: intentDocs.map((item: any) => [
          item.leadId,
          item.fullName || [item.firstName, item.lastName].filter(Boolean).join(' '),
          item.company || '',
          Number(item.intentScore || 0),
          item.intentSegment || 'COLD',
          Number(item.engagementScore || item.engagementScoreRecent || 0),
          item.isUrgentEscalation ? 'yes' : 'no',
          formatDateTime(item.lastActionDate),
        ]),
      },
      behaviors: {
        filename: 'm02_behavior_events_report.csv',
        header: ['lead_id', 'timestamp', 'event_type', 'engagement_score', 'velocity', 'spike_flag', 'drop_flag', 'intent_segment'],
        rows: behaviorDocs.map((item: any) => [
          item.leadId,
          formatDateTime(item.timestamp),
          item.eventType,
          Number(item.engagementScore || 0),
          Number(item.velocity || 0),
          item.spikeFlag ? 'yes' : 'no',
          item.dropFlag ? 'yes' : 'no',
          item.intentSegment || '',
        ]),
      },
      segments: {
        filename: 'm02_segment_summary_report.csv',
        header: ['segment', 'lead_count', 'average_intent_score'],
        rows: segmentStats.map((item) => [item.segment, item.count, Number(item.avgIntent.toFixed(2))]),
      },
    },
  };
}

async function buildM05Report(workspaceId: string): Promise<ReportBundle> {
  const [prioritizedRows, sharedLeads, stageRows, uploads, threads] = await Promise.all([
    M2LeadIntentSummary.find({ workspaceId }).sort({ intentScore: -1 }).lean(),
    Module6Lead.find({ project_id: workspaceId, is_archived: { $ne: true } }).lean(),
    StageHistory.find({ workspace_id: workspaceId, is_archived: { $ne: true } }).lean(),
    UploadFile.find({
      workspace: workspaceId,
      filename: { $regex: `^${MODULE5_UPLOAD_PREFIX}` },
    }).sort({ createdAt: -1 }).lean(),
    CommunicationThread.find({
      workspaceId,
      archivedAt: null,
    }).sort({ updatedAt: -1 }).lean(),
  ]);

  const activeUploads = uploads.filter((item: any) => item.status !== 'archived');
  const stageLeadIds = new Set(stageRows.map((row: any) => row.lead_id));
  const prioritizedLeadIds = new Set(prioritizedRows.map((row: any) => row.leadId));
  const prioritizedSharedLeadCount = sharedLeads.filter((lead: any) => prioritizedLeadIds.has(lead.lead_id)).length;
  const hotRows = prioritizedRows.filter((row: any) => ['HOT', 'BLAZING'].includes(String(row.intentSegment || '').toUpperCase()));
  const hotLeadIds = new Set(hotRows.map((row: any) => row.leadId));
  const hotInPipeline = hotRows.filter((row: any) => stageLeadIds.has(row.leadId)).length;
  const pipelineCoverage = sharedLeads.length > 0 ? (sharedLeads.filter((lead: any) => stageLeadIds.has(lead.lead_id)).length / sharedLeads.length) * 100 : 0;
  const prioritizationCoverage = sharedLeads.length > 0 ? (prioritizedSharedLeadCount / sharedLeads.length) * 100 : 0;
  const hotPipelineCoverage = hotRows.length > 0 ? (hotInPipeline / hotRows.length) * 100 : 0;
  const openThreads = threads.filter((thread: any) => thread.status !== 'resolved');
  const highPriorityThreads = threads.filter((thread: any) => thread.priority === 'high' && thread.status !== 'resolved');
  const alignmentConcernThreads = threads.filter((thread: any) => thread.type === 'alignment_concern');
  const stageCounts = new Map<string, number>();
  for (const row of stageRows) {
    const key = row.stage_name || 'Unspecified';
    stageCounts.set(key, (stageCounts.get(key) || 0) + 1);
  }
  const stageDistribution = Array.from(stageCounts.entries())
    .map(([stage, count]) => ({
      stage,
      count,
      share: stageRows.length > 0 ? (count / stageRows.length) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);
  const latestUpload = activeUploads[0];
  const latestThread = threads[0];

  return {
    payload: {
      ok: true,
      moduleKey: 'm05',
      title: 'Sales and Marketing Alignment Report',
      subtitle: 'Shared operational view across prioritized demand, pipeline coverage, web-signal availability, and cross-team follow-through.',
      generatedAt: new Date().toISOString(),
      reportStatusLabel: sharedLeads.length === 0 ? 'Critical Setup Gap' : hotPipelineCoverage >= 70 && highPriorityThreads.length === 0 ? 'Ready' : 'Needs Attention',
      reportStatusTone: sharedLeads.length === 0 ? 'critical' : hotPipelineCoverage >= 70 && highPriorityThreads.length === 0 ? 'healthy' : 'warning',
      reportStatusSummary: sharedLeads.length === 0
        ? 'The shared operating lead base is missing, so Module 5 cannot yet function as a true alignment layer.'
        : highPriorityThreads.length > 0
          ? `${formatNumber(highPriorityThreads.length)} high-priority communication thread(s) remain unresolved, so alignment visibility exists but follow-through is still exposed.`
          : `Alignment coverage is usable, but managers should still monitor whether high-intent leads are consistently making it into visible stage tracking.`,
      overviewTitle: 'Executive Summary',
      overviewBody: [
        `Sales & Marketing Alignment is the shared operating layer between commercial teams. Its purpose is to align lead readiness, intent priority, funnel visibility, website engagement context, and communication follow-through into one management view.`,
        sharedLeads.length > 0
          ? `${formatNumber(sharedLeads.length)} shared leads are currently available. ${formatNumber(prioritizedSharedLeadCount)} already have prioritization coverage, representing ${formatPercent(prioritizationCoverage, 1)} alignment between the shared lead table and current intent-ready demand.`
          : 'No shared lead base is currently available, so alignment reporting is still in a setup state.',
        hotRows.length > 0
          ? `${formatNumber(hotRows.length)} HOT or BLAZING leads are currently visible, and ${formatNumber(hotInPipeline)} of them already appear in stage tracking. This gives the business ${formatPercent(hotPipelineCoverage, 1)} high-intent pipeline coverage.`
          : 'No high-intent lead cohort is currently available, so the alignment view is focused more on readiness than active conversion pressure.',
      ],
      recommendations: [
        activeUploads.length === 0 ? 'Upload at least one validated web-engagement dataset so Module 5 can compare funnel movement against live website and campaign activity.' : 'Keep the web-engagement library current so alignment discussions continue to reflect real traffic and engagement behavior.',
        hotRows.length > 0 && hotPipelineCoverage < 70 ? 'Review why high-intent leads are not consistently appearing in pipeline stages; this usually indicates handoff delay or incomplete follow-through between teams.' : 'Current high-intent pipeline coverage is broadly usable; focus on preserving response discipline for the hottest lead cohort.',
        highPriorityThreads.length > 0 ? `Resolve the ${formatNumber(highPriorityThreads.length)} high-priority communication threads quickly so alignment blockers do not remain open without ownership.` : 'No high-priority unresolved communication threads are currently open, which supports a healthier cross-team operating rhythm.',
      ],
      metricCards: [
        { label: 'Shared Leads', value: formatNumber(sharedLeads.length), helper: `${formatNumber(prioritizedSharedLeadCount)} leads already connect to prioritization coverage.`, ...statusFromLevel(sharedLeads.length > 0 ? 'healthy' : 'critical', sharedLeads.length > 0 ? 'Base Available' : 'Base Missing') },
        { label: 'High-Intent Leads', value: formatNumber(hotRows.length), helper: `${formatPercent(hotPipelineCoverage, 1)} of HOT and BLAZING leads already appear in stage tracking.`, ...statusFromLevel(hotPipelineCoverage >= 70 ? 'healthy' : hotPipelineCoverage >= 40 ? 'warning' : 'critical', hotPipelineCoverage >= 70 ? 'Well Covered' : hotPipelineCoverage >= 40 ? 'Partial Handoff' : 'Handoff Risk') },
        { label: 'Web Datasets', value: formatNumber(activeUploads.length), helper: latestUpload ? `Latest validated dataset: ${latestUpload.originalName || latestUpload.filename}.` : 'No active Module 5 engagement dataset is available.', ...statusFromLevel(activeUploads.length > 0 ? 'healthy' : 'warning', activeUploads.length > 0 ? 'Telemetry Available' : 'Telemetry Thin') },
        { label: 'Open Threads', value: formatNumber(openThreads.length), helper: `${formatNumber(highPriorityThreads.length)} high-priority issues remain unresolved.`, ...statusFromLevel(highPriorityThreads.length === 0 ? 'healthy' : highPriorityThreads.length <= 3 ? 'warning' : 'critical', highPriorityThreads.length === 0 ? 'Controlled' : highPriorityThreads.length <= 3 ? 'Follow-Up Needed' : 'Collaboration Risk') },
      ],
      highlights: [
        `${formatNumber(sharedLeads.length)} shared leads, ${formatNumber(prioritizedRows.length)} prioritized rows, ${formatNumber(stageRows.length)} stage records, and ${formatNumber(threads.length)} communication threads give this module enough evidence to act as a real alignment summary rather than a placeholder screen.`,
        activeUploads.length > 0 ? `${formatNumber(activeUploads.length)} active web-engagement dataset(s) are available, which means sales and marketing discussions can reference real web-signal context instead of pipeline data alone.` : 'No active web-engagement dataset is currently available for Module 5, so alignment discussions are missing a live website signal layer.',
        latestThread ? `The latest communication thread is "${latestThread.title}", which confirms cross-team follow-through is being tracked, but unresolved high-priority threads should be treated as operational drag.` : 'No communication threads exist yet, so alignment follow-through is not being documented in the hub.',
      ],
      sections: [
        {
          key: 'alignment-summary',
          title: 'Alignment Readiness Summary',
          description: 'Shared business view across lead availability, prioritization coverage, pipeline presence, and collaboration follow-through.',
          columns: ['Area', 'Current State', 'Interpretation'],
          rows: [
            ['Shared lead base', formatNumber(sharedLeads.length), sharedLeads.length > 0 ? 'A usable cross-team lead base is available.' : 'No shared lead base is currently available.'],
            ['Prioritization coverage', formatPercent(prioritizationCoverage, 1), prioritizationCoverage >= 70 ? 'Lead-to-prioritization coverage is strong.' : prioritizationCoverage >= 40 ? 'Coverage is usable but incomplete.' : 'Coverage is still too limited for confident alignment review.'],
            ['Pipeline coverage', formatPercent(pipelineCoverage, 1), pipelineCoverage >= 60 ? 'A meaningful share of leads already appears in funnel stages.' : 'Pipeline representation is still relatively thin.' ],
            ['Collaboration backlog', formatNumber(openThreads.length), openThreads.length > 0 ? 'Open threads still require managed follow-through.' : 'No open communication backlog is currently visible.'],
          ],
        },
        {
          key: 'priority-coverage',
          title: 'Priority Lead Coverage',
          description: 'How current high-intent demand is translating into visible funnel ownership.',
          columns: ['Priority Area', 'Count', 'Interpretation'],
          rows: [
            ['HOT and BLAZING leads', formatNumber(hotRows.length), hotRows.length > 0 ? 'Current demand pool available for immediate review.' : 'No high-intent pool is currently visible.'],
            ['High-intent leads in pipeline', formatNumber(hotInPipeline), hotInPipeline > 0 ? 'A share of the highest-intent demand is already represented in stage tracking.' : 'No high-intent leads currently appear in pipeline stages.'],
            ['High-intent pipeline coverage', formatPercent(hotPipelineCoverage, 1), hotPipelineCoverage >= 70 ? 'Coverage is strong.' : hotPipelineCoverage >= 40 ? 'Coverage is partial and should improve.' : 'Coverage is weak and suggests handoff issues.'],
          ],
        },
        {
          key: 'communication',
          title: 'Communication and Ownership Queue',
          description: 'Active communication threads supporting cross-team clarification, issue handling, and follow-through.',
          columns: ['Thread', 'Type', 'Status', 'Priority', 'Last Update'],
          rows: threads.slice(0, 10).map((thread: any) => [
            thread.title || 'Untitled thread',
            thread.type || 'general',
            thread.status || 'open',
            thread.priority || 'medium',
            formatDateTime(thread.lastMessageAt || thread.updatedAt),
          ]),
        },
        {
          key: 'web-library',
          title: 'Web Engagement Library',
          description: 'Validated Module 5 web-engagement datasets available for alignment interpretation.',
          columns: ['Dataset', 'Status', 'Size KB', 'Uploaded'],
          rows: uploads.slice(0, 10).map((item: any) => [
            item.originalName || item.filename || 'Web engagement dataset',
            item.status || 'active',
            formatNumber((Number(item.length || 0) / 1024), 1),
            formatDateTime(item.createdAt),
          ]),
        },
        {
          key: 'stage-distribution',
          title: 'Pipeline Stage Distribution',
          description: 'How the visible alignment population is currently distributed across stage tracking.',
          columns: ['Stage', 'Rows', 'Share'],
          rows: stageDistribution.slice(0, 10).map((item) => [item.stage, item.count, formatPercent(item.share, 1)]),
        },
      ],
      exports: [
        { key: 'shared-leads', label: 'Shared Leads CSV', description: 'Lead-level shared operating table used in the alignment view.', filename: 'm05_shared_leads_report.csv' },
        { key: 'prioritized-leads', label: 'Prioritized Leads CSV', description: 'Intent-priority lead rows supporting alignment review.', filename: 'm05_prioritized_leads_report.csv' },
        { key: 'communication-threads', label: 'Communication Threads CSV', description: 'Current cross-team communication and follow-through queue.', filename: 'm05_communication_threads_report.csv' },
        { key: 'web-datasets', label: 'Web Dataset Library CSV', description: 'Validated Module 5 website-engagement uploads available to users.', filename: 'm05_web_dataset_library_report.csv' },
      ],
    },
    csv: {
      'shared-leads': {
        filename: 'm05_shared_leads_report.csv',
        header: ['lead_id', 'company', 'source', 'owner', 'lead_score', 'intent_score', 'segment'],
        rows: sharedLeads.map((lead: any) => [
          lead.lead_id,
          lead.company || '',
          lead.source || '',
          lead.owner || '',
          Number(lead.lead_score || 0),
          Number(lead.intent_score || 0),
          lead.segment || '',
        ]),
      },
      'prioritized-leads': {
        filename: 'm05_prioritized_leads_report.csv',
        header: ['lead_id', 'full_name', 'company', 'intent_score', 'intent_segment', 'days_since_last_action'],
        rows: prioritizedRows.map((row: any) => [
          row.leadId,
          row.fullName || [row.firstName, row.lastName].filter(Boolean).join(' '),
          row.company || '',
          Number(row.intentScore || 0),
          row.intentSegment || '',
          row.daysSinceLastAction ?? '',
        ]),
      },
      'communication-threads': {
        filename: 'm05_communication_threads_report.csv',
        header: ['title', 'type', 'status', 'priority', 'message_count', 'last_message_at', 'created_by'],
        rows: threads.map((thread: any) => [
          thread.title || '',
          thread.type || 'general',
          thread.status || 'open',
          thread.priority || 'medium',
          Number(thread.messageCount || 0),
          formatDateTime(thread.lastMessageAt || thread.updatedAt),
          thread.createdByName || '',
        ]),
      },
      'web-datasets': {
        filename: 'm05_web_dataset_library_report.csv',
        header: ['filename', 'original_name', 'status', 'size_bytes', 'created_at'],
        rows: uploads.map((item: any) => [
          item.filename || '',
          item.originalName || '',
          item.status || 'active',
          Number(item.length || 0),
          formatDateTime(item.createdAt),
        ]),
      },
    },
  };
}

async function buildM06Report(workspaceId: string): Promise<ReportBundle> {
  const [leads, campaigns, deals, touches, latestRun] = await Promise.all([
    Module6Lead.find({ project_id: workspaceId, is_archived: { $ne: true } }).lean(),
    Campaign.find({ project_id: workspaceId }).lean(),
    Deal.find({ project_id: workspaceId }).lean(),
    CampaignTouch.find({ project_id: workspaceId, status: { $ne: 'archived' } }).lean(),
    AttributionRun.findOne({ project_id: workspaceId, status: 'success' }).sort({ createdAt: -1 }).lean(),
  ]);

  const closedWonDeals = deals.filter((item: any) => item.closed_won);
  const totalRevenue = closedWonDeals.reduce((sum: number, item: any) => sum + Number(item.revenue || 0), 0);
  const totalSpend = campaigns.reduce((sum: number, item: any) => sum + Number(item.spend || 0), 0);
  const avgDealSize = closedWonDeals.length ? totalRevenue / closedWonDeals.length : 0;
  const attributionRunId = latestRun ? String(latestRun._id) : null;
  const attributionResults = attributionRunId ? await AttributionResult.find({ project_id: workspaceId, run_id: attributionRunId }).lean() : [];
  const attributedRevenue = attributionResults.reduce((sum: number, item: any) => sum + Number(item.revenue_share || 0), 0);
  const unattributedRevenue = Math.max(0, totalRevenue - attributedRevenue);
  const roi = totalSpend > 0 ? ((attributedRevenue - totalSpend) / totalSpend) * 100 : 0;

  const campaignMap = new Map<string, any>();
  for (const campaign of campaigns) campaignMap.set(String(campaign.campaign_id), campaign);

  const channelSummaryMap = new Map<string, { campaigns: number; spend: number; attributedRevenue: number }>();
  for (const campaign of campaigns) {
    const channel = campaign.channel || 'other';
    const bucket = channelSummaryMap.get(channel) || { campaigns: 0, spend: 0, attributedRevenue: 0 };
    bucket.campaigns += 1;
    bucket.spend += Number(campaign.spend || 0);
    channelSummaryMap.set(channel, bucket);
  }
  for (const result of attributionResults) {
    const campaign = campaignMap.get(String(result.campaign_id));
    const channel = campaign?.channel || 'other';
    const bucket = channelSummaryMap.get(channel) || { campaigns: 0, spend: 0, attributedRevenue: 0 };
    bucket.attributedRevenue += Number(result.revenue_share || 0);
    channelSummaryMap.set(channel, bucket);
  }
  const channelSummary = Array.from(channelSummaryMap.entries()).map(([channel, bucket]) => ({
    channel,
    campaigns: bucket.campaigns,
    spend: bucket.spend,
    attributedRevenue: bucket.attributedRevenue,
    roi: bucket.spend > 0 ? ((bucket.attributedRevenue - bucket.spend) / bucket.spend) * 100 : 0,
  })).sort((a, b) => b.attributedRevenue - a.attributedRevenue);

  const campaignAttributedMap = new Map<string, number>();
  for (const result of attributionResults) {
    const key = String(result.campaign_id);
    campaignAttributedMap.set(key, (campaignAttributedMap.get(key) || 0) + Number(result.revenue_share || 0));
  }
  const campaignPerformance = campaigns.map((campaign: any) => {
    const attributed = campaignAttributedMap.get(String(campaign.campaign_id)) || 0;
    const spend = Number(campaign.spend || 0);
    return {
      campaignId: String(campaign.campaign_id),
      name: campaign.name || 'Campaign',
      channel: campaign.channel || 'other',
      spend,
      attributed,
      roi: spend > 0 ? ((attributed - spend) / spend) * 100 : 0,
    };
  }).sort((a, b) => b.roi - a.roi);
  const topCampaign = campaignPerformance[0];
  const attributionCoverage = totalRevenue > 0 ? (attributedRevenue / totalRevenue) * 100 : 0;

  return {
    payload: {
      ok: true,
      moduleKey: 'm06',
      title: 'Revenue Attribution and ROI Report',
      subtitle: 'Professional revenue view across campaigns, deal outcomes, journey coverage, and attributed performance.',
      generatedAt: new Date().toISOString(),
      reportStatusLabel: totalRevenue === 0 ? 'Critical Setup Gap' : attributionCoverage >= 80 && roi >= 0 ? 'Ready' : 'Needs Attention',
      reportStatusTone: totalRevenue === 0 ? 'critical' : attributionCoverage >= 80 && roi >= 0 ? 'healthy' : 'warning',
      reportStatusSummary: totalRevenue === 0
        ? 'No closed-won revenue is currently available, so this module cannot yet produce a fully commercial report.'
        : attributionCoverage < 80
          ? `${formatPercent(attributionCoverage, 1)} of realized revenue is currently attributed. Management should treat the ROI view as directionally useful, but not yet fully explained.`
          : `Revenue, spend, and attribution are sufficiently connected for management review. The main question is now channel efficiency rather than basic coverage.`,
      overviewTitle: 'Executive Summary',
      overviewBody: [
        `Revenue Insight is the commercial performance layer of the workspace. Its purpose is to connect campaigns, touches, deals, and attribution logic into a clear view of revenue contribution, spend efficiency, and return on marketing activity.`,
        closedWonDeals.length > 0
          ? `${formatCurrency(totalRevenue)} in closed-won revenue is currently recorded. Of that amount, ${formatCurrency(attributedRevenue)} is assigned through the latest attribution run, giving the business ${formatPercent(attributionCoverage, 1)} attribution coverage on realized revenue.`
          : 'No closed-won revenue has been recorded yet, so ROI interpretation is still preparatory rather than commercial.',
        topCampaign
          ? `The strongest currently ranked campaign is ${topCampaign.name}, which is returning ${formatPercent(topCampaign.roi, 1)} under the latest available attribution model.`
          : 'No campaign ranking is currently available because attribution output is missing or campaign records are incomplete.',
      ],
      recommendations: [
        latestRun ? `Use the latest attribution run as the current baseline, but rerun it immediately after any material import to touches, campaigns, or deals.` : 'No completed attribution run is available. Create one before using this report in a commercial review.',
        totalSpend > 0 && attributedRevenue < totalSpend ? `Attributed revenue (${formatCurrency(attributedRevenue)}) is still below tracked spend (${formatCurrency(totalSpend)}). Reduce or question low-efficiency campaign groups before increasing budget.` : 'Current spend is broadly covered by attributed performance; focus next on scaling the highest-return campaign and channel mix.',
        touches.length === 0 ? 'Touchpoint coverage is missing entirely. Upload touch data before the next revenue review, otherwise attribution confidence remains structurally weak.' : `Maintain touchpoint completeness across ${formatNumber(touches.length)} recorded touches so revenue can keep being explained through journey evidence rather than treated as unattributed outcome.`,
      ],
      metricCards: [
        { label: 'Closed-Won Revenue', value: formatCurrency(totalRevenue), helper: `${formatNumber(closedWonDeals.length)} won deals currently tracked.`, ...statusFromLevel(totalRevenue > 0 ? 'healthy' : 'critical', totalRevenue > 0 ? 'Commercial Data Live' : 'No Revenue Base') },
        { label: 'Attributed Revenue', value: formatCurrency(attributedRevenue), helper: `${formatCurrency(unattributedRevenue)} remains unattributed.`, ...statusFromLevel(attributionCoverage >= 80 ? 'healthy' : attributionCoverage >= 50 ? 'warning' : 'critical', attributionCoverage >= 80 ? 'Strong Coverage' : attributionCoverage >= 50 ? 'Partial Coverage' : 'Weak Coverage') },
        { label: 'Campaign Spend', value: formatCurrency(totalSpend), helper: `${formatNumber(campaigns.length)} campaigns and ${formatNumber(leads.length)} leads included.`, ...statusFromLevel(totalSpend > 0 ? 'neutral' : 'warning', totalSpend > 0 ? 'Tracked Spend' : 'No Spend Base') },
        { label: 'Attributed ROI', value: formatPercent(roi, 1), helper: `Average won-deal size: ${formatCurrency(avgDealSize)}.`, ...statusFromLevel(roi >= 0 ? 'healthy' : roi >= -20 ? 'warning' : 'critical', roi >= 0 ? 'Return Positive' : roi >= -20 ? 'Return Under Pressure' : 'Return Negative') },
      ],
      highlights: [
        latestRun ? `The latest attribution run (${latestRun.model_type}) is the current reporting baseline; managers should not compare ROI across runs casually without re-baselining the inputs.` : 'No completed attribution run exists yet, so attributed revenue remains unavailable.',
        `${formatNumber(leads.length)} leads, ${formatNumber(campaigns.length)} campaigns, ${formatNumber(touches.length)} touches, and ${formatNumber(deals.length)} deals are currently available, which is enough to produce a real commercial view if attribution coverage is acceptable.`,
        closedWonDeals.length > 0 ? `${formatCurrency(totalRevenue)} in closed-won revenue is recorded, but only ${formatCurrency(attributedRevenue)} is currently attributed, so the remaining gap should shape how confidently managers read channel ROI.` : 'No closed-won deals are stored yet.',
      ],
      sections: [
        {
          key: 'commercial-summary',
          title: 'Commercial Performance Summary',
          description: 'High-level interpretation of revenue accountability, spend efficiency, and journey evidence.',
          columns: ['Area', 'Current Value', 'Interpretation'],
          rows: [
            ['Revenue realized', formatCurrency(totalRevenue), closedWonDeals.length > 0 ? 'Closed-won revenue is available for commercial analysis.' : 'No realized revenue exists yet.'],
            ['Attribution coverage', formatPercent(attributionCoverage, 1), attributionCoverage >= 80 ? 'Attribution coverage is strong.' : attributionCoverage >= 50 ? 'Attribution coverage is usable but incomplete.' : 'Attribution coverage is low and should be improved.'],
            ['Spend efficiency', formatPercent(roi, 1), roi >= 0 ? 'Attributed return is covering spend.' : 'Attributed return is below current spend.'],
            ['Journey evidence', formatNumber(touches.length), touches.length > 0 ? 'Touch data is present to support journey-level revenue interpretation.' : 'Touch evidence is missing.'],
          ],
        },
        {
          key: 'channel-performance',
          title: 'Channel Performance Review',
          description: 'Spend and attributed revenue performance by campaign channel.',
          columns: ['Channel', 'Campaigns', 'Spend', 'Attributed Revenue', 'ROI'],
          rows: channelSummary.map((item) => [item.channel, item.campaigns, formatCurrency(item.spend), formatCurrency(item.attributedRevenue), formatPercent(item.roi, 1)]),
        },
        {
          key: 'top-campaigns',
          title: 'Campaign Performance Ranking',
          description: 'Campaign-level ROI ranking from the current attribution baseline.',
          columns: ['Campaign', 'Channel', 'Spend', 'Attributed Revenue', 'ROI'],
          rows: campaignPerformance.slice(0, 10).map((item) => [item.name, item.channel, formatCurrency(item.spend), formatCurrency(item.attributed), formatPercent(item.roi, 1)]),
        },
        {
          key: 'recent-deals',
          title: 'Recent Closed-Won Deals',
          description: 'Latest won deals currently informing the revenue model.',
          columns: ['Deal ID', 'Lead ID', 'Revenue', 'Closed At', 'Status'],
          rows: closedWonDeals
            .sort((a: any, b: any) => new Date(b.closed_at || 0).getTime() - new Date(a.closed_at || 0).getTime())
            .slice(0, 10)
            .map((item: any) => [item.deal_id || String(item._id), item.lead_id, formatCurrency(item.revenue), formatDate(item.closed_at), item.closed_won ? 'closed_won' : 'open']),
        },
      ],
      exports: [
        { key: 'campaigns', label: 'Campaigns CSV', description: 'Campaign inventory including spend and ROI context.', filename: 'm06_campaigns_report.csv' },
        { key: 'deals', label: 'Deals CSV', description: 'Deal-level revenue and close status records.', filename: 'm06_deals_report.csv' },
        { key: 'touches', label: 'Touches CSV', description: 'Touchpoint inventory feeding attribution journeys.', filename: 'm06_touches_report.csv' },
        { key: 'attribution', label: 'Attribution CSV', description: 'Current attribution run allocations by campaign and deal.', filename: 'm06_attribution_report.csv' },
      ],
    },
    csv: {
      campaigns: {
        filename: 'm06_campaigns_report.csv',
        header: ['campaign_id', 'name', 'channel', 'status', 'spend', 'attributed_revenue', 'roi_percent'],
        rows: campaignPerformance.map((item) => [item.campaignId, item.name, item.channel, campaignMap.get(item.campaignId)?.status || 'active', item.spend, item.attributed, Number(item.roi.toFixed(2))]),
      },
      deals: {
        filename: 'm06_deals_report.csv',
        header: ['deal_id', 'lead_id', 'revenue', 'currency', 'closed_won', 'closed_at'],
        rows: deals.map((item: any) => [item.deal_id || String(item._id), item.lead_id, Number(item.revenue || 0), item.currency || 'USD', item.closed_won ? 'yes' : 'no', formatDateTime(item.closed_at)]),
      },
      touches: {
        filename: 'm06_touches_report.csv',
        header: ['lead_id', 'campaign_id', 'channel', 'touch_type', 'touched_at', 'status'],
        rows: touches.map((item: any) => [item.lead_id, item.campaign_id, item.channel || 'other', item.type, formatDateTime(item.touched_at), item.status || 'active']),
      },
      attribution: {
        filename: 'm06_attribution_report.csv',
        header: ['run_id', 'deal_id', 'campaign_id', 'campaign_name', 'channel', 'revenue_share'],
        rows: attributionResults.map((item: any) => {
          const campaign = campaignMap.get(String(item.campaign_id));
          return [item.run_id, item.deal_id, item.campaign_id, campaign?.name || '', campaign?.channel || 'other', Number(item.revenue_share || 0)];
        }),
      },
    },
  };
}

async function buildM07Report(workspaceId: string): Promise<ReportBundle> {
  const [leads, stages, interactions] = await Promise.all([
    FunnelLead.find({ workspace_id: workspaceId, is_archived: { $ne: true } }).lean(),
    StageHistory.find({ workspace_id: workspaceId, is_archived: { $ne: true } }).lean(),
    Interaction.find({ workspace_id: workspaceId, is_archived: { $ne: true } }).lean(),
  ]);

  const activeStages = stages.filter((item: any) => item.stage_status === 'active');
  const droppedStages = stages.filter((item: any) => item.stage_status === 'dropped');
  const stageOccupancyMap = new Map<string, number>();
  const stageDurationMap = new Map<string, { days: number; count: number }>();
  const leakageMap = new Map<string, number>();

  for (const stage of activeStages) {
    const key = stage.stage_name || 'Unknown';
    stageOccupancyMap.set(key, (stageOccupancyMap.get(key) || 0) + 1);
  }

  for (const stage of stages) {
    const stageName = stage.stage_name || 'Unknown';
    if (stage.entered_at && stage.exited_at) {
      const days = Math.max(0, (new Date(stage.exited_at).getTime() - new Date(stage.entered_at).getTime()) / (1000 * 60 * 60 * 24));
      const bucket = stageDurationMap.get(stageName) || { days: 0, count: 0 };
      bucket.days += days;
      bucket.count += 1;
      stageDurationMap.set(stageName, bucket);
    }
    if (stage.stage_status === 'dropped') {
      const key = `${stageName} | ${stage.exit_reason || 'unspecified'}`;
      leakageMap.set(key, (leakageMap.get(key) || 0) + 1);
    }
  }

  const stalledLeads = activeStages
    .map((stage: any) => ({
      leadId: stage.lead_id,
      stageName: stage.stage_name || 'Unknown',
      enteredAt: stage.entered_at,
      daysOpen: Math.max(0, Math.round((Date.now() - new Date(stage.entered_at).getTime()) / (1000 * 60 * 60 * 24))),
    }))
    .sort((a, b) => b.daysOpen - a.daysOpen)
    .slice(0, 10);

  const stageOccupancy = Array.from(stageOccupancyMap.entries()).map(([stageName, count]) => ({ stageName, count }));
  const stageDuration = Array.from(stageDurationMap.entries()).map(([stageName, bucket]) => ({
    stageName,
    avgDays: bucket.count ? bucket.days / bucket.count : 0,
    observations: bucket.count,
  })).sort((a, b) => b.avgDays - a.avgDays);
  const leakage = Array.from(leakageMap.entries()).map(([key, count]) => {
    const [stageName, exitReason] = key.split(' | ');
    return { stageName, exitReason, count };
  }).sort((a, b) => b.count - a.count);
  const worstLeak = leakage[0];
  const mostCrowdedStage = stageOccupancy.sort((a, b) => b.count - a.count)[0];

  return {
    payload: {
      ok: true,
      moduleKey: 'm07',
      title: 'Funnel Health and Leakage Report',
      subtitle: 'Operational funnel health across stage occupancy, stalled leads, interaction volume, and drop-off reasons.',
      generatedAt: new Date().toISOString(),
      reportStatusLabel: activeStages.length === 0 ? 'Critical Setup Gap' : worstLeak || stalledLeads.length > 0 ? 'Needs Attention' : 'Ready',
      reportStatusTone: activeStages.length === 0 ? 'critical' : worstLeak || stalledLeads.length > 0 ? 'warning' : 'healthy',
      reportStatusSummary: activeStages.length === 0
        ? 'No live stage occupancy is visible, so the funnel cannot yet be managed as an in-flight operating system.'
        : worstLeak
          ? `${worstLeak.stageName} is currently the clearest leakage point, and it should be treated as the first management intervention area.`
          : `The funnel has live occupancy and no dominant leakage pattern is currently standing out above the rest.`,
      overviewTitle: 'Executive Summary',
      overviewBody: [
        `Funnel Insight is the pipeline-diagnostics layer of the workspace. Its purpose is to show where leads are currently sitting, where they are being lost, and which points in the journey require operational intervention.`,
        activeStages.length > 0
          ? `${formatNumber(activeStages.length)} active stage records indicate live funnel occupancy. ${mostCrowdedStage ? `${mostCrowdedStage.stageName} is currently the heaviest loaded stage with ${formatNumber(mostCrowdedStage.count)} active records.` : ''}`
          : 'There are no active stage records yet, so live funnel occupancy cannot be assessed.',
        worstLeak
          ? `The largest current leakage pattern is at ${worstLeak.stageName}, where "${worstLeak.exitReason}" is recorded most often as a drop-off reason.`
          : 'No dropped-stage pattern is currently available, so leakage interpretation is limited.',
      ],
      recommendations: [
        worstLeak ? `Investigate ${worstLeak.stageName} first. It currently carries the most visible leakage pattern, which means process fixes elsewhere will have lower immediate impact.` : 'Populate stage outcomes and exit reasons before relying on leakage conclusions.',
        stalledLeads.length > 0 ? `Review the longest-stalled active leads now; the oldest open record has been sitting for ${formatNumber(stalledLeads[0]?.daysOpen || 0)} day(s), which is a direct workflow-delay risk.` : 'No major stall pattern is currently visible in active stage records.',
        interactions.length === 0 ? 'Interaction history is missing. Upload it before the next funnel review so stage movement can be explained by real outreach behavior.' : `Maintain interaction freshness across ${formatNumber(interactions.length)} interactions so stall and drop patterns can keep being read against actual engagement evidence.`,
      ],
      metricCards: [
        { label: 'Funnel Leads', value: formatNumber(leads.length), helper: 'Shared lead table currently active in funnel analysis.', ...statusFromLevel(leads.length > 0 ? 'healthy' : 'critical', leads.length > 0 ? 'Funnel Base Live' : 'Base Missing') },
        { label: 'Active Stages', value: formatNumber(activeStages.length), helper: `${formatNumber(droppedStages.length)} dropped-stage records stored.`, ...statusFromLevel(activeStages.length > 0 ? 'healthy' : 'critical', activeStages.length > 0 ? 'Live Occupancy' : 'No Occupancy') },
        { label: 'Interactions', value: formatNumber(interactions.length), helper: 'Observed interaction history available for journey reading.', ...statusFromLevel(interactions.length > 0 ? 'healthy' : 'warning', interactions.length > 0 ? 'Journey Evidence' : 'Evidence Thin') },
        { label: 'Avg Stage Duration', value: `${formatNumber(stageDuration[0]?.avgDays || 0, 1)} days`, helper: 'Longest average completed stage duration currently observed.', ...statusFromLevel((stageDuration[0]?.avgDays || 0) <= 21 ? 'healthy' : (stageDuration[0]?.avgDays || 0) <= 35 ? 'warning' : 'critical', (stageDuration[0]?.avgDays || 0) <= 21 ? 'Pace Acceptable' : (stageDuration[0]?.avgDays || 0) <= 35 ? 'Pace Slowing' : 'Delay Risk') },
      ],
      highlights: [
        `${formatNumber(leads.length)} funnel leads, ${formatNumber(stages.length)} stage-history entries, and ${formatNumber(interactions.length)} interactions are currently available, which gives this module enough evidence to describe live funnel pressure rather than static counts alone.`,
        activeStages.length > 0 ? `${formatNumber(activeStages.length)} active stage records indicate live in-funnel volume, so managers can use this module for current-state operational review rather than just historical reporting.` : 'There are no active stage records yet.',
        droppedStages.length > 0 ? `${formatNumber(droppedStages.length)} dropped-stage records are available, so leakage analysis can now move from anecdotal discussion into a measurable pattern review.` : 'No dropped stage records exist yet.',
      ],
      sections: [
        {
          key: 'funnel-summary',
          title: 'Funnel Health Summary',
          description: 'High-level interpretation of current conversion health, leakage visibility, and operational risk.',
          columns: ['Area', 'Current State', 'Interpretation'],
          rows: [
            ['Live funnel occupancy', formatNumber(activeStages.length), activeStages.length > 0 ? 'There is an active in-flight funnel to monitor.' : 'No in-flight funnel volume is visible.'],
            ['Leakage visibility', formatNumber(droppedStages.length), droppedStages.length > 0 ? 'Drop-off patterns are visible for diagnosis.' : 'Leakage evidence is not yet available.'],
            ['Journey evidence', formatNumber(interactions.length), interactions.length > 0 ? 'Interaction history is available to explain funnel movement.' : 'Interaction history is missing.'],
            ['Stall pressure', formatNumber(stalledLeads[0]?.daysOpen || 0), stalledLeads.length > 0 ? 'At least one active lead is materially stalled.' : 'No significant stall signal is currently visible.'],
          ],
        },
        {
          key: 'stage-occupancy',
          title: 'Current Stage Occupancy',
          description: 'Distribution of active funnel records across the current stage sequence.',
          columns: ['Stage', 'Active Leads'],
          rows: stageOccupancy.map((item) => [item.stageName, item.count]),
        },
        {
          key: 'leakage',
          title: 'Leakage Drivers',
          description: 'Where funnel records are being lost and which exit reasons are driving those outcomes.',
          columns: ['Stage', 'Exit Reason', 'Dropped Count'],
          rows: leakage.slice(0, 10).map((item) => [item.stageName, item.exitReason, item.count]),
        },
        {
          key: 'stalled-leads',
          title: 'Most Stalled Active Leads',
          description: 'Active stage records that have remained open for the longest duration.',
          columns: ['Lead ID', 'Current Stage', 'Entered At', 'Days In Stage'],
          rows: stalledLeads.map((item) => [item.leadId, item.stageName, formatDate(item.enteredAt), item.daysOpen]),
        },
      ],
      exports: [
        { key: 'funnel-leads', label: 'Funnel Leads CSV', description: 'Current shared funnel lead records.', filename: 'm07_funnel_leads_report.csv' },
        { key: 'stages', label: 'Stage History CSV', description: 'Stage history and transition outcomes.', filename: 'm07_stage_history_report.csv' },
        { key: 'interactions', label: 'Interactions CSV', description: 'Interaction event inventory for funnel journeys.', filename: 'm07_interactions_report.csv' },
        { key: 'stage-summary', label: 'Stage Summary CSV', description: 'Stage occupancy and average duration summary.', filename: 'm07_stage_summary_report.csv' },
      ],
    },
    csv: {
      'funnel-leads': {
        filename: 'm07_funnel_leads_report.csv',
        header: ['lead_id', 'full_name', 'company', 'owner', 'lead_score', 'intent_score', 'email'],
        rows: leads.map((item: any) => [item.lead_id, item.full_name || '', item.company || '', item.owner || '', Number(item.lead_score || 0), Number(item.intent_score || 0), item.email || '']),
      },
      stages: {
        filename: 'm07_stage_history_report.csv',
        header: ['lead_id', 'stage_name', 'entered_at', 'exited_at', 'stage_status', 'next_stage', 'exit_reason'],
        rows: stages.map((item: any) => [item.lead_id, item.stage_name, formatDateTime(item.entered_at), formatDateTime(item.exited_at), item.stage_status || 'active', item.next_stage || '', item.exit_reason || '']),
      },
      interactions: {
        filename: 'm07_interactions_report.csv',
        header: ['lead_id', 'timestamp', 'interaction_type', 'channel', 'campaign_id', 'outcome', 'engagement_score'],
        rows: interactions.map((item: any) => [item.lead_id, formatDateTime(item.timestamp), item.interaction_type, item.channel || '', item.campaign_id || '', item.outcome || '', Number(item.engagement_score || 0)]),
      },
      'stage-summary': {
        filename: 'm07_stage_summary_report.csv',
        header: ['stage_name', 'active_count', 'average_completed_days', 'completed_observations'],
        rows: stageOccupancy.map((item) => {
          const duration = stageDuration.find((entry) => entry.stageName === item.stageName);
          return [item.stageName, item.count, Number((duration?.avgDays || 0).toFixed(2)), duration?.observations || 0];
        }),
      },
    },
  };
}

async function buildM09Report(workspaceId: string): Promise<ReportBundle> {
  const [workspaceUploads, mergedDatasets] = await Promise.all([
    UploadFile.find({ workspace: workspaceId }).sort({ createdAt: -1 }).lean(),
    (MergedDataset as any).find({ workspace: workspaceId }).sort({ createdAt: -1 }).lean(),
  ]);

  const uploads = (workspaceUploads as any[]).filter((item) => getUploadModuleTag(item) === 'm09');
  const activeUploads = uploads.filter((item) => item.status !== 'archived');
  const archivedUploads = uploads.filter((item) => item.status === 'archived');
  const totalRowsBefore = (mergedDatasets as any[]).reduce((sum, item) => sum + Number(item.rowCountBeforeMerge || 0), 0);
  const totalRowsAfter = (mergedDatasets as any[]).reduce((sum, item) => sum + Number(item.rowCountAfterMerge || 0), 0);
  const totalDuplicates = (mergedDatasets as any[]).reduce((sum, item) => sum + Number(item.duplicateCount || 0), 0);
  const duplicateReduction = totalRowsBefore > 0 ? (totalDuplicates / totalRowsBefore) * 100 : 0;
  const latestMerged = (mergedDatasets as any[])[0];
  const latestWarnings = Array.isArray(latestMerged?.validationSummary?.warnings) ? latestMerged.validationSummary.warnings : [];

  const channelCounts = new Map<string, number>();
  const latestSampleRows = Array.isArray(latestMerged?.sampleRows) ? latestMerged.sampleRows : [];
  for (const row of latestSampleRows) {
    const channel = String((row as any)?.channel || (row as any)?.platform || 'unknown');
    channelCounts.set(channel, (channelCounts.get(channel) || 0) + 1);
  }
  const sampledChannelMix = Array.from(channelCounts.entries())
    .map(([channel, count]) => ({
      channel,
      count,
      share: latestSampleRows.length > 0 ? (count / latestSampleRows.length) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const mergeQualityRows = (mergedDatasets as any[]).map((item) => {
    const warnings = Array.isArray(item.validationSummary?.warnings) ? item.validationSummary.warnings.length : 0;
    const before = Number(item.rowCountBeforeMerge || 0);
    const after = Number(item.rowCountAfterMerge || 0);
    const duplicates = Number(item.duplicateCount || 0);
    return {
      title: item.title || item.filename || 'Merged dataset',
      before,
      after,
      duplicates,
      warnings,
      duplicateRate: before > 0 ? (duplicates / before) * 100 : 0,
      createdAt: item.createdAt,
    };
  });

  return {
    payload: {
      ok: true,
      moduleKey: 'm09',
      title: 'Campaign Performance Optimization Report',
      subtitle: 'Operational view of Module 9 campaign dataset readiness, merge quality, duplicate reduction, and simulator input health.',
      generatedAt: new Date().toISOString(),
      reportStatusLabel: mergedDatasets.length === 0 ? 'Critical Setup Gap' : latestWarnings.length > 0 ? 'Needs Attention' : 'Ready',
      reportStatusTone: mergedDatasets.length === 0 ? 'critical' : latestWarnings.length > 0 ? 'warning' : 'healthy',
      reportStatusSummary: mergedDatasets.length === 0
        ? 'No merged campaign dataset is available yet, so the simulator and optimization workflows do not have a trustworthy baseline.'
        : latestWarnings.length > 0
          ? `The latest merged dataset still carries ${formatNumber(latestWarnings.length)} warning(s), so optimization outputs should be treated cautiously until those mapping or completeness issues are reviewed.`
          : `Merged campaign data is available with no visible warning pressure on the latest dataset, which makes Module 9 ready for scenario planning work.`,
      overviewTitle: 'Executive Summary',
      overviewBody: [
        `Campaign Performance Optimization depends on a clean merged campaign dataset before scenario testing can be trusted. This report focuses on input readiness, merge quality, and whether the optimization workspace has enough normalized campaign detail to support baseline selection and what-if analysis.`,
        mergedDatasets.length > 0
          ? `${formatNumber(activeUploads.length)} active Module 9 uploads have produced ${formatNumber(mergedDatasets.length)} merged campaign datasets. Across those merged outputs, ${formatNumber(totalRowsAfter)} normalized rows remain available after duplicate handling.`
          : 'No merged Module 9 dataset is currently available, so optimization reporting is still at the intake stage.',
        totalDuplicates > 0
          ? `${formatNumber(totalDuplicates)} duplicate campaign rows have already been collapsed during merge, representing ${formatPercent(duplicateReduction, 1)} duplicate reduction against pre-merge row volume.`
          : 'No duplicate campaign rows have been collapsed yet, which usually means either the input set is already clean or merged output volume is still limited.',
      ],
      recommendations: [
        mergedDatasets.length === 0 ? 'Create at least one merged Module 9 campaign dataset before relying on simulator or optimization outputs.' : 'Keep using merged datasets as the optimization baseline so scenario testing is grounded in normalized campaign records rather than raw uploads.',
        latestWarnings.length > 0 ? `Resolve the ${formatNumber(latestWarnings.length)} latest merge warning(s), especially around missing spend or channel mapping, before the next simulator review.` : 'The latest merged dataset does not currently show validation warnings that materially weaken optimization reading.',
        activeUploads.length === 0 ? 'No active Module 9 upload library is visible. Upload campaign CSVs before the next optimization cycle so the merged baseline does not go stale.' : `There are ${formatNumber(activeUploads.length)} active Module 9 upload(s). Refresh them on a regular cadence so merged baselines stay relevant.`,
      ],
      metricCards: [
        { label: 'Active Uploads', value: formatNumber(activeUploads.length), helper: `${formatNumber(archivedUploads.length)} archived campaign files remain available for audit history.`, ...statusFromLevel(activeUploads.length > 0 ? 'healthy' : 'warning', activeUploads.length > 0 ? 'Library Active' : 'Library Thin') },
        { label: 'Merged Datasets', value: formatNumber(mergedDatasets.length), helper: latestMerged ? `Latest merged dataset: ${latestMerged.title || latestMerged.filename}.` : 'No merged campaign dataset exists yet.', ...statusFromLevel(mergedDatasets.length > 0 ? 'healthy' : 'critical', mergedDatasets.length > 0 ? 'Baseline Available' : 'No Baseline') },
        { label: 'Rows After Merge', value: formatNumber(totalRowsAfter), helper: `${formatNumber(totalRowsBefore)} rows were evaluated before deduplication.`, ...statusFromLevel(totalRowsAfter > 0 ? 'healthy' : 'critical', totalRowsAfter > 0 ? 'Usable Rows' : 'No Usable Rows') },
        { label: 'Duplicates Removed', value: formatNumber(totalDuplicates), helper: `${formatPercent(duplicateReduction, 1)} duplicate reduction across merged datasets.`, ...statusFromLevel(duplicateReduction <= 10 ? 'healthy' : duplicateReduction <= 25 ? 'warning' : 'critical', duplicateReduction <= 10 ? 'Clean Merge' : duplicateReduction <= 25 ? 'Moderate Cleanup' : 'Heavy Cleanup') },
      ],
      highlights: [
        latestMerged ? `The latest merged output was created on ${formatDateTime(latestMerged.createdAt)} and keeps ${formatNumber(latestMerged.rowCountAfterMerge || 0)} normalized campaign rows available for simulator work, which is the real operating baseline for Module 9.` : 'No merged campaign output exists yet.',
        latestWarnings.length > 0 ? `${formatNumber(latestWarnings.length)} warning(s) remain attached to the latest merged dataset, so the optimization story is still partly a data-quality story rather than purely a performance story.` : 'The latest merged dataset does not currently show warning pressure.',
        sampledChannelMix[0] ? `${sampledChannelMix[0].channel} is the most visible channel in the latest merged sample rows, which means optimization attention may become biased if the dataset is not diversified.` : 'No sampled campaign rows are currently available for channel interpretation.',
      ],
      sections: [
        {
          key: 'dataset-readiness',
          title: 'Dataset Readiness Summary',
          description: 'Whether Module 9 currently has enough structured campaign data to support optimization workflows.',
          columns: ['Area', 'Current State', 'Interpretation'],
          rows: [
            ['Active upload library', formatNumber(activeUploads.length), activeUploads.length > 0 ? 'Campaign source files are available in the workspace.' : 'No Module 9 source uploads are available yet.'],
            ['Merged outputs', formatNumber(mergedDatasets.length), mergedDatasets.length > 0 ? 'Merged campaign datasets are available for simulator baseline selection.' : 'Merged campaign output is missing.'],
            ['Rows after merge', formatNumber(totalRowsAfter), totalRowsAfter > 0 ? 'Simulator-ready campaign rows are available.' : 'No normalized merged campaign rows are available.'],
            ['Latest warning count', formatNumber(latestWarnings.length), latestWarnings.length > 0 ? 'Merge warnings may weaken optimization confidence.' : 'No current warning pressure is visible on the latest merge.'],
          ],
        },
        {
          key: 'merge-quality',
          title: 'Merge Quality by Dataset',
          description: 'How each merged dataset performed in row retention, duplicate handling, and warning load.',
          columns: ['Dataset', 'Rows Before', 'Rows After', 'Duplicates', 'Duplicate Rate', 'Warnings', 'Created'],
          rows: mergeQualityRows.slice(0, 10).map((item) => [
            item.title,
            formatNumber(item.before),
            formatNumber(item.after),
            formatNumber(item.duplicates),
            formatPercent(item.duplicateRate, 1),
            formatNumber(item.warnings),
            formatDateTime(item.createdAt),
          ]),
        },
        {
          key: 'latest-sample',
          title: 'Latest Merged Campaign Sample',
          description: 'Sample normalized campaign rows from the latest merged dataset used by baseline selection and scenario tools.',
          columns: ['Campaign', 'Channel', 'Spend', 'ROI', 'Launch Weekday', 'Touches/User'],
          rows: latestSampleRows.slice(0, 10).map((row: any) => [
            row.campaign_name || row.campaign_id || 'Untitled campaign',
            row.channel || row.platform || 'unknown',
            row.spend ?? 'N/A',
            row.roi ?? 'N/A',
            row.launch_weekday || 'N/A',
            row.touches_per_user ?? 'N/A',
          ]),
        },
        {
          key: 'channel-sample-mix',
          title: 'Latest Sample Channel Mix',
          description: 'Channel distribution visible inside the latest merged sample rows.',
          columns: ['Channel', 'Sample Count', 'Sample Share'],
          rows: sampledChannelMix.map((item) => [item.channel, item.count, formatPercent(item.share, 1)]),
        },
        {
          key: 'upload-library',
          title: 'Campaign Upload Library',
          description: 'Module 9-tagged campaign files available to the optimization workflow.',
          columns: ['File', 'Status', 'Size KB', 'Uploaded'],
          rows: uploads.slice(0, 10).map((item: any) => [
            item.originalName || item.filename || 'Campaign CSV',
            item.status || 'active',
            formatNumber((Number(item.length || 0) / 1024), 1),
            formatDateTime(item.createdAt),
          ]),
        },
      ],
      exports: [
        { key: 'uploads', label: 'Campaign Uploads CSV', description: 'Module 9-tagged raw campaign file library.', filename: 'm09_campaign_uploads_report.csv' },
        { key: 'merged-datasets', label: 'Merged Datasets CSV', description: 'Merged campaign dataset register and merge-quality metadata.', filename: 'm09_merged_datasets_report.csv' },
        { key: 'latest-sample', label: 'Latest Sample Rows CSV', description: 'Sample normalized campaign rows from the latest merged dataset.', filename: 'm09_latest_sample_rows_report.csv' },
        { key: 'merge-warnings', label: 'Merge Warnings CSV', description: 'Latest merged-dataset warning inventory for review.', filename: 'm09_merge_warnings_report.csv' },
      ],
    },
    csv: {
      uploads: {
        filename: 'm09_campaign_uploads_report.csv',
        header: ['upload_id', 'filename', 'original_name', 'status', 'size_bytes', 'created_at'],
        rows: uploads.map((item: any) => [String(item._id), item.filename || '', item.originalName || '', item.status || 'active', Number(item.length || 0), formatDateTime(item.createdAt)]),
      },
      'merged-datasets': {
        filename: 'm09_merged_datasets_report.csv',
        header: ['merged_id', 'title', 'row_count_before_merge', 'row_count_after_merge', 'duplicate_count', 'warning_count', 'created_at'],
        rows: (mergedDatasets as any[]).map((item) => [String(item._id), item.title || item.filename || 'Merged dataset', Number(item.rowCountBeforeMerge || 0), Number(item.rowCountAfterMerge || 0), Number(item.duplicateCount || 0), Array.isArray(item.validationSummary?.warnings) ? item.validationSummary.warnings.length : 0, formatDateTime(item.createdAt)]),
      },
      'latest-sample': {
        filename: 'm09_latest_sample_rows_report.csv',
        header: ['campaign_id', 'campaign_name', 'channel', 'platform', 'spend', 'roi', 'launch_weekday', 'launch_hour_bucket', 'touches_per_user'],
        rows: latestSampleRows.map((row: any) => [row.campaign_id || '', row.campaign_name || '', row.channel || '', row.platform || '', row.spend ?? '', row.roi ?? '', row.launch_weekday || '', row.launch_hour_bucket || '', row.touches_per_user ?? '']),
      },
      'merge-warnings': {
        filename: 'm09_merge_warnings_report.csv',
        header: ['merged_dataset', 'warning'],
        rows: (mergedDatasets as any[]).flatMap((item) => {
          const warnings = Array.isArray(item.validationSummary?.warnings) ? item.validationSummary.warnings : [];
          return warnings.map((warning: string) => [item.title || item.filename || 'Merged dataset', warning]);
        }),
      },
    },
  };
}

async function buildReport(moduleKey: ModuleKey, workspaceId: string) {
  if (moduleKey === 'm01') return buildM01Report(workspaceId);
  if (moduleKey === 'm02') return buildM02Report(workspaceId);
  if (moduleKey === 'm03') return buildM03Report(workspaceId);
  if (moduleKey === 'm05') return buildM05Report(workspaceId);
  if (moduleKey === 'm06') return buildM06Report(workspaceId);
  if (moduleKey === 'm07') return buildM07Report(workspaceId);
  return buildM09Report(workspaceId);
}

export async function getModuleReport(req: Request, res: Response) {
  try {
    const moduleKey = String(req.params.moduleKey || '').toLowerCase();
    const workspaceId = getWorkspaceId(req);
    if (!isModuleKey(moduleKey)) return res.status(400).json({ ok: false, error: 'invalid_module_key' });
    if (!workspaceId) return res.status(400).json({ ok: false, error: 'workspace_required' });

    const report = await buildReport(moduleKey, workspaceId);
    return res.json(report.payload);
  } catch (error) {
    console.error('[m08.getModuleReport]', error);
    return res.status(500).json({ ok: false, error: 'internal' });
  }
}

export async function exportModuleReport(req: Request, res: Response) {
  try {
    const moduleKey = String(req.params.moduleKey || '').toLowerCase();
    const exportKey = String(req.query.export || req.query.kind || '').trim();
    const workspaceId = getWorkspaceId(req);
    if (!isModuleKey(moduleKey)) return res.status(400).json({ ok: false, error: 'invalid_module_key' });
    if (!workspaceId) return res.status(400).json({ ok: false, error: 'workspace_required' });
    if (!exportKey) return res.status(400).json({ ok: false, error: 'export_required' });

    const report = await buildReport(moduleKey, workspaceId);
    const spec = report.csv[exportKey];
    if (!spec) return res.status(404).json({ ok: false, error: 'export_not_found' });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${spec.filename}"`);
    return res.send(csvText(spec.header, spec.rows));
  } catch (error) {
    console.error('[m08.exportModuleReport]', error);
    return res.status(500).json({ ok: false, error: 'internal' });
  }
}
