export type TimelinePoint = {
  month: string
  total: number
}

type Props = {
  data: TimelinePoint[]
  height?: number
  valueFormatter?: (value: number) => string
  tone?: 'navy' | 'teal' | 'amber' | 'slate'
}

const toneMap = {
  navy: {
    stroke: '#0f4258',
    fillTop: 'rgba(15,66,88,0.28)',
    fillBottom: 'rgba(15,66,88,0.03)',
    dot: '#0f4258',
  },
  teal: {
    stroke: '#0F766E',
    fillTop: 'rgba(15,118,110,0.26)',
    fillBottom: 'rgba(15,118,110,0.04)',
    dot: '#0F766E',
  },
  amber: {
    stroke: '#B7791F',
    fillTop: 'rgba(183,121,31,0.24)',
    fillBottom: 'rgba(183,121,31,0.04)',
    dot: '#B7791F',
  },
  slate: {
    stroke: '#475569',
    fillTop: 'rgba(71,85,105,0.24)',
    fillBottom: 'rgba(71,85,105,0.04)',
    dot: '#475569',
  },
} as const

export default function TimelineChart({ data, height = 220, valueFormatter, tone = 'navy' }: Props) {
  if (!data || data.length === 0) {
    return <div style={{ fontSize: 12, color: '#666' }}>No timeline data</div>
  }

  const palette = toneMap[tone]
  const chartHeight = Math.max(160, height - 46)
  const width = Math.max(640, data.length * 110)
  const max = Math.max(...data.map((d) => d.total), 1)
  const min = Math.min(...data.map((d) => d.total), 0)
  const range = Math.max(1, max - min)
  const points = data.map((point, index) => {
    const x = data.length === 1 ? width / 2 : 26 + (index * (width - 52)) / (data.length - 1)
    const y = 14 + ((max - point.total) / range) * (chartHeight - 28)
    return { ...point, x, y }
  })

  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${chartHeight} L ${points[0].x} ${chartHeight} Z`
  const guideValues = [max, max - range / 2, min]

  return (
    <div
      style={{
        padding: '14px 16px 10px',
        borderRadius: 18,
        background: 'linear-gradient(180deg, rgba(246,250,252,0.98), rgba(255,255,255,0.94))',
        border: '1px solid rgba(15,66,88,0.08)',
        overflowX: 'auto',
      }}
    >
      <svg width={width} height={chartHeight + 34} viewBox={`0 0 ${width} ${chartHeight + 34}`} style={{ display: 'block', minWidth: '100%' }}>
        <defs>
          <linearGradient id={`timeline-fill-${tone}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={palette.fillTop} />
            <stop offset="100%" stopColor={palette.fillBottom} />
          </linearGradient>
        </defs>

        {guideValues.map((guide, index) => {
          const y = 14 + ((max - guide) / range) * (chartHeight - 28)
          return (
            <g key={`${guide}-${index}`}>
              <line x1={18} y1={y} x2={width - 18} y2={y} stroke="rgba(15,66,88,0.10)" strokeDasharray="5 6" />
              <text x={18} y={Math.max(12, y - 6)} fill="#5B6C8B" fontSize="11">
                {valueFormatter ? valueFormatter(guide) : Math.round(guide).toLocaleString()}
              </text>
            </g>
          )
        })}

        <path d={areaPath} fill={`url(#timeline-fill-${tone})`} />
        <path d={linePath} fill="none" stroke={palette.stroke} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />

        {points.map((point) => (
          <g key={point.month}>
            <circle cx={point.x} cy={point.y} r="5.5" fill="#fff" stroke={palette.dot} strokeWidth="3" />
            <rect x={point.x - 34} y={point.y - 36} rx="10" width="68" height="22" fill="rgba(255,255,255,0.95)" stroke="rgba(15,66,88,0.08)" />
            <text x={point.x} y={point.y - 21} textAnchor="middle" fill="#0B2540" fontSize="11" fontWeight="700">
              {valueFormatter ? valueFormatter(point.total) : Math.round(point.total).toLocaleString()}
            </text>
            <text x={point.x} y={chartHeight + 22} textAnchor="middle" fill="#415274" fontSize="11">
              {point.month}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}
