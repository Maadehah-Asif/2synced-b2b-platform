/**
 * Module: Sales & Marketing Alignment (m05)
 * Layer: Backend
 * File: controllers.ts
 * Purpose: Supports the c on tr ol le rs flow for this module.
 * Notes: Documentation header added for maintainability.
 */

import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { parse } from 'csv-parse';
import UploadFile from '../m01/models/UploadFile.js';
import CommunicationThread, {
  type CommunicationParticipant,
  type CommunicationThreadPriority,
  type CommunicationThreadStatus,
  type CommunicationThreadType,
} from './models/CommunicationThread.js';
import CommunicationMessage from './models/CommunicationMessage.js';

const MODULE5_UPLOAD_PREFIX = 'm05-web-engagement__';
const DEFAULT_AUTHOR_NAME = 'Workspace user';

type Tone = 'navy' | 'teal' | 'amber' | 'slate';

function normalizeHeader(value: string) {
  return String(value || '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function pickColumn(header: string[], candidates: string[]) {
  const normalized = header.map(normalizeHeader);
  for (const candidate of candidates) {
    const index = normalized.indexOf(candidate);
    if (index !== -1) return header[index];
  }
  return undefined;
}

function inferColumnMap(header: string[]) {
  return {
    company: pickColumn(header, ['company', 'companyname', 'account', 'accountname', 'organization', 'organisation', 'firm', 'companydomain', 'domain']),
    source: pickColumn(header, ['source', 'trafficsource', 'utmsource', 'channelsource', 'channel', 'referrer', 'referrersource', 'medium']),
    campaign: pickColumn(header, ['campaign', 'campaignname', 'utmcampaign', 'campaignid']),
    pageCategory: pickColumn(header, ['pagecategory', 'contentcategory', 'category', 'section', 'pagegroup', 'contentgroup']),
    page: pickColumn(header, ['page', 'pagetitle', 'pageurl', 'url', 'path', 'landingpage', 'pagepath']),
    intent: pickColumn(header, ['intent', 'intentlabel', 'intentsegment', 'intentlevel', 'buyingintent']),
    engagementScore: pickColumn(header, ['engagementscore', 'score', 'eventscore', 'sessionscore']),
    timestamp: pickColumn(header, ['eventtimestamp', 'eventtime', 'eventdatetime', 'eventdate', 'timestamp', 'datetime', 'occurredat', 'occurredon', 'activitydate', 'lastactivity', 'time', 'date']),
    conversion: pickColumn(header, ['conversion', 'converted', 'isconversion', 'conversionflag', 'goalcompletion', 'isgoal', 'demorequest']),
    eventType: pickColumn(header, ['eventtype', 'event', 'action', 'interactiontype', 'activitytype']),
  };
}

function toNumber(value: any) {
  const cleaned = String(value ?? '').replace(/,/g, '').trim();
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function toDateSafe(value: any) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toIntent(value: any): 'hot' | 'warm' | 'cold' | 'unknown' {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return 'unknown';
  if (raw.includes('hot') || raw.includes('blazing') || raw.includes('high')) return 'hot';
  if (raw.includes('warm') || raw.includes('medium')) return 'warm';
  if (raw.includes('cold') || raw.includes('low')) return 'cold';
  return 'unknown';
}

function toBooleanLike(value: any) {
  const raw = String(value ?? '').trim().toLowerCase();
  return ['1', 'true', 'yes', 'y', 'converted'].includes(raw);
}

function normalizeValue(value: any, fallback = 'Unknown') {
  const trimmed = String(value ?? '').trim();
  return trimmed || fallback;
}

function derivePageCategory(pageCategory: string, page: string) {
  if (pageCategory && pageCategory !== 'Unknown') return pageCategory;
  const normalizedPage = String(page || '').toLowerCase();
  if (!normalizedPage) return 'Unknown';
  if (normalizedPage.includes('pricing')) return 'Pricing';
  if (normalizedPage.includes('demo') || normalizedPage.includes('contact') || normalizedPage.includes('signup')) return 'Conversion';
  if (normalizedPage.includes('product') || normalizedPage.includes('feature') || normalizedPage.includes('solution')) return 'Product';
  if (normalizedPage.includes('blog') || normalizedPage.includes('article') || normalizedPage.includes('resource')) return 'Content';
  if (normalizedPage.includes('case') || normalizedPage.includes('customer')) return 'Proof';
  return 'Other';
}

function detectConversion(row: Record<string, any>, columnMap: ReturnType<typeof inferColumnMap>, page: string, eventType: string) {
  if (columnMap.conversion && toBooleanLike(row[columnMap.conversion])) return true;
  const merged = `${page} ${eventType}`.toLowerCase();
  return ['demo', 'contact', 'signup', 'book', 'trial', 'form_submit', 'conversion'].some((keyword) => merged.includes(keyword));
}

function detectHighIntent(intent: ReturnType<typeof toIntent>, engagementScore: number | null, page: string, eventType: string) {
  if (intent === 'hot') return true;
  if (typeof engagementScore === 'number' && engagementScore >= 70) return true;
  const merged = `${page} ${eventType}`.toLowerCase();
  return ['pricing', 'demo', 'contact', 'trial', 'quote', 'book'].some((keyword) => merged.includes(keyword));
}

function createDistribution(items: Array<{ label: string; value: number; helper?: string; tone?: Tone }>) {
  const total = items.reduce((sum, item) => sum + item.value, 0) || 1;
  return items
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)
    .map((item) => ({
      ...item,
      share: (item.value / total) * 100,
    }));
}

function increment(map: Map<string, number>, key: string, amount = 1) {
  map.set(key, (map.get(key) || 0) + amount);
}

function looksLikeHeader(record: string[]) {
  if (!record || record.length === 0) return false;
  let numericCount = 0;
  let alphaCount = 0;
  let nonEmpty = 0;

  for (const cell of record) {
    const value = String(cell ?? '').trim();
    if (!value) continue;
    nonEmpty += 1;
    if (/^[0-9\-\. ,]+$/.test(value)) numericCount += 1;
    if (/[A-Za-z]/.test(value)) alphaCount += 1;
  }

  if (nonEmpty === 0) return false;
  return alphaCount > 0 && numericCount / nonEmpty < 0.9;
}

function isValidObjectId(value: string) {
  return mongoose.isValidObjectId(value);
}

function normalizeWorkspaceId(source: { query?: any; workspace?: any; workspaceId?: any }) {
  return String(source?.query?.workspace || source?.query?.workspaceId || source?.workspace || source?.workspaceId || '').trim();
}

function normalizeSearch(value: unknown) {
  return String(value || '').trim();
}

function normalizeThreadType(value: unknown): CommunicationThreadType {
  const raw = String(value || '').trim();
  return ['lead_issue', 'campaign_issue', 'alignment_concern', 'follow_up', 'blocker', 'general', 'note'].includes(raw)
    ? raw as CommunicationThreadType
    : 'general';
}

function normalizeThreadStatus(value: unknown): CommunicationThreadStatus {
  const raw = String(value || '').trim();
  return ['open', 'in_progress', 'resolved'].includes(raw)
    ? raw as CommunicationThreadStatus
    : 'open';
}

function normalizeThreadPriority(value: unknown): CommunicationThreadPriority {
  const raw = String(value || '').trim();
  return ['low', 'medium', 'high'].includes(raw)
    ? raw as CommunicationThreadPriority
    : 'medium';
}

function sanitizeParticipants(value: unknown): CommunicationParticipant[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .map((item) => {
      const userIdRaw = String((item as any)?.userId || '').trim();
      const name = String((item as any)?.name || '').trim();
      const email = String((item as any)?.email || '').trim().toLowerCase();
      const role = String((item as any)?.role || '').trim();
      if (!name) return null;
      const dedupeKey = userIdRaw || email || name.toLowerCase();
      if (!dedupeKey || seen.has(dedupeKey)) return null;
      seen.add(dedupeKey);
      return {
        ...(userIdRaw && isValidObjectId(userIdRaw) ? { userId: new mongoose.Types.ObjectId(userIdRaw) } : {}),
        name,
        ...(email ? { email } : {}),
        ...(role ? { role } : {}),
      };
    })
    .filter(Boolean) as CommunicationParticipant[];
}

function summarizeBody(body: string) {
  const compact = body.replace(/\s+/g, ' ').trim();
  if (compact.length <= 180) return compact;
  return `${compact.slice(0, 177).trimEnd()}...`;
}

function getActor(req: Request) {
  const user = (req as any).user;
  return {
    id: user?.id && isValidObjectId(String(user.id)) ? new mongoose.Types.ObjectId(String(user.id)) : null,
    name: String(user?.fullName || user?.email || DEFAULT_AUTHOR_NAME).trim() || DEFAULT_AUTHOR_NAME,
    email: user?.email ? String(user.email).trim().toLowerCase() : null,
  };
}

function isThreadCreator(thread: any, actor: ReturnType<typeof getActor>) {
  if (!actor.id && !actor.email) return false;
  if (actor.id && thread.createdBy && String(thread.createdBy) === String(actor.id)) return true;
  if (actor.email && thread.createdByEmail && String(thread.createdByEmail).trim().toLowerCase() === actor.email) return true;
  return false;
}

function isThreadParticipant(thread: any, actor: ReturnType<typeof getActor>) {
  if (!actor.id && !actor.email) return false;
  return Array.isArray(thread.participants) && thread.participants.some((participant: any) => {
    if (actor.id && participant?.userId && String(participant.userId) === String(actor.id)) return true;
    if (actor.email && participant?.email && String(participant.email).trim().toLowerCase() === actor.email) return true;
    return false;
  });
}

function canManageThreadStatus(thread: any, actor: ReturnType<typeof getActor>) {
  return isThreadCreator(thread, actor) || isThreadParticipant(thread, actor);
}

function canArchiveThread(thread: any, actor: ReturnType<typeof getActor>) {
  return canManageThreadStatus(thread, actor);
}

function canDeleteThread(thread: any, actor: ReturnType<typeof getActor>) {
  return isThreadCreator(thread, actor);
}

function serializeThread(thread: any, actor?: ReturnType<typeof getActor>) {
  const resolvedActor = actor || { id: null, name: '', email: null };
  return {
    id: String(thread._id),
    workspaceId: String(thread.workspaceId),
    title: thread.title,
    type: thread.type,
    status: thread.status,
    priority: thread.priority,
    createdBy: thread.createdBy ? String(thread.createdBy) : null,
    createdByName: thread.createdByName,
    createdByEmail: thread.createdByEmail || null,
    participants: Array.isArray(thread.participants) ? thread.participants : [],
    archivedAt: thread.archivedAt || null,
    archivedBy: thread.archivedBy ? String(thread.archivedBy) : null,
    archivedByName: thread.archivedByName || null,
    messageCount: Number(thread.messageCount || 0),
    lastMessageAt: thread.lastMessageAt || null,
    lastMessagePreview: thread.lastMessagePreview || null,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    permissions: {
      canChangeStatus: canManageThreadStatus(thread, resolvedActor),
      canArchive: canArchiveThread(thread, resolvedActor),
      canDelete: canDeleteThread(thread, resolvedActor),
    },
  };
}

function serializeMessage(message: any) {
  return {
    id: String(message._id),
    threadId: String(message.threadId),
    authorId: message.authorId ? String(message.authorId) : null,
    authorName: message.authorName,
    authorEmail: message.authorEmail || null,
    body: message.body,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
  };
}

async function findThreadInWorkspace(threadId: string, workspaceId: string) {
  return CommunicationThread.findOne({
    _id: threadId,
    workspaceId,
  });
}

export async function getWebEngagementAnalytics(req: Request, res: Response) {
  try {
    const uploadId = String(req.params.uploadId || '');
    const workspace = String(req.query.workspace || req.query.workspaceId || '');

    if (!uploadId || !mongoose.isValidObjectId(uploadId)) return res.status(400).json({ error: 'invalid upload id' });
    if (!workspace || !mongoose.isValidObjectId(workspace)) return res.status(400).json({ error: 'workspace is required' });

    const doc = await UploadFile.findById(uploadId).lean();
    if (!doc) return res.status(404).json({ error: 'upload not found' });
    if (String(doc.workspace) !== String(workspace)) return res.status(403).json({ error: 'forbidden' });

    const rawName = String(doc.originalName || doc.filename || '');
    if (!rawName.startsWith(MODULE5_UPLOAD_PREFIX)) return res.status(400).json({ error: 'not a module 5 web engagement upload' });

    const db = mongoose.connection.db;
    if (!db) return res.status(500).json({ error: 'db not ready' });

    const bucket = new mongoose.mongo.GridFSBucket(db as any, { bucketName: 'm01_uploads' });
    const downloadStream = bucket.openDownloadStream(doc.fileId);
    const parser = parse({ bom: true, trim: true, relax_column_count: true, skip_empty_lines: true });

    const sourceMap = new Map<string, number>();
    const sourceHighIntent = new Map<string, number>();
    const campaignMap = new Map<string, number>();
    const campaignHighIntent = new Map<string, number>();
    const campaignConversions = new Map<string, number>();
    const categoryMap = new Map<string, number>();
    const trendMap = new Map<string, number>();
    const companyMap = new Map<string, {
      company: string;
      eventCount: number;
      highIntentEvents: number;
      conversions: number;
      categoryCounts: Map<string, number>;
      pageCounts: Map<string, number>;
      lastActivity: Date | null;
    }>();

    let header: string[] = [];
    let columnMap = inferColumnMap([]);
    let totalEvents = 0;
    let highIntentEvents = 0;
    let conversions = 0;
    let engagementScoreSum = 0;
    let engagementScoreCount = 0;
    const uniqueCompanies = new Set<string>();

    const done = new Promise<void>((resolve, reject) => {
      const allRecords: string[][] = [];

      parser.on('readable', () => {
        let record: string[] | null;
        while ((record = parser.read()) !== null) {
          allRecords.push(record.map((cell) => String(cell ?? '').replace(/^\uFEFF/, '').trim()));
        }
      });

      parser.on('end', () => {
        try {
          let headerIndex = -1;
          const headerScanLimit = Math.min(allRecords.length, 3);
          for (let index = 0; index < headerScanLimit; index += 1) {
            if (looksLikeHeader(allRecords[index] ?? [])) {
              headerIndex = index;
              break;
            }
          }
          if (headerIndex === -1 && allRecords.length > 0) headerIndex = 0;

          header = (allRecords[headerIndex] ?? []).map((cell) => String(cell ?? '').replace(/^\uFEFF/, '').trim());
          columnMap = inferColumnMap(header);

          const dataRecords = headerIndex >= 0 ? allRecords.slice(headerIndex + 1) : [];
          for (const row of dataRecords) {
            const record: Record<string, any> = {};
            header.forEach((column, index) => {
              record[column] = String(row[index] ?? '').trim();
            });

            totalEvents += 1;

            const page = normalizeValue(columnMap.page ? record[columnMap.page] : '', 'Unknown page');
            const eventType = normalizeValue(columnMap.eventType ? record[columnMap.eventType] : '', 'Unknown event');
            const intent = toIntent(columnMap.intent ? record[columnMap.intent] : '');
            const engagementScore = columnMap.engagementScore ? toNumber(record[columnMap.engagementScore]) : null;
            const timestamp = columnMap.timestamp ? toDateSafe(record[columnMap.timestamp]) : null;
            const source = normalizeValue(columnMap.source ? record[columnMap.source] : '', 'Direct / Unknown');
            const campaign = normalizeValue(columnMap.campaign ? record[columnMap.campaign] : '', 'No campaign');
            const company = normalizeValue(columnMap.company ? record[columnMap.company] : '', 'Unknown company');
            const pageCategory = derivePageCategory(normalizeValue(columnMap.pageCategory ? record[columnMap.pageCategory] : '', 'Unknown'), page);
            const converted = detectConversion(record, columnMap, page, eventType);
            const isHighIntent = detectHighIntent(intent, engagementScore, page, eventType);

            increment(sourceMap, source);
            increment(campaignMap, campaign);
            increment(categoryMap, pageCategory);

            if (isHighIntent) {
              highIntentEvents += 1;
              increment(sourceHighIntent, source);
              increment(campaignHighIntent, campaign);
            }

            if (converted) {
              conversions += 1;
              increment(campaignConversions, campaign);
            }

            if (typeof engagementScore === 'number') {
              engagementScoreSum += engagementScore;
              engagementScoreCount += 1;
            }

            if (company !== 'Unknown company') uniqueCompanies.add(company);

            if (timestamp) {
              const dayKey = timestamp.toISOString().slice(0, 10);
              increment(trendMap, dayKey);
            }

            const companyEntry = companyMap.get(company) || {
              company,
              eventCount: 0,
              highIntentEvents: 0,
              conversions: 0,
              categoryCounts: new Map<string, number>(),
              pageCounts: new Map<string, number>(),
              lastActivity: null,
            };

            companyEntry.eventCount += 1;
            if (isHighIntent) companyEntry.highIntentEvents += 1;
            if (converted) companyEntry.conversions += 1;
            increment(companyEntry.categoryCounts, pageCategory);
            increment(companyEntry.pageCounts, page);
            if (timestamp && (!companyEntry.lastActivity || timestamp > companyEntry.lastActivity)) companyEntry.lastActivity = timestamp;
            companyMap.set(company, companyEntry);
          }

          resolve();
        } catch (err) {
          reject(err);
        }
      });
      parser.on('error', (err) => reject(err));
      downloadStream.on('error', (err) => reject(err));
    });

    downloadStream.pipe(parser);
    await done;

    if (header.length === 0) {
      return res.status(400).json({
        error: 'dataset header could not be read',
        detail: 'The uploaded CSV could not produce a recognizable header row from the stored file.',
      });
    }

    const sourceDistribution = createDistribution(
      Array.from(sourceMap.entries()).map(([label, value]) => ({
        label,
        value,
        helper: `${sourceHighIntent.get(label) || 0} high-intent events`,
        tone: label.toLowerCase().includes('email') || label.toLowerCase().includes('direct') ? 'teal' : 'navy' as Tone,
      })),
    );

    const campaignPerformance = createDistribution(
      Array.from(campaignMap.entries()).map(([label, value]) => ({
        label,
        value,
        helper: `${campaignHighIntent.get(label) || 0} high-intent | ${campaignConversions.get(label) || 0} conversions`,
        tone: (campaignConversions.get(label) || 0) > 0 ? 'teal' : 'navy' as Tone,
      })),
    );

    const pageCategoryEngagement = createDistribution(
      Array.from(categoryMap.entries()).map(([label, value]) => ({
        label,
        value,
        helper: `${Math.round((value / (totalEvents || 1)) * 100)}% of activity`,
        tone: label.toLowerCase().includes('pricing') || label.toLowerCase().includes('conversion') ? 'amber' : 'navy' as Tone,
      })),
    );

    const trend = Array.from(trendMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-8)
      .map(([key, value], _idx, arr) => {
        const total = arr.reduce((sum, item) => sum + item[1], 0) || 1;
        return {
          label: new Date(key).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          value,
          share: (value / total) * 100,
          helper: 'daily event volume',
          tone: 'navy' as Tone,
        };
      });

    const companyRows = Array.from(companyMap.values())
      .filter((entry) => entry.company !== 'Unknown company')
      .sort((a, b) => {
        if (b.highIntentEvents !== a.highIntentEvents) return b.highIntentEvents - a.highIntentEvents;
        if (b.conversions !== a.conversions) return b.conversions - a.conversions;
        return b.eventCount - a.eventCount;
      })
      .slice(0, 10)
      .map((entry) => {
        const topPageCategory = Array.from(entry.categoryCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown';
        const topPage = Array.from(entry.pageCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown page';
        const status = entry.highIntentEvents >= 3 || entry.conversions >= 2
          ? 'Hot'
          : entry.highIntentEvents >= 1 || entry.eventCount >= 3
            ? 'Warm'
            : 'Cold';
        return {
          company: entry.company,
          eventCount: entry.eventCount,
          highIntentEvents: entry.highIntentEvents,
          conversions: entry.conversions,
          topPageCategory,
          topPage,
          lastActivityDate: entry.lastActivity ? entry.lastActivity.toISOString() : null,
          lastActivityLabel: entry.lastActivity ? entry.lastActivity.toLocaleDateString() : 'Unknown',
          status,
        };
      });

    const topSource = sourceDistribution[0] || null;
    const topCampaign = campaignPerformance[0] || null;
    const topCategory = pageCategoryEngagement[0] || null;
    const averageEngagement = engagementScoreCount ? engagementScoreSum / engagementScoreCount : null;

    const opportunityCards: Array<{ title: string; stat: string; body: string; tone: Tone }> = [];
    const riskCards: Array<{ title: string; stat: string; body: string; tone: Tone }> = [];

    if (topCampaign && (campaignConversions.get(topCampaign.label) || 0) > 0) {
      opportunityCards.push({
        title: 'Top opportunity',
        stat: topCampaign.label,
        body: `${campaignConversions.get(topCampaign.label) || 0} conversion-style events and ${campaignHighIntent.get(topCampaign.label) || 0} high-intent events make this the strongest visible campaign.`,
        tone: 'teal',
      });
    }

    if (topSource) {
      opportunityCards.push({
        title: 'Strongest source',
        stat: topSource.label,
        body: `${Math.round(topSource.share)}% of the dataset activity is coming from this source, with ${sourceHighIntent.get(topSource.label) || 0} high-intent events visible.`,
        tone: 'navy',
      });
    }

    if (topCategory && topCategory.label.toLowerCase().includes('content') && conversions <= Math.max(1, Math.round(totalEvents * 0.1))) {
      riskCards.push({
        title: 'Main risk',
        stat: topCategory.label,
        body: 'Content-heavy traffic is strong, but downstream conversion behavior is still comparatively light.',
        tone: 'amber',
      });
    }

    if (pageCategoryEngagement.some((item) => item.label.toLowerCase().includes('pricing')) && conversions < Math.max(1, Math.round(highIntentEvents * 0.5))) {
      riskCards.push({
        title: 'Biggest drop-off signal',
        stat: 'Pricing interest',
        body: 'Visitors are reaching high-intent pages, but the conversion follow-through is lower than the visible interest level suggests.',
        tone: 'amber',
      });
    }

    if (opportunityCards.length === 0) {
      opportunityCards.push({
        title: 'Top opportunity',
        stat: `${totalEvents} events`,
        body: 'The dataset is large enough to support source, campaign, and company-level interpretation for Module 5.',
        tone: 'navy',
      });
    }

    if (riskCards.length === 0) {
      riskCards.push({
        title: 'Main risk',
        stat: uniqueCompanies.size <= 1 ? 'Low coverage' : 'Monitor mix',
        body: uniqueCompanies.size <= 1
          ? 'Company-level variety is limited, so sales-readiness conclusions should stay conservative.'
          : 'Keep watching whether high-interest page activity continues to turn into conversion behavior.',
        tone: 'slate',
      });
    }

    return res.json({
      ok: true,
      dataset: {
        uploadId: String(doc._id),
        name: rawName.slice(MODULE5_UPLOAD_PREFIX.length),
        createdAt: doc.createdAt,
        length: doc.length ?? null,
      },
      diagnostics: {
        header,
        columnMap,
      },
      kpis: {
        totalEvents,
        uniqueCompanies: uniqueCompanies.size,
        highIntentEvents,
        conversionRate: totalEvents ? Number(((conversions / totalEvents) * 100).toFixed(1)) : 0,
        topTrafficSource: topSource ? topSource.label : 'Unknown',
        topCampaign: topCampaign ? topCampaign.label : 'No campaign',
        averageEngagementScore: averageEngagement != null ? Number(averageEngagement.toFixed(1)) : null,
      },
      sourceDistribution,
      campaignPerformance,
      pageCategoryEngagement,
      trend,
      companyRows,
      insightCards: {
        topOpportunity: opportunityCards[0],
        strongestSource: topSource ? {
          title: 'Strongest source',
          stat: topSource.label,
          body: `${Math.round(topSource.share)}% of total activity is coming from this source.`,
          tone: 'navy' as Tone,
        } : null,
        mainRisk: riskCards[0],
        biggestDropOff: riskCards[1] || null,
      },
    });
  } catch (e) {
    console.error('[m05.getWebEngagementAnalytics]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function listCommunicationThreads(req: Request, res: Response) {
  try {
    const workspaceId = normalizeWorkspaceId(req);
    const actor = getActor(req);
    if (!workspaceId || !isValidObjectId(workspaceId)) return res.status(400).json({ error: 'workspace is required' });

    const status = normalizeSearch(req.query.status);
    const priority = normalizeSearch(req.query.priority);
    const type = normalizeSearch(req.query.type);
    const q = normalizeSearch(req.query.q);
    const view = normalizeSearch(req.query.view) || 'active';
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));

    const filter: Record<string, any> = {
      workspaceId,
    };

    if (status && ['open', 'in_progress', 'resolved'].includes(status)) filter.status = status;
    if (priority && ['low', 'medium', 'high'].includes(priority)) filter.priority = priority;
    if (type && ['lead_issue', 'campaign_issue', 'alignment_concern', 'follow_up', 'blocker', 'general', 'note'].includes(type)) filter.type = type;
    if (view === 'archived') filter.archivedAt = { $ne: null };
    if (view !== 'all' && view !== 'archived') filter.archivedAt = null;
    if (q) {
      filter.$or = [
        { title: { $regex: q, $options: 'i' } },
        { createdByName: { $regex: q, $options: 'i' } },
        { lastMessagePreview: { $regex: q, $options: 'i' } },
        { 'participants.name': { $regex: q, $options: 'i' } },
        { 'participants.email': { $regex: q, $options: 'i' } },
      ];
    }

    const items = await CommunicationThread.find(filter)
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    return res.json({
      ok: true,
      items: items.map((item) => serializeThread(item, actor)),
    });
  } catch (e) {
    console.error('[m05.listCommunicationThreads]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function getCommunicationThreadDetail(req: Request, res: Response) {
  try {
    const workspaceId = normalizeWorkspaceId(req);
    const threadId = String(req.params.threadId || '').trim();
    const actor = getActor(req);

    if (!workspaceId || !isValidObjectId(workspaceId)) return res.status(400).json({ error: 'workspace is required' });
    if (!threadId || !isValidObjectId(threadId)) return res.status(400).json({ error: 'invalid thread id' });

    const thread = await CommunicationThread.findOne({ _id: threadId, workspaceId }).lean();
    if (!thread) return res.status(404).json({ error: 'thread not found' });

    const messages = await CommunicationMessage.find({ workspaceId, threadId })
      .sort({ createdAt: 1 })
      .lean();

    return res.json({
      ok: true,
      thread: serializeThread(thread, actor),
      messages: messages.map(serializeMessage),
    });
  } catch (e) {
    console.error('[m05.getCommunicationThreadDetail]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function createCommunicationThread(req: Request, res: Response) {
  try {
    const workspaceId = normalizeWorkspaceId(req.body);
    const title = String(req.body?.title || '').trim();
    const body = String(req.body?.body || '').trim();
    const type = normalizeThreadType(req.body?.type);
    const priority = normalizeThreadPriority(req.body?.priority);
    const participants = sanitizeParticipants(req.body?.participants);

    if (!workspaceId || !isValidObjectId(workspaceId)) return res.status(400).json({ error: 'workspace is required' });
    if (!title) return res.status(400).json({ error: 'title is required' });
    if (!body) return res.status(400).json({ error: 'initial message is required' });
    if (type !== 'note' && participants.length === 0) {
      return res.status(400).json({
        error: 'participants_required',
        detail: 'Add at least one participant for discussion threads. Notes can be created without participants.',
      });
    }

    const actor = getActor(req);
    const now = new Date();

    const thread = await CommunicationThread.create({
      workspaceId,
      title,
      type,
      status: 'open',
      priority,
      createdBy: actor.id,
      createdByName: actor.name,
      createdByEmail: actor.email,
      participants,
      archivedAt: null,
      archivedBy: null,
      archivedByName: null,
      messageCount: 1,
      lastMessageAt: now,
      lastMessagePreview: summarizeBody(body),
    });

    const message = await CommunicationMessage.create({
      workspaceId,
      threadId: thread._id,
      authorId: actor.id,
      authorName: actor.name,
      authorEmail: actor.email,
      body,
    });

    return res.status(201).json({
      ok: true,
      thread: serializeThread(thread.toObject(), actor),
      message: serializeMessage(message.toObject()),
    });
  } catch (e) {
    console.error('[m05.createCommunicationThread]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function addCommunicationReply(req: Request, res: Response) {
  try {
    const workspaceId = normalizeWorkspaceId(req.body);
    const threadId = String(req.params.threadId || '').trim();
    const body = String(req.body?.body || '').trim();

    if (!workspaceId || !isValidObjectId(workspaceId)) return res.status(400).json({ error: 'workspace is required' });
    if (!threadId || !isValidObjectId(threadId)) return res.status(400).json({ error: 'invalid thread id' });
    if (!body) return res.status(400).json({ error: 'reply body is required' });

    const thread = await findThreadInWorkspace(threadId, workspaceId);
    if (!thread) return res.status(404).json({ error: 'thread not found' });

    const actor = getActor(req);
    const message = await CommunicationMessage.create({
      workspaceId,
      threadId,
      authorId: actor.id,
      authorName: actor.name,
      authorEmail: actor.email,
      body,
    });

    thread.messageCount = Number(thread.messageCount || 0) + 1;
    thread.lastMessageAt = message.createdAt;
    thread.lastMessagePreview = summarizeBody(body);
    await thread.save();

    return res.status(201).json({
      ok: true,
      message: serializeMessage(message.toObject()),
      thread: serializeThread(thread.toObject(), actor),
    });
  } catch (e) {
    console.error('[m05.addCommunicationReply]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function updateCommunicationThreadStatus(req: Request, res: Response) {
  try {
    const workspaceId = normalizeWorkspaceId(req.body);
    const threadId = String(req.params.threadId || '').trim();
    const status = normalizeThreadStatus(req.body?.status);
    const actor = getActor(req);

    if (!workspaceId || !isValidObjectId(workspaceId)) return res.status(400).json({ error: 'workspace is required' });
    if (!threadId || !isValidObjectId(threadId)) return res.status(400).json({ error: 'invalid thread id' });

    const thread = await findThreadInWorkspace(threadId, workspaceId);
    if (!thread) return res.status(404).json({ error: 'thread not found' });
    if (!canManageThreadStatus(thread, actor)) return res.status(403).json({ error: 'forbidden' });

    thread.status = status;
    await thread.save();

    return res.json({
      ok: true,
      thread: serializeThread(thread.toObject(), actor),
    });
  } catch (e) {
    console.error('[m05.updateCommunicationThreadStatus]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function updateCommunicationThreadPriority(req: Request, res: Response) {
  try {
    const workspaceId = normalizeWorkspaceId(req.body);
    const threadId = String(req.params.threadId || '').trim();
    const priority = normalizeThreadPriority(req.body?.priority);
    const actor = getActor(req);

    if (!workspaceId || !isValidObjectId(workspaceId)) return res.status(400).json({ error: 'workspace is required' });
    if (!threadId || !isValidObjectId(threadId)) return res.status(400).json({ error: 'invalid thread id' });

    const thread = await findThreadInWorkspace(threadId, workspaceId);
    if (!thread) return res.status(404).json({ error: 'thread not found' });

    thread.priority = priority;
    await thread.save();

    return res.json({
      ok: true,
      thread: serializeThread(thread.toObject(), actor),
    });
  } catch (e) {
    console.error('[m05.updateCommunicationThreadPriority]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function archiveCommunicationThread(req: Request, res: Response) {
  try {
    const workspaceId = normalizeWorkspaceId(req.body);
    const threadId = String(req.params.threadId || '').trim();
    const archived = req.body?.archived !== false;
    const actor = getActor(req);

    if (!workspaceId || !isValidObjectId(workspaceId)) return res.status(400).json({ error: 'workspace is required' });
    if (!threadId || !isValidObjectId(threadId)) return res.status(400).json({ error: 'invalid thread id' });

    const thread = await findThreadInWorkspace(threadId, workspaceId);
    if (!thread) return res.status(404).json({ error: 'thread not found' });
    if (!canArchiveThread(thread, actor)) return res.status(403).json({ error: 'forbidden' });

    if (archived) {
      thread.archivedAt = new Date();
      thread.archivedBy = actor.id;
      thread.archivedByName = actor.name;
    } else {
      thread.archivedAt = null;
      thread.archivedBy = null;
      thread.archivedByName = null;
    }

    await thread.save();

    return res.json({
      ok: true,
      thread: serializeThread(thread.toObject(), actor),
    });
  } catch (e) {
    console.error('[m05.archiveCommunicationThread]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function deleteCommunicationThread(req: Request, res: Response) {
  try {
    const workspaceId = normalizeWorkspaceId(req.body);
    const threadId = String(req.params.threadId || '').trim();
    const actor = getActor(req);

    if (!workspaceId || !isValidObjectId(workspaceId)) return res.status(400).json({ error: 'workspace is required' });
    if (!threadId || !isValidObjectId(threadId)) return res.status(400).json({ error: 'invalid thread id' });

    const thread = await findThreadInWorkspace(threadId, workspaceId);
    if (!thread) return res.status(404).json({ error: 'thread not found' });
    if (!canDeleteThread(thread, actor)) return res.status(403).json({ error: 'forbidden' });

    await Promise.all([
      CommunicationMessage.deleteMany({ workspaceId, threadId }),
      CommunicationThread.deleteOne({ _id: threadId, workspaceId }),
    ]);

    return res.json({
      ok: true,
      deletedThreadId: threadId,
    });
  } catch (e) {
    console.error('[m05.deleteCommunicationThread]', e);
    return res.status(500).json({ error: 'internal' });
  }
}
