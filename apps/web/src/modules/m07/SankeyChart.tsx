import type { FunnelHealthResponse } from './useFunnelHealth';

interface SankeyChartProps {
  data: FunnelHealthResponse | null;
  loading: boolean;
}

export function SankeyChart({ data, loading }: SankeyChartProps) {
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
          <div style={{ fontSize: '14px', marginBottom: '8px' }}>Loading Sankey diagram...</div>
          <div style={{ width: '40px', height: '40px', margin: '0 auto', border: '4px solid #f0f0f0', borderTop: '4px solid #0A1A75', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        </div>
      </div>
    );
  }

  if (!data || data.funnelFlow.sankeyLinks.length === 0) {
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
          <div style={{ fontSize: '16px', marginBottom: '8px' }}>No movement data found.</div>
          <div style={{ fontSize: '12px' }}>Leads are not progressing through stages.</div>
        </div>
      </div>
    );
  }

  const { sankeyNodes, sankeyLinks } = data.funnelFlow;

  // Calculate positions for a simple horizontal layout
  const nodeRadius = 30;
  const verticalSpacing = 100;
  const horizontalSpacing = 150;

  // Group nodes by "level" (source -> target progression)
  const levels: Map<string, number> = new Map();
  const visited = new Set<string>();

  function assignLevel(nodeId: string, level: number) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    levels.set(nodeId, level);

    const outgoing = sankeyLinks.filter((l) => l.source === nodeId);
    outgoing.forEach((link) => {
      assignLevel(link.target, level + 1);
    });
  }

  // Find root nodes (no incoming links)
  const rootNodes = sankeyNodes.filter(
    (node) => !sankeyLinks.some((link) => link.target === node.id)
  );

  rootNodes.forEach((node) => {
    assignLevel(node.id, 0);
  });

  // Calculate canvas dimensions
  const maxLevel = Math.max(...Array.from(levels.values()), 0);
  const canvasWidth = (maxLevel + 1) * horizontalSpacing + nodeRadius * 2 + 40;
  const canvasHeight = sankeyNodes.length * verticalSpacing + 40;

  // SVG rendering of Sankey
  return (
    <div
      style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '24px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
        overflow: 'auto',
      }}
    >
      <h4 style={{ margin: '0 0 16px 0', color: '#0B2540', fontSize: '16px', fontWeight: 600 }}>
        Sankey Diagram — Lead Movement
      </h4>
      <svg width={canvasWidth} height={canvasHeight} style={{ minWidth: '100%', borderRadius: '4px' }}>
        {/* Links */}
        {sankeyLinks.map((link, idx) => {
          const sourceLevel = levels.get(link.source) || 0;
          const targetLevel = levels.get(link.target) || 0;

          const sourceNode = sankeyNodes.find((n) => n.id === link.source);
          const targetNode = sankeyNodes.find((n) => n.id === link.target);

          const sourceIndex = sankeyNodes.findIndex((n) => n.id === link.source);
          const targetIndex = sankeyNodes.findIndex((n) => n.id === link.target);

          const x1 = sourceLevel * horizontalSpacing + nodeRadius + 20;
          const y1 = sourceIndex * verticalSpacing + 20 + nodeRadius;
          const x2 = targetLevel * horizontalSpacing + nodeRadius + 20;
          const y2 = targetIndex * verticalSpacing + 20 + nodeRadius;

          const maxValue = Math.max(...sankeyLinks.map((l) => l.value), 1);
          const strokeWidth = Math.max(1, (link.value / maxValue) * 8);
          const conversionPercent = sourceNode ? ((link.value / sourceNode.id.length) * 100).toFixed(1) : '0';

          return (
            <g key={idx}>
              {/* Link line with gradient */}
              <defs>
                <linearGradient id={`gradient-${idx}`} x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#0A1A75" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#0A1A75" stopOpacity="0.6" />
                </linearGradient>
              </defs>
              <path
                d={`M ${x1} ${y1} Q ${(x1 + x2) / 2} ${(y1 + y2) / 2 + 20} ${x2} ${y2}`}
                fill="none"
                stroke={`url(#gradient-${idx})`}
                strokeWidth={strokeWidth}
                style={{ pointerEvents: 'none' }}
              />
              {/* Tooltip trigger area */}
              <rect
                x={Math.min(x1, x2) - 10}
                y={Math.min(y1, y2) - 10}
                width={Math.abs(x2 - x1) + 20}
                height={Math.abs(y2 - y1) + 20}
                fill="transparent"
                style={{ cursor: 'pointer' }}
              >
                <title>{`${sourceNode?.label || 'Unknown'} → ${targetNode?.label || 'Unknown'}\nLeads: ${link.value}\nConversion: ${conversionPercent}%`}</title>
              </rect>
            </g>
          );
        })}

        {/* Nodes */}
        {sankeyNodes.map((node, idx) => {
          const level = levels.get(node.id) || 0;
          const x = level * horizontalSpacing + nodeRadius + 20;
          const y = idx * verticalSpacing + 20 + nodeRadius;

          const incoming = sankeyLinks.filter((l) => l.target === node.id);
          const totalIncoming = incoming.reduce((sum, l) => sum + l.value, 0);

          return (
            <g key={node.id}>
              {/* Circle */}
              <circle
                cx={x}
                cy={y}
                r={nodeRadius}
                fill="#0A1A75"
                style={{ cursor: 'pointer' }}
              >
                <title>{`${node.label}\nTotal: ${totalIncoming}`}</title>
              </circle>
              {/* Label */}
              <text
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="white"
                fontSize="12"
                fontWeight="600"
                style={{ pointerEvents: 'none' }}
              >
                {node.label}
              </text>
              {/* Count below */}
              <text
                x={x}
                y={y + nodeRadius + 16}
                textAnchor="middle"
                fill="#555"
                fontSize="11"
                style={{ pointerEvents: 'none' }}
              >
                {totalIncoming.toLocaleString()}
              </text>
            </g>
          );
        })}
      </svg>
      <div style={{ marginTop: '12px', fontSize: '12px', color: '#999' }}>
        Hover over links to see conversion rates. Node size and link thickness represent lead volume.
      </div>
    </div>
  );
}
