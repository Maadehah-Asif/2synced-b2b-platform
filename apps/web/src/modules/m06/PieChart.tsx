type PieSlice = { label?: string; value: number; color?: string }

function polarToCartesian(cx:number, cy:number, r:number, angle:number){
  const rad = (angle-90) * Math.PI / 180.0;
  return { x: cx + (r * Math.cos(rad)), y: cy + (r * Math.sin(rad)) };
}

export default function PieChart({ data, size=140 }: { data: PieSlice[]; size?: number }){
  const total = data.reduce((s,d)=> s + (d.value || 0), 0) || 1;
  let angle = 0;
  const cx = size/2, cy = size/2, r = size/2 - 6;
  const paths: any[] = [];
  for(const d of data){
    const sliceAngle = (d.value/total) * 360;
    const start = polarToCartesian(cx, cy, r, angle);
    const end = polarToCartesian(cx, cy, r, angle + sliceAngle);
    const large = sliceAngle > 180 ? 1 : 0;
    const path = `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y} Z`;
    paths.push({ path, color: d.color || '#65A1BF', label: d.label, value: d.value });
    angle += sliceAngle;
  }

  // center label: total
  const centerLabel = `$${Math.round(total).toLocaleString()}`;

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}` }>
        <defs>
          <filter id="m7-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#042a33" floodOpacity="0.12"/>
          </filter>
        </defs>
        <g filter="url(#m7-shadow)">
          {paths.map((p, i) => <path key={i} d={p.path} fill={p.color} stroke="#fff" strokeWidth={0.8} />)}
        </g>
        <circle cx={cx} cy={cy} r={r * 0.48} fill="#fff" />
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize={12} fill="#042a33" fontWeight={700}>{centerLabel}</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 140 }}>
            <div style={{ width: 12, height: 12, background: d.color || '#65A1BF', borderRadius: 3 }} />
            <div style={{ fontSize: 12, color: '#042a33' }}>{d.label || '—'}</div>
            <div style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700 }}>{Math.round(d.value || 0)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
