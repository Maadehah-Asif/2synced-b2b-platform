/**
 * Module: Revenue Attribution & ROI (m06)
 * Layer: Frontend
 * File: Module6StatsPanel.tsx
 * Purpose: Supports the M od ul e6 St at sP an el flow for this module.
 * Notes: Documentation header added for maintainability.
 */

import { useEffect, useState } from 'react';
import './module6.css';
import PieChart from './PieChart';
import TimelineChart from './TimelineChart';
import type { TimelinePoint } from './TimelineChart';
import { useWorkspaceId } from '../../utils/workspace';
import { fetchFromApi, parseApiJson } from '../../utils/api';


const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

type Module6StatsPanelProps = {
  compact?: boolean;
};

export default function Module6StatsPanel({ compact = false }: Module6StatsPanelProps) {
  const workspaceId = useWorkspaceId({ redirectToWorkspaces: !compact });
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [autoProject, setAutoProject] = useState<string | null>(null);

  // Fetch stats for current workspace
  useEffect(() => {
    (async () => {
      if (!workspaceId) return;
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await fetchFromApi(
          `${API_URL}/m06/stats?projectId=${encodeURIComponent(workspaceId)}`,
          {
            headers: {
              Authorization: token ? `Bearer ${token}` : '',
            },
          },
          API_URL
        );
        const json = await parseApiJson<any>(res, 'Could not load Module 6 stats');
        if (json) {
          setData(json);
          setFetchError(null);
        }
      } catch (e: any) {
        console.error('m06/stats fetch failed', e);
        setData(null);
        setFetchError(e?.message || 'Could not load Module 6 stats');
      }
      setLoading(false);
    })();
  }, [workspaceId]);

  // If no data, try auto-select demo project (if backend supports it)
  useEffect(() => {
    (async () => {
      if (!workspaceId) return;
      if (!data || (data && data.totalRevenue === 0 && data.campaignCount === 0)) {
        try {
          const res = await fetch(`${API_URL}/m06/demo-projects`);
          const json = await res.json();
          if (res.ok && Array.isArray(json.projects) && json.projects.length > 0) {
            const p = json.projects[0];
            setAutoProject(p);
            const token = localStorage.getItem('token');
            const r2 = await fetchFromApi(
              `${API_URL}/m06/stats?projectId=${encodeURIComponent(p)}`,
              { headers: { Authorization: token ? `Bearer ${token}` : '' } },
              API_URL
            );
            const j2 = await parseApiJson<any>(r2, 'Could not load Module 6 stats');
            if (j2) setData(j2);
          }
        } catch {
          // ignore, we already show error UI
        }
      }
    })();
  }, [workspaceId, data]);

  if (!workspaceId) {
    return <div style={{ fontSize: 13 }}>Open a workspace to view stats.</div>;
  }
  if (loading) {
    return <div style={{ fontSize: 13 }}>Loading...</div>;
  }
  if (!data) {
    return (
      <div style={{ fontSize: 13 }}>
        <div>No data</div>
        <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
          API: {API_URL}/m06/stats?projectId={workspaceId}
        </div>
        {fetchError && (
          <div style={{ marginTop: 8, color: 'crimson' }}>Error: {fetchError}</div>
        )}
        <div style={{ marginTop: 8 }}>
          <em>Open browser console or network tab for more details.</em>
        </div>
      </div>
    );
  }

  const tr = (v: number) => `$${(Math.round(v) || 0).toLocaleString()}`;

  const campaignRevenue = (data.campaignRevenue || []).map((c: any, i: number) => ({
    label: c.name || c.campaign_id,
    value: c.revenue || 0,
    color: ['#65A1BF', '#5E94B9', '#ACCFDA', '#CEDDE3'][i % 4],
  }));

  const timelineData: TimelinePoint[] = (data.monthlyDeals || []).map((m: any) => ({
    month: m.month,
    total: m.total || 0,
  }));

  // ---------- COMPACT VIEW (for floating Module 7 dropdown) ----------
  if (compact) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {autoProject && (
          <div
            style={{
              background: '#eef6f8',
              padding: 6,
              borderRadius: 6,
              color: '#042a33',
              fontSize: 11,
            }}
          >
            Demo workspace: <strong>{autoProject}</strong>
          </div>
        )}

        <div className="m7-card" style={{ padding: 10 }}>
          <div style={{ fontSize: 12, color: '#042a33' }}>Total Revenue</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            {tr(data.totalRevenue)}
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 11,
              marginBottom: 6,
            }}
          >
            <div>
              <div>Attributed</div>
              <div style={{ fontWeight: 700 }}>{tr(data.attributedTotal)}</div>
            </div>
            <div>
              <div>Unattributed</div>
              <div style={{ fontWeight: 700 }}>{tr(data.unattributed)}</div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 11,
              marginBottom: 6,
            }}
          >
            <div>
              <div>Campaigns</div>
              <div style={{ fontWeight: 700 }}>{data.campaignCount}</div>
            </div>
            <div>
              <div>Spend</div>
              <div style={{ fontWeight: 700 }}>{tr(data.totalSpend)}</div>
            </div>
          </div>

          <div style={{ fontSize: 11, marginTop: 4 }}>
            <div>
              <strong>Model:</strong> {data.latestRun?.model_type || '—'}
            </div>
            <div>
              <strong>Last Run:</strong>{' '}
              {data.latestRun?.timestamp
                ? new Date(data.latestRun.timestamp).toLocaleString()
                : '—'}
            </div>
            <div>
              <strong>Status:</strong> {data.latestRun?.status || 'none'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------- FULL PAGE VIEW ----------
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {autoProject && (
        <div
          style={{
            background: '#eef6f8',
            padding: 10,
            borderRadius: 8,
            color: '#042a33',
            fontSize: 13,
          }}
        >
          Displaying demo data for workspace <strong>{autoProject}</strong> (auto-selected)
        </div>
      )}

      {/* CARD 1: BIG OVERVIEW (fills most of the page width) */}
      <section
        className="m7-card"
        style={{
          width: '100%',
          display: 'grid',
          gridTemplateColumns: '2fr 2fr 1.5fr 1.5fr',
          gap: 24,
          alignItems: 'center',
          minHeight: 160,
          padding: 24,
        }}
      >
        <div>
          <div style={{ fontSize: 14, color: '#042a33' }}>Total Revenue</div>
          <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6 }}>
            {tr(data.totalRevenue)}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 14, color: '#042a33', marginBottom: 4 }}>
            Attributed / Unattributed
          </div>
          <div style={{ display: 'flex', gap: 20, fontSize: 13 }}>
            <div>
              <div style={{ fontSize: 12 }}>Attributed</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>
                {tr(data.attributedTotal)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12 }}>Unattributed</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>
                {tr(data.unattributed)}
              </div>
            </div>
          </div>
        </div>

        <div>
          <div style={{ fontSize: 14, color: '#042a33', marginBottom: 4 }}>
            Campaigns &amp; Spend
          </div>
          <div style={{ display: 'flex', gap: 20, fontSize: 13 }}>
            <div>
              <div style={{ fontSize: 12 }}>Campaigns</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>
                {data.campaignCount}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12 }}>Spend</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>
                {tr(data.totalSpend)}
              </div>
            </div>
          </div>
        </div>

        <div style={{ fontSize: 12 }}>
          <div style={{ marginBottom: 4 }}>
            <strong>Model:</strong> {data.latestRun?.model_type || '—'}
          </div>
          <div style={{ marginBottom: 4 }}>
            <strong>Last Run:</strong>{' '}
            {data.latestRun?.timestamp
              ? new Date(data.latestRun.timestamp).toLocaleString()
              : '—'}
          </div>
          <div>
            <strong>Status:</strong> {data.latestRun?.status || 'none'}
          </div>
        </div>
      </section>

      {/* CARD 2: TWO BIG CHARTS SIDE BY SIDE */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
          gap: 24,
          width: '100%',
        }}
      >
        {/* LEFT: REVENUE BY CHANNEL */}
        <div className="m7-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
            Revenue by Channel
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 20,
              justifyContent: 'space-between',
            }}
          >
            <div style={{ flex: '0 0 auto' }}>
              <PieChart data={campaignRevenue} size={180} />
            </div>
            <ul
              style={{
                listStyle: 'none',
                margin: 0,
                padding: 0,
                fontSize: 12,
                color: '#042a33',
              }}
            >
              {campaignRevenue.map((c: { label: string; value: number; color: string }) => (

                <li
                  key={c.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 6,
                  }}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 999,
                      backgroundColor: c.color as string,
                    }}
                  />
                  <span style={{ minWidth: 110 }}>{c.label}</span>
                  <strong>{Math.round(c.value).toLocaleString()}</strong>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* RIGHT: REVENUE OVER TIME */}
        <div className="m7-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
            Revenue Over Time
          </div>
          <TimelineChart data={timelineData} />
        </div>
      </section>
    </div>
  );
}
