/**
 * Module: Revenue Attribution & ROI (m06)
 * Layer: Frontend
 * File: BarChart.tsx
 * Purpose: Supports the B ar Ch ar t flow for this module.
 * Notes: Documentation header added for maintainability.
 */

type BarDatum = { label: string; value: number }

type Props = {
  data: BarDatum[]
  height?: number
  valueFormatter?: (value: number) => string
}

const palette = ['#0f4258', '#0F766E', '#B7791F', '#5B6C8B', '#7AA6B8', '#9CB7A4']

export default function BarChart({ data, height = 180, valueFormatter }: Props) {
  const max = Math.max(...data.map((item) => item.value), 1)

  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'end', height, padding: '8px 6px', overflowX: 'auto' }}>
      {data.map((item, index) => {
        const tone = palette[index % palette.length]
        const barHeight = Math.max(28, Math.round((item.value / max) * (height - 52)))
        return (
          <div key={`${item.label}-${index}`} style={{ textAlign: 'center', width: 72, flexShrink: 0 }}>
            <div style={{ position: 'relative', height: height - 30, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
              <div
                style={{
                  width: '76%',
                  height: barHeight,
                  background: `linear-gradient(180deg, ${tone} 0%, rgba(255,255,255,0.18) 100%), ${tone}`,
                  borderRadius: 14,
                  boxShadow: '0 12px 24px rgba(13,30,60,0.10)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div style={{ fontSize: 11, color: '#fff', padding: '4px 6px', borderRadius: 8, fontWeight: 800 }}>
                  {valueFormatter ? valueFormatter(item.value) : Math.round(item.value).toLocaleString()}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 11, marginTop: 8, color: '#415274', fontWeight: 700 }}>{item.label}</div>
          </div>
        )
      })}
    </div>
  )
}
