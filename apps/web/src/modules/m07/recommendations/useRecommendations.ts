import { useEffect, useState, useCallback } from 'react'

function getWorkspaceId(){
  const hash = window.location.hash || '';
  const m = hash.match(/#\/workspace\/(.+?)(?:\/|$)/);
  return m ? m[1] : null;
}

export default function useRecommendations(initialFilters: any = {}) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<any>(null)
  const [filters, setFilters] = useState<any>(initialFilters)

  const workspaceId = getWorkspaceId()

  const buildQuery = (f:any) => {
    const q: string[] = []
    if (!workspaceId) return ''
    q.push(`workspace=${encodeURIComponent(workspaceId)}`)
    if (f.stage) q.push(`stage=${encodeURIComponent(f.stage)}`)
    if (f.leakage) q.push(`leakage=${encodeURIComponent(f.leakage)}`)
    if (f.fatigue) q.push(`fatigue=${encodeURIComponent(f.fatigue)}`)
    if (f.campaign) q.push(`campaign=${encodeURIComponent(f.campaign)}`)
    if (f.owner) q.push(`owner=${encodeURIComponent(f.owner)}`)
    if (f.status) q.push(`status=${encodeURIComponent(f.status)}`)
    return q.join('&')
  }

  const fetchRecs = useCallback(async (f = filters) => {
    if (!workspaceId) return
    setLoading(true)
    setError(null)
    try {
      const qs = buildQuery(f)
      const res = await fetch(`/api/m07/recommendations?${qs}`)
      if (!res.ok) throw new Error(await res.text())
      const json = await res.json()
      setData(json)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [workspaceId, filters])

  useEffect(() => { fetchRecs() }, [fetchRecs])

  async function run() {
    if (!workspaceId) return
    setLoading(true)
    try {
      await fetch('/api/m07/recommendations/run', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ workspace: workspaceId }) })
      // background job, poll for results
      setTimeout(() => fetchRecs(filters), 1200)
    } finally { setLoading(false) }
  }

  async function markDone(id:string) {
    if (!id) return
    await fetch(`/api/m07/recommendations/${id}/done`, { method: 'POST' })
    await fetchRecs(filters)
  }

  async function dismiss(id:string, note?:string) {
    if (!id) return
    await fetch(`/api/m07/recommendations/${id}/dismiss`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ note }) })
    await fetchRecs(filters)
  }

  return { data, loading, error, refetch: () => fetchRecs(filters), run, markDone, dismiss, filters, setFilters }
}
