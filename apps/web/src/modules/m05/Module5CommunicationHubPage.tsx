import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import { getWorkspaceIdFromHash } from '../../utils/workspace'
import { setModule5View } from './navigation'
import {
  createCommunicationThread,
  fetchCommunicationThreadDetail,
  fetchCommunicationThreads,
  formatThreadPriority,
  formatThreadStatus,
  formatThreadType,
  replyToCommunicationThread,
  updateCommunicationThreadPriority,
  updateCommunicationThreadStatus,
  type CommunicationParticipant,
  type CommunicationMessage,
  type CommunicationThread,
  type CommunicationThreadPriority,
  type CommunicationThreadStatus,
  type CommunicationThreadType,
} from './communicationHub'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

type ListState = 'loading' | 'ready' | 'empty' | 'error'
type DetailState = 'idle' | 'loading' | 'ready' | 'error'

const TYPE_OPTIONS: CommunicationThreadType[] = ['general', 'alignment_concern', 'lead_issue', 'campaign_issue', 'follow_up', 'blocker']
const STATUS_OPTIONS: CommunicationThreadStatus[] = ['open', 'in_progress', 'resolved']
const PRIORITY_OPTIONS: CommunicationThreadPriority[] = ['low', 'medium', 'high']

export default function Module5CommunicationHubPage() {
  const [workspaceId] = useState<string | null>(() => getWorkspaceIdFromHash())
  const [listState, setListState] = useState<ListState>('loading')
  const [detailState, setDetailState] = useState<DetailState>('idle')
  const [threads, setThreads] = useState<CommunicationThread[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [detail, setDetail] = useState<{ thread: CommunicationThread; messages: CommunicationMessage[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [savingReply, setSavingReply] = useState(false)
  const [savingMeta, setSavingMeta] = useState<'status' | 'priority' | null>(null)
  const [showComposer, setShowComposer] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState({
    title: '',
    body: '',
    type: 'general' as CommunicationThreadType,
    priority: 'medium' as CommunicationThreadPriority,
    participantsText: '',
  })
  const [filters, setFilters] = useState({
    q: '',
    status: '' as '' | CommunicationThreadStatus,
    priority: '' as '' | CommunicationThreadPriority,
  })

  useEffect(() => {
    let cancelled = false

    async function loadThreads() {
      if (!workspaceId) {
        setListState('error')
        setError('Workspace context is missing. Open Module 5 from inside a workspace to use the communication hub.')
        return
      }

      setListState('loading')
      setError(null)

      try {
        const result = await fetchCommunicationThreads(API_URL, workspaceId, filters)
        if (cancelled) return

        if (!result.ok) {
          setThreads([])
          setListState('error')
          setError(result.error || 'The communication hub could not load workspace threads.')
          return
        }

        setThreads(result.items)
        if (result.items.length === 0) {
          setSelectedId('')
          setDetail(null)
          setListState('empty')
          setDetailState('idle')
          return
        }

        setListState('ready')
        setSelectedId((current) => current && result.items.some((item) => item.id === current) ? current : result.items[0]!.id)
      } catch {
        if (cancelled) return
        setThreads([])
        setListState('error')
        setError('The communication hub could not reach the backend workspace thread service.')
      }
    }

    void loadThreads()
    return () => {
      cancelled = true
    }
  }, [workspaceId, filters.q, filters.status, filters.priority])

  useEffect(() => {
    let cancelled = false

    async function loadDetail() {
      if (!workspaceId || !selectedId) {
        setDetail(null)
        setDetailState('idle')
        return
      }

      setDetailState('loading')

      try {
        const result = await fetchCommunicationThreadDetail(API_URL, workspaceId, selectedId)
        if (cancelled) return

        if (!result.ok || !result.detail) {
          setDetail(null)
          setDetailState('error')
          setError(result.error || 'The selected thread could not be loaded.')
          return
        }

        setDetail(result.detail)
        setDetailState('ready')
      } catch {
        if (cancelled) return
        setDetail(null)
        setDetailState('error')
        setError('The selected thread could not be loaded from the communication hub.')
      }
    }

    void loadDetail()
    return () => {
      cancelled = true
    }
  }, [workspaceId, selectedId])

  const counts = useMemo(() => {
    const open = threads.filter((item) => item.status === 'open').length
    const inProgress = threads.filter((item) => item.status === 'in_progress').length
    const resolved = threads.filter((item) => item.status === 'resolved').length
    return { open, inProgress, resolved }
  }, [threads])

  async function handleCreateThread(event: FormEvent) {
    event.preventDefault()
    if (!workspaceId) return

    const participants = createForm.participantsText
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map<CommunicationParticipant>((item) => {
        const hasEmail = item.includes('<') && item.includes('>')
        if (hasEmail) {
          const name = item.slice(0, item.indexOf('<')).trim()
          const email = item.slice(item.indexOf('<') + 1, item.indexOf('>')).trim()
          return { name: name || email, email }
        }
        return item.includes('@') ? { name: item, email: item } : { name: item }
      })

    setCreating(true)
    setError(null)

    try {
      const result = await createCommunicationThread(API_URL, {
        workspaceId,
        title: createForm.title.trim(),
        body: createForm.body.trim(),
        type: createForm.type,
        priority: createForm.priority,
        participants,
      })

      if (!result.ok || !result.thread) {
        setError(result.error || 'The new discussion thread could not be created.')
        return
      }

      setShowComposer(false)
      setCreateForm({
        title: '',
        body: '',
        type: 'general',
        priority: 'medium',
        participantsText: '',
      })
      setSelectedId(result.thread.id)
      setThreads((current) => [result.thread!, ...current.filter((item) => item.id !== result.thread!.id)])
      const detailResult = await fetchCommunicationThreadDetail(API_URL, workspaceId, result.thread.id)
      if (detailResult.ok && detailResult.detail) {
        setDetail(detailResult.detail)
        setDetailState('ready')
      }
      setListState('ready')
    } catch {
      setError('The new discussion thread could not be created right now.')
    } finally {
      setCreating(false)
    }
  }

  async function handleReply(event: FormEvent) {
    event.preventDefault()
    if (!workspaceId || !detail || !replyText.trim()) return

    setSavingReply(true)
    setError(null)

    try {
      const result = await replyToCommunicationThread(API_URL, workspaceId, detail.thread.id, replyText.trim())
      if (!result.ok || !result.message || !result.thread) {
        setError(result.error || 'The reply could not be posted.')
        return
      }

      setReplyText('')
      setDetail((current) => current ? {
        thread: result.thread!,
        messages: [...current.messages, result.message!],
      } : current)
      setThreads((current) => [result.thread!, ...current.filter((item) => item.id !== result.thread!.id)])
    } catch {
      setError('The reply could not be posted right now.')
    } finally {
      setSavingReply(false)
    }
  }

  async function handleStatusChange(status: CommunicationThreadStatus) {
    if (!workspaceId || !detail) return
    setSavingMeta('status')
    try {
      const result = await updateCommunicationThreadStatus(API_URL, workspaceId, detail.thread.id, status)
      if (!result.ok || !result.thread) {
        setError(result.error || 'Thread status could not be updated.')
        return
      }
      setDetail((current) => current ? { ...current, thread: result.thread! } : current)
      setThreads((current) => current.map((item) => item.id === result.thread!.id ? result.thread! : item))
    } catch {
      setError('Thread status could not be updated right now.')
    } finally {
      setSavingMeta(null)
    }
  }

  async function handlePriorityChange(priority: CommunicationThreadPriority) {
    if (!workspaceId || !detail) return
    setSavingMeta('priority')
    try {
      const result = await updateCommunicationThreadPriority(API_URL, workspaceId, detail.thread.id, priority)
      if (!result.ok || !result.thread) {
        setError(result.error || 'Thread priority could not be updated.')
        return
      }
      setDetail((current) => current ? { ...current, thread: result.thread! } : current)
      setThreads((current) => current.map((item) => item.id === result.thread!.id ? result.thread! : item))
    } catch {
      setError('Thread priority could not be updated right now.')
    } finally {
      setSavingMeta(null)
    }
  }

  return (
    <div style={page}>
      <button type="button" onClick={() => setModule5View('home')} style={backBtn}>
        Back to Module 5 Home
      </button>

      <section style={heroSection}>
        <div style={heroBody}>
          <div style={heroGrid}>
            <div>
              <div style={heroPill}>Communication hub</div>
              <h1 style={{ margin: '16px 0 8px', fontSize: 36, lineHeight: 1.05, fontWeight: 900, color: '#0F172A' }}>
                Alignment discussion space
              </h1>
              <div style={{ maxWidth: 720, color: '#475569', fontSize: 15, lineHeight: 1.75 }}>
                Keep sales, marketing, and RevOps follow-through inside the product with structured threads for lead issues, campaign questions, blockers, and action-oriented alignment discussion.
              </div>
            </div>

            <div style={heroStats}>
              <StatCard label="Open" value={String(counts.open)} />
              <StatCard label="In progress" value={String(counts.inProgress)} />
              <StatCard label="Resolved" value={String(counts.resolved)} />
            </div>
          </div>
        </div>
      </section>

      {error && <section style={errorNotice}>{error}</section>}

      <section style={layoutGrid}>
        <aside style={sidebarCard}>
          <div style={sectionHeaderRow}>
            <SectionHeader eyebrow="Threads" title="Workspace discussions" />
            <button type="button" className="btn-primary" style={primaryButton} onClick={() => setShowComposer(true)}>
              Start thread
            </button>
          </div>

          <div style={filterGrid}>
            <input
              value={filters.q}
              onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
              placeholder="Search title, author, or recent note"
              style={textInput}
            />
            <div style={filterRow}>
              <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as '' | CommunicationThreadStatus }))} style={selectInput}>
                <option value="">All statuses</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>{formatThreadStatus(status)}</option>
                ))}
              </select>
              <select value={filters.priority} onChange={(event) => setFilters((current) => ({ ...current, priority: event.target.value as '' | CommunicationThreadPriority }))} style={selectInput}>
                <option value="">All priorities</option>
                {PRIORITY_OPTIONS.map((priority) => (
                  <option key={priority} value={priority}>{formatThreadPriority(priority)}</option>
                ))}
              </select>
            </div>
          </div>

          {listState === 'loading' && (
            <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
              <SkeletonBlock height={82} />
              <SkeletonBlock height={82} />
              <SkeletonBlock height={82} />
            </div>
          )}

          {listState === 'error' && (
            <div style={emptyBox}>The communication hub could not load the current workspace discussion list.</div>
          )}

          {listState === 'empty' && (
            <div style={emptyBox}>
              No discussion threads exist yet for this workspace. Start the first thread to turn alignment watchouts into owned follow-up.
            </div>
          )}

          {listState === 'ready' && (
            <div style={threadList}>
              {threads.map((thread) => (
                <button key={thread.id} type="button" onClick={() => setSelectedId(thread.id)} style={{ ...threadItem, ...(selectedId === thread.id ? threadItemActive : null) }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', textAlign: 'left', lineHeight: 1.45 }}>{thread.title}</div>
                    <span style={priorityBadge(thread.priority)}>{formatThreadPriority(thread.priority)}</span>
                  </div>
                  <div style={threadMetaRow}>
                    <span style={typePill}>{formatThreadType(thread.type)}</span>
                    <span style={statusBadge(thread.status)}>{formatThreadStatus(thread.status)}</span>
                  </div>
                  <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.65, color: '#64748B', textAlign: 'left' }}>
                    {thread.lastMessagePreview || 'No recent reply yet'}
                  </div>
                  <div style={{ marginTop: 10, fontSize: 12, color: '#64748B', textAlign: 'left' }}>
                    {thread.lastMessageAt ? `Updated ${new Date(thread.lastMessageAt).toLocaleString()}` : `Created ${new Date(thread.createdAt).toLocaleString()}`}
                  </div>
                </button>
              ))}
            </div>
          )}
        </aside>

        <section style={detailCard}>
          {detailState === 'idle' && (
            <div style={detailEmptyState}>
              <div style={emptyEyebrow}>No thread selected</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#0F172A' }}>Choose a thread or start a new one</div>
              <div style={{ marginTop: 10, fontSize: 14, lineHeight: 1.75, color: '#475569', maxWidth: 560 }}>
                The Communication Hub is designed for structured follow-up, not real-time chat. Use threads to clarify ownership, keep status visible, and resolve alignment work inside the platform.
              </div>
            </div>
          )}

          {detailState === 'loading' && (
            <div style={{ display: 'grid', gap: 12 }}>
              <SkeletonBlock height={96} />
              <SkeletonBlock height={240} />
              <SkeletonBlock height={120} />
            </div>
          )}

          {detailState === 'error' && (
            <div style={emptyBox}>The selected thread could not be loaded right now.</div>
          )}

          {detailState === 'ready' && detail && (
            <div style={detailLayout}>
              <div style={threadHeader}>
                <div>
                  <SectionHeader eyebrow="Thread detail" title={detail.thread.title} />
                  <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.7, color: '#475569' }}>
                    Started by {detail.thread.createdByName} on {new Date(detail.thread.createdAt).toLocaleString()}
                  </div>
                </div>
                <div style={headerControls}>
                  <div style={controlBlock}>
                    <label style={controlLabel}>Status</label>
                    <select value={detail.thread.status} onChange={(event) => void handleStatusChange(event.target.value as CommunicationThreadStatus)} style={selectInput} disabled={savingMeta === 'status'}>
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>{formatThreadStatus(status)}</option>
                      ))}
                    </select>
                  </div>
                  <div style={controlBlock}>
                    <label style={controlLabel}>Priority</label>
                    <select value={detail.thread.priority} onChange={(event) => void handlePriorityChange(event.target.value as CommunicationThreadPriority)} style={selectInput} disabled={savingMeta === 'priority'}>
                      {PRIORITY_OPTIONS.map((priority) => (
                        <option key={priority} value={priority}>{formatThreadPriority(priority)}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div style={summaryStrip}>
                <span style={typePill}>{formatThreadType(detail.thread.type)}</span>
                <span style={statusBadge(detail.thread.status)}>{formatThreadStatus(detail.thread.status)}</span>
                <span style={priorityBadge(detail.thread.priority)}>{formatThreadPriority(detail.thread.priority)}</span>
                <span style={metricPill}>{detail.thread.messageCount} messages</span>
                {detail.thread.participants.length > 0 && <span style={metricPill}>{detail.thread.participants.length} participants</span>}
              </div>

              {detail.thread.participants.length > 0 && (
                <div style={participantsCard}>
                  <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#64748B' }}>Participants</div>
                  <div style={participantRow}>
                    {detail.thread.participants.map((participant, index) => (
                      <span key={`${participant.name}-${index}`} style={participantChip}>
                        {participant.name}{participant.email ? ` (${participant.email})` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div style={messageStack}>
                {detail.messages.map((message) => (
                  <article key={message.id} style={messageCard}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>{message.authorName}</div>
                      <div style={{ fontSize: 12, color: '#64748B' }}>{new Date(message.createdAt).toLocaleString()}</div>
                    </div>
                    <div style={{ marginTop: 10, fontSize: 14, lineHeight: 1.8, color: '#334155', whiteSpace: 'pre-wrap' }}>{message.body}</div>
                  </article>
                ))}
              </div>

              <form onSubmit={handleReply} style={composerCard}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>Reply to this thread</div>
                <textarea
                  value={replyText}
                  onChange={(event) => setReplyText(event.target.value)}
                  placeholder="Add context, next steps, or a follow-up decision"
                  style={textareaInput}
                  rows={5}
                />
                <div style={composerActions}>
                  <div style={{ fontSize: 12, color: '#64748B' }}>
                    Keep replies focused on coordination, decisions, and follow-up rather than real-time back-and-forth.
                  </div>
                  <button type="submit" className="btn-primary" style={primaryButton} disabled={savingReply || !replyText.trim()}>
                    {savingReply ? 'Posting...' : 'Post reply'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </section>
      </section>

      {showComposer && (
        <div style={overlay} onClick={() => !creating && setShowComposer(false)}>
          <div style={modalCard} onClick={(event) => event.stopPropagation()}>
            <div style={sectionHeaderRow}>
              <SectionHeader eyebrow="Start thread" title="Create a new discussion" />
              <button type="button" className="btn-ghost" style={ghostButton} onClick={() => setShowComposer(false)} disabled={creating}>
                Close
              </button>
            </div>

            <form onSubmit={handleCreateThread} style={modalForm}>
              <div style={formGrid}>
                <div style={fieldBlockWide}>
                  <label style={controlLabel}>Title</label>
                  <input value={createForm.title} onChange={(event) => setCreateForm((current) => ({ ...current, title: event.target.value }))} placeholder="Describe the issue, question, or follow-up clearly" style={textInput} />
                </div>
                <div style={fieldBlock}>
                  <label style={controlLabel}>Type</label>
                  <select value={createForm.type} onChange={(event) => setCreateForm((current) => ({ ...current, type: event.target.value as CommunicationThreadType }))} style={selectInput}>
                    {TYPE_OPTIONS.map((type) => (
                      <option key={type} value={type}>{formatThreadType(type)}</option>
                    ))}
                  </select>
                </div>
                <div style={fieldBlock}>
                  <label style={controlLabel}>Priority</label>
                  <select value={createForm.priority} onChange={(event) => setCreateForm((current) => ({ ...current, priority: event.target.value as CommunicationThreadPriority }))} style={selectInput}>
                    {PRIORITY_OPTIONS.map((priority) => (
                      <option key={priority} value={priority}>{formatThreadPriority(priority)}</option>
                    ))}
                  </select>
                </div>
                <div style={fieldBlockWide}>
                  <label style={controlLabel}>Participants</label>
                  <input
                    value={createForm.participantsText}
                    onChange={(event) => setCreateForm((current) => ({ ...current, participantsText: event.target.value }))}
                    placeholder="Comma-separated names or emails, for example: Ayesha, imran@team.com"
                    style={textInput}
                  />
                </div>
                <div style={fieldBlockWide}>
                  <label style={controlLabel}>Initial message</label>
                  <textarea
                    value={createForm.body}
                    onChange={(event) => setCreateForm((current) => ({ ...current, body: event.target.value }))}
                    placeholder="Explain what needs review, what is blocking progress, or what action the team should discuss"
                    style={textareaInput}
                    rows={7}
                  />
                </div>
              </div>
              <div style={composerActions}>
                <div style={{ fontSize: 12, color: '#64748B', maxWidth: 520 }}>
                  Phase 1 supports structured threads, replies, status, and priority. Mentions, attachments, linked entities, and richer handoff actions are intentionally deferred.
                </div>
                <button type="submit" className="btn-primary" style={primaryButton} disabled={creating || !createForm.title.trim() || !createForm.body.trim()}>
                  {creating ? 'Creating...' : 'Create thread'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <div style={sectionPill}>{eyebrow}</div>
      <h3 style={{ margin: '12px 0 0', fontSize: 24, color: '#0F172A' }}>{title}</h3>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={statCard}>
      <div style={{ fontSize: 11, color: '#64748B', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ marginTop: 10, fontSize: 28, fontWeight: 900, color: '#0F172A' }}>{value}</div>
    </div>
  )
}

function SkeletonBlock({ height }: { height: number }) {
  return <div style={{ ...skeleton, height }} />
}

function statusBadge(status: CommunicationThreadStatus): CSSProperties {
  const palette = status === 'resolved'
    ? { bg: 'rgba(15,118,110,0.12)', color: '#0F766E' }
    : status === 'in_progress'
      ? { bg: 'rgba(36,83,166,0.10)', color: '#2453A6' }
      : { bg: 'rgba(245,158,11,0.14)', color: '#B45309' }
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '5px 9px',
    borderRadius: 999,
    background: palette.bg,
    color: palette.color,
    fontSize: 11,
    fontWeight: 800,
  }
}

function priorityBadge(priority: CommunicationThreadPriority): CSSProperties {
  const palette = priority === 'high'
    ? { bg: 'rgba(190,24,93,0.10)', color: '#9D174D' }
    : priority === 'medium'
      ? { bg: 'rgba(245,158,11,0.14)', color: '#B45309' }
      : { bg: 'rgba(226,232,240,0.9)', color: '#475569' }
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '5px 9px',
    borderRadius: 999,
    background: palette.bg,
    color: palette.color,
    fontSize: 11,
    fontWeight: 800,
    whiteSpace: 'nowrap',
  }
}

const page: CSSProperties = {
  marginTop: 18,
  display: 'grid',
  gap: 18,
}

const backBtn: CSSProperties = {
  justifySelf: 'start',
  borderRadius: 10,
  padding: '10px 14px',
  border: '1px solid rgba(203,213,225,1)',
  background: '#ffffff',
  color: '#0F172A',
  fontWeight: 700,
  cursor: 'pointer',
}

const heroSection: CSSProperties = {
  borderRadius: 24,
  border: '1px solid rgba(226,232,240,1)',
  background: 'linear-gradient(180deg, #ffffff 0%, #f8fbfd 100%)',
}

const heroBody: CSSProperties = {
  padding: 28,
}

const heroGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: 18,
  alignItems: 'start',
}

const heroPill: CSSProperties = {
  display: 'inline-flex',
  padding: '6px 10px',
  borderRadius: 999,
  background: '#EEF6FA',
  color: '#0F4258',
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
}

const heroStats: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
  gap: 12,
}

const statCard: CSSProperties = {
  borderRadius: 18,
  padding: 16,
  background: '#F8FAFC',
  border: '1px solid rgba(226,232,240,1)',
}

const sectionPill: CSSProperties = {
  display: 'inline-flex',
  padding: '5px 9px',
  borderRadius: 999,
  background: '#F1F5F9',
  color: '#64748B',
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
}

const errorNotice: CSSProperties = {
  borderRadius: 14,
  padding: 14,
  background: 'rgba(190,24,93,0.08)',
  border: '1px solid rgba(190,24,93,0.14)',
  color: '#9D174D',
  fontSize: 13,
  lineHeight: 1.7,
}

const layoutGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: 18,
  alignItems: 'start',
}

const sidebarCard: CSSProperties = {
  borderRadius: 22,
  padding: 22,
  background: '#ffffff',
  border: '1px solid rgba(226,232,240,1)',
  boxShadow: '0 10px 30px rgba(15,23,42,0.04)',
  display: 'grid',
  gap: 16,
}

const detailCard: CSSProperties = {
  borderRadius: 22,
  padding: 22,
  background: '#ffffff',
  border: '1px solid rgba(226,232,240,1)',
  boxShadow: '0 10px 30px rgba(15,23,42,0.04)',
  minHeight: 620,
}

const sectionHeaderRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'flex-start',
  flexWrap: 'wrap',
}

const primaryButton: CSSProperties = {
  borderRadius: 10,
  padding: '10px 14px',
  fontWeight: 800,
}

const ghostButton: CSSProperties = {
  borderRadius: 10,
  padding: '10px 14px',
  fontWeight: 700,
}

const filterGrid: CSSProperties = {
  display: 'grid',
  gap: 10,
}

const filterRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 10,
}

const textInput: CSSProperties = {
  width: '100%',
  borderRadius: 12,
  border: '1px solid rgba(203,213,225,1)',
  padding: '11px 12px',
  fontSize: 14,
  color: '#0F172A',
  background: '#ffffff',
}

const selectInput: CSSProperties = {
  width: '100%',
  borderRadius: 12,
  border: '1px solid rgba(203,213,225,1)',
  padding: '11px 12px',
  fontSize: 14,
  color: '#0F172A',
  background: '#ffffff',
}

const threadList: CSSProperties = {
  display: 'grid',
  gap: 10,
}

const threadItem: CSSProperties = {
  borderRadius: 16,
  padding: 14,
  border: '1px solid rgba(226,232,240,1)',
  background: '#ffffff',
  cursor: 'pointer',
}

const threadItemActive: CSSProperties = {
  background: '#F8FAFC',
  borderColor: 'rgba(15,66,88,0.22)',
}

const threadMetaRow: CSSProperties = {
  marginTop: 10,
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
}

const typePill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '5px 9px',
  borderRadius: 999,
  background: '#F1F5F9',
  color: '#475569',
  fontSize: 11,
  fontWeight: 800,
}

const emptyBox: CSSProperties = {
  borderRadius: 16,
  padding: 16,
  border: '1px dashed rgba(203,213,225,1)',
  background: '#F8FAFC',
  color: '#475569',
  fontSize: 13,
  lineHeight: 1.75,
}

const detailEmptyState: CSSProperties = {
  minHeight: 520,
  display: 'grid',
  placeContent: 'center',
  justifyItems: 'start',
}

const emptyEyebrow: CSSProperties = {
  display: 'inline-flex',
  padding: '6px 10px',
  borderRadius: 999,
  background: '#EEF6FA',
  color: '#0F4258',
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
}

const detailLayout: CSSProperties = {
  display: 'grid',
  gap: 16,
}

const threadHeader: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 16,
  alignItems: 'flex-start',
  flexWrap: 'wrap',
}

const headerControls: CSSProperties = {
  display: 'flex',
  gap: 12,
  flexWrap: 'wrap',
}

const controlBlock: CSSProperties = {
  minWidth: 160,
  display: 'grid',
  gap: 6,
}

const controlLabel: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: '#64748B',
}

const summaryStrip: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
}

const metricPill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '5px 9px',
  borderRadius: 999,
  background: '#EEF6FA',
  color: '#0F4258',
  fontSize: 11,
  fontWeight: 800,
}

const participantsCard: CSSProperties = {
  borderRadius: 16,
  padding: 14,
  border: '1px solid rgba(226,232,240,1)',
  background: '#FAFCFD',
}

const participantRow: CSSProperties = {
  marginTop: 10,
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
}

const participantChip: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '6px 10px',
  borderRadius: 999,
  background: '#ffffff',
  border: '1px solid rgba(226,232,240,1)',
  fontSize: 12,
  color: '#475569',
}

const messageStack: CSSProperties = {
  display: 'grid',
  gap: 12,
}

const messageCard: CSSProperties = {
  borderRadius: 18,
  padding: 16,
  border: '1px solid rgba(226,232,240,1)',
  background: '#ffffff',
}

const composerCard: CSSProperties = {
  borderRadius: 18,
  padding: 16,
  border: '1px solid rgba(226,232,240,1)',
  background: '#FAFCFD',
  display: 'grid',
  gap: 12,
}

const textareaInput: CSSProperties = {
  width: '100%',
  borderRadius: 14,
  border: '1px solid rgba(203,213,225,1)',
  padding: '12px 14px',
  fontSize: 14,
  lineHeight: 1.7,
  color: '#0F172A',
  background: '#ffffff',
  resize: 'vertical',
}

const composerActions: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'center',
  flexWrap: 'wrap',
}

const overlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15,23,42,0.30)',
  display: 'grid',
  placeItems: 'center',
  padding: 20,
  zIndex: 60,
}

const modalCard: CSSProperties = {
  width: 'min(820px, 100%)',
  maxHeight: '90vh',
  overflow: 'auto',
  borderRadius: 24,
  padding: 22,
  background: '#ffffff',
  border: '1px solid rgba(226,232,240,1)',
  boxShadow: '0 24px 60px rgba(15,23,42,0.16)',
}

const modalForm: CSSProperties = {
  display: 'grid',
  gap: 16,
  marginTop: 16,
}

const formGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 14,
}

const fieldBlock: CSSProperties = {
  display: 'grid',
  gap: 6,
}

const fieldBlockWide: CSSProperties = {
  gridColumn: '1 / -1',
  display: 'grid',
  gap: 6,
}

const skeleton: CSSProperties = {
  borderRadius: 18,
  background: 'linear-gradient(90deg, rgba(241,245,249,0.9), rgba(248,250,252,1), rgba(241,245,249,0.9))',
  border: '1px solid rgba(226,232,240,1)',
}
