import type { FunnelHealthResponse } from './useFunnelHealth';

interface LeakageHeatmapProps {
  data: FunnelHealthResponse | null;
  loading: boolean;
}

/**
 * Get color based on leakage percentage
 * Green (low) -> Yellow (moderate) -> Red (high)
 */
function getHeatmapColor(percentage: number): string {
  if (percentage === 0) return '#f3f4f6'; // Light gray for 0%
  if (percentage < 0.2) return '#d1fae5'; // Light green
  if (percentage < 0.4) return '#a7f3d0'; // Green
  if (percentage < 0.6) return '#fef3c7'; // Light yellow
  if (percentage < 0.8) return '#fcd34d'; // Yellow
  return '#fca5a5'; // Red
}

export function LeakageHeatmap({ data, loading }: LeakageHeatmapProps) {
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
          Leakage Heatmap
        </h4>
        <div style={{ color: '#999', fontSize: '14px' }}>Loading heatmap...</div>
      </div>
    );
  }

  if (!data || data.leakageHeatmap.stages.length === 0 || data.leakageHeatmap.matrix.length === 0) {
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
          Leakage Heatmap
        </h4>
        <div
          style={{
            backgroundColor: '#f0f9ff',
            color: '#0369a1',
            padding: '16px',
            borderRadius: '6px',
            fontSize: '13px',
          }}
        >
          No leakage data available. This may indicate complete funnel progression or filtered data with minimal movement.
        </div>
      </div>
    );
  }

  const { stages, matrix } = data.leakageHeatmap;
  const cellSize = 50;

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
        Leakage Heatmap
      </h4>

      <div style={{ marginBottom: '20px' }}>
        <svg
          width={cellSize * stages.length + 80}
          height={cellSize * stages.length + 80}
          style={{ display: 'block' }}
        >
          {/* X-axis labels (to stages) */}
          {stages.map((stage, idx) => (
            <text
              key={`x-${idx}`}
              x={80 + idx * cellSize + cellSize / 2}
              y={25}
              textAnchor="middle"
              fontSize="12"
              fill="#333"
              fontWeight="500"
            >
              {stage}
            </text>
          ))}

          {/* Y-axis labels (from stages) */}
          {stages.map((stage, idx) => (
            <text
              key={`y-${idx}`}
              x={25}
              y={80 + idx * cellSize + cellSize / 2 + 4}
              textAnchor="middle"
              fontSize="12"
              fill="#333"
              fontWeight="500"
            >
              {stage}
            </text>
          ))}

          {/* Grid cells */}
          {matrix.map((row, fromIdx) =>
            row.map((value, toIdx) => {
              const x = 80 + toIdx * cellSize;
              const y = 80 + fromIdx * cellSize;
              const color = getHeatmapColor(value);
              const percentage = (value * 100).toFixed(1);

              return (
                <g key={`cell-${fromIdx}-${toIdx}`}>
                  <rect
                    x={x}
                    y={y}
                    width={cellSize}
                    height={cellSize}
                    fill={color}
                    stroke="#ddd"
                    strokeWidth="1"
                    style={{ cursor: 'pointer' }}
                  >
                    <title>{`${stages[fromIdx]} → ${stages[toIdx]}\n${percentage}% leakage`}</title>
                  </rect>
                  {value > 0 && (
                    <text
                      x={x + cellSize / 2}
                      y={y + cellSize / 2 + 4}
                      textAnchor="middle"
                      fontSize="11"
                      fill="#333"
                      fontWeight="600"
                      style={{ pointerEvents: 'none' }}
                    >
                      {percentage}%
                    </text>
                  )}
                </g>
              );
            })
          )}
        </svg>
      </div>

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          gap: '16px',
          justifyContent: 'center',
          marginTop: '20px',
          padding: '12px 0',
          borderTop: '1px solid #e5e7eb',
          flexWrap: 'wrap',
          fontSize: '12px',
        }}
      >
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <div style={{ width: '20px', height: '20px', backgroundColor: '#d1fae5', border: '1px solid #ccc' }} />
          <span>Low (&lt;20%)</span>
        </div>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <div style={{ width: '20px', height: '20px', backgroundColor: '#a7f3d0', border: '1px solid #ccc' }} />
          <span>20-40%</span>
        </div>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <div style={{ width: '20px', height: '20px', backgroundColor: '#fef3c7', border: '1px solid #ccc' }} />
          <span>40-60%</span>
        </div>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <div style={{ width: '20px', height: '20px', backgroundColor: '#fcd34d', border: '1px solid #ccc' }} />
          <span>60-80%</span>
        </div>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <div style={{ width: '20px', height: '20px', backgroundColor: '#fca5a5', border: '1px solid #ccc' }} />
          <span>High (&gt;80%)</span>
        </div>
      </div>

      <div style={{ marginTop: '16px', fontSize: '12px', color: '#999' }}>
        Rows represent origin stages, columns represent destination stages. Higher percentages indicate more leads lost in that transition.
      </div>
    </div>
  );
}
