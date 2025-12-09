import { useCallback, useEffect, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export type LeakageFilters = {
  stages?: string[];
  riskBuckets?: ('LOW' | 'MEDIUM' | 'HIGH')[];
  from?: string;
  to?: string;
};

export function useLeakagePrediction(workspaceId: string | null, filters: LeakageFilters = {}) {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildParams = useCallback(() => {
    const params = new URLSearchParams();
    if (workspaceId) params.append('workspace', workspaceId);
    if (filters.from) params.append('from', filters.from);
    if (filters.to) params.append('to', filters.to);
    if (filters.stages && filters.stages.length) params.append('stages', filters.stages.join(','));
    if (filters.riskBuckets && filters.riskBuckets.length) params.append('buckets', filters.riskBuckets.join(','));
    return params.toString();
  }, [workspaceId, filters]);

  const fetchData = useCallback(async () => {
    if (!workspaceId) {
      setError('workspace id required');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await window.fetch(`${API_URL}/api/m07/leakage-prediction?${buildParams()}`, { headers: { Authorization: token ? `Bearer ${token}` : '' } });
      if (!res.ok) throw new Error(await res.text() || res.statusText);
      const body = await res.json();
      setData(body);
    } catch (e: any) {
      setError(e?.message || 'failed');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, buildParams]);

  const runPrediction = useCallback(async (opts: { modelVersion?: string } = {}) => {
    if (!workspaceId) {
      setError('workspace id required');
      return { ok: false };
    }
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await window.fetch(`${API_URL}/m07/leakage-prediction/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
        body: JSON.stringify({ workspace: workspaceId, modelVersion: opts.modelVersion || 'v1' }),
      });
      if (!res.ok) throw new Error(await res.text() || res.statusText);
      // On success, refetch dashboard
      await fetchData();
      return { ok: true };
    } catch (e: any) {
      setError(e?.message || 'run failed');
      return { ok: false };
    } finally {
      setLoading(false);
    }
  }, [workspaceId, fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData, runPrediction };
}

export default useLeakagePrediction;
