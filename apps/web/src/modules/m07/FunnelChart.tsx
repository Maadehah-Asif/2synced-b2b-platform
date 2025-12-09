import type { FunnelHealthResponse } from './useFunnelHealth';

interface FunnelChartProps {
  data: FunnelHealthResponse | null;
  loading: boolean;
}

export function FunnelChart({ data, loading }: FunnelChartProps) {
  if (loading) {
    return (
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
          minHeight: '400px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ textAlign: 'center', color: '#999' }}>
          <div style={{ fontSize: '14px', marginBottom: '8px' }}>Loading Funnel chart...</div>
          <div style={{ width: '40px', height: '40px', margin: '0 auto', border: '4px solid #f0f0f0', borderTop: '4px solid #0A1A75', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        </div>
      </div>
    );
  }

  if (!data || data.funnelFlow.funnelStages.length === 0) {
    return (
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
          minHeight: '400px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#999',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '16px' }}>No funnel stage data available.</div>
        </div>
      </div>
    );
  }

  const { funnelStages } = data.funnelFlow;
  const maxCount = Math.max(...funnelStages.map((s) => s.count), 1);

  return (
    <div
      style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '24px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
      }}
    >
      <h4 style={{ margin: '0 0 24px 0', color: '#0B2540', fontSize: '16px', fontWeight: 600 }}>
        Funnel — Stage Progression
      </h4>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {funnelStages.map((stage, idx) => {
          const percentage = (stage.count / maxCount) * 100;
          const dropoff = idx > 0 ? ((1 - stage.count / funnelStages[idx - 1].count) * 100).toFixed(1) : '—';

          return (
            <div key={stage.stage}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#333' }}>
                  {stage.stage}
                </div>
                <div style={{ fontSize: '13px', color: '#666' }}>
                  {stage.count.toLocaleString()} leads {idx > 0 && `(↓${dropoff}%)`}
                </div>
              </div>
              {/* Funnel bar */}
              <div
                style={{
                  width: `${percentage}%`,
                  height: '24px',
                  backgroundColor: '#0A1A75',
                  borderRadius: '4px',
                  transition: 'width 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  paddingRight: '8px',
                  minWidth: '40px',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    right: '6px',
                    color: 'white',
                    fontSize: '11px',
                    fontWeight: 600,
                  }}
                >
                  {percentage.toFixed(0)}%
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: '16px', fontSize: '12px', color: '#999' }}>
        Total leads: {funnelStages.reduce((sum, s) => sum + s.count, 0).toLocaleString()}
      </div>
    </div>
  );
}
