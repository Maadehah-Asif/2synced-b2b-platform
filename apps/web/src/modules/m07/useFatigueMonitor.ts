import { useEffect, useState } from 'react';
function getWorkspaceId() {
  const hash = window.location.hash || '';
  const m = hash.match(/#\/workspace\/(.+?)(?:\/|$)/);
  return m ? m[1] : null;
}

export default function useFatigueMonitor(workspaceId?: string) {
  const wid = workspaceId || getWorkspaceId();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchData() {
    if (!wid) return;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ workspace: wid });
      const res = await window.fetch(`/api/m07/fatigue?${qs.toString()}`);
      if (!res.ok) throw new Error(`status_${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally { setLoading(false); }
  }

  useEffect(() => { fetchData(); }, [wid]);

  async function runFatigue(optsRun: { windowDays?: number; threshold?: number; channels?: string[] } = {}) {
    if (!wid) throw new Error('workspace_required');
    setLoading(true);
    setError(null);
    try {
      const body = { workspace: wid, windowDays: optsRun.windowDays || 7, threshold: optsRun.threshold || 8, channels: optsRun.channels || [] };
      const res = await window.fetch('/api/m07/fatigue/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(`status_${res.status}`);
      // after successful kickoff, refetch data
      await fetchData();
      return true;
    } catch (e: any) {
      setError(e?.message || String(e));
      return false;
    } finally { setLoading(false); }
  }

  return { data, loading, error, refetch: fetchData, runFatigue };
}
