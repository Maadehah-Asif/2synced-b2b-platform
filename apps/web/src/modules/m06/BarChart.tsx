export default function BarChart({ data, height=100 }: { data: Array<{ label: string; value: number }>; height?: number }){
  const max = Math.max(...data.map(d=>d.value), 1);
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'end', height, padding: 6 }}>
      {data.map((d, i) => (
        <div key={i} style={{ textAlign: 'center', width: 56 }}>
          <div style={{ position: 'relative', height: Math.round((d.value/max) * (height-40)), display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
            <div style={{ width: '72%', height: '100%', background: `linear-gradient(180deg, ${shadeColor('#65A1BF', 8)}, ${shadeColor('#5E94B9', -6)})`, borderRadius: 6, boxShadow: '0 4px 10px rgba(6,24,32,0.08)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
              <div style={{ fontSize: 11, color: '#042a33', padding: 4, background: 'rgba(255,255,255,0.6)', borderRadius: 4, transform: 'translateY(-8px)', fontWeight: 700 }}>{Math.round(d.value)}</div>
            </div>
          </div>
          <div style={{ fontSize: 11, marginTop: 8, color: '#042a33' }}>{d.label}</div>
        </div>
      ))}
    </div>
  )
}

// small helper to shade hex color
function shadeColor(hex:string, percent:number){
  try{
    const h = hex.replace('#','');
    const num = parseInt(h,16);
    let r = (num >> 16) + percent;
    let g = ((num >> 8) & 0x00FF) + percent;
    let b = (num & 0x0000FF) + percent;
    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));
    return `#${(r<<16 | g<<8 | b).toString(16).padStart(6,'0')}`;
  }catch(e){ return hex }
}
