import type React from 'react'
import { useEffect, useMemo, useState } from 'react'
import Layout from '../../components/Layout'
import ModuleBackButton from '../../components/ModuleBackButton'
import { getWorkspaceIdFromHash } from '../../utils/workspace'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'
const CANONICAL_FIELDS = [
  'campaign_id',
  'campaign_name',
  'platform',
  'channel',
  'campaign_type',
  'period_start',
  'period_end',
  'spend',
  'impressions',
  'clicks',
  'conversions',
  'mqls',
  'sqls',
  'pipeline_revenue',
  'launch_weekday',
  'launch_hour_bucket',
  'touches_per_user',
  'fatigue_flag',
] as const

type CanonicalField = (typeof CANONICAL_FIELDS)[number]
type MessageState = { type: 'info' | 'success' | 'error'; text: string } | null

type UploadItem = {
  _id: string
  filename?: string | null
  originalName?: string | null
  contentType?: string | null
  length?: number | null
  createdAt?: string | null
  module?: string | null
  metadata?: {
    uploader?: {
      fullName?: string | null
      email?: string | null
    } | null
  } | null
}

type PreviewData = {
  uploadId: string
  fileName: string
  headers: string[]
  sampleRows: Array<Record<string, string>>
  inferredTypes: Record<string, string>
  summary: {
    rowCount: number
    columnCount: number
    fileSize?: number | null
    contentType?: string | null
  }
  suggestedMapping: Partial<Record<CanonicalField, string>>
}

type ValidationFile = {
  uploadId: string
  fileName: string
  valid: boolean
  summary: {
    totalRows: number
    usableRows: number
    invalidRows: number
    mappedFields: CanonicalField[]
    missingCanonicalFields: CanonicalField[]
    unmappedFields: string[]
  }
  mapping: Partial<Record<CanonicalField, string>>
  autoMapping: Partial<Record<CanonicalField, string>>
  headers: string[]
  inferredTypes: Record<string, string>
  sampleRows: Array<Record<string, string>>
  issues: Array<{ level: 'error' | 'warning'; code: string; message: string; rowIndex?: number }>
}

type ValidationState = {
  canMerge: boolean
  files: ValidationFile[]
} | null

type MergeResult = {
  mergedOutputId: string
  title: string
  rowCountBeforeMerge: number
  rowCountAfterMerge: number
  duplicateCount: number
  mergedCount: number
  warnings: string[]
  sampleRows: Array<Record<string, string | number | boolean | null>>
} | null

type MergedOutputItem = {
  _id: string
  title: string
  filename: string
  sourceUploadIds?: string[]
  rowCountBeforeMerge?: number
  rowCountAfterMerge?: number
  duplicateCount?: number
  mergedCount?: number
  createdAt?: string
  summary?: {
    fuzzyThreshold?: string
    duplicateMethod?: {
      exactKey?: number
      fuzzyNameChannelWindow?: number
    } | null
    validationWarnings?: string[]
  } | null
}

type MergedOutputDetail = {
  item: MergedOutputItem
  headers: string[]
  sampleRows: Array<Record<string, string>>
  mergeSummary?: {
    duplicateCount?: number
    mergedCount?: number
    duplicateMethod?: {
      exactKey?: number
      fuzzyNameChannelWindow?: number
    } | null
    fuzzyThreshold?: string | null
  } | null
  validationSummary?: {
    warnings?: string[]
  } | null
}

function getAuthHeaders(extra: Record<string, string> = {}) {
  try {
    const token = localStorage.getItem('token')
    return token ? { ...extra, Authorization: `Bearer ${token}` } : extra
  } catch {
    return extra
  }
}

function formatBytes(value?: number | null) {
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

export default function Module9CampaignImportFlow() {
  const workspaceId = getWorkspaceIdFromHash()
  const [file, setFile] = useState<File | null>(null)
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [mergedOutputs, setMergedOutputs] = useState<MergedOutputItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMerged, setLoadingMerged] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [previewingId, setPreviewingId] = useState<string | null>(null)
  const [validating, setValidating] = useState(false)
  const [runningMerge, setRunningMerge] = useState(false)
  const [message, setMessage] = useState<MessageState>(null)
  const [selectedUploadIds, setSelectedUploadIds] = useState<string[]>([])
  const [activeUploadId, setActiveUploadId] = useState<string | null>(null)
  const [previewsByUpload, setPreviewsByUpload] = useState<Record<string, PreviewData>>({})
  const [mappingsByUpload, setMappingsByUpload] = useState<Record<string, Partial<Record<CanonicalField, string>>>>({})
  const [validation, setValidation] = useState<ValidationState>(null)
  const [mergeResult, setMergeResult] = useState<MergeResult>(null)
  const [mergedDetailsById, setMergedDetailsById] = useState<Record<string, MergedOutputDetail>>({})
  const [previewMergedId, setPreviewMergedId] = useState<string | null>(null)
  const [loadingMergedPreviewId, setLoadingMergedPreviewId] = useState<string | null>(null)
  const [downloadingMergedId, setDownloadingMergedId] = useState<string | null>(null)

  async function loadUploads() {
    if (!workspaceId) {
      setLoading(false)
      setMessage({ type: 'error', text: 'Workspace context is missing. Open Module 9 from inside a workspace.' })
      return
    }
    setLoading(true)
    try {
      const params = new URLSearchParams({ workspace: workspaceId, module: 'm09' })
      const res = await fetch(`${API_URL}/m01/uploads?${params.toString()}`, { headers: getAuthHeaders() })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) {
        setUploads([])
        setMessage({ type: 'error', text: json?.error || 'Module 9 could not load the current campaign upload list.' })
        return
      }
      setUploads(Array.isArray(json.items) ? json.items : [])
    } catch {
      setUploads([])
      setMessage({ type: 'error', text: 'Module 9 could not reach the shared upload service right now.' })
    } finally {
      setLoading(false)
    }
  }

  async function loadMergedOutputs() {
    if (!workspaceId) {
      setLoadingMerged(false)
      return
    }
    setLoadingMerged(true)
    try {
      const params = new URLSearchParams({ workspace: workspaceId })
      const res = await fetch(`${API_URL}/m09/merged?${params.toString()}`, { headers: getAuthHeaders() })
      const json = await res.json().catch(() => ({}))
      setMergedOutputs(res.ok && json?.ok && Array.isArray(json.items) ? json.items : [])
    } catch {
      setMergedOutputs([])
    } finally {
      setLoadingMerged(false)
    }
  }

  useEffect(() => {
    loadUploads()
    loadMergedOutputs()
  }, [workspaceId])

  useEffect(() => {
    if (!selectedUploadIds.length) {
      setActiveUploadId(null)
      return
    }
    if (!activeUploadId || !selectedUploadIds.includes(activeUploadId)) setActiveUploadId(selectedUploadIds[0])
  }, [selectedUploadIds, activeUploadId])

  const stats = useMemo(() => {
    const totalBytes = uploads.reduce((sum, item) => sum + (Number(item.length) || 0), 0)
    return {
      count: uploads.length,
      selected: selectedUploadIds.length,
      totalSize: formatBytes(totalBytes),
      latest: uploads[0]?.createdAt ? new Date(uploads[0].createdAt).toLocaleDateString() : 'No uploads yet',
    }
  }, [uploads, selectedUploadIds])

  const activePreview = activeUploadId ? previewsByUpload[activeUploadId] : null
  const activeMapping = activeUploadId ? mappingsByUpload[activeUploadId] || {} : {}

  async function handleUpload(event: React.FormEvent) {
    event.preventDefault()
    if (!workspaceId) {
      setMessage({ type: 'error', text: 'Workspace context is missing.' })
      return
    }
    if (!file) {
      setMessage({ type: 'error', text: 'Choose a CSV file first.' })
      return
    }
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setMessage({ type: 'error', text: 'Only CSV files are supported in this step.' })
      return
    }

    setUploading(true)
    setMessage({ type: 'info', text: 'Uploading campaign CSV to the shared Module 9 file library...' })
    try {
      const formData = new FormData()
      formData.append('file', file, file.name)
      formData.append('workspace', workspaceId)
      formData.append('module', 'm09')

      const res = await fetch(`${API_URL}/m01/uploads`, {
        method: 'POST',
        body: formData,
        headers: getAuthHeaders(),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) {
        setMessage({ type: 'error', text: json?.error || 'Upload failed.' })
        return
      }
      setFile(null)
      setMessage({ type: 'success', text: 'Campaign CSV uploaded for Module 9.' })
      await loadUploads()
    } catch {
      setMessage({ type: 'error', text: 'Upload failed before the shared service could confirm the file.' })
    } finally {
      setUploading(false)
    }
  }

  async function loadPreview(uploadId: string) {
    if (!workspaceId) return
    if (previewsByUpload[uploadId]) {
      setActiveUploadId(uploadId)
      return
    }
    setPreviewingId(uploadId)
    try {
      const params = new URLSearchParams({ workspace: workspaceId })
      const res = await fetch(`${API_URL}/m09/uploads/${uploadId}/preview?${params.toString()}`, { headers: getAuthHeaders() })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) {
        setMessage({ type: 'error', text: json?.error || 'Preview could not be generated.' })
        return
      }
      const preview = json as PreviewData
      setPreviewsByUpload((current) => ({ ...current, [uploadId]: preview }))
      setMappingsByUpload((current) => ({
        ...current,
        [uploadId]: current[uploadId] && Object.keys(current[uploadId] || {}).length > 0 ? current[uploadId] : preview.suggestedMapping,
      }))
      setActiveUploadId(uploadId)
    } catch {
      setMessage({ type: 'error', text: 'Module 9 could not fetch the selected file preview.' })
    } finally {
      setPreviewingId(null)
    }
  }

  function toggleSelected(uploadId: string) {
    setValidation(null)
    setMergeResult(null)
    setSelectedUploadIds((current) => current.includes(uploadId) ? current.filter((item) => item !== uploadId) : [...current, uploadId])
  }

  function updateMapping(field: CanonicalField, value: string) {
    if (!activeUploadId) return
    setValidation(null)
    setMergeResult(null)
    setMappingsByUpload((current) => ({
      ...current,
      [activeUploadId]: {
        ...(current[activeUploadId] || {}),
        [field]: value || '',
      },
    }))
  }

  async function ensurePreviewsForSelection() {
    for (const uploadId of selectedUploadIds) {
      if (!previewsByUpload[uploadId]) {
        // eslint-disable-next-line no-await-in-loop
        await loadPreview(uploadId)
      }
    }
  }

  async function handleValidate() {
    if (!workspaceId) return
    if (!selectedUploadIds.length) {
      setMessage({ type: 'error', text: 'Select at least one uploaded file to validate.' })
      return
    }
    setValidating(true)
    setMessage({ type: 'info', text: 'Validating selected Module 9 files and checking canonical mappings...' })
    try {
      await ensurePreviewsForSelection()
      const res = await fetch(`${API_URL}/m09/merge/validate`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ workspace: workspaceId, uploadIds: selectedUploadIds, mappingsByUpload }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) {
        setValidation(null)
        setMessage({ type: 'error', text: json?.error || 'Validation failed.' })
        return
      }
      setValidation({ canMerge: !!json.canMerge, files: Array.isArray(json.files) ? json.files : [] })
      setMessage({ type: json.canMerge ? 'success' : 'info', text: json.canMerge ? 'Validation passed. The selected files are ready to merge.' : 'Validation finished with issues. Review the warnings and errors before merging.' })
    } catch {
      setValidation(null)
      setMessage({ type: 'error', text: 'Validation could not be completed right now.' })
    } finally {
      setValidating(false)
    }
  }

  async function handleRunMerge() {
    if (!workspaceId) return
    if (!selectedUploadIds.length) {
      setMessage({ type: 'error', text: 'Select at least one uploaded file before running the merge.' })
      return
    }
    setRunningMerge(true)
    setMessage({ type: 'info', text: 'Normalizing selected campaign files and building the merged Module 9 dataset...' })
    try {
      const res = await fetch(`${API_URL}/m09/merge/run`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ workspace: workspaceId, uploadIds: selectedUploadIds, mappingsByUpload }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) {
        setMergeResult(null)
        setMessage({ type: 'error', text: json?.error || 'Merge failed.' })
        return
      }
      setMergeResult({
        mergedOutputId: json.mergedOutputId,
        title: json.title,
        rowCountBeforeMerge: json.rowCountBeforeMerge,
        rowCountAfterMerge: json.rowCountAfterMerge,
        duplicateCount: json.duplicateCount,
        mergedCount: json.mergedCount,
        warnings: Array.isArray(json.warnings) ? json.warnings : [],
        sampleRows: Array.isArray(json.sampleRows) ? json.sampleRows : [],
      })
      setMessage({ type: 'success', text: 'Module 9 merged dataset created successfully.' })
      await loadMergedOutputs()
    } catch {
      setMergeResult(null)
      setMessage({ type: 'error', text: 'Merge could not be completed right now.' })
    } finally {
      setRunningMerge(false)
    }
  }

  async function openMergedPreview(mergedId: string) {
    if (!workspaceId) return
    if (mergedDetailsById[mergedId]) {
      setPreviewMergedId(mergedId)
      return
    }

    setLoadingMergedPreviewId(mergedId)
    try {
      const params = new URLSearchParams({ workspace: workspaceId })
      const res = await fetch(`${API_URL}/m09/merged/${mergedId}?${params.toString()}`, { headers: getAuthHeaders() })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) {
        setMessage({ type: 'error', text: json?.error || 'Merged output preview could not be loaded.' })
        return
      }
      const detail: MergedOutputDetail = {
        item: json.item,
        headers: Array.isArray(json.headers) ? json.headers : [],
        sampleRows: Array.isArray(json.sampleRows) ? json.sampleRows : [],
        mergeSummary: json.mergeSummary || null,
        validationSummary: json.validationSummary || null,
      }
      setMergedDetailsById((current) => ({ ...current, [mergedId]: detail }))
      setPreviewMergedId(mergedId)
    } catch {
      setMessage({ type: 'error', text: 'Module 9 could not fetch the merged dataset preview.' })
    } finally {
      setLoadingMergedPreviewId(null)
    }
  }

  async function downloadMergedOutput(item: MergedOutputItem) {
    if (!workspaceId) return
    setDownloadingMergedId(item._id)
    try {
      const params = new URLSearchParams({ workspace: workspaceId })
      const res = await fetch(`${API_URL}/m09/merged/${item._id}/download?${params.toString()}`, {
        headers: getAuthHeaders(),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setMessage({ type: 'error', text: json?.error || 'Merged CSV download failed.' })
        return
      }
      const blob = await res.blob()
      const objectUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = item.filename || `${item.title}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(objectUrl)
      setMessage({ type: 'success', text: 'Merged Module 9 CSV download started.' })
    } catch {
      setMessage({ type: 'error', text: 'Merged CSV download could not be started.' })
    } finally {
      setDownloadingMergedId(null)
    }
  }

  return (
    <Layout>
      <main className="page-root" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ModuleBackButton toSuffix="/m09" label="Back" />
          <h2 style={{ marginTop: 16 }}>Module 9</h2>
        </div>

        <section style={heroStyle}>
          <div style={{ padding: 28 }}>
            <div style={heroEyebrow}>M09 Campaign Data Import</div>
            <h1 style={{ margin: '16px 0 8px', fontSize: 38, lineHeight: 1.05, fontWeight: 900, color: '#fff' }}>Campaign Data Import</h1>
            <div style={{ maxWidth: 860, color: 'rgba(255,255,255,0.84)', fontSize: 15, lineHeight: 1.7 }}>
              Upload raw campaign CSVs, preview detected headers, validate the selected source files, map source columns into the Module 9 canonical schema, normalize values, and merge them into one managed campaign dataset for later analytics and optimization workflows.
            </div>
          </div>
        </section>

        {message && <MessageBanner message={message} />}

        <section style={twoColumnStyle}>
          <div style={panelStyle}>
            <div style={pillStyle}>Upload</div>
            <h3 style={panelHeadingStyle}>Add a campaign CSV</h3>
            <div style={panelBodyStyle}>
              Upload uses the existing shared M01 storage with `module=m09`, so raw files remain workspace-aware while Module 9 manages the preview, validation, normalization, and merge flow.
            </div>
            <form onSubmit={handleUpload} style={{ display: 'grid', gap: 14 }}>
              <label style={inputCardStyle}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#0B2540' }}>Choose a CSV file</div>
                <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.65, color: '#5B6C8B' }}>
                  Raw files stay in the shared upload library. Module 9 processing starts after you select and validate them below.
                </div>
                <input type="file" accept=".csv,text/csv" onChange={(event) => setFile(event.target.files?.[0] || null)} style={{ marginTop: 14 }} />
                <div style={{ marginTop: 10, fontSize: 12, color: '#5B6C8B' }}>{file ? `Selected file: ${file.name}` : 'No file selected yet'}</div>
              </label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <button type="submit" className="btn-primary" disabled={uploading} style={buttonPrimaryStyle}>{uploading ? 'Uploading...' : 'Upload campaign CSV'}</button>
                <div style={{ fontSize: 12, color: '#5B6C8B' }}>Sends `file`, `workspace`, and `module=m09` to `POST /m01/uploads`.</div>
              </div>
            </form>
          </div>

          <div style={sidePanelStyle}>
            <div style={statusPillStyle}>Current Status</div>
            <h3 style={{ margin: '14px 0 10px', fontSize: 24, color: '#0B2540' }}>Feature 1 flow</h3>
            <div style={{ display: 'grid', gap: 12 }}>
              <StepCard step="1" title="Select raw source files" text="Use the Module 9 file library to choose multiple uploaded campaign CSVs for processing." />
              <StepCard step="2" title="Preview and map fields" text="Inspect headers, sample rows, inferred types, and source-to-canonical mappings for each file." />
              <StepCard step="3" title="Validate and merge" text="Normalize rows, detect duplicate campaign-period rows, and save one merged Module 9 dataset." />
            </div>
            <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
              <MetaTile label="Files" value={String(stats.count)} />
              <MetaTile label="Selected" value={String(stats.selected)} />
              <MetaTile label="Visible size" value={stats.totalSize} />
              <MetaTile label="Latest upload" value={stats.latest} />
            </div>
          </div>
        </section>

        <section style={panelStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 18 }}>
            <div>
              <div style={pillStyle}>Module 9 Files</div>
              <h3 style={{ margin: '12px 0 0', fontSize: 24, color: '#0B2540' }}>Uploaded campaign CSVs</h3>
            </div>
            <button className="btn-ghost" style={buttonGhostStyle} onClick={loadUploads}>Reload List</button>
          </div>

          {loading ? (
            <div style={{ display: 'grid', gap: 12 }}>
              <SkeletonBlock height={68} />
              <SkeletonBlock height={68} />
              <SkeletonBlock height={68} />
            </div>
          ) : uploads.length === 0 ? (
            <EmptyState title="No Module 9 files yet" text="Once a campaign CSV is uploaded with module=m09, it will appear here and can be selected for preview, validation, and merge." />
          ) : (
            <div style={{ overflowX: 'auto', borderRadius: 18, border: '1px solid rgba(15,66,88,0.08)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', background: 'rgba(255,255,255,0.96)' }}>
                <thead>
                  <tr>
                    <th style={tableHead}>Select</th>
                    <th style={tableHead}>File</th>
                    <th style={tableHead}>Uploaded</th>
                    <th style={tableHead}>Size</th>
                    <th style={tableHead}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {uploads.map((item) => {
                    const selected = selectedUploadIds.includes(item._id)
                    return (
                      <tr key={item._id} style={{ background: selected ? 'rgba(72,177,217,0.08)' : 'rgba(255,255,255,0.96)' }}>
                        <td style={tableCell}><input type="checkbox" checked={selected} onChange={() => toggleSelected(item._id)} /></td>
                        <td style={tableCellStrong}>
                          <div>{item.originalName || item.filename || 'Untitled CSV'}</div>
                          <div style={{ marginTop: 4, fontSize: 12, color: '#5B6C8B', fontWeight: 500 }}>
                            {item.metadata?.uploader?.fullName || item.metadata?.uploader?.email || 'Unknown uploader'}
                          </div>
                        </td>
                        <td style={tableCell}>{item.createdAt ? new Date(item.createdAt).toLocaleString() : 'Unknown date'}</td>
                        <td style={tableCell}>{formatBytes(item.length)}</td>
                        <td style={tableCell}>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button className="btn-ghost" style={smallGhostButtonStyle} onClick={() => void loadPreview(item._id)}>
                              {previewingId === item._id ? 'Loading...' : previewsByUpload[item._id] ? 'Open Preview' : 'Preview'}
                            </button>
                            <button className="btn-ghost" style={smallGhostButtonStyle} onClick={() => { toggleSelected(item._id); if (!previewsByUpload[item._id]) void loadPreview(item._id) }}>
                              {selected ? 'Deselect' : 'Select'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section style={twoColumnStyle}>
          <div style={panelStyle}>
            <div style={pillStyle}>Preview</div>
            <h3 style={panelHeadingStyle}>Selected file preview</h3>
            {!activePreview ? (
              <div style={panelBodyStyle}>Choose a selected upload and open its preview to inspect headers, inferred column types, sample rows, and suggested source mappings.</div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: '#0B2540' }}>{activePreview.fileName}</div>
                    <div style={{ marginTop: 6, fontSize: 13, color: '#5B6C8B' }}>
                      {activePreview.summary.rowCount} rows • {activePreview.summary.columnCount} columns • {formatBytes(activePreview.summary.fileSize)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {selectedUploadIds.map((uploadId) => (
                      <button
                        key={uploadId}
                        className="btn-ghost"
                        style={{ ...smallGhostButtonStyle, background: activeUploadId === uploadId ? 'rgba(72,177,217,0.16)' : smallGhostButtonStyle.background }}
                        onClick={() => void loadPreview(uploadId)}
                      >
                        {(uploads.find((item) => item._id === uploadId)?.originalName || uploads.find((item) => item._id === uploadId)?.filename || uploadId).slice(0, 20)}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                  <MetaTile label="Rows" value={String(activePreview.summary.rowCount)} />
                  <MetaTile label="Columns" value={String(activePreview.summary.columnCount)} />
                  <MetaTile label="Type" value={activePreview.summary.contentType || 'text/csv'} />
                </div>

                <div style={{ marginTop: 18, overflowX: 'auto', borderRadius: 18, border: '1px solid rgba(15,66,88,0.08)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
                    <thead>
                      <tr>
                        <th style={tableHead}>Header</th>
                        <th style={tableHead}>Inferred Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activePreview.headers.map((header) => (
                        <tr key={header}>
                          <td style={tableCellStrong}>{header}</td>
                          <td style={tableCell}>{activePreview.inferredTypes[header] || 'text'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: 18, overflowX: 'auto', borderRadius: 18, border: '1px solid rgba(15,66,88,0.08)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
                    <thead>
                      <tr>
                        {activePreview.headers.map((header) => <th key={header} style={tableHead}>{header}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {activePreview.sampleRows.length === 0 ? (
                        <tr><td style={tableCell} colSpan={Math.max(activePreview.headers.length, 1)}>No sample rows available.</td></tr>
                      ) : activePreview.sampleRows.map((row, rowIndex) => (
                        <tr key={`${activeUploadId}-row-${rowIndex}`}>
                          {activePreview.headers.map((header) => <td key={`${rowIndex}-${header}`} style={tableCell}>{row[header] || '—'}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          <div style={sidePanelStyle}>
            <div style={statusPillStyle}>Mapping</div>
            <h3 style={{ margin: '14px 0 10px', fontSize: 24, color: '#0B2540' }}>Canonical field mapping</h3>
            {!activePreview ? (
              <div style={panelBodyStyle}>Preview a file first to override its source-to-canonical column mapping.</div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {CANONICAL_FIELDS.map((field) => (
                  <label key={field} style={mappingRowStyle}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#0B2540' }}>{field}</div>
                      <div style={{ fontSize: 12, color: '#5B6C8B', marginTop: 2 }}>Map this canonical field to one source column.</div>
                    </div>
                    <select value={activeMapping[field] || ''} onChange={(event) => updateMapping(field, event.target.value)} style={mappingSelectStyle}>
                      <option value="">Leave unmapped</option>
                      {activePreview.headers.map((header) => <option key={`${field}-${header}`} value={header}>{header}</option>)}
                    </select>
                  </label>
                ))}
              </div>
            )}
          </div>
        </section>

        <section style={panelStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div>
              <div style={pillStyle}>Validation & Merge</div>
              <h3 style={{ margin: '12px 0 0', fontSize: 24, color: '#0B2540' }}>Prepare the merged campaign dataset</h3>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn-ghost" style={buttonGhostStyle} onClick={() => void handleValidate()} disabled={validating || runningMerge}>{validating ? 'Validating...' : 'Validate Selection'}</button>
              <button className="btn-primary" style={buttonPrimaryStyle} onClick={() => void handleRunMerge()} disabled={runningMerge || validating}>{runningMerge ? 'Merging...' : 'Run Merge'}</button>
            </div>
          </div>

          <div style={{ marginTop: 16, fontSize: 13, lineHeight: 1.7, color: '#5B6C8B' }}>
            Selected uploads are normalized into the Module 9 canonical campaign schema, then combined with duplicate detection based on campaign name, channel, and period window.
          </div>

          {validation ? (
            <div style={{ marginTop: 18, display: 'grid', gap: 14 }}>
              <StatusCard title={validation.canMerge ? 'Validation passed' : 'Validation found issues'} tone={validation.canMerge ? 'success' : 'info'}>
                {validation.canMerge ? 'All selected files contain enough mappable campaign data to contribute usable rows.' : 'Review each file below. Errors block merging, while warnings highlight rows or fields that were partially usable.'}
              </StatusCard>
              {validation.files.map((fileResult) => (
                <div key={fileResult.uploadId} style={validationCardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: 17, fontWeight: 900, color: '#0B2540' }}>{fileResult.fileName}</div>
                      <div style={{ marginTop: 6, fontSize: 13, color: '#5B6C8B' }}>
                        {fileResult.summary.usableRows} usable rows • {fileResult.summary.invalidRows} invalid rows • {fileResult.summary.totalRows} total rows
                      </div>
                    </div>
                    <span style={fileResult.valid ? successTagStyle : warningTagStyle}>{fileResult.valid ? 'Ready' : 'Needs Attention'}</span>
                  </div>
                  <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                    <MetaTile label="Mapped fields" value={String(fileResult.summary.mappedFields.length)} />
                    <MetaTile label="Missing canonical" value={String(fileResult.summary.missingCanonicalFields.length)} />
                    <MetaTile label="Unmapped source" value={String(fileResult.summary.unmappedFields.length)} />
                  </div>
                  {fileResult.issues.length > 0 && (
                    <div style={{ marginTop: 14, display: 'grid', gap: 8 }}>
                      {fileResult.issues.map((issue, index) => (
                        <div key={`${fileResult.uploadId}-${issue.code}-${index}`} style={issue.level === 'error' ? issueErrorStyle : issueWarningStyle}>
                          <strong>{issue.level === 'error' ? 'Error' : 'Warning'}:</strong> {issue.message}{issue.rowIndex ? ` (row ${issue.rowIndex})` : ''}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ marginTop: 18 }}>
              <EmptyState title="Validation has not run yet" text="Select files, preview them, adjust the mappings if needed, and then run validation to see file-level readiness and row-level warnings." compact />
            </div>
          )}

          {mergeResult && (
            <div style={{ marginTop: 18 }}>
              <StatusCard title="Merged output created" tone="success">
                {mergeResult.title} was saved as a Module 9 managed output. {mergeResult.rowCountBeforeMerge} normalized rows were reduced to {mergeResult.rowCountAfterMerge} rows after duplicate handling.
              </StatusCard>
              <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                <MetaTile label="Rows before" value={String(mergeResult.rowCountBeforeMerge)} />
                <MetaTile label="Rows after" value={String(mergeResult.rowCountAfterMerge)} />
                <MetaTile label="Duplicates merged" value={String(mergeResult.duplicateCount)} />
              </div>
              {mergeResult.warnings.length > 0 && (
                <div style={{ marginTop: 14, display: 'grid', gap: 8 }}>
                  {mergeResult.warnings.map((warning, index) => <div key={`merge-warning-${index}`} style={issueWarningStyle}>{warning}</div>)}
                </div>
              )}
            </div>
          )}
        </section>

        <section style={panelStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div>
              <div style={pillStyle}>Merged Outputs</div>
              <h3 style={{ margin: '12px 0 0', fontSize: 24, color: '#0B2540' }}>Saved Module 9 merged datasets</h3>
            </div>
            <button className="btn-ghost" style={buttonGhostStyle} onClick={loadMergedOutputs}>Reload Outputs</button>
          </div>

          {loadingMerged ? (
            <div style={{ marginTop: 18, display: 'grid', gap: 12 }}>
              <SkeletonBlock height={84} />
              <SkeletonBlock height={84} />
            </div>
          ) : mergedOutputs.length === 0 ? (
            <div style={{ marginTop: 18 }}>
              <EmptyState title="No merged outputs yet" text="Once a validation-ready selection is merged, the resulting normalized campaign dataset will appear here." compact />
            </div>
          ) : (
            <div style={{ marginTop: 18, display: 'grid', gap: 14 }}>
              {mergedOutputs.map((item) => (
                <div key={item._id} style={validationCardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: 17, fontWeight: 900, color: '#0B2540' }}>{item.title}</div>
                      <div style={{ marginTop: 6, fontSize: 13, color: '#5B6C8B' }}>{item.createdAt ? new Date(item.createdAt).toLocaleString() : 'Unknown date'}</div>
                    </div>
                    <span style={successTagStyle}>Stored</span>
                  </div>

                  <div style={mergedSectionDividerStyle} />

                  <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                    <MetaTile label="Rows before" value={String(item.rowCountBeforeMerge || 0)} />
                    <MetaTile label="Rows after" value={String(item.rowCountAfterMerge || 0)} />
                    <MetaTile label="Duplicates" value={String(item.duplicateCount || 0)} />
                  </div>

                  <div style={mergedSectionDividerStyle} />

                  <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button className="btn-ghost" style={buttonGhostStyle} onClick={() => void openMergedPreview(item._id)}>
                      {loadingMergedPreviewId === item._id ? 'Loading Preview...' : 'Preview'}
                    </button>
                    <button className="btn-primary" style={buttonPrimaryStyle} onClick={() => void downloadMergedOutput(item)} disabled={downloadingMergedId === item._id}>
                      {downloadingMergedId === item._id ? 'Downloading...' : 'Download CSV'}
                    </button>
                  </div>

                  <div style={mergedSectionDividerStyle} />

                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 15, fontWeight: 900, color: '#0B2540' }}>How this dataset was generated</div>
                    <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                      <TrustBullet text={`${item.sourceUploadIds?.length || 0} source file(s) were normalized into one Module 9 managed dataset.`} />
                      <TrustBullet text={`${item.duplicateCount || 0} duplicate campaign-period row(s) were merged after exact and fuzzy duplicate checks.`} />
                      <TrustBullet text={item.summary?.fuzzyThreshold || 'Duplicate handling uses normalized campaign names, matching channels, and a close period window.'} />
                      <TrustBullet text="Normalization cleans currency-like values, trims strings, standardizes dates, and fills derived launch weekday or hour buckets when possible." />
                      <TrustBullet text="Derived campaign metrics include CTR, CPL, ROI, and campaign duration days for downstream Module 9 analysis." />
                    </div>
                  </div>

                  {!!item.summary?.validationWarnings?.length && (
                    <>
                      <div style={mergedSectionDividerStyle} />
                      <div style={{ marginTop: 14 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#0B2540' }}>Validation carry-over</div>
                        <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
                          {item.summary.validationWarnings.slice(0, 3).map((warning, index) => (
                            <div key={`${item._id}-warning-${index}`} style={issueWarningStyle}>{warning}</div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {previewMergedId && mergedDetailsById[previewMergedId] && (
          <section style={modalOverlayStyle} onClick={() => setPreviewMergedId(null)}>
            <div style={modalCardStyle} onClick={(event) => event.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div>
                  <div style={pillStyle}>Merged Preview</div>
                  <h3 style={{ margin: '12px 0 0', fontSize: 24, color: '#0B2540' }}>{mergedDetailsById[previewMergedId].item.title}</h3>
                </div>
                <button className="btn-ghost" style={buttonGhostStyle} onClick={() => setPreviewMergedId(null)}>Close</button>
              </div>

              <div style={{ marginTop: 14, fontSize: 13, lineHeight: 1.7, color: '#5B6C8B' }}>
                This preview reads sample rows from the stored merged CSV in Module 9 storage so you can confirm the dataset structure before downloading or using it later.
              </div>

              <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                <MetaTile label="Rows before" value={String(mergedDetailsById[previewMergedId].item.rowCountBeforeMerge || 0)} />
                <MetaTile label="Rows after" value={String(mergedDetailsById[previewMergedId].item.rowCountAfterMerge || 0)} />
                <MetaTile label="Duplicates" value={String(mergedDetailsById[previewMergedId].mergeSummary?.duplicateCount || 0)} />
              </div>

              <div style={{ marginTop: 18, overflowX: 'auto', borderRadius: 18, border: '1px solid rgba(15,66,88,0.08)', maxHeight: '52vh' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
                  <thead>
                    <tr>
                      {mergedDetailsById[previewMergedId].headers.map((header) => <th key={header} style={tableHead}>{header}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {mergedDetailsById[previewMergedId].sampleRows.length === 0 ? (
                      <tr><td style={tableCell} colSpan={Math.max(mergedDetailsById[previewMergedId].headers.length, 1)}>No sample rows available.</td></tr>
                    ) : mergedDetailsById[previewMergedId].sampleRows.map((row, rowIndex) => (
                      <tr key={`${previewMergedId}-merged-row-${rowIndex}`}>
                        {mergedDetailsById[previewMergedId].headers.map((header) => <td key={`${rowIndex}-${header}`} style={tableCell}>{row[header] || '-'}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}
      </main>
    </Layout>
  )
}

function MessageBanner({ message }: { message: NonNullable<MessageState> }) {
  return (
    <section style={{
      marginTop: 18,
      borderRadius: 16,
      padding: 14,
      fontSize: 13,
      lineHeight: 1.7,
      background: message.type === 'error' ? 'rgba(190,24,93,0.10)' : message.type === 'success' ? 'rgba(15,118,110,0.10)' : 'rgba(36,83,166,0.10)',
      border: message.type === 'error' ? '1px solid rgba(190,24,93,0.18)' : message.type === 'success' ? '1px solid rgba(15,118,110,0.18)' : '1px solid rgba(36,83,166,0.18)',
      color: message.type === 'error' ? '#9D174D' : message.type === 'success' ? '#0F766E' : '#2453A6',
    }}>{message.text}</section>
  )
}

function StepCard({ step, title, text }: { step: string; title: string; text: string }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div style={{ width: 34, height: 34, borderRadius: 12, background: 'linear-gradient(135deg, #0f4258 0%, #2b6f8a 100%)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 900, flexShrink: 0 }}>{step}</div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#0B2540', marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 13, color: '#415274', lineHeight: 1.7 }}>{text}</div>
      </div>
    </div>
  )
}

function MetaTile({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ borderRadius: 16, padding: 14, background: 'rgba(244,248,252,0.95)', border: '1px solid rgba(15,66,88,0.07)' }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5B6C8B' }}>{label}</div>
      <div style={{ marginTop: 8, fontSize: 18, fontWeight: 900, color: '#0B2540' }}>{value}</div>
    </div>
  )
}

function SkeletonBlock({ height }: { height: number }) {
  return <div style={{ height, borderRadius: 18, background: 'linear-gradient(90deg, rgba(232,237,243,0.9), rgba(244,247,250,1), rgba(232,237,243,0.9))', border: '1px solid rgba(15,66,88,0.06)' }} />
}

function EmptyState({ title, text, compact = false }: { title: string; text: string; compact?: boolean }) {
  return (
    <div style={{ borderRadius: 20, padding: compact ? 20 : 24, background: 'linear-gradient(180deg, rgba(247,250,253,0.98), rgba(255,255,255,1))', border: '1px dashed rgba(15,66,88,0.18)' }}>
      <div style={{ display: 'inline-flex', padding: '6px 11px', borderRadius: 999, background: 'rgba(72,177,217,0.12)', color: '#0B2540', fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Empty State</div>
      <h3 style={{ margin: '14px 0 8px', fontSize: 24, color: '#0B2540' }}>{title}</h3>
      <div style={{ maxWidth: 760, fontSize: 14, lineHeight: 1.75, color: '#415274' }}>{text}</div>
    </div>
  )
}

function StatusCard({ title, tone, children }: { title: string; tone: 'success' | 'info'; children: React.ReactNode }) {
  const bg = tone === 'success' ? 'rgba(15,118,110,0.10)' : 'rgba(36,83,166,0.10)'
  const border = tone === 'success' ? '1px solid rgba(15,118,110,0.18)' : '1px solid rgba(36,83,166,0.18)'
  const color = tone === 'success' ? '#0F766E' : '#2453A6'
  return (
    <div style={{ borderRadius: 18, padding: 16, background: bg, border }}>
      <div style={{ fontSize: 15, fontWeight: 900, color }}>{title}</div>
      <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.7, color }}>{children}</div>
    </div>
  )
}

function TrustBullet({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <div style={{ width: 8, height: 8, borderRadius: 999, background: '#2b6f8a', marginTop: 7, flexShrink: 0 }} />
      <div style={{ fontSize: 13, lineHeight: 1.7, color: '#415274' }}>{text}</div>
    </div>
  )
}

const heroStyle: React.CSSProperties = { marginTop: 18, borderRadius: 24, overflow: 'hidden', border: '1px solid rgba(15,66,88,0.08)', boxShadow: '0 20px 46px rgba(13,30,60,0.08)', background: 'linear-gradient(135deg, rgba(18,59,87,0.98) 0%, rgba(15,66,88,0.94) 52%, rgba(72,177,217,0.24) 100%)', color: '#fff' }
const heroEyebrow: React.CSSProperties = { display: 'inline-flex', padding: '7px 12px', borderRadius: 999, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.16)', fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }
const twoColumnStyle: React.CSSProperties = { marginTop: 18, display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 18, alignItems: 'start' }
const panelStyle: React.CSSProperties = { marginTop: 18, borderRadius: 22, padding: 22, background: 'linear-gradient(180deg, rgba(255,255,255,1), rgba(247,250,253,0.98))', border: '1px solid rgba(15,66,88,0.08)', boxShadow: '0 16px 38px rgba(13,30,60,0.06)' }
const sidePanelStyle: React.CSSProperties = { borderRadius: 22, padding: 22, background: 'linear-gradient(180deg, rgba(243,248,252,0.98), rgba(255,255,255,1))', border: '1px solid rgba(15,66,88,0.08)', boxShadow: '0 16px 38px rgba(13,30,60,0.05)' }
const pillStyle: React.CSSProperties = { display: 'inline-flex', padding: '6px 11px', borderRadius: 999, background: 'rgba(15,66,88,0.08)', color: 'var(--header-secondary)', fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }
const statusPillStyle: React.CSSProperties = { display: 'inline-flex', padding: '6px 11px', borderRadius: 999, background: 'rgba(72,177,217,0.12)', color: '#0B2540', fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }
const panelHeadingStyle: React.CSSProperties = { margin: '14px 0 12px', fontSize: 28, color: '#0B2540' }
const panelBodyStyle: React.CSSProperties = { fontSize: 14, color: '#415274', lineHeight: 1.7, marginBottom: 16 }
const inputCardStyle: React.CSSProperties = { display: 'block', borderRadius: 18, padding: 18, background: 'linear-gradient(180deg, rgba(244,248,252,0.95), rgba(255,255,255,1))', border: '1px dashed rgba(15,66,88,0.20)' }
const buttonPrimaryStyle: React.CSSProperties = { borderRadius: 12, padding: '10px 14px', fontWeight: 800 }
const buttonGhostStyle: React.CSSProperties = { borderRadius: 12, padding: '9px 12px', fontWeight: 800 }
const smallGhostButtonStyle: React.CSSProperties = { borderRadius: 10, padding: '8px 10px', fontWeight: 800, fontSize: 12, background: 'rgba(244,248,252,0.96)' }
const mappingRowStyle: React.CSSProperties = { display: 'grid', gap: 8, padding: 12, borderRadius: 16, background: 'rgba(244,248,252,0.95)', border: '1px solid rgba(15,66,88,0.07)' }
const mappingSelectStyle: React.CSSProperties = { width: '100%', borderRadius: 12, border: '1px solid rgba(15,66,88,0.16)', padding: '10px 12px', fontSize: 13, color: '#0B2540', background: '#fff' }
const validationCardStyle: React.CSSProperties = { borderRadius: 18, padding: 18, background: 'rgba(255,255,255,0.96)', border: '1px solid rgba(15,66,88,0.08)' }
const successTagStyle: React.CSSProperties = { display: 'inline-flex', padding: '6px 10px', borderRadius: 999, background: 'rgba(15,118,110,0.12)', color: '#0F766E', fontSize: 12, fontWeight: 800, textTransform: 'uppercase' }
const warningTagStyle: React.CSSProperties = { ...successTagStyle, background: 'rgba(36,83,166,0.10)', color: '#2453A6' }
const issueErrorStyle: React.CSSProperties = { borderRadius: 14, padding: 12, fontSize: 13, lineHeight: 1.65, background: 'rgba(190,24,93,0.08)', border: '1px solid rgba(190,24,93,0.14)', color: '#9D174D' }
const issueWarningStyle: React.CSSProperties = { borderRadius: 14, padding: 12, fontSize: 13, lineHeight: 1.65, background: 'rgba(36,83,166,0.08)', border: '1px solid rgba(36,83,166,0.12)', color: '#2453A6' }
const mergedSectionDividerStyle: React.CSSProperties = { marginTop: 16, borderTop: '1px solid rgba(15,66,88,0.08)' }
const modalOverlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(11,37,64,0.24)', display: 'grid', placeItems: 'center', padding: 24, zIndex: 50 }
const modalCardStyle: React.CSSProperties = { width: 'min(1120px, 96vw)', maxHeight: '86vh', overflow: 'auto', borderRadius: 24, padding: 24, background: 'linear-gradient(180deg, rgba(255,255,255,1), rgba(247,250,253,0.98))', border: '1px solid rgba(15,66,88,0.08)', boxShadow: '0 24px 52px rgba(13,30,60,0.16)' }
const tableHead: React.CSSProperties = { textAlign: 'left', fontSize: 12, color: '#5B6C8B', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '14px 16px', borderBottom: '1px solid rgba(15,66,88,0.08)', background: 'rgba(244,248,252,0.95)' }
const tableCell: React.CSSProperties = { padding: '14px 16px', borderBottom: '1px solid rgba(15,66,88,0.08)', fontSize: 13, color: '#415274', verticalAlign: 'top' }
const tableCellStrong: React.CSSProperties = { ...tableCell, color: '#0B2540', fontWeight: 800 }
