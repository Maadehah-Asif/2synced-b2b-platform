import type { FunnelHealthResponse } from './useFunnelHealth';

interface KPITilesProps {
  data: FunnelHealthResponse | null;
  loading: boolean;
  error: string | null;
}

function SkeletonLoader() {
  return (
    <div
      style={{
        height: '80px',
        backgroundColor: '#f0f0f0',
        borderRadius: '6px',
        animation: 'pulse 2s infinite',
      }}
    />
  );
}

export function KPITiles({ data, loading, error }: KPITilesProps) {
  if (error && !data) {
    return (
      <div
        style={{
          backgroundColor: '#fee2e2',
          color: '#991b1b',
          padding: '16px',
          borderRadius: '6px',
          marginBottom: '24px',
          fontSize: '14px',
        }}
      >
        Failed to load KPIs: {error}
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {Array(5)
          .fill(0)
          .map((_, i) => (
            <SkeletonLoader key={i} />
          ))}
      </div>
    );
  }

  if (!data) {
    return (
      <div
        style={{
          backgroundColor: '#f9fafb',
          padding: '24px',
          borderRadius: '6px',
          textAlign: 'center',
          color: '#666',
          marginBottom: '24px',
        }}
      >
        No funnel data available for selected filters.
      </div>
    );
  }

  const { kpis } = data;

  // Helper to count stuck leads
  const stuckLeads = kpis.stageCounts.reduce((acc: number, stage: { stage: string; count: number }) => {
    const completePath = kpis.stageCounts.find((s: { stage: string; count: number }) => s.stage === 'Won');
    return completePath ? acc : acc + stage.count;
  }, 0);

  const kpiCards = [
    {
      label: 'Total Active Leads',
      value: kpis.totalActiveLeads.toLocaleString(),
      subtext: 'in funnel',
    },
    {
      label: 'Overall Conversion Rate',
      value: `${(kpis.overallConversionRate * 100).toFixed(2)}%`,
      subtext: 'to Won',
    },
    {
      label: 'Worst Leakage Transition',
      value: kpis.worstLeakageTransition
        ? `${(kpis.worstLeakageTransition.leakageRate * 100).toFixed(1)}%`
        : '—',
      subtext: kpis.worstLeakageTransition
        ? `${kpis.worstLeakageTransition.fromStage} → ${kpis.worstLeakageTransition.toStage}`
        : 'No leakage',
    },
    {
      label: 'Average Time Per Stage',
      value: kpis.averageTimePerStageDays[0]?.avgDays.toFixed(1) || '—',
      subtext: kpis.averageTimePerStageDays[0]?.stage ? `(${kpis.averageTimePerStageDays[0].stage})` : 'days',
    },
    {
      label: 'Stuck Leads',
      value: stuckLeads.toLocaleString(),
      subtext: 'without progression',
    },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
      {kpiCards.map((card, idx) => (
        <div
          key={idx}
          style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '16px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
          }}
        >
          <div style={{ fontSize: '12px', color: '#999', fontWeight: 500, marginBottom: '8px' }}>
            {card.label}
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#0A1A75', marginBottom: '4px' }}>
            {card.value}
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>{card.subtext}</div>
        </div>
      ))}
    </div>
  );
}
