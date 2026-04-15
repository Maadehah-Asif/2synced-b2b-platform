export const MODULE5_UPLOAD_PREFIX = 'm05-web-engagement__'

export type Module5UploadStatus = 'active' | 'archived'

export type UploadItem = {
  _id: string
  filename?: string | null
  originalName?: string | null
  contentType?: string | null
  length?: number | null
  metadata?: {
    uploader?: {
      fullName?: string | null
      email?: string | null
    } | null
  } | null
  createdAt?: string | null
  status?: 'active' | 'archived'
}

export type PreviewData = {
  header: string[]
  rows: string[][]
  page: number
  perPage: number
  hasMore: boolean
}

export type DatasetColumnMap = {
  company?: string
  source?: string
  campaign?: string
  pageCategory?: string
  page?: string
  intent?: string
  engagementScore?: string
  timestamp?: string
  conversion?: string
  eventType?: string
}

export type UploadValidationGroup = {
  key: 'timestamp' | 'company' | 'content' | 'activity' | 'acquisition'
  label: string
  description: string
  columns: string[]
  satisfied: boolean
}

export type UploadValidationSummary = {
  header: string[]
  rowCountPreview: number
  columnMap: DatasetColumnMap
  requiredGroups: UploadValidationGroup[]
  optionalMatches: Array<{ label: string; columns: string[] }>
  missingRequiredLabels: string[]
  valid: boolean
  reason: string
}

export type ParsedWebRow = {
  company: string
  source: string
  campaign: string
  pageCategory: string
  page: string
  intent: 'hot' | 'warm' | 'cold' | 'unknown'
  engagementScore: number | null
  timestamp: Date | null
  converted: boolean
  eventType: string
  isHighIntent: boolean
}

export type WebEngagementKpi = {
  label: string
  value: string
  note: string
  tone: 'navy' | 'teal' | 'amber' | 'slate'
}

export type DistributionItem = {
  label: string
  value: number
  share: number
  helper?: string
  tone?: 'navy' | 'teal' | 'amber' | 'slate'
}

export type CompanyInsightRow = {
  company: string
  eventCount: number
  highIntentEvents: number
  conversions: number
  topPageCategory: string
  lastActivityLabel: string
  status: 'Hot' | 'Warm' | 'Cold'
}

export type WebInsight = {
  title: string
  stat: string
  body: string
  tone: 'navy' | 'teal' | 'amber' | 'slate'
}

export type AnalyticsInsightCard = {
  title: string
  stat: string
  body: string
  tone: 'navy' | 'teal' | 'amber' | 'slate'
}

export type AnalyticsCompanyRow = {
  company: string
  eventCount: number
  highIntentEvents: number
  conversions: number
  topPageCategory: string
  topPage: string
  lastActivityDate: string | null
  lastActivityLabel: string
  status: 'Hot' | 'Warm' | 'Cold'
}

export type Module5AnalyticsResponse = {
  dataset: {
    uploadId: string
    name: string
    createdAt?: string | null
    length?: number | null
  }
  diagnostics: {
    header: string[]
    columnMap: DatasetColumnMap
  }
  kpis: {
    totalEvents: number
    uniqueCompanies: number
    highIntentEvents: number
    conversionRate: number
    topTrafficSource: string
    topCampaign: string
    averageEngagementScore: number | null
  }
  sourceDistribution: DistributionItem[]
  campaignPerformance: DistributionItem[]
  pageCategoryEngagement: DistributionItem[]
  trend: DistributionItem[]
  companyRows: AnalyticsCompanyRow[]
  insightCards: {
    topOpportunity: AnalyticsInsightCard | null
    strongestSource: AnalyticsInsightCard | null
    mainRisk: AnalyticsInsightCard | null
    biggestDropOff: AnalyticsInsightCard | null
  }
}

export type WebEngagementMetrics = {
  columnMap: DatasetColumnMap
  totalRows: number
  usesSample: boolean
  timelineAvailable: boolean
  kpis: WebEngagementKpi[]
  sourceDistribution: DistributionItem[]
  campaignPerformance: DistributionItem[]
  pageCategoryDistribution: DistributionItem[]
  intentDistribution: DistributionItem[]
  timeline: DistributionItem[]
  companyRows: CompanyInsightRow[]
  insights: WebInsight[]
}

export function getAuthHeaders(extra: Record<string, string> = {}) {
  try {
    const token = localStorage.getItem('token')
    return token ? { ...extra, Authorization: `Bearer ${token}` } : extra
  } catch {
    return extra
  }
}

export function isModule5Upload(item: UploadItem) {
  const name = String(item.originalName || item.filename || '')
  return name.startsWith(MODULE5_UPLOAD_PREFIX)
}

export function getDisplayName(item: UploadItem) {
  const raw = String(item.originalName || item.filename || 'Untitled dataset')
  return raw.startsWith(MODULE5_UPLOAD_PREFIX) ? raw.slice(MODULE5_UPLOAD_PREFIX.length) : raw
}

export function formatBytes(value?: number | null) {
  if (!value || value <= 0) return 'Unknown size'
  const units = ['B', 'KB', 'MB', 'GB']
  let current = value
  let index = 0
  while (current >= 1024 && index < units.length - 1) {
    current /= 1024
    index += 1
  }
  return `${current >= 10 || index === 0 ? Math.round(current) : current.toFixed(1)} ${units[index]}`
}

export function normalizeHeader(value: string) {
  return value
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function pickColumn(header: string[], candidates: string[]) {
  const normalized = header.map(normalizeHeader)
  for (const candidate of candidates) {
    const matchIndex = normalized.indexOf(candidate)
    if (matchIndex !== -1) return header[matchIndex]
  }
  return undefined
}

export function inferColumnMap(header: string[]): DatasetColumnMap {
  return {
    company: pickColumn(header, ['company', 'companyname', 'account', 'accountname', 'organization', 'organisation', 'firm', 'companydomain', 'domain']),
    source: pickColumn(header, ['source', 'trafficsource', 'utmsource', 'channelsource', 'channel', 'referrer', 'referrersource', 'medium']),
    campaign: pickColumn(header, ['campaign', 'campaignname', 'utmcampaign', 'campaignid']),
    pageCategory: pickColumn(header, ['pagecategory', 'contentcategory', 'category', 'section', 'pagegroup', 'contentgroup']),
    page: pickColumn(header, ['page', 'pagetitle', 'pageurl', 'url', 'path', 'landingpage', 'pagepath']),
    intent: pickColumn(header, ['intent', 'intentlabel', 'intentsegment', 'intentlevel', 'buyingintent']),
    engagementScore: pickColumn(header, ['engagementscore', 'score', 'eventscore', 'sessionscore']),
    timestamp: pickColumn(header, [
      'eventtimestamp',
      'eventtime',
      'eventdatetime',
      'eventdate',
      'timestamp',
      'datetime',
      'occurredat',
      'occurredon',
      'activitydate',
      'lastactivity',
      'time',
      'date',
    ]),
    conversion: pickColumn(header, ['conversion', 'converted', 'isconversion', 'conversionflag', 'goalcompletion', 'isgoal', 'demorequest']),
    eventType: pickColumn(header, ['eventtype', 'event', 'action', 'interactiontype', 'activitytype']),
  }
}

export function parseCsvLine(line: string) {
  const cells: string[] = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]

    if (char === '"') {
      const next = line[index + 1]
      if (inQuotes && next === '"') {
        current += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      cells.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  cells.push(current.trim())
  return cells
}

export function inspectCsvText(text: string) {
  const normalized = text.replace(/\r\n?/g, '\n')
  const lines = normalized.split('\n')
  const nonBlankLines = lines.filter((line) => line.trim().length > 0)
  const header = nonBlankLines[0] ? parseCsvLine(nonBlankLines[0]).map((cell) => cell.replace(/^\uFEFF/, '').trim()) : []
  const rows = nonBlankLines.slice(1).map(parseCsvLine)

  return {
    header,
    rows,
    rowCountPreview: rows.length,
  }
}

export function buildUploadValidation(header: string[], rowCountPreview: number): UploadValidationSummary {
  const columnMap = inferColumnMap(header)

  const requiredGroups: UploadValidationGroup[] = [
    {
      key: 'timestamp',
      label: 'Event timestamp',
      description: 'When the activity happened',
      columns: columnMap.timestamp ? [columnMap.timestamp] : [],
      satisfied: Boolean(columnMap.timestamp),
    },
    {
      key: 'company',
      label: 'Company or visitor identity',
      description: 'Who the activity should be associated with',
      columns: columnMap.company ? [columnMap.company] : [],
      satisfied: Boolean(columnMap.company),
    },
    {
      key: 'content',
      label: 'Page or page category',
      description: 'What part of the website was engaged',
      columns: [columnMap.page, columnMap.pageCategory].filter(Boolean) as string[],
      satisfied: Boolean(columnMap.page || columnMap.pageCategory),
    },
    {
      key: 'activity',
      label: 'Event type',
      description: 'What the visitor actually did',
      columns: columnMap.eventType ? [columnMap.eventType] : [],
      satisfied: Boolean(columnMap.eventType),
    },
    {
      key: 'acquisition',
      label: 'Traffic source or campaign',
      description: 'Where the visit or interaction came from',
      columns: [columnMap.source, columnMap.campaign].filter(Boolean) as string[],
      satisfied: Boolean(columnMap.source || columnMap.campaign),
    },
  ]

  const optionalMatches = [
    { label: 'Engagement score', columns: columnMap.engagementScore ? [columnMap.engagementScore] : [] },
    { label: 'Intent hint', columns: columnMap.intent ? [columnMap.intent] : [] },
    { label: 'Conversion indicator', columns: columnMap.conversion ? [columnMap.conversion] : [] },
    { label: 'Both source and campaign', columns: [columnMap.source, columnMap.campaign].filter(Boolean) as string[] },
    { label: 'Both page and page category', columns: [columnMap.page, columnMap.pageCategory].filter(Boolean) as string[] },
  ].filter((item) => item.columns.length > 0)

  const missingRequiredLabels = requiredGroups.filter((group) => !group.satisfied).map((group) => group.label)
  const valid = header.length > 0 && rowCountPreview > 0 && missingRequiredLabels.length === 0

  let reason = 'This file looks like a valid web engagement dataset for Module 5.'
  if (header.length === 0) {
    reason = 'The file does not appear to contain a usable CSV header row.'
  } else if (rowCountPreview === 0) {
    reason = 'The file has headers, but no visible data rows were detected.'
  } else if (missingRequiredLabels.length > 0) {
    reason = `This file is missing required web engagement signals: ${missingRequiredLabels.join(', ')}.`
  }

  return {
    header,
    rowCountPreview,
    columnMap,
    requiredGroups,
    optionalMatches,
    missingRequiredLabels,
    valid,
    reason,
  }
}

export async function fetchModule5Uploads(apiUrl: string, workspaceId: string, status: Module5UploadStatus = 'active') {
  const res = await fetch(`${apiUrl}/m01/uploads?workspace=${workspaceId}&status=${status}`, {
    headers: getAuthHeaders(),
  })
  const json = await res.json().catch(() => ({}))
  const items = (Array.isArray(json.items) ? json.items : []).filter(isModule5Upload) as UploadItem[]

  return {
    ok: res.ok && Boolean(json?.ok),
    items,
    error: json?.error ? String(json.error) : null,
  }
}

export async function fetchModule5UploadPreview(apiUrl: string, workspaceId: string, uploadId: string, perPage = 500) {
  const [detailsRes, previewRes] = await Promise.all([
    fetch(`${apiUrl}/m01/uploads/${uploadId}?workspace=${workspaceId}`, { headers: getAuthHeaders() }),
    fetch(`${apiUrl}/m01/uploads/${uploadId}/preview?page=1&perPage=${perPage}&workspace=${workspaceId}`, { headers: getAuthHeaders() }),
  ])

  const [detailsJson, previewJson] = await Promise.all([
    detailsRes.json().catch(() => ({})),
    previewRes.json().catch(() => ({})),
  ])

  return {
    ok: detailsRes.ok && previewRes.ok && !previewJson?.error,
    item: detailsRes.ok && detailsJson?.ok && detailsJson.item ? detailsJson.item as UploadItem : null,
    preview: {
      header: Array.isArray(previewJson.header) ? previewJson.header : [],
      rows: Array.isArray(previewJson.rows) ? previewJson.rows : [],
      page: typeof previewJson.page === 'number' ? previewJson.page : 1,
      perPage: typeof previewJson.perPage === 'number' ? previewJson.perPage : perPage,
      hasMore: Boolean(previewJson.hasMore),
    } satisfies PreviewData,
    error: previewJson?.error ? String(previewJson.error) : null,
  }
}

export async function fetchModule5Analytics(apiUrl: string, workspaceId: string, uploadId: string) {
  const res = await fetch(`${apiUrl}/m05/web-engagement/${uploadId}/analytics?workspace=${workspaceId}`, {
    headers: getAuthHeaders(),
  })

  const json = await res.json().catch(() => ({}))
  const errorParts = [json?.error, json?.detail].filter(Boolean).map((value) => String(value))

  return {
    ok: res.ok && Boolean(json?.ok),
    analytics: res.ok && json?.ok ? json as Module5AnalyticsResponse & { ok: true } : null,
    error: errorParts.length > 0 ? errorParts.join(' ') : null,
  }
}

function toNumber(value: string) {
  const cleaned = String(value || '').replace(/,/g, '').trim()
  if (!cleaned) return null
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

function toDateSafe(value: string) {
  const raw = String(value || '').trim()
  if (!raw) return null
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function toIntent(value: string): ParsedWebRow['intent'] {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return 'unknown'
  if (raw.includes('hot') || raw.includes('blazing') || raw.includes('high')) return 'hot'
  if (raw.includes('warm') || raw.includes('medium')) return 'warm'
  if (raw.includes('cold') || raw.includes('low')) return 'cold'
  return 'unknown'
}

function toBooleanLike(value: string) {
  const raw = String(value || '').trim().toLowerCase()
  return ['1', 'true', 'yes', 'y', 'converted'].includes(raw)
}

function normalizeValue(value: string, fallback = 'Unknown') {
  const trimmed = String(value || '').trim()
  return trimmed || fallback
}

function derivePageCategory(pageCategory: string, page: string) {
  const raw = String(pageCategory || '').trim()
  if (raw) return raw

  const normalizedPage = String(page || '').toLowerCase()
  if (!normalizedPage) return 'Unknown'
  if (normalizedPage.includes('pricing')) return 'Pricing'
  if (normalizedPage.includes('demo') || normalizedPage.includes('contact') || normalizedPage.includes('signup')) return 'Conversion'
  if (normalizedPage.includes('product') || normalizedPage.includes('feature') || normalizedPage.includes('solution')) return 'Product'
  if (normalizedPage.includes('blog') || normalizedPage.includes('article') || normalizedPage.includes('resource')) return 'Content'
  if (normalizedPage.includes('case') || normalizedPage.includes('customer')) return 'Proof'
  return 'Other'
}

function detectConversion(row: Record<string, string>, columnMap: DatasetColumnMap, page: string, eventType: string) {
  if (columnMap.conversion && toBooleanLike(row[columnMap.conversion] || '')) return true
  const merged = `${page} ${eventType}`.toLowerCase()
  return ['demo', 'contact', 'signup', 'book', 'trial', 'form_submit', 'conversion'].some((keyword) => merged.includes(keyword))
}

function detectHighIntent(intent: ParsedWebRow['intent'], engagementScore: number | null, page: string, eventType: string) {
  if (intent === 'hot') return true
  if (typeof engagementScore === 'number' && engagementScore >= 70) return true
  const merged = `${page} ${eventType}`.toLowerCase()
  return ['pricing', 'demo', 'contact', 'trial', 'quote', 'book'].some((keyword) => merged.includes(keyword))
}

export function parsePreviewRows(preview: PreviewData): ParsedWebRow[] {
  const columnMap = inferColumnMap(preview.header)

  return preview.rows.map((row) => {
    const record: Record<string, string> = {}
    preview.header.forEach((header, index) => {
      record[header] = String(row[index] || '')
    })

    const page = normalizeValue(columnMap.page ? record[columnMap.page] : '', 'Unknown page')
    const eventType = normalizeValue(columnMap.eventType ? record[columnMap.eventType] : '', 'Unknown event')
    const intent = toIntent(columnMap.intent ? record[columnMap.intent] : '')
    const engagementScore = columnMap.engagementScore ? toNumber(record[columnMap.engagementScore]) : null
    const timestamp = columnMap.timestamp ? toDateSafe(record[columnMap.timestamp]) : null
    const source = normalizeValue(columnMap.source ? record[columnMap.source] : '', 'Direct / Unknown')
    const campaign = normalizeValue(columnMap.campaign ? record[columnMap.campaign] : '', 'No campaign')
    const company = normalizeValue(columnMap.company ? record[columnMap.company] : '', 'Unknown company')
    const pageCategory = derivePageCategory(columnMap.pageCategory ? record[columnMap.pageCategory] : '', page)
    const converted = detectConversion(record, columnMap, page, eventType)
    const isHighIntent = detectHighIntent(intent, engagementScore, page, eventType)

    return {
      company,
      source,
      campaign,
      pageCategory,
      page,
      intent,
      engagementScore,
      timestamp,
      converted,
      eventType,
      isHighIntent,
    }
  })
}

function createDistribution(items: Array<{ label: string; value: number; helper?: string; tone?: DistributionItem['tone'] }>) {
  const total = items.reduce((sum, item) => sum + item.value, 0) || 1
  return items
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)
    .map((item) => ({
      ...item,
      share: (item.value / total) * 100,
    }))
}

function increment(map: Map<string, number>, key: string, amount = 1) {
  map.set(key, (map.get(key) || 0) + amount)
}

export function buildWebEngagementMetrics(preview: PreviewData): WebEngagementMetrics {
  const columnMap = inferColumnMap(preview.header)
  const rows = parsePreviewRows(preview)
  const totalRows = rows.length
  const uniqueCompanies = new Set(rows.map((row) => row.company).filter((value) => value !== 'Unknown company'))
  const highIntentEvents = rows.filter((row) => row.isHighIntent).length
  const conversions = rows.filter((row) => row.converted).length
  const averageEngagement = rows.reduce((sum, row) => sum + (row.engagementScore || 0), 0) / (rows.filter((row) => typeof row.engagementScore === 'number').length || 1)

  const sourceMap = new Map<string, number>()
  const sourceHighIntent = new Map<string, number>()
  const campaignMap = new Map<string, number>()
  const campaignHighIntent = new Map<string, number>()
  const campaignConversions = new Map<string, number>()
  const categoryMap = new Map<string, number>()
  const intentMap = new Map<string, number>()
  const timelineMap = new Map<string, number>()
  const companyMap = new Map<string, {
    company: string
    eventCount: number
    highIntentEvents: number
    conversions: number
    categoryCounts: Map<string, number>
    lastActivity: Date | null
  }>()

  rows.forEach((row) => {
    increment(sourceMap, row.source)
    increment(campaignMap, row.campaign)
    increment(categoryMap, row.pageCategory)
    increment(intentMap, row.intent)

    if (row.isHighIntent) {
      increment(sourceHighIntent, row.source)
      increment(campaignHighIntent, row.campaign)
    }

    if (row.converted) {
      increment(campaignConversions, row.campaign)
    }

    if (row.timestamp) {
      const label = row.timestamp.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      increment(timelineMap, label)
    }

    const companyEntry = companyMap.get(row.company) || {
      company: row.company,
      eventCount: 0,
      highIntentEvents: 0,
      conversions: 0,
      categoryCounts: new Map<string, number>(),
      lastActivity: null,
    }

    companyEntry.eventCount += 1
    if (row.isHighIntent) companyEntry.highIntentEvents += 1
    if (row.converted) companyEntry.conversions += 1
    increment(companyEntry.categoryCounts, row.pageCategory)

    if (row.timestamp && (!companyEntry.lastActivity || row.timestamp > companyEntry.lastActivity)) {
      companyEntry.lastActivity = row.timestamp
    }

    companyMap.set(row.company, companyEntry)
  })

  const sourceDistribution = createDistribution(
    Array.from(sourceMap.entries()).map(([label, value]) => ({
      label,
      value,
      helper: `${sourceHighIntent.get(label) || 0} high-intent events`,
      tone: label.toLowerCase().includes('email') || label.toLowerCase().includes('direct') ? 'teal' : 'navy',
    })),
  )

  const campaignPerformance = createDistribution(
    Array.from(campaignMap.entries()).map(([label, value]) => ({
      label,
      value,
      helper: `${campaignHighIntent.get(label) || 0} high-intent | ${campaignConversions.get(label) || 0} conversions`,
      tone: (campaignConversions.get(label) || 0) > 0 ? 'teal' : 'navy',
    })),
  )

  const pageCategoryDistribution = createDistribution(
    Array.from(categoryMap.entries()).map(([label, value]) => ({
      label,
      value,
      helper: `${Math.round((value / (totalRows || 1)) * 100)}% of visible activity`,
      tone: label.toLowerCase().includes('pricing') || label.toLowerCase().includes('conversion') ? 'amber' : 'navy',
    })),
  )

  const intentDistribution = createDistribution(
    Array.from(intentMap.entries()).map(([label, value]) => ({
      label: label === 'unknown' ? 'Unknown' : label.charAt(0).toUpperCase() + label.slice(1),
      value,
      helper: `${Math.round((value / (totalRows || 1)) * 100)}% of visible events`,
      tone: label === 'hot' ? 'teal' : label === 'warm' ? 'amber' : 'slate',
    })),
  )

  const timeline = createDistribution(
    Array.from(timelineMap.entries()).map(([label, value]) => ({
      label,
      value,
      helper: 'daily event volume',
      tone: 'navy',
    })),
  ).slice(-6)

  const companyRows = Array.from(companyMap.values())
    .filter((entry) => entry.company !== 'Unknown company')
    .sort((a, b) => {
      if (b.highIntentEvents !== a.highIntentEvents) return b.highIntentEvents - a.highIntentEvents
      if (b.conversions !== a.conversions) return b.conversions - a.conversions
      return b.eventCount - a.eventCount
    })
    .slice(0, 8)
    .map((entry) => {
      const topPageCategory = Array.from(entry.categoryCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown'
      const status: CompanyInsightRow['status'] = entry.highIntentEvents >= 3 || entry.conversions >= 2
        ? 'Hot'
        : entry.highIntentEvents >= 1 || entry.eventCount >= 3
          ? 'Warm'
          : 'Cold'
      return {
        company: entry.company,
        eventCount: entry.eventCount,
        highIntentEvents: entry.highIntentEvents,
        conversions: entry.conversions,
        topPageCategory,
        lastActivityLabel: entry.lastActivity ? entry.lastActivity.toLocaleDateString() : 'Unknown',
        status,
      }
    })

  const topSource = sourceDistribution[0]
  const topCampaign = campaignPerformance[0]
  const topCategory = pageCategoryDistribution[0]

  const kpis: WebEngagementKpi[] = [
    {
      label: 'Total Events',
      value: String(totalRows),
      note: preview.hasMore ? 'based on the visible preview sample' : 'from the selected uploaded dataset',
      tone: 'navy',
    },
    {
      label: 'Unique Companies',
      value: String(uniqueCompanies.size),
      note: 'named companies with visible website activity',
      tone: 'teal',
    },
    {
      label: 'High-Intent Events',
      value: String(highIntentEvents),
      note: 'events showing pricing, demo, contact, or strong intent signals',
      tone: 'amber',
    },
    {
      label: 'Conversion Rate',
      value: `${Math.round(((conversions / (totalRows || 1)) * 100))}%`,
      note: 'share of visible events that look conversion-oriented',
      tone: 'teal',
    },
    {
      label: 'Top Source',
      value: topSource ? topSource.label : 'Unknown',
      note: topSource ? `${Math.round(topSource.share)}% of visible activity` : 'no source signal detected',
      tone: 'navy',
    },
    {
      label: 'Avg. Engagement',
      value: Number.isFinite(averageEngagement) ? averageEngagement.toFixed(1) : 'N/A',
      note: columnMap.engagementScore ? 'average engagement score from the selected file' : 'engagement score column not detected',
      tone: 'slate',
    },
  ]

  const insights: WebInsight[] = []

  if (topCategory && topCategory.label.toLowerCase().includes('content') && conversions <= Math.max(1, totalRows * 0.1)) {
    insights.push({
      title: 'Content traffic is leading',
      stat: `${Math.round(topCategory.share)}%`,
      body: 'Most visible activity is landing in content-style pages, but conversion signals remain comparatively light.',
      tone: 'amber',
    })
  }

  if (topCampaign && (campaignConversions.get(topCampaign.label) || 0) >= 2) {
    insights.push({
      title: 'One campaign is standing out',
      stat: topCampaign.label,
      body: `${campaignConversions.get(topCampaign.label) || 0} visible conversion events are tied to this campaign in the selected dataset.`,
      tone: 'teal',
    })
  }

  if (sourceDistribution.some((item) => item.label.toLowerCase().includes('email') && (sourceHighIntent.get(item.label) || 0) >= 2)) {
    const emailSource = sourceDistribution.find((item) => item.label.toLowerCase().includes('email'))
    if (emailSource) {
      insights.push({
        title: 'Email traffic looks sales-ready',
        stat: `${sourceHighIntent.get(emailSource.label) || 0} events`,
        body: 'Email-driven traffic is contributing multiple high-intent interactions in the current visible dataset.',
        tone: 'teal',
      })
    }
  }

  if (pageCategoryDistribution.some((item) => item.label.toLowerCase().includes('pricing')) && conversions < highIntentEvents / 2) {
    const pricingCategory = pageCategoryDistribution.find((item) => item.label.toLowerCase().includes('pricing'))
    if (pricingCategory) {
      insights.push({
        title: 'Pricing attention is active',
        stat: pricingCategory.label,
        body: 'Pricing-oriented activity is visible, but the downstream conversion count is still moderate relative to that interest.',
        tone: 'amber',
      })
    }
  }

  if (insights.length === 0) {
    insights.push({
      title: 'This dataset is usable',
      stat: `${totalRows} rows`,
      body: 'The selected upload is already strong enough to support traffic, intent, and company-level conversation starters inside Module 5.',
      tone: 'navy',
    })
  }

  return {
    columnMap,
    totalRows,
    usesSample: preview.hasMore,
    timelineAvailable: timeline.length > 1,
    kpis,
    sourceDistribution,
    campaignPerformance,
    pageCategoryDistribution,
    intentDistribution,
    timeline,
    companyRows,
    insights: insights.slice(0, 4),
  }
}
