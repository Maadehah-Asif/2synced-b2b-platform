type Props = {
  summary: { ok: number; warm: number; tired: number; burntOut: number; mostFatiguingCampaign?: string | null } | null;
}

export default function FatigueSummaryTiles({ summary }: Props) {
  if (!summary) return <div className="text-sm text-muted">No data</div>;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
      <div className="card p-4"><div className="text-sm">OK Leads</div><div className="text-2xl font-bold" style={{ color: 'green' }}>{summary.ok}</div></div>
      <div className="card p-4"><div className="text-sm">WARM Leads</div><div className="text-2xl font-bold" style={{ color: 'goldenrod' }}>{summary.warm}</div></div>
      <div className="card p-4"><div className="text-sm">TIRED Leads</div><div className="text-2xl font-bold" style={{ color: 'orange' }}>{summary.tired}</div></div>
      <div className="card p-4"><div className="text-sm">BURNT_OUT Leads</div><div className="text-2xl font-bold" style={{ color: 'red' }}>{summary.burntOut}</div></div>
      <div className="card p-4"><div className="text-sm">Most fatiguing campaign</div><div className="text-lg">{summary.mostFatiguingCampaign || '—'}</div></div>
    </div>
  )
}
