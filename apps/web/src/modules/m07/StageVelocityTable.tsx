import type { FunnelHealthResponse } from './useFunnelHealth';

interface StageVelocityTableProps {
  data: FunnelHealthResponse | null;
  loading: boolean;
}

export function StageVelocityTable({ data, loading }: StageVelocityTableProps) {
  if (loading) {
    return (
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
        }}
      >
        <h4 style={{ margin: '0 0 16px 0', color: '#0B2540', fontSize: '16px', fontWeight: 600 }}>
          Stage Velocity
        </h4>
        <div style={{ color: '#999', fontSize: '14px' }}>Loading table...</div>
      </div>
    );
  }

  if (!data || data.stageMetrics.length === 0) {
    return (
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
        }}
      >
        <h4 style={{ margin: '0 0 16px 0', color: '#0B2540', fontSize: '16px', fontWeight: 600 }}>
          Stage Velocity
        </h4>
        <div style={{ color: '#999', fontSize: '14px' }}>No stage metrics available.</div>
      </div>
    );
  }

  const { stageMetrics } = data;

  return (
    <div
      style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '24px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
        overflowX: 'auto',
      }}
    >
      <h4 style={{ margin: '0 0 16px 0', color: '#0B2540', fontSize: '16px', fontWeight: 600 }}>
        Stage Velocity
      </h4>

      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '13px',
        }}
      >
        <thead>
          <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
            <th style={{ textAlign: 'left', padding: '12px 8px', fontWeight: 600, color: '#0B2540' }}>
              Stage
            </th>
            <th style={{ textAlign: 'left', padding: '12px 8px', fontWeight: 600, color: '#0B2540' }}>
              Avg Time (days)
            </th>
            <th style={{ textAlign: 'left', padding: '12px 8px', fontWeight: 600, color: '#0B2540' }}>
              Median Time
            </th>
            <th style={{ textAlign: 'left', padding: '12px 8px', fontWeight: 600, color: '#0B2540' }}>
              % Stuck
            </th>
            <th style={{ textAlign: 'left', padding: '12px 8px', fontWeight: 600, color: '#0B2540' }}>
              Drop-off to Lost
            </th>
            <th style={{ textAlign: 'center', padding: '12px 8px', fontWeight: 600, color: '#0B2540' }}>
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {stageMetrics.map((metric, idx) => (
            <tr
              key={metric.stage}
              style={{
                borderBottom: '1px solid #f3f4f6',
                backgroundColor: idx % 2 === 0 ? '#f9fafb' : 'white',
                transition: 'background-color 0.2s ease',
                cursor: 'pointer',
              }}
            >
              <td style={{ padding: '12px 8px', fontWeight: 500, color: '#333' }}>
                {metric.stage}
              </td>
              <td style={{ padding: '12px 8px', color: '#666' }}>
                {metric.avgTimeDays !== null ? metric.avgTimeDays.toFixed(1) : '—'}
                {metric.avgTimeDays === null && (
                  <span
                    title="No complete paths available"
                    style={{ cursor: 'help', marginLeft: '4px', color: '#999' }}
                  >
                    ⓘ
                  </span>
                )}
              </td>
              <td style={{ padding: '12px 8px', color: '#666' }}>
                {metric.medianTimeDays !== null ? metric.medianTimeDays.toFixed(1) : '—'}
              </td>
              <td style={{ padding: '12px 8px', color: '#666' }}>
                {(metric.percentStuck * 100).toFixed(1)}%
              </td>
              <td style={{ padding: '12px 8px', color: '#666' }}>
                {(metric.dropOffToLostPercent * 100).toFixed(1)}%
              </td>
              <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                {metric.hasIncompletePaths && (
                  <span
                    title="Has incomplete paths"
                    style={{
                      fontSize: '18px',
                      cursor: 'help',
                    }}
                  >
                    ⚠️
                  </span>
                )}
                {!metric.hasIncompletePaths && (
                  <span style={{ color: '#ccc' }}>—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
