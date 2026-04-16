import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import { getWorkspaceIdFromHash } from '../../utils/workspace'
import {
  archiveCommunicationThread,
  createCommunicationThread,
  deleteCommunicationThread,
  fetchCommunicationThreadDetail,
  fetchCommunicationThreads,
  fetchWorkspaceMemberOptions,
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
  type WorkspaceMemberOption,
} from './communicationHub'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

type ListState = 'loading' | 'ready' | 'empty' | 'error'
type DetailState = 'idle' | 'loading' | 'ready' | 'error'

const TYPE_OPTIONS: CommunicationThreadType[] = ['general', 'note', 'alignment_concern', 'lead_issue', 'campaign_issue', 'follow_up', 'blocker']
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
  const [savingMeta, setSavingMeta] = useState<'status' | 'priority' | 'archive' | 'delete' | null>(null)
  const [showComposer, setShowComposer] = useState(false)
  const [creating, setCreating] = useState(false)
  const [memberOptions, setMemberOptions] = useState<WorkspaceMemberOption[]>([])
  const [memberState, setMemberState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [participantQuery, setParticipantQuery] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [createForm, setCreateForm] = useState({
    title: '',
    body: '',
    type: 'general' as CommunicationThreadType,
    priority: 'medium' as CommunicationThreadPriority,
    participants: [] as CommunicationParticipant[],
  })
  const [filters, setFilters] = useState({
    q: '',
    status: '' as '' | CommunicationThreadStatus,
    priority: '' as '' | CommunicationThreadPriority,
    view: 'active' as 'active' | 'archived' | 'all',
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
  }, [workspaceId, filters.q, filters.status, filters.priority, filters.view])

  useEffect(() => {
    let cancelled = false

    async function loadMembers() {
      if (!workspaceId) {
        setMemberState('error')
        return
      }

      setMemberState('loading')

      try {
        const result = await fetchWorkspaceMemberOptions(API_URL, workspaceId)
        if (cancelled) return

        if (!result.ok) {
          setMemberOptions([])
          setMemberState('error')
          return
        }

        setMemberOptions(result.items)
        setMemberState('ready')
      } catch {
        if (cancelled) return
        setMemberOptions([])
        setMemberState('error')
      }
    }

    void loadMembers()
    return () => {
      cancelled = true
    }
  }, [workspaceId])

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

  const memberSearchResults = useMemo(() => {
    const selectedIds = new Set(createForm.participants.map((participant) => participant.userId || participant.email || participant.name))
    const query = participantQuery.trim().toLowerCase()
    return memberOptions
      .filter((member) => !selectedIds.has(member.id) && (!query || `${member.name} ${member.email || ''} ${member.role}`.toLowerCase().includes(query)))
      .slice(0, 8)
  }, [createForm.participants, memberOptions, participantQuery])

  async function handleCreateThread(event: FormEvent) {
    event.preventDefault()
    if (!workspaceId) return

    if (createForm.type !== 'note' && createForm.participants.length === 0) {
      setCreateError('Add at least one participant for discussion threads. Notes can be created without participants.')
      return
    }

    setCreating(true)
    setError(null)
    setCreateError(null)

    try {
      const result = await createCommunicationThread(API_URL, {
        workspaceId,
        title: createForm.title.trim(),
        body: createForm.body.trim(),
        type: createForm.type,
        priority: createForm.priority,
        participants: createForm.participants,
      })

      if (!result.ok || !result.thread) {
        setCreateError(result.error || 'The new discussion thread could not be created.')
        return
      }

      setShowComposer(false)
      setCreateForm({
        title: '',
        body: '',
        type: 'general',
        priority: 'medium',
        participants: [],
      })
      setParticipantQuery('')
      setSelectedId(result.thread.id)
      setThreads((current) => [result.thread!, ...current.filter((item) => item.id !== result.thread!.id)])
      const detailResult = await fetchCommunicationThreadDetail(API_URL, workspaceId, result.thread.id)
      if (detailResult.ok && detailResult.detail) {
        setDetail(detailResult.detail)
        setDetailState('ready')
      }
      setListState('ready')
    } catch {
      setCreateError('The new discussion thread could not be created right now.')
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

  function handleAddParticipant(member: WorkspaceMemberOption) {
    setCreateForm((current) => ({
      ...current,
      participants: current.participants.some((participant) => participant.userId === member.id)
        ? current.participants
        : [
            ...current.participants,
            {
              userId: member.id,
              name: member.name,
              email: member.email || undefined,
              role: member.role,
            },
          ],
    }))
    setCreateError(null)
    setParticipantQuery('')
  }

  function handleRemoveParticipant(targetId: string) {
    setCreateForm((current) => ({
      ...current,
      participants: current.participants.filter((participant) => (participant.userId || participant.email || participant.name) !== targetId),
    }))
  }

  async function handleArchiveChange(archived: boolean) {
    if (!workspaceId || !detail) return
    setSavingMeta('archive')
    setError(null)
    try {
      const result = await archiveCommunicationThread(API_URL, workspaceId, detail.thread.id, archived)
      if (!result.ok || !result.thread) {
        setError(result.error || `Thread could not be ${archived ? 'archived' : 'restored'}.`)
        return
      }

      if (filters.view === 'active' && archived) {
        const remainingThreads = threads.filter((item) => item.id !== result.thread!.id)
        setThreads(remainingThreads)
        setSelectedId('')
        setDetail(null)
        setDetailState('idle')
        setListState(remainingThreads.length > 0 ? 'ready' : 'empty')
        return
      }

      if (filters.view === 'archived' && !archived) {
        const remainingThreads = threads.filter((item) => item.id !== result.thread!.id)
        setThreads(remainingThreads)
        setSelectedId('')
        setDetail(null)
        setDetailState('idle')
        setListState(remainingThreads.length > 0 ? 'ready' : 'empty')
        return
      }

      setDetail((current) => current ? { ...current, thread: result.thread! } : current)
      setThreads((current) => current.map((item) => item.id === result.thread!.id ? result.thread! : item))
    } catch {
      setError(`Thread could not be ${archived ? 'archived' : 'restored'} right now.`)
    } finally {
      setSavingMeta(null)
    }
  }

  async function handleDeleteThread() {
    if (!workspaceId || !detail) return
    const confirmed = window.confirm('Delete this thread for everyone? This cannot be undone.')
    if (!confirmed) return

    setSavingMeta('delete')
    setError(null)

    try {
      const result = await deleteCommunicationThread(API_URL, workspaceId, detail.thread.id)
      if (!result.ok || !result.deletedThreadId) {
        setError(result.error || 'This thread could not be deleted.')
        return
      }

      const remainingThreads = threads.filter((item) => item.id !== result.deletedThreadId)
      setThreads(remainingThreads)
      setDetail(null)
      setSelectedId(remainingThreads[0]?.id || '')
      setDetailState(remainingThreads.length > 0 ? 'loading' : 'idle')
      setListState(remainingThreads.length > 0 ? 'ready' : 'empty')
    } catch {
      setError('This thread could not be deleted right now.')
    } finally {
      setSavingMeta(null)
    }
  }

  return (
    <div style={page}>
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
            <button
              type="button"
              className="btn-primary"
              style={primaryButton}
              onClick={() => {
                setCreateError(null)
                setParticipantQuery('')
                setShowComposer(true)
              }}
            >
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
              <select value={filters.view} onChange={(event) => setFilters((current) => ({ ...current, view: event.target.value as 'active' | 'archived' | 'all' }))} style={selectInput}>
                <option value="active">Active threads</option>
                <option value="archived">Archived</option>
                <option value="all">All threads</option>
              </select>
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
              {filters.view === 'archived'
                ? 'No archived threads are available yet for this workspace.'
                : 'No discussion threads exist yet for this workspace. Start the first thread to turn alignment watchouts into owned follow-up.'}
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
                    {thread.archivedAt && <span style={archivedBadge}>Archived</span>}
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
                  {detail.thread.archivedAt && (
                    <div style={{ marginTop: 8, fontSize: 12, color: '#64748B' }}>
                      Archived by {detail.thread.archivedByName || 'a participant'} on {new Date(detail.thread.archivedAt).toLocaleString()}
                    </div>
                  )}
                </div>
                <div style={headerControls}>
                  <div style={controlBlock}>
                    <label style={controlLabel}>Status</label>
                    <select
                      value={detail.thread.status}
                      onChange={(event) => void handleStatusChange(event.target.value as CommunicationThreadStatus)}
                      style={selectInput}
                      disabled={savingMeta === 'status' || !detail.thread.permissions.canChangeStatus}
                    >
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
                  <div style={actionCluster}>
                    {detail.thread.permissions.canArchive && (
                      <button
                        type="button"
                        className="btn-ghost"
                        style={secondaryActionButton}
                        onClick={() => void handleArchiveChange(!detail.thread.archivedAt)}
                        disabled={savingMeta === 'archive'}
                      >
                        {savingMeta === 'archive' ? 'Saving...' : detail.thread.archivedAt ? 'Restore thread' : 'Archive thread'}
                      </button>
                    )}
                    {detail.thread.permissions.canDelete && (
                      <button
                        type="button"
                        className="btn-ghost"
                        style={dangerButton}
                        onClick={() => void handleDeleteThread()}
                        disabled={savingMeta === 'delete'}
                      >
                        {savingMeta === 'delete' ? 'Deleting...' : 'Delete thread'}
                      </button>
                    )}
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
                        {participant.name}
                        {participant.role ? ` · ${participant.role.replace(/_/g, ' ')}` : ''}
                        {participant.email ? ` (${participant.email})` : ''}
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
        <div style={overlay} onClick={() => {
          if (!creating) {
            setCreateError(null)
            setShowComposer(false)
          }
        }}>
          <div style={modalCard} onClick={(event) => event.stopPropagation()}>
            <div style={sectionHeaderRow}>
              <SectionHeader eyebrow="Start thread" title="Create a new discussion" />
              <button
                type="button"
                className="btn-ghost"
                style={ghostButton}
                onClick={() => {
                  setCreateError(null)
                  setShowComposer(false)
                }}
                disabled={creating}
              >
                Close
              </button>
            </div>

            <form onSubmit={handleCreateThread} style={modalForm}>
              {createError && <div style={inlineError}>{createError}</div>}
              <div style={formGrid}>
                <div style={fieldBlockWide}>
                  <label style={controlLabel}>Title</label>
                  <input value={createForm.title} onChange={(event) => {
                    setCreateError(null)
                    setCreateForm((current) => ({ ...current, title: event.target.value }))
                  }} placeholder="Describe the issue, question, or follow-up clearly" style={textInput} />
                </div>
                <div style={fieldBlock}>
                  <label style={controlLabel}>Type</label>
                  <select value={createForm.type} onChange={(event) => {
                    setCreateError(null)
                    setCreateForm((current) => ({ ...current, type: event.target.value as CommunicationThreadType }))
                  }} style={selectInput}>
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
                  <div style={participantPickerCard}>
                    <div style={{ fontSize: 13, lineHeight: 1.7, color: '#475569' }}>
                      {createForm.type === 'note'
                        ? 'Notes can be created without participants. Add people only if you want them visibly included in the discussion.'
                        : 'Pick at least one participant so ownership and follow-up stay visible in the thread.'}
                    </div>
                    <input
                      value={participantQuery}
                      onChange={(event) => setParticipantQuery(event.target.value)}
                      placeholder="Search workspace members by name, email, or role"
                      style={textInput}
                    />

                    {createForm.participants.length > 0 && (
                      <div style={selectedParticipantWrap}>
                        {createForm.participants.map((participant) => {
                          const targetId = participant.userId || participant.email || participant.name
                          return (
                            <button
                              key={targetId}
                              type="button"
                              style={selectedParticipantChip}
                              onClick={() => handleRemoveParticipant(targetId)}
                            >
                              <span>{participant.name}{participant.role ? ` · ${participant.role.replace(/_/g, ' ')}` : ''}</span>
                              <span style={{ fontWeight: 900, color: '#94A3B8' }}>×</span>
                            </button>
                          )
                        })}
                      </div>
                    )}

                    {memberState === 'loading' && <div style={pickerHint}>Loading workspace members...</div>}
                    {memberState === 'error' && <div style={pickerHint}>Workspace members could not be loaded right now. You can try again by reopening the composer.</div>}
                    {memberState === 'ready' && (
                      memberSearchResults.length > 0 ? (
                        <div style={memberList}>
                          {memberSearchResults.map((member) => (
                            <button key={member.id} type="button" style={memberOptionButton} onClick={() => handleAddParticipant(member)}>
                              <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', textAlign: 'left' }}>{member.name}</div>
                              <div style={{ fontSize: 12, color: '#64748B', textAlign: 'left' }}>
                                {member.role.replace(/_/g, ' ')}{member.email ? ` · ${member.email}` : ''}
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div style={pickerHint}>
                          {participantQuery.trim() ? 'No matching workspace members found for that search.' : 'Start typing to quickly find people from this workspace.'}
                        </div>
                      )
                    )}
                  </div>
                </div>
                <div style={fieldBlockWide}>
                  <label style={controlLabel}>Initial message</label>
                  <textarea
                    value={createForm.body}
                    onChange={(event) => {
                      setCreateError(null)
                      setCreateForm((current) => ({ ...current, body: event.target.value }))
                    }}
                    placeholder="Explain what needs review, what is blocking progress, or what action the team should discuss"
                    style={textareaInput}
                    rows={7}
                  />
                </div>
              </div>
              <div style={composerActions}>
                <div style={{ fontSize: 12, color: '#64748B', maxWidth: 520 }}>
                  Phase 1 supports structured threads, replies, status, archive, and priority. Mentions, attachments, linked entities, and richer handoff actions are intentionally deferred.
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
  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
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

const archivedBadge: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '5px 9px',
  borderRadius: 999,
  background: '#E2E8F0',
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
  alignItems: 'flex-end',
}

const controlBlock: CSSProperties = {
  minWidth: 160,
  display: 'grid',
  gap: 6,
}

const actionCluster: CSSProperties = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
  alignItems: 'center',
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

const secondaryActionButton: CSSProperties = {
  borderRadius: 10,
  padding: '10px 14px',
  border: '1px solid rgba(203,213,225,1)',
  background: '#ffffff',
  color: '#0F172A',
  fontWeight: 700,
}

const dangerButton: CSSProperties = {
  borderRadius: 10,
  padding: '10px 14px',
  border: '1px solid rgba(254,205,211,1)',
  background: '#FFF1F2',
  color: '#BE123C',
  fontWeight: 800,
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

const inlineError: CSSProperties = {
  borderRadius: 14,
  padding: 12,
  border: '1px solid rgba(251,191,188,1)',
  background: '#FFF7F7',
  color: '#B42318',
  fontSize: 13,
  lineHeight: 1.7,
}

const participantPickerCard: CSSProperties = {
  borderRadius: 16,
  border: '1px solid rgba(226,232,240,1)',
  background: '#F8FAFC',
  padding: 14,
  display: 'grid',
  gap: 12,
}

const selectedParticipantWrap: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
}

const selectedParticipantChip: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 12px',
  borderRadius: 999,
  border: '1px solid rgba(203,213,225,1)',
  background: '#ffffff',
  color: '#0F172A',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
}

const memberList: CSSProperties = {
  display: 'grid',
  gap: 8,
}

const memberOptionButton: CSSProperties = {
  borderRadius: 14,
  padding: 12,
  border: '1px solid rgba(226,232,240,1)',
  background: '#ffffff',
  cursor: 'pointer',
}

const pickerHint: CSSProperties = {
  fontSize: 12,
  color: '#64748B',
  lineHeight: 1.7,
}

const skeleton: CSSProperties = {
  borderRadius: 18,
  background: 'linear-gradient(90deg, rgba(241,245,249,0.9), rgba(248,250,252,1), rgba(241,245,249,0.9))',
  border: '1px solid rgba(226,232,240,1)',
}
