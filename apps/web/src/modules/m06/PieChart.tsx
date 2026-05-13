type PieSlice = { label?: string; value: number; color?: string }

const palette = ['#0f4258', '#0F766E', '#B7791F', '#5B6C8B', '#7AA6B8', '#9CB7A4']

function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
  const rad = (angle - 90) * Math.PI / 180
  return { x: cx + (r * Math.cos(rad)), y: cy + (r * Math.sin(rad)) }
}

export default function PieChart({ data, size = 140 }: { data: PieSlice[]; size?: number }) {
  const total = data.reduce((sum, item) => sum + (item.value || 0), 0) || 1
  let angle = 0
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 8
  const innerRadius = r * 0.48

  const paths = data.map((item, index) => {
    const sliceAngle = (item.value / total) * 360
    const start = polarToCartesian(cx, cy, r, angle)
    const end = polarToCartesian(cx, cy, r, angle + sliceAngle)
    const large = sliceAngle > 180 ? 1 : 0
    const path = `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y} Z`
    const fill = item.color || palette[index % palette.length]
    angle += sliceAngle
    return { path, fill, label: item.label, value: item.value }
  })

  const centerLabel = `$${Math.round(total).toLocaleString()}`

  return (
    <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <filter id="m06-pie-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#0b2540" floodOpacity="0.14" />
          </filter>
        </defs>
        <g filter="url(#m06-pie-shadow)">
          {paths.map((item, index) => <path key={index} d={item.path} fill={item.fill} stroke="#fff" strokeWidth={1.2} />)}
        </g>
        <circle cx={cx} cy={cy} r={innerRadius} fill="#fff" />
        <text x={cx} y={cy - 5} textAnchor="middle" fill="#5B6C8B" fontSize={11} fontWeight={800} letterSpacing="0.06em">
          TOTAL
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" fill="#0B2540" fontSize={14} fontWeight={900}>
          {centerLabel}
        </text>
      </svg>

      <div style={{ display: 'grid', gap: 8, minWidth: 220 }}>
        {paths.map((item, index) => (
          <div key={index} style={{ display: 'grid', gridTemplateColumns: '12px minmax(90px, 1fr) auto', gap: 10, alignItems: 'center' }}>
            <div style={{ width: 12, height: 12, background: item.fill, borderRadius: 4 }} />
            <div style={{ fontSize: 12, color: '#0B2540', fontWeight: 700, textTransform: 'capitalize' }}>{item.label || '—'}</div>
            <div style={{ fontSize: 12, color: '#415274', fontWeight: 700 }}>{Math.round(item.value || 0).toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
