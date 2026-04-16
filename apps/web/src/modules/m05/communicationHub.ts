import { getAuthHeaders } from './webEngagement'

export type CommunicationThreadType =
  | 'lead_issue'
  | 'campaign_issue'
  | 'alignment_concern'
  | 'follow_up'
  | 'blocker'
  | 'general'
  | 'note'

export type CommunicationThreadStatus = 'open' | 'in_progress' | 'resolved'
export type CommunicationThreadPriority = 'low' | 'medium' | 'high'

export type CommunicationParticipant = {
  userId?: string | null
  name: string
  email?: string
  role?: string | null
}

export type CommunicationPermissions = {
  canChangeStatus: boolean
  canArchive: boolean
  canDelete: boolean
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
  archivedAt: string | null
  archivedBy: string | null
  archivedByName: string | null
  messageCount: number
  lastMessageAt: string | null
  lastMessagePreview: string | null
  createdAt: string
  updatedAt: string
  permissions: CommunicationPermissions
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
  view?: 'active' | 'archived' | 'all'
}

export type CreateCommunicationThreadInput = {
  workspaceId: string
  title: string
  body: string
  type: CommunicationThreadType
  priority: CommunicationThreadPriority
  participants: CommunicationParticipant[]
}

export type WorkspaceMemberOption = {
  id: string
  name: string
  email: string | null
  role: string
  status: string
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
    note: 'Note',
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
    view: filters.view || undefined,
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

export async function archiveCommunicationThread(apiUrl: string, workspaceId: string, threadId: string, archived: boolean) {
  const res = await fetch(`${apiUrl}/m05/communication/threads/${threadId}/archive`, {
    method: 'PATCH',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ workspaceId, archived }),
  })
  const json = await res.json().catch(() => ({}))
  return {
    ok: res.ok && Boolean(json?.ok),
    thread: json?.thread as CommunicationThread | undefined,
    error: json?.detail ? String(json.detail) : json?.error ? String(json.error) : null,
  }
}

export async function deleteCommunicationThread(apiUrl: string, workspaceId: string, threadId: string) {
  const res = await fetch(`${apiUrl}/m05/communication/threads/${threadId}`, {
    method: 'DELETE',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ workspaceId }),
  })
  const json = await res.json().catch(() => ({}))
  return {
    ok: res.ok && Boolean(json?.ok),
    deletedThreadId: json?.deletedThreadId ? String(json.deletedThreadId) : null,
    error: json?.detail ? String(json.detail) : json?.error ? String(json.error) : null,
  }
}

export async function fetchWorkspaceMemberOptions(apiUrl: string, workspaceId: string) {
  const res = await fetch(`${apiUrl}/workspaces/${workspaceId}/members`, {
    headers: getAuthHeaders(),
  })

  const json = await res.json().catch(() => ({}))
  const members = Array.isArray(json?.members) ? json.members : []
  return {
    ok: res.ok,
    items: members
      .filter((item: any) => item?.status === 'active' && item?.user)
      .map((item: any) => ({
        id: String(item.user.id),
        name: String(item.user.fullName || item.user.email || 'Workspace user'),
        email: item.user.email ? String(item.user.email) : null,
        role: String(item.role || 'member'),
        status: String(item.status || 'active'),
      })) as WorkspaceMemberOption[],
    error: json?.error ? String(json.error) : null,
  }
}
