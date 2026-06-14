/**
 * Module: Campaign Performance Optimization (m09)
 * Layer: Frontend
 * File: Module9CampaignImportPage.tsx
 * Purpose: Supports the M od ul e9 Ca mp ai gn Im po rt Pa ge flow for this module.
 * Notes: Documentation header added for maintainability.
 */

export { default } from './Module9CampaignImportFlow'
/*
import type React from 'react'
import { useEffect, useMemo, useState } from 'react'
import Layout from '../../components/Layout'
import ModuleBackButton from '../../components/ModuleBackButton'
import { getWorkspaceIdFromHash } from '../../utils/workspace'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

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

export default function Module9CampaignImportPage() {
  const workspaceId = getWorkspaceIdFromHash()
  const [file, setFile] = useState<File | null>(null)
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{ type: 'info' | 'success' | 'error'; text: string } | null>(null)

  async function loadUploads() {
    if (!workspaceId) {
      setLoading(false)
      setMessage({ type: 'error', text: 'Workspace context is missing. Open Campaign Intelligence from inside a workspace.' })
      return
    }

    setLoading(true)
    try {
      const params = new URLSearchParams({ workspace: workspaceId, module: 'm09' })
      const res = await fetch(`${API_URL}/m01/uploads?${params.toString()}`, { headers: getAuthHeaders() })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) {
        setUploads([])
        setMessage({ type: 'error', text: json?.error || 'Campaign Intelligence could not load the current campaign upload list.' })
        return
      }
      setUploads(Array.isArray(json.items) ? json.items : [])
    } catch {
      setUploads([])
      setMessage({ type: 'error', text: 'Campaign Intelligence could not reach the shared upload service right now.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUploads()
  }, [workspaceId])

  const stats = useMemo(() => {
    const totalBytes = uploads.reduce((sum, item) => sum + (Number(item.length) || 0), 0)
    return {
      count: uploads.length,
      totalSize: formatBytes(totalBytes),
      latest: uploads[0]?.createdAt ? new Date(uploads[0].createdAt).toLocaleDateString() : 'No uploads yet',
    }
  }, [uploads])

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
    setMessage({ type: 'info', text: 'Uploading campaign CSV to the shared campaign file library...' })

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
      setMessage({ type: 'success', text: 'Campaign CSV uploaded for Campaign Intelligence.' })
      await loadUploads()
    } catch {
      setMessage({ type: 'error', text: 'Upload failed before the shared service could confirm the file.' })
    } finally {
      setUploading(false)
    }
  }

  return (
    <Layout>
      <main className="page-root" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ModuleBackButton toSuffix="/m09" label="Back" />
          <h2 style={{ marginTop: 16 }}>Campaign Intelligence & What-If Simulation</h2>
        </div>

        <section
          style={{
            marginTop: 18,
            borderRadius: 24,
            overflow: 'hidden',
            border: '1px solid rgba(15,66,88,0.08)',
            boxShadow: '0 20px 46px rgba(13,30,60,0.08)',
            background: 'linear-gradient(135deg, rgba(18,59,87,0.98) 0%, rgba(15,66,88,0.94) 52%, rgba(72,177,217,0.24) 100%)',
            color: '#fff',
          }}
        >
          <div style={{ padding: 28 }}>
            <div style={{ display: 'inline-flex', padding: '7px 12px', borderRadius: 999, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.16)', fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Campaign Data Import
            </div>
            <h1 style={{ margin: '16px 0 8px', fontSize: 38, lineHeight: 1.05, fontWeight: 900, color: '#fff' }}>Campaign Data Import</h1>
            <div style={{ maxWidth: 800, color: 'rgba(255,255,255,0.84)', fontSize: 15, lineHeight: 1.7 }}>
              Upload campaign performance CSV files into the shared workspace upload system. This first step focuses on storing and listing campaign source files before preview mapping, normalization, and merge workflows.
            </div>
          </div>
        </section>

        {message && (
          <section
            style={{
              marginTop: 18,
              borderRadius: 16,
              padding: 14,
              fontSize: 13,
              lineHeight: 1.7,
              background: message.type === 'error'
                ? 'rgba(190,24,93,0.10)'
                : message.type === 'success'
                  ? 'rgba(15,118,110,0.10)'
                  : 'rgba(36,83,166,0.10)',
              border: message.type === 'error'
                ? '1px solid rgba(190,24,93,0.18)'
                : message.type === 'success'
                  ? '1px solid rgba(15,118,110,0.18)'
                  : '1px solid rgba(36,83,166,0.18)',
              color: message.type === 'error'
                ? '#9D174D'
                : message.type === 'success'
                  ? '#0F766E'
                  : '#2453A6',
            }}
          >
            {message.text}
          </section>
        )}

        <section
          style={{
            marginTop: 18,
            display: 'grid',
            gridTemplateColumns: '1.2fr 1fr',
            gap: 18,
            alignItems: 'start',
          }}
        >
          <div
            style={{
              borderRadius: 22,
              padding: 22,
              background: 'linear-gradient(180deg, rgba(255,255,255,1), rgba(247,250,253,0.98))',
              border: '1px solid rgba(15,66,88,0.08)',
              boxShadow: '0 16px 38px rgba(13,30,60,0.06)',
            }}
          >
            <div style={{ display: 'inline-flex', padding: '6px 11px', borderRadius: 999, background: 'rgba(15,66,88,0.08)', color: 'var(--header-secondary)', fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Upload
            </div>
            <h3 style={{ margin: '14px 0 12px', fontSize: 28, color: '#0B2540' }}>Add a campaign CSV</h3>
            <div style={{ fontSize: 14, color: '#415274', lineHeight: 1.7, marginBottom: 16 }}>
              Use this page to send campaign source files to the existing workspace upload service. The file will then appear in the campaign upload list below.
            </div>

            <form onSubmit={handleUpload} style={{ display: 'grid', gap: 14 }}>
              <label
                style={{
                  display: 'block',
                  borderRadius: 18,
                  padding: 18,
                  background: 'linear-gradient(180deg, rgba(244,248,252,0.95), rgba(255,255,255,1))',
                  border: '1px dashed rgba(15,66,88,0.20)',
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 800, color: '#0B2540' }}>Choose a CSV file</div>
                <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.65, color: '#5B6C8B' }}>
                  This step stores raw campaign files for Campaign Intelligence. Preview, mapping, normalization, and merge logic build on this file library.
                </div>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(event) => setFile(event.target.files?.[0] || null)}
                  style={{ marginTop: 14 }}
                />
                <div style={{ marginTop: 10, fontSize: 12, color: '#5B6C8B' }}>
                  {file ? `Selected file: ${file.name}` : 'No file selected yet'}
                </div>
              </label>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <button type="submit" className="btn-primary" disabled={uploading} style={{ borderRadius: 12, padding: '10px 14px', fontWeight: 800 }}>
                  {uploading ? 'Uploading...' : 'Upload campaign CSV'}
                </button>
                <div style={{ fontSize: 12, color: '#5B6C8B' }}>
                  Upload sends `file`, `workspace`, and `module=m09` to the existing backend upload endpoint.
                </div>
              </div>
            </form>
          </div>

          <div
            style={{
              borderRadius: 22,
              padding: 22,
              background: 'linear-gradient(180deg, rgba(243,248,252,0.98), rgba(255,255,255,1))',
              border: '1px solid rgba(15,66,88,0.08)',
              boxShadow: '0 16px 38px rgba(13,30,60,0.05)',
            }}
          >
            <div style={{ display: 'inline-flex', padding: '6px 11px', borderRadius: 999, background: 'rgba(72,177,217,0.12)', color: '#0B2540', fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Current Status
            </div>
            <h3 style={{ margin: '14px 0 10px', fontSize: 24, color: '#0B2540' }}>What this page covers</h3>
            <div style={{ display: 'grid', gap: 12 }}>
              <StepCard step="1" title="Upload campaign files" text="Store raw campaign CSVs without creating a separate upload system." />
              <StepCard step="2" title="Review the campaign file list" text="See every workspace file already tagged for Campaign Intelligence in one focused list." />
              <StepCard step="3" title="Prepare for normalization later" text="This page deliberately stops before preview mapping, schema validation, normalization, and merge." />
            </div>

            <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
              <MetaTile label="Files" value={String(stats.count)} />
              <MetaTile label="Visible size" value={stats.totalSize} />
              <MetaTile label="Latest upload" value={stats.latest} />
            </div>
          </div>
        </section>

        <section
          style={{
            marginTop: 18,
            borderRadius: 22,
            padding: 22,
            background: 'linear-gradient(180deg, rgba(255,255,255,1), rgba(247,250,253,0.98))',
            border: '1px solid rgba(15,66,88,0.08)',
            boxShadow: '0 16px 38px rgba(13,30,60,0.06)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 18 }}>
            <div>
              <div style={{ display: 'inline-flex', padding: '6px 11px', borderRadius: 999, background: 'rgba(15,66,88,0.08)', color: 'var(--header-secondary)', fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Campaign Files
              </div>
              <h3 style={{ margin: '12px 0 0', fontSize: 24, color: '#0B2540' }}>Uploaded campaign CSVs</h3>
            </div>
            <button className="btn-ghost" style={{ borderRadius: 12, padding: '9px 12px', fontWeight: 800 }} onClick={loadUploads}>
              Reload List
            </button>
          </div>

          {loading ? (
            <div style={{ display: 'grid', gap: 12 }}>
              <SkeletonBlock height={68} />
              <SkeletonBlock height={68} />
              <SkeletonBlock height={68} />
            </div>
          ) : uploads.length === 0 ? (
            <div
              style={{
                borderRadius: 20,
                padding: 24,
                background: 'linear-gradient(180deg, rgba(247,250,253,0.98), rgba(255,255,255,1))',
                border: '1px dashed rgba(15,66,88,0.18)',
              }}
            >
              <div style={{ display: 'inline-flex', padding: '6px 11px', borderRadius: 999, background: 'rgba(72,177,217,0.12)', color: '#0B2540', fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Empty State
              </div>
              <h3 style={{ margin: '14px 0 8px', fontSize: 24, color: '#0B2540' }}>No campaign files yet</h3>
              <div style={{ maxWidth: 680, fontSize: 14, lineHeight: 1.75, color: '#415274' }}>
                Once a campaign CSV is uploaded, it will appear here. This list only shows Campaign Intelligence files for the current workspace.
              </div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto', borderRadius: 18, border: '1px solid rgba(15,66,88,0.08)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', background: 'rgba(255,255,255,0.96)' }}>
                <thead>
                  <tr>
                    <th style={tableHead}>File</th>
                    <th style={tableHead}>Uploaded</th>
                    <th style={tableHead}>Module</th>
                    <th style={tableHead}>Size</th>
                    <th style={tableHead}>Uploaded by</th>
                  </tr>
                </thead>
                <tbody>
                  {uploads.map((item) => (
                    <tr key={item._id} style={{ background: 'rgba(255,255,255,0.96)' }}>
                      <td style={tableCellStrong}>
                        <div>{item.originalName || item.filename || 'Untitled CSV'}</div>
                        <div style={{ marginTop: 4, fontSize: 12, color: '#5B6C8B', fontWeight: 500 }}>Campaign source file</div>
                      </td>
                      <td style={tableCell}>{item.createdAt ? new Date(item.createdAt).toLocaleString() : 'Unknown date'}</td>
                      <td style={tableCell}>
                        <span
                          style={{
                            display: 'inline-flex',
                            padding: '6px 10px',
                            borderRadius: 999,
                            background: 'rgba(15,118,110,0.12)',
                            color: '#0F766E',
                            fontSize: 12,
                            fontWeight: 800,
                            textTransform: 'uppercase',
                          }}
                        >
                          {item.module || 'm01'}
                        </span>
                      </td>
                      <td style={tableCell}>{formatBytes(item.length)}</td>
                      <td style={tableCell}>{item.metadata?.uploader?.fullName || item.metadata?.uploader?.email || 'Unknown'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </Layout>
  )
}

function StepCard({ step, title, text }: { step: string; title: string; text: string }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div style={{ width: 34, height: 34, borderRadius: 12, background: 'linear-gradient(135deg, #0f4258 0%, #2b6f8a 100%)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 900, flexShrink: 0 }}>
        {step}
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#0B2540', marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 13, color: '#415274', lineHeight: 1.7 }}>{text}</div>
      </div>
    </div>
  )
}

function MetaTile({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        borderRadius: 16,
        padding: 14,
        background: 'rgba(244,248,252,0.95)',
        border: '1px solid rgba(15,66,88,0.07)',
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5B6C8B' }}>
        {label}
      </div>
      <div style={{ marginTop: 8, fontSize: 18, fontWeight: 900, color: '#0B2540' }}>{value}</div>
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

const tableHead: React.CSSProperties = {
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

const tableCell: React.CSSProperties = {
  padding: '14px 16px',
  borderBottom: '1px solid rgba(15,66,88,0.08)',
  fontSize: 13,
  color: '#415274',
  verticalAlign: 'top',
}

const tableCellStrong: React.CSSProperties = {
  ...tableCell,
  color: '#0B2540',
  fontWeight: 800,
}
*/
