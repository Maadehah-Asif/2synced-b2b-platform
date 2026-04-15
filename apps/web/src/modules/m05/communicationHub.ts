import { getAuthHeaders } from './webEngagement'

export type CommunicationThreadType =
  | 'lead_issue'
  | 'campaign_issue'
  | 'alignment_concern'
  | 'follow_up'
  | 'blocker'
  | 'general'

export type CommunicationThreadStatus = 'open' | 'in_progress' | 'resolved'
export type CommunicationThreadPriority = 'low' | 'medium' | 'high'

export type CommunicationParticipant = {
  name: string
  email?: string
}

export type CommunicationThread = {
  id: string
  workspaceId: string
  title: string
  type: CommunicationThreadType
  status: CommunicationThreadStatus
  priority: CommunicationThreadPriority
  createdBy: string | null
  createdByName: string
  createdByEmail: string | null
  participants: CommunicationParticipant[]
  messageCount: number
  lastMessageAt: string | null
  lastMessagePreview: string | null
  createdAt: string
  updatedAt: string
}

export type CommunicationMessage = {
  id: string
  threadId: string
  authorId: string | null
  authorName: string
  authorEmail: string | null
  body: string
  createdAt: string
  updatedAt: string
}

export type CommunicationThreadDetail = {
  thread: CommunicationThread
  messages: CommunicationMessage[]
}

export type CommunicationListFilters = {
  q?: string
  status?: '' | CommunicationThreadStatus
  priority?: '' | CommunicationThreadPriority
  type?: '' | CommunicationThreadType
}

export type CreateCommunicationThreadInput = {
  workspaceId: string
  title: string
  body: string
  type: CommunicationThreadType
  priority: CommunicationThreadPriority
  participants: CommunicationParticipant[]
}

function buildQuery(workspaceId: string, extra: Record<string, string | undefined>) {
  const params = new URLSearchParams({ workspace: workspaceId })
  Object.entries(extra).forEach(([key, value]) => {
    if (value) params.set(key, value)
  })
  return params.toString()
}

export function formatThreadType(type: CommunicationThreadType) {
  return {
    lead_issue: 'Lead issue',
    campaign_issue: 'Campaign issue',
    alignment_concern: 'Alignment concern',
    follow_up: 'Follow-up',
    blocker: 'Blocker',
    general: 'General',
  }[type]
}

export function formatThreadStatus(status: CommunicationThreadStatus) {
  return {
    open: 'Open',
    in_progress: 'In progress',
    resolved: 'Resolved',
  }[status]
}

export function formatThreadPriority(priority: CommunicationThreadPriority) {
  return {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
  }[priority]
}

export async function fetchCommunicationThreads(apiUrl: string, workspaceId: string, filters: CommunicationListFilters = {}) {
  const res = await fetch(`${apiUrl}/m05/communication/threads?${buildQuery(workspaceId, {
    q: filters.q?.trim() || undefined,
    status: filters.status || undefined,
    priority: filters.priority || undefined,
    type: filters.type || undefined,
  })}`, {
    headers: getAuthHeaders(),
  })

  const json = await res.json().catch(() => ({}))
  return {
    ok: res.ok && Boolean(json?.ok),
    items: Array.isArray(json?.items) ? json.items as CommunicationThread[] : [],
    error: json?.error ? String(json.error) : null,
  }
}

export async function fetchCommunicationThreadDetail(apiUrl: string, workspaceId: string, threadId: string) {
  const res = await fetch(`${apiUrl}/m05/communication/threads/${threadId}?${buildQuery(workspaceId, {})}`, {
    headers: getAuthHeaders(),
  })

  const json = await res.json().catch(() => ({}))
  return {
    ok: res.ok && Boolean(json?.ok),
    detail: res.ok && json?.ok ? { thread: json.thread as CommunicationThread, messages: Array.isArray(json.messages) ? json.messages as CommunicationMessage[] : [] } : null,
    error: json?.error ? String(json.error) : null,
  }
}

export async function createCommunicationThread(apiUrl: string, input: CreateCommunicationThreadInput) {
  const res = await fetch(`${apiUrl}/m05/communication/threads`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      workspaceId: input.workspaceId,
      title: input.title,
      body: input.body,
      type: input.type,
      priority: input.priority,
      participants: input.participants,
    }),
  })

  const json = await res.json().catch(() => ({}))
  return {
    ok: res.ok && Boolean(json?.ok),
    thread: json?.thread as CommunicationThread | undefined,
    message: json?.message as CommunicationMessage | undefined,
    error: json?.error ? String(json.error) : null,
  }
}

export async function replyToCommunicationThread(apiUrl: string, workspaceId: string, threadId: string, body: string) {
  const res = await fetch(`${apiUrl}/m05/communication/threads/${threadId}/messages`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ workspaceId, body }),
  })

  const json = await res.json().catch(() => ({}))
  return {
    ok: res.ok && Boolean(json?.ok),
    message: json?.message as CommunicationMessage | undefined,
    thread: json?.thread as CommunicationThread | undefined,
    error: json?.error ? String(json.error) : null,
  }
}

export async function updateCommunicationThreadStatus(apiUrl: string, workspaceId: string, threadId: string, status: CommunicationThreadStatus) {
  const res = await fetch(`${apiUrl}/m05/communication/threads/${threadId}/status`, {
    method: 'PATCH',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ workspaceId, status }),
  })
  const json = await res.json().catch(() => ({}))
  return {
    ok: res.ok && Boolean(json?.ok),
    thread: json?.thread as CommunicationThread | undefined,
    error: json?.error ? String(json.error) : null,
  }
}

export async function updateCommunicationThreadPriority(apiUrl: string, workspaceId: string, threadId: string, priority: CommunicationThreadPriority) {
  const res = await fetch(`${apiUrl}/m05/communication/threads/${threadId}/priority`, {
    method: 'PATCH',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ workspaceId, priority }),
  })
  const json = await res.json().catch(() => ({}))
  return {
    ok: res.ok && Boolean(json?.ok),
    thread: json?.thread as CommunicationThread | undefined,
    error: json?.error ? String(json.error) : null,
  }
}
