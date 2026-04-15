import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { getWorkspaceIdFromHash } from '../../utils/workspace'
import { setModule5View } from './navigation'
import {
  buildUploadValidation,
  MODULE5_UPLOAD_PREFIX,
  fetchModule5UploadPreview,
  fetchModule5Uploads,
  formatBytes,
  getAuthHeaders,
  getDisplayName,
  inspectCsvText,
  type Module5UploadStatus,
  type PreviewData,
  type UploadItem,
  type UploadValidationSummary,
} from './webEngagement'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

type LoadState = 'loading' | 'ready' | 'empty' | 'error'
type StatusView = Module5UploadStatus

export default function Module5WebEngagementPage() {
  const [workspaceId] = useState<string | null>(() => getWorkspaceIdFromHash())
  const [state, setState] = useState<LoadState>('loading')
  const [statusView, setStatusView] = useState<StatusView>('active')
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [validation, setValidation] = useState<UploadValidationSummary | null>(null)
  const [validating, setValidating] = useState(false)
  const [message, setMessage] = useState<{ tone: 'info' | 'success' | 'error'; text: string } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewItem, setPreviewItem] = useState<UploadItem | null>(null)
  const [previewData, setPreviewData] = useState<PreviewData | null>(null)
  const [actionTarget, setActionTarget] = useState<{ type: 'archive' | 'delete'; item: UploadItem } | null>(null)

  async function loadUploads(nextStatus: StatusView = statusView) {
    if (!workspaceId) {
      setState('error')
      setMessage({ tone: 'error', text: 'Workspace context is missing. Open Module 5 from inside a workspace to manage engagement datasets.' })
      return
    }

    setState('loading')

    try {
      const result = await fetchModule5Uploads(API_URL, workspaceId, nextStatus)

      if (!result.ok) {
        setUploads([])
        setState('error')
        setMessage({ tone: 'error', text: result.error || 'Module 5 could not load the current engagement datasets.' })
        return
      }

      setUploads(result.items)
      setState(result.items.length > 0 ? 'ready' : 'empty')
    } catch {
      setUploads([])
      setState('error')
      setMessage({ tone: 'error', text: 'Module 5 could not reach the shared file library right now.' })
    }
  }

  useEffect(() => {
    loadUploads(statusView)
  }, [workspaceId, statusView])

  const stats = useMemo(() => {
    const totalBytes = uploads.reduce((sum, item) => sum + (Number(item.length) || 0), 0)
    const latest = uploads[0]?.createdAt ? new Date(uploads[0].createdAt).toLocaleDateString() : 'No uploads yet'
    return {
      count: uploads.length,
      totalBytes: formatBytes(totalBytes),
      latest,
    }
  }, [uploads])

  async function handleFileSelection(nextFile: File | null) {
    setFile(nextFile)
    setValidation(null)

    if (!nextFile) {
      return
    }

    if (!nextFile.name.toLowerCase().endsWith('.csv')) {
      setMessage({ tone: 'error', text: 'Only CSV files are supported in this first step.' })
      return
    }

    setValidating(true)
    setMessage({ tone: 'info', text: 'Checking whether this file looks like valid web engagement data...' })

    try {
      const text = await nextFile.text()
      const inspection = inspectCsvText(text)
      const summary = buildUploadValidation(inspection.header, inspection.rowCountPreview)
      setValidation(summary)
      setMessage({
        tone: summary.valid ? 'success' : 'error',
        text: summary.valid
          ? 'This file passed the Module 5 web engagement checks and is ready to upload.'
          : summary.reason,
      })
    } catch {
      setValidation(null)
      setMessage({ tone: 'error', text: 'The selected file could not be read for validation.' })
    } finally {
      setValidating(false)
    }
  }

  async function handleUpload(event: React.FormEvent) {
    event.preventDefault()

    if (!workspaceId) {
      setMessage({ tone: 'error', text: 'Workspace context is missing.' })
      return
    }

    if (!file) {
      setMessage({ tone: 'error', text: 'Choose a CSV file first.' })
      return
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setMessage({ tone: 'error', text: 'Only CSV files are supported in this first step.' })
      return
    }

    if (!validation || !validation.valid) {
      setMessage({
        tone: 'error',
        text: validation?.reason || 'This file cannot be uploaded because it does not pass the Module 5 web engagement checks.',
      })
      return
    }

    setUploading(true)
    setMessage({ tone: 'info', text: 'Uploading your web engagement dataset...' })

    try {
      const formData = new FormData()
      formData.append('file', file, `${MODULE5_UPLOAD_PREFIX}${file.name}`)
      formData.append('workspace', workspaceId)

      const res = await fetch(`${API_URL}/m01/uploads`, {
        method: 'POST',
        body: formData,
        headers: getAuthHeaders(),
      })
      const json = await res.json().catch(() => ({}))

      if (!res.ok || !json?.ok) {
        setMessage({ tone: 'error', text: json?.error || 'Upload failed.' })
        return
      }

      setFile(null)
      setValidation(null)
      setStatusView('active')
      setMessage({ tone: 'success', text: 'Web engagement dataset uploaded. It is now available in the Module 5 manager view.' })
      await loadUploads('active')
    } catch {
      setMessage({ tone: 'error', text: 'Upload failed before the shared file library could confirm the dataset.' })
    } finally {
      setUploading(false)
    }
  }

  async function openPreview(item: UploadItem) {
    if (!workspaceId) return

    setPreviewOpen(true)
    setPreviewLoading(true)
    setPreviewItem(item)
    setPreviewData(null)

    try {
      const result = await fetchModule5UploadPreview(API_URL, workspaceId, item._id, 10)

      if (result.item) {
        setPreviewItem(result.item)
      }

      if (!result.ok) {
        setPreviewData({ header: [], rows: [], page: 1, perPage: 10, hasMore: false })
        setMessage({ tone: 'error', text: result.error || 'Preview could not be loaded.' })
        return
      }

      setPreviewData(result.preview as PreviewData)
    } catch {
      setPreviewData({ header: [], rows: [], page: 1, perPage: 10, hasMore: false })
      setMessage({ tone: 'error', text: 'Preview could not be loaded from the shared file library.' })
    } finally {
      setPreviewLoading(false)
    }
  }

  async function confirmAction() {
    if (!workspaceId || !actionTarget) return

    const { type, item } = actionTarget
    setActionTarget(null)

    try {
      const endpoint = type === 'archive'
        ? `${API_URL}/m01/uploads/${item._id}?workspace=${workspaceId}`
        : `${API_URL}/m01/uploads/${item._id}/permanent?workspace=${workspaceId}`

      const res = await fetch(endpoint, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })
      const json = await res.json().catch(() => ({}))

      if (!res.ok || !json?.ok) {
        setMessage({ tone: 'error', text: json?.error || `${type === 'archive' ? 'Archive' : 'Delete'} failed.` })
        return
      }

      setMessage({
        tone: 'success',
        text: type === 'archive'
          ? 'Dataset archived. It now lives in the archived view of this manager.'
          : 'Dataset deleted from the shared file library.',
      })
      await loadUploads(statusView)
    } catch {
      setMessage({ tone: 'error', text: `${type === 'archive' ? 'Archive' : 'Delete'} failed.` })
    }
  }

  return (
    <div style={{ marginTop: 18 }}>
      <button type="button" onClick={() => setModule5View('home')} style={backBtn}>
        Back to Module 5 Home
      </button>

      <section style={heroSection}>
        <div style={{ padding: 28 }}>
          <div style={heroPill}>M05 Web Data</div>
          <div style={heroGrid}>
            <div>
              <h1 style={{ margin: '16px 0 8px', fontSize: 36, lineHeight: 1.05, fontWeight: 900, color: '#fff' }}>
                Web engagement data manager
              </h1>
              <div style={{ maxWidth: 680, color: 'rgba(255,255,255,0.84)', fontSize: 15, lineHeight: 1.7 }}>
                Upload and manage website engagement CSVs so Module 5 can build trustworthy traffic, interaction, and engagement views on top of a shared workspace file library.
              </div>
            </div>

            <div style={heroStats}>
              <HeroStat label={statusView === 'active' ? 'Active datasets' : 'Archived datasets'} value={String(stats.count)} />
              <HeroStat label="Visible library size" value={stats.totalBytes} />
              <HeroStat label="Latest upload" value={stats.latest} compact />
            </div>
          </div>
        </div>
      </section>

      {message && (
        <section style={{ ...noticeBox, ...(message.tone === 'error' ? errorNotice : message.tone === 'success' ? successNotice : infoNotice) }}>
          {message.text}
        </section>
      )}

      <section style={mainGrid}>
        <div style={panelCard}>
          <SectionHeader eyebrow="Upload" title="Add a new engagement CSV" />
          <div style={{ fontSize: 13, lineHeight: 1.7, color: '#415274' }}>
            Use this manager to store website engagement datasets in the same shared file-library pattern already used elsewhere in the workspace. Module 5 now checks the file before upload so clearly unrelated CSVs do not enter the library.
          </div>

          <form onSubmit={handleUpload} style={{ marginTop: 18, display: 'grid', gap: 14 }}>
            <label style={uploadCard}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0B2540' }}>Choose a CSV file</div>
              <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.65, color: '#5B6C8B' }}>
                Good fits include page-view exports, session activity, clickstream summaries, landing-page interactions, or UTM-tagged engagement data. The file should clearly describe who engaged, what they did, where they came from, and when it happened.
              </div>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => {
                  void handleFileSelection(event.target.files?.[0] || null)
                }}
                style={{ marginTop: 14 }}
              />
              <div style={{ marginTop: 10, fontSize: 12, color: '#5B6C8B' }}>
                {file ? `Selected file: ${file.name}` : 'No file selected yet'}
              </div>
            </label>

            <div style={guidanceCard}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0B2540' }}>What a valid file should contain</div>
              <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.7, color: '#415274' }}>
                Module 5 expects one logical web-engagement dataset per file. A strong upload usually includes an event timestamp, company or visitor identity, page or page category, event type, and source or campaign context. Engagement score, intent hints, and conversion flags are helpful extras.
              </div>
            </div>

            {(validating || validation) && (
              <section style={validationCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div>
                    <div style={validationPill}>Validation summary</div>
                    <h4 style={{ margin: '12px 0 0', fontSize: 22, color: '#0B2540' }}>Does this file look like web engagement data?</h4>
                  </div>
                  <div style={validationStatus(validating ? 'checking' : validation?.valid ? 'valid' : 'invalid')}>
                    {validating ? 'Checking' : validation?.valid ? 'Upload allowed' : 'Upload blocked'}
                  </div>
                </div>

                {validating && (
                  <div style={{ marginTop: 14, fontSize: 13, color: '#415274' }}>
                    Reading the header row and checking whether the file contains the key engagement signals Module 5 expects.
                  </div>
                )}

                {validation && (
                  <>
                    <div style={{ marginTop: 14, fontSize: 13, lineHeight: 1.7, color: '#415274' }}>
                      {validation.reason}
                    </div>

                    <div style={validationMetaGrid}>
                      <MetaTile label="Detected columns" value={String(validation.header.length)} />
                      <MetaTile label="Preview rows" value={String(validation.rowCountPreview)} />
                      <MetaTile label="Required signals found" value={String(validation.requiredGroups.filter((group) => group.satisfied).length)} />
                      <MetaTile label="Optional signals found" value={String(validation.optionalMatches.length)} />
                    </div>

                    <div style={validationSplitGrid}>
                      <div style={subCard}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#0B2540' }}>Required checks</div>
                        <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
                          {validation.requiredGroups.map((group) => (
                            <div key={group.key} style={requiredRow}>
                              <div style={groupBadge(group.satisfied)}>{group.satisfied ? 'Found' : 'Missing'}</div>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 800, color: '#0B2540' }}>{group.label}</div>
                                <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.6, color: '#5B6C8B' }}>
                                  {group.columns.length > 0 ? `Matched column: ${group.columns.join(', ')}` : group.description}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div style={subCard}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#0B2540' }}>Helpful extras</div>
                        <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
                          {validation.optionalMatches.length > 0 ? (
                            validation.optionalMatches.map((item) => (
                              <div key={item.label} style={optionalRow}>
                                <div style={optionalBadge}>Detected</div>
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0B2540' }}>{item.label}</div>
                                  <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.6, color: '#5B6C8B' }}>{item.columns.join(', ')}</div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div style={{ fontSize: 12, lineHeight: 1.7, color: '#5B6C8B' }}>
                              No optional enrichment fields were detected. The file may still be uploadable if all required checks pass.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={subCard}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#0B2540' }}>Detected columns</div>
                      <div style={chipRow}>
                        {validation.header.map((column) => (
                          <span key={column} style={columnChip}>{column}</span>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </section>
            )}

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <button type="submit" className="btn-primary" disabled={uploading || validating || !validation?.valid} style={primaryButton}>
                {uploading ? 'Uploading...' : 'Upload dataset'}
              </button>
              <div style={{ fontSize: 12, color: '#5B6C8B' }}>
                {validation?.valid
                  ? 'This file passed validation and can be stored as one Module 5 web engagement dataset.'
                  : 'Upload stays disabled until the selected file passes the Module 5 web engagement checks.'}
              </div>
            </div>
          </form>
        </div>

        <div style={panelCardMuted}>
          <SectionHeader eyebrow="Trust check" title="What this first version supports" />
          <div style={{ display: 'grid', gap: 12 }}>
            <FeatureCard title="Shared storage" text="Module 5 reuses the existing workspace file-library backend instead of creating a separate upload system." />
            <FeatureCard title="Manager-friendly controls" text="The flow focuses on upload, preview, archive, and delete so the dataset state stays clear and easy to trust." />
            <FeatureCard title="Ready for later views" text="These uploaded datasets are intended to feed future web-engagement visualization work inside Module 5." />
          </div>
        </div>
      </section>

      <section style={panelCard}>
        <div style={toolbar}>
          <div>
            <SectionHeader eyebrow="Dataset library" title="Available web engagement datasets" />
            <div style={{ fontSize: 13, color: '#415274', lineHeight: 1.7 }}>
              This view shows Module 5-labeled datasets from the shared workspace file library.
            </div>
          </div>

          <div style={toggleRow}>
            <button
              type="button"
              onClick={() => setStatusView('active')}
              style={{ ...toggleButton, ...(statusView === 'active' ? toggleButtonActive : null) }}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => setStatusView('archived')}
              style={{ ...toggleButton, ...(statusView === 'archived' ? toggleButtonActive : null) }}
            >
              Archived
            </button>
          </div>
        </div>

        {state === 'loading' && (
          <div style={{ display: 'grid', gap: 12 }}>
            <SkeletonBlock height={68} />
            <SkeletonBlock height={68} />
            <SkeletonBlock height={68} />
          </div>
        )}

        {state === 'error' && (
          <div style={emptyBox}>
            Module 5 could not load the current engagement dataset list from the shared file library.
          </div>
        )}

        {state === 'empty' && (
          <div style={emptyStateCard}>
            <div style={emptyStatePill}>{statusView === 'active' ? 'No datasets yet' : 'No archived datasets'}</div>
            <h3 style={{ margin: '14px 0 8px', fontSize: 24, color: '#0B2540' }}>
              {statusView === 'active' ? 'Upload your first web engagement dataset' : 'Archived datasets will appear here'}
            </h3>
            <div style={{ maxWidth: 680, fontSize: 14, lineHeight: 1.75, color: '#415274' }}>
              {statusView === 'active'
                ? 'Once you upload a CSV here, Module 5 will keep it in a simple library view so later visualization work has a clear source to build from.'
                : 'Archive moves datasets out of the active list without forcing an immediate permanent delete.'}
            </div>
          </div>
        )}

        {state === 'ready' && (
          <div style={tableWrap}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>Dataset</th>
                  <th style={th}>Uploaded</th>
                  <th style={th}>Status</th>
                  <th style={th}>Size</th>
                  <th style={th}>Uploaded by</th>
                  <th style={th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {uploads.map((item) => (
                  <tr key={item._id} style={tr}>
                    <td style={tdStrong}>
                      <div>{getDisplayName(item)}</div>
                      <div style={{ marginTop: 4, fontSize: 12, color: '#5B6C8B', fontWeight: 500 }}>
                        Web engagement dataset
                      </div>
                    </td>
                    <td style={td}>{item.createdAt ? new Date(item.createdAt).toLocaleString() : 'Unknown date'}</td>
                    <td style={td}>
                      <span style={statusBadge(item.status || statusView)}>{item.status || statusView}</span>
                    </td>
                    <td style={td}>{formatBytes(item.length)}</td>
                    <td style={td}>{item.metadata?.uploader?.fullName || item.metadata?.uploader?.email || 'Unknown'}</td>
                    <td style={td}>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button type="button" className="btn-ghost" style={ghostButton} onClick={() => openPreview(item)}>
                          Preview
                        </button>
                        {statusView === 'active' ? (
                          <button type="button" className="btn-ghost" style={ghostButton} onClick={() => setActionTarget({ type: 'archive', item })}>
                            Archive
                          </button>
                        ) : (
                          <button type="button" className="btn-danger" style={dangerButton} onClick={() => setActionTarget({ type: 'delete', item })}>
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {previewOpen && (
        <div style={overlay} onClick={() => setPreviewOpen(false)}>
          <div style={modalCard} onClick={(event) => event.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
              <div>
                <div style={sectionPill}>Dataset preview</div>
                <h3 style={{ margin: '12px 0 6px', fontSize: 24, color: '#0B2540' }}>
                  {previewItem ? getDisplayName(previewItem) : 'Web engagement dataset'}
                </h3>
                <div style={{ fontSize: 13, lineHeight: 1.7, color: '#415274' }}>
                  First-page preview from the shared workspace file library.
                </div>
              </div>
              <button type="button" className="btn-ghost" style={ghostButton} onClick={() => setPreviewOpen(false)}>
                Close
              </button>
            </div>

            {previewLoading ? (
              <div style={{ marginTop: 18, display: 'grid', gap: 12 }}>
                <SkeletonBlock height={64} />
                <SkeletonBlock height={180} />
              </div>
            ) : (
              <>
                <div style={previewMetaGrid}>
                  <PreviewMeta label="Uploaded" value={previewItem?.createdAt ? new Date(previewItem.createdAt).toLocaleString() : 'Unknown'} />
                  <PreviewMeta label="Status" value={String(previewItem?.status || statusView)} />
                  <PreviewMeta label="Size" value={formatBytes(previewItem?.length)} />
                  <PreviewMeta label="Columns" value={String(previewData?.header.length || 0)} />
                </div>

                {previewData && previewData.header.length > 0 ? (
                  <div style={{ ...tableWrap, marginTop: 18 }}>
                    <table style={table}>
                      <thead>
                        <tr>
                          {previewData.header.map((column) => (
                            <th key={column} style={th}>
                              {column}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.rows.map((row, rowIndex) => (
                          <tr key={`${rowIndex}-${row.join('|')}`} style={tr}>
                            {previewData.header.map((column, columnIndex) => (
                              <td key={`${column}-${columnIndex}`} style={td}>
                                {row[columnIndex] || ''}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ ...emptyBox, marginTop: 18 }}>
                    This dataset preview is empty or the shared library could not detect any visible rows on the first page.
                  </div>
                )}

                {previewData?.hasMore && (
                  <div style={{ marginTop: 12, fontSize: 12, color: '#5B6C8B' }}>
                    More rows exist in the dataset than are shown in this first-page preview.
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {actionTarget && (
        <div style={overlay} onClick={() => setActionTarget(null)}>
          <div style={confirmCard} onClick={(event) => event.stopPropagation()}>
            <div style={sectionPill}>Confirm action</div>
            <h3 style={{ margin: '12px 0 8px', fontSize: 22, color: '#0B2540' }}>
              {actionTarget.type === 'archive' ? 'Archive this dataset?' : 'Delete this dataset permanently?'}
            </h3>
            <div style={{ fontSize: 14, lineHeight: 1.75, color: '#415274' }}>
              {actionTarget.type === 'archive'
                ? `This will move "${getDisplayName(actionTarget.item)}" out of the active Module 5 list.`
                : `This will permanently remove "${getDisplayName(actionTarget.item)}" from the shared file library.`}
            </div>
            <div style={{ marginTop: 18, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn-ghost" style={ghostButton} onClick={() => setActionTarget(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={actionTarget.type === 'archive' ? 'btn-primary' : 'btn-danger'}
                style={actionTarget.type === 'archive' ? primaryButton : dangerButton}
                onClick={confirmAction}
              >
                {actionTarget.type === 'archive' ? 'Archive dataset' : 'Delete permanently'}
              </button>
            </div>
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
      <h3 style={{ margin: '12px 0 0', fontSize: 24, color: '#0B2540' }}>{title}</h3>
    </div>
  )
}

function HeroStat({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div style={heroStatCard}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.72)' }}>
        {label}
      </div>
      <div style={{ marginTop: 8, fontSize: compact ? 18 : 28, fontWeight: 900, color: '#fff', lineHeight: 1.2 }}>
        {value}
      </div>
    </div>
  )
}

function FeatureCard({ title, text }: { title: string; text: string }) {
  return (
    <div style={featureCard}>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#0B2540' }}>{title}</div>
      <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.65, color: '#415274' }}>{text}</div>
    </div>
  )
}

function PreviewMeta({ label, value }: { label: string; value: string }) {
  return (
    <div style={previewMetaCard}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5B6C8B' }}>
        {label}
      </div>
      <div style={{ marginTop: 8, fontSize: 15, fontWeight: 800, color: '#0B2540' }}>{value}</div>
    </div>
  )
}

function SkeletonBlock({ height }: { height: number }) {
  return (
    <div
      style={{
        height,
        borderRadius: 18,
        background: 'linear-gradient(90deg, rgba(232,237,243,0.9), rgba(244,247,250,1), rgba(232,237,243,0.9))',
        border: '1px solid rgba(15,66,88,0.06)',
      }}
    />
  )
}

function statusBadge(status: string): CSSProperties {
  const isArchived = status === 'archived'
  return {
    display: 'inline-flex',
    padding: '6px 10px',
    borderRadius: 999,
    background: isArchived ? 'rgba(71,85,105,0.12)' : 'rgba(15,118,110,0.12)',
    color: isArchived ? '#475569' : '#0F766E',
    fontSize: 12,
    fontWeight: 800,
    textTransform: 'capitalize',
  }
}

const backBtn: CSSProperties = {
  borderRadius: 12,
  padding: '10px 14px',
  border: '1px solid rgba(15,66,88,0.12)',
  background: 'linear-gradient(180deg, rgba(255,255,255,1), rgba(245,249,253,0.98))',
  color: '#0B2540',
  fontWeight: 800,
  cursor: 'pointer',
  boxShadow: '0 10px 22px rgba(13,30,60,0.05)',
}

const heroSection: CSSProperties = {
  marginTop: 16,
  borderRadius: 24,
  overflow: 'hidden',
  border: '1px solid rgba(15,66,88,0.08)',
  boxShadow: '0 20px 46px rgba(13,30,60,0.08)',
  background: 'linear-gradient(135deg, rgba(18,59,87,0.98) 0%, rgba(15,66,88,0.94) 52%, rgba(72,177,217,0.24) 100%)',
  color: '#fff',
}

const heroPill: CSSProperties = {
  display: 'inline-flex',
  padding: '7px 12px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.12)',
  border: '1px solid rgba(255,255,255,0.16)',
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const heroGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1.2fr 0.8fr',
  gap: 18,
  alignItems: 'stretch',
}

const heroStats: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: 12,
}

const heroStatCard: CSSProperties = {
  borderRadius: 18,
  padding: 16,
  background: 'rgba(255,255,255,0.10)',
  border: '1px solid rgba(255,255,255,0.14)',
}

const noticeBox: CSSProperties = {
  marginTop: 18,
  borderRadius: 16,
  padding: 14,
  fontSize: 13,
  lineHeight: 1.7,
}

const infoNotice: CSSProperties = {
  background: 'rgba(36,83,166,0.10)',
  border: '1px solid rgba(36,83,166,0.18)',
  color: '#2453A6',
}

const successNotice: CSSProperties = {
  background: 'rgba(15,118,110,0.10)',
  border: '1px solid rgba(15,118,110,0.18)',
  color: '#0F766E',
}

const errorNotice: CSSProperties = {
  background: 'rgba(190,24,93,0.10)',
  border: '1px solid rgba(190,24,93,0.18)',
  color: '#9D174D',
}

const mainGrid: CSSProperties = {
  marginTop: 18,
  display: 'grid',
  gridTemplateColumns: '1.2fr 0.8fr',
  gap: 18,
}

const panelCard: CSSProperties = {
  borderRadius: 22,
  padding: 22,
  background: 'linear-gradient(180deg, rgba(255,255,255,1), rgba(247,250,253,0.98))',
  border: '1px solid rgba(15,66,88,0.08)',
  boxShadow: '0 16px 38px rgba(13,30,60,0.06)',
}

const panelCardMuted: CSSProperties = {
  borderRadius: 22,
  padding: 22,
  background: 'linear-gradient(180deg, rgba(243,248,252,0.98), rgba(255,255,255,1))',
  border: '1px solid rgba(15,66,88,0.08)',
  boxShadow: '0 16px 38px rgba(13,30,60,0.05)',
}

const sectionPill: CSSProperties = {
  display: 'inline-flex',
  padding: '6px 11px',
  borderRadius: 999,
  background: 'rgba(15,66,88,0.08)',
  color: 'var(--header-secondary)',
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const uploadCard: CSSProperties = {
  display: 'block',
  borderRadius: 18,
  padding: 18,
  background: 'linear-gradient(180deg, rgba(244,248,252,0.95), rgba(255,255,255,1))',
  border: '1px dashed rgba(15,66,88,0.20)',
}

const featureCard: CSSProperties = {
  borderRadius: 16,
  padding: 16,
  border: '1px solid rgba(15,66,88,0.08)',
  background: 'linear-gradient(180deg, rgba(255,255,255,1), rgba(245,249,253,0.98))',
}

const guidanceCard: CSSProperties = {
  borderRadius: 16,
  padding: 16,
  border: '1px solid rgba(15,66,88,0.08)',
  background: 'rgba(244,248,252,0.95)',
}

const validationCard: CSSProperties = {
  borderRadius: 18,
  padding: 18,
  border: '1px solid rgba(15,66,88,0.10)',
  background: 'linear-gradient(180deg, rgba(255,255,255,1), rgba(246,250,253,0.98))',
  boxShadow: '0 12px 28px rgba(13,30,60,0.05)',
}

const validationPill: CSSProperties = {
  display: 'inline-flex',
  padding: '6px 11px',
  borderRadius: 999,
  background: 'rgba(15,66,88,0.08)',
  color: 'var(--header-secondary)',
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

function validationStatus(mode: 'checking' | 'valid' | 'invalid'): CSSProperties {
  const palette = mode === 'valid'
    ? { bg: 'rgba(15,118,110,0.12)', color: '#0F766E' }
    : mode === 'invalid'
      ? { bg: 'rgba(190,24,93,0.10)', color: '#9D174D' }
      : { bg: 'rgba(36,83,166,0.10)', color: '#2453A6' }

  return {
    display: 'inline-flex',
    padding: '7px 12px',
    borderRadius: 999,
    background: palette.bg,
    color: palette.color,
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  }
}

const validationMetaGrid: CSSProperties = {
  marginTop: 16,
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
  gap: 12,
}

const validationSplitGrid: CSSProperties = {
  marginTop: 16,
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 14,
}

const subCard: CSSProperties = {
  marginTop: 16,
  borderRadius: 14,
  padding: 14,
  border: '1px solid rgba(15,66,88,0.08)',
  background: 'rgba(248,251,254,0.95)',
}

const requiredRow: CSSProperties = {
  display: 'flex',
  gap: 10,
  alignItems: 'flex-start',
}

const optionalRow: CSSProperties = {
  display: 'flex',
  gap: 10,
  alignItems: 'flex-start',
}

function groupBadge(satisfied: boolean): CSSProperties {
  return {
    display: 'inline-flex',
    padding: '5px 9px',
    borderRadius: 999,
    background: satisfied ? 'rgba(15,118,110,0.12)' : 'rgba(190,24,93,0.10)',
    color: satisfied ? '#0F766E' : '#9D174D',
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    flexShrink: 0,
  }
}

const optionalBadge: CSSProperties = {
  display: 'inline-flex',
  padding: '5px 9px',
  borderRadius: 999,
  background: 'rgba(36,83,166,0.10)',
  color: '#2453A6',
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  flexShrink: 0,
}

const chipRow: CSSProperties = {
  marginTop: 10,
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
}

const columnChip: CSSProperties = {
  display: 'inline-flex',
  padding: '7px 10px',
  borderRadius: 999,
  background: 'rgba(15,66,88,0.08)',
  color: '#0B2540',
  fontSize: 12,
  fontWeight: 700,
}

function MetaTile({ label, value }: { label: string; value: string }) {
  return (
    <div style={previewMetaCard}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5B6C8B' }}>
        {label}
      </div>
      <div style={{ marginTop: 8, fontSize: 18, fontWeight: 900, color: '#0B2540' }}>{value}</div>
    </div>
  )
}

const toolbar: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 16,
  alignItems: 'flex-start',
  flexWrap: 'wrap',
  marginBottom: 18,
}

const toggleRow: CSSProperties = {
  display: 'inline-flex',
  gap: 8,
  padding: 6,
  borderRadius: 999,
  background: 'rgba(15,66,88,0.06)',
  border: '1px solid rgba(15,66,88,0.08)',
}

const toggleButton: CSSProperties = {
  borderRadius: 999,
  border: 'none',
  background: 'transparent',
  color: '#5B6C8B',
  fontWeight: 800,
  padding: '8px 12px',
  cursor: 'pointer',
}

const toggleButtonActive: CSSProperties = {
  background: 'linear-gradient(135deg, #0f4258 0%, #2b6f8a 100%)',
  color: '#fff',
}

const tableWrap: CSSProperties = {
  overflowX: 'auto',
  borderRadius: 18,
  border: '1px solid rgba(15,66,88,0.08)',
}

const table: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  background: 'rgba(255,255,255,0.96)',
}

const th: CSSProperties = {
  textAlign: 'left',
  fontSize: 12,
  color: '#5B6C8B',
  fontWeight: 800,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  padding: '14px 16px',
  borderBottom: '1px solid rgba(15,66,88,0.08)',
  background: 'rgba(244,248,252,0.95)',
}

const td: CSSProperties = {
  padding: '14px 16px',
  borderBottom: '1px solid rgba(15,66,88,0.08)',
  fontSize: 13,
  color: '#415274',
  verticalAlign: 'top',
}

const tdStrong: CSSProperties = {
  ...td,
  color: '#0B2540',
  fontWeight: 800,
}

const tr: CSSProperties = {
  background: 'rgba(255,255,255,0.96)',
}

const emptyStateCard: CSSProperties = {
  borderRadius: 20,
  padding: 24,
  background: 'linear-gradient(180deg, rgba(247,250,253,0.98), rgba(255,255,255,1))',
  border: '1px dashed rgba(15,66,88,0.18)',
}

const emptyStatePill: CSSProperties = {
  display: 'inline-flex',
  padding: '6px 11px',
  borderRadius: 999,
  background: 'rgba(72,177,217,0.12)',
  color: '#0B2540',
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const emptyBox: CSSProperties = {
  borderRadius: 16,
  padding: 16,
  border: '1px dashed rgba(15,66,88,0.16)',
  background: 'rgba(245,249,253,0.9)',
  color: '#415274',
  fontSize: 13,
  lineHeight: 1.7,
}

const overlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(11,37,64,0.40)',
  display: 'grid',
  placeItems: 'center',
  padding: 20,
  zIndex: 50,
}

const modalCard: CSSProperties = {
  width: 'min(1080px, 100%)',
  maxHeight: '85vh',
  overflow: 'auto',
  borderRadius: 24,
  padding: 22,
  background: 'linear-gradient(180deg, rgba(255,255,255,1), rgba(247,250,253,0.98))',
  border: '1px solid rgba(15,66,88,0.08)',
  boxShadow: '0 28px 60px rgba(13,30,60,0.18)',
}

const confirmCard: CSSProperties = {
  width: 'min(540px, 100%)',
  borderRadius: 24,
  padding: 22,
  background: 'linear-gradient(180deg, rgba(255,255,255,1), rgba(247,250,253,0.98))',
  border: '1px solid rgba(15,66,88,0.08)',
  boxShadow: '0 28px 60px rgba(13,30,60,0.18)',
}

const previewMetaGrid: CSSProperties = {
  marginTop: 18,
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: 12,
}

const previewMetaCard: CSSProperties = {
  borderRadius: 16,
  padding: 14,
  background: 'rgba(244,248,252,0.95)',
  border: '1px solid rgba(15,66,88,0.07)',
}

const primaryButton: CSSProperties = {
  borderRadius: 12,
  padding: '10px 14px',
  fontWeight: 800,
}

const ghostButton: CSSProperties = {
  borderRadius: 12,
  padding: '9px 12px',
  fontWeight: 800,
}

const dangerButton: CSSProperties = {
  borderRadius: 12,
  padding: '9px 12px',
  fontWeight: 800,
}
