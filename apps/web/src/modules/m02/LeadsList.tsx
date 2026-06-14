/**
 * Module: Intent Signals (m02)
 * Layer: Frontend
 * File: LeadsList.tsx
 * Purpose: Supports the L ea ds Li st flow for this module.
 * Notes: Documentation header added for maintainability.
 */

import { useEffect, useMemo, useState } from 'react'
import Layout from '../../components/Layout'
import ModuleBackButton from '../../components/ModuleBackButton'
import { getWorkspaceIdFromHash } from '../../utils/workspace'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

const shellCard = {
  borderRadius: 22,
  background: 'linear-gradient(180deg, rgba(255,255,255,1), rgba(247,250,253,0.98))',
  border: '1px solid rgba(15,66,88,0.08)',
  boxShadow: '0 16px 38px rgba(13,30,60,0.06)',
}

const fieldWrapStyle = { display: 'grid', gap: 6 } as const
const fieldLabelStyle = { fontSize: 13, color: '#415274', fontWeight: 700 } as const
const compactInputStyle = {
  width: '100%',
  minWidth: 0,
  height: 42,
  padding: '0 14px',
  borderRadius: 12,
  border: '1px solid rgba(15,66,88,0.16)',
  background: 'linear-gradient(180deg, #ffffff 0%, #f6fafc 100%)',
  color: '#0B2540',
  boxSizing: 'border-box' as const,
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)',
}
const compactButtonStyle = { minWidth: 118, height: 42, width: 'auto', alignSelf: 'end', whiteSpace: 'nowrap' as const }
const neutralButtonStyle = {
  ...compactButtonStyle,
  padding: '0 18px',
  borderRadius: 12,
  border: '1px solid rgba(15,66,88,0.12)',
  background: 'linear-gradient(180deg, #ffffff 0%, #eef5fa 100%)',
  color: '#0f4258',
  fontWeight: 800,
  boxShadow: '0 8px 18px rgba(13,30,60,0.05)',
}

export default function LeadsListM02() {
  const [workspace] = useState<string | null>(() => getWorkspaceIdFromHash())
  const [items, setItems] = useState<any[]>([])
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<'createdAt_desc' | 'createdAt_asc' | 'name_asc' | 'name_desc'>('createdAt_desc')
  const [message, setMessage] = useState<string | null>(null)
  const [retryAction, setRetryAction] = useState<null | (() => void)>(null)
  const [details, setDetails] = useState<any | null>(null)
  const [mergedOptions, setMergedOptions] = useState<any[]>([])
  const [selMerged, setSelMerged] = useState<string>('')
  const [newName, setNewName] = useState<string>('')
  const [creating, setCreating] = useState(false)

  useEffect(() => { void fetchList(); void fetchMerged() }, [workspace, sort])

  const setPreviewReturn = () => {
    try { sessionStorage.setItem('m02_preview_return', window.location.hash || '') } catch (_) {}
  }

  async function fetchList() {
    if (!workspace) return setMessage('Workspace required')
    try {
      const res = await fetch(`${API_URL}/m01/leads?workspace=${workspace}&outputKind=m02&sort=${sort}${q ? `&q=${encodeURIComponent(q)}` : ''}`)
      const j = await res.json()
      if (j?.ok) {
        const nextItems = Array.isArray(j.items) ? j.items : []
        if (nextItems.length) {
          setItems(nextItems)
        } else {
          const fallbackRes = await fetch(`${API_URL}/m01/leads?workspace=${workspace}&sort=${sort}${q ? `&q=${encodeURIComponent(q)}` : ''}`)
          const fallbackJson = await fallbackRes.json()
          const fallbackItems = Array.isArray(fallbackJson?.items) ? fallbackJson.items : []
          setItems(fallbackItems.filter((item: any) => /intent|m02|priorit/i.test(`${item?.name || ''} ${item?.filename || ''}`.toLowerCase())))
        }
      }
      else setMessage(j?.error || 'failed to load')
    } catch (_) {
      setMessage('network error')
    }
  }

  async function fetchMerged() {
    if (!workspace) return
    try {
      const res = await fetch(`${API_URL}/m01/merges?workspace=${workspace}&sort=createdAt_desc`)
      const j = await res.json()
      if (j?.ok) setMergedOptions(j.items || [])
    } catch (_) {}
  }

  async function createLeads() {
    if (!workspace) return setMessage('Workspace required')
    if (!selMerged) return setMessage('Select a merged CSV')
    setRetryAction(null)
    setCreating(true)
    setMessage(null)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_URL}/m01/leads/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ workspace, mergedId: selMerged, name: newName, moduleKey: 'm02' }),
      })
      const j = await res.json()
      if (j?.ok) {
        setNewName('')
        setSelMerged('')
        await fetchList()
      } else {
        setMessage(j?.error || 'failed to generate')
        setRetryAction(() => createLeads)
      }
    } catch (_) {
      setMessage('network error')
      setRetryAction(() => createLeads)
    }
    setCreating(false)
  }

  const rows = useMemo(() => items, [items])

  return (
    <Layout>
      <main className="page-root" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ModuleBackButton toSuffix="/m02" />
        </div>

        <section style={{ ...shellCard, marginTop: 18, overflow: 'hidden', background: 'linear-gradient(135deg, rgba(18,59,87,0.98) 0%, rgba(15,66,88,0.94) 52%, rgba(72,177,217,0.24) 100%)', color: '#fff' }}>
          <div style={{ padding: 28 }}>
            <div style={{ display: 'inline-flex', padding: '7px 12px', borderRadius: 999, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.16)', fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Intent View
            </div>
            <h1 style={{ margin: '16px 0 8px', fontSize: 38, lineHeight: 1.05, fontWeight: 900 }}>Final Intent-Scored CSVs</h1>
            <div style={{ maxWidth: 780, color: 'rgba(255,255,255,0.84)', fontSize: 15, lineHeight: 1.7 }}>
              Review only the CatBoost intent outputs generated by Intent Signals, create a new final intent-scored CSV from a merged dataset, and inspect hot-intent records before prioritization.
            </div>
          </div>
        </section>

        <section style={{ ...shellCard, marginTop: 18, padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'inline-flex', padding: '6px 11px', borderRadius: 999, background: 'rgba(15,66,88,0.08)', color: 'var(--header-secondary)', fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Create Output
              </div>
              <h3 style={{ margin: '14px 0 8px', fontSize: 28, color: '#0B2540' }}>Build a new intent-scored CSV</h3>
            </div>
            <div style={{ fontSize: 13, color: '#5B6C8B', fontWeight: 700 }}>{rows.length} M02 outputs visible</div>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap', marginTop: 10 }}>
            <label style={{ ...fieldWrapStyle, flex: '0 1 240px' }}>
              <span style={fieldLabelStyle}>Optional output name</span>
              <input placeholder="Name (optional)" value={newName} onChange={(e) => setNewName(e.target.value)} style={compactInputStyle} />
            </label>
            <label style={{ ...fieldWrapStyle, flex: '1 1 420px' }}>
              <span style={fieldLabelStyle}>Source merged CSV</span>
              <select value={selMerged} onChange={(e) => setSelMerged(e.target.value)} style={compactInputStyle}>
                <option value="">Select a merged CSV...</option>
                {mergedOptions.map((m: any) => (
                  <option key={m._id} value={m._id}>{m.name || m.filename}</option>
                ))}
              </select>
            </label>
            <button className="btn-primary" disabled={creating || !selMerged} onClick={createLeads} style={compactButtonStyle}>
              {creating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </section>

        <section style={{ ...shellCard, marginTop: 18, padding: 22 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
            <label style={{ ...fieldWrapStyle, flex: '1 1 320px' }}>
              <span style={fieldLabelStyle}>Search output files</span>
              <input placeholder="Search name or filename" value={q} onChange={(e) => setQ(e.target.value)} style={compactInputStyle} />
            </label>
            <button type="button" onClick={fetchList} style={{ ...neutralButtonStyle, minWidth: 110 }}>Search</button>
            <label style={{ ...fieldWrapStyle, flex: '0 1 220px' }}>
              <span style={fieldLabelStyle}>Sort</span>
              <select value={sort} onChange={(e) => setSort(e.target.value as any)} style={compactInputStyle}>
                <option value="createdAt_desc">Newest first</option>
                <option value="createdAt_asc">Oldest first</option>
                <option value="name_asc">Name A-Z</option>
                <option value="name_desc">Name Z-A</option>
              </select>
            </label>
          </div>
          {message ? (
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, color: '#7A2133' }}>
              <span>{message}</span>
              {retryAction ? <button className="btn-ghost btn-sm" onClick={retryAction}>Retry</button> : null}
            </div>
          ) : null}
        </section>

        <section style={{ ...shellCard, marginTop: 18, padding: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'inline-flex', padding: '6px 11px', borderRadius: 999, background: 'rgba(72,177,217,0.12)', color: '#0B2540', fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Output Library
              </div>
              <h3 style={{ margin: '14px 0 6px', fontSize: 28, color: '#0B2540' }}>Intent Signals outputs</h3>
              <div style={{ fontSize: 13, color: '#415274', lineHeight: 1.7 }}>
                Only Module 2 intent-scored outputs are shown here.
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
            {rows.map((m: any) => (
              <div key={m._id} style={{ borderRadius: 18, border: '1px solid rgba(15,66,88,0.08)', background: 'linear-gradient(180deg, rgba(255,255,255,1), rgba(248,251,254,0.98))', boxShadow: '0 10px 24px rgba(13,30,60,0.04)', padding: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#0B2540' }}>{m.name || m.filename}</div>
                  <div style={{ marginTop: 6, fontSize: 13, color: '#5B6C8B' }}>{new Date(m.createdAt).toLocaleString()}</div>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button type="button" className="btn-primary" onClick={() => {
                    setPreviewReturn()
                    if (workspace) window.location.hash = `#/workspace/${workspace}/m02/leads/preview/${m._id}`
                    else window.location.hash = `#/m02/leads/preview/${m._id}`
                  }}>Preview</button>
                  <button type="button" className="btn-ghost" onClick={async () => {
                    const res = await fetch(`${API_URL}/m01/leads/${m._id}?workspace=${workspace}`)
                    const j = await res.json()
                    if (j?.ok) setDetails(j.item)
                    else setMessage('failed to load details')
                  }}>Details</button>
                </div>
              </div>
            ))}
            {!rows.length ? <div style={{ borderRadius: 18, border: '1px dashed rgba(15,66,88,0.18)', padding: 22, color: '#5B6C8B' }}>No Module 2 final outputs are visible yet.</div> : null}
          </div>
        </section>

        {details ? (
          <div className="modal-overlay" onClick={() => setDetails(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3>Intent-scored CSV details</h3>
              <div><strong>Name:</strong> {details.name || details.filename}</div>
              <div><strong>Created by:</strong> {details.createdBy?.fullName || details.createdBy?.email || 'Unknown'}</div>
              <div><strong>Created at:</strong> {new Date(details.createdAt).toLocaleString()}</div>
              <div><strong>Source merged:</strong> {details.mergedId}</div>
              <div className="mt-12"><button type="button" onClick={() => setDetails(null)}>Close</button></div>
            </div>
          </div>
        ) : null}
      </main>
    </Layout>
  )
}
