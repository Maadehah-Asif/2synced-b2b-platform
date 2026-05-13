import type { CSSProperties } from 'react'

type LineSeries = {
  label: string
  color: string
  values: number[]
}

type GroupedBarSeries = {
  label: string
  color: string
  values: number[]
}

export function ForecastLineChart({
  labels,
  series,
  height = 260,
  suffix = '',
  maxLabelCount = 8,
}: {
  labels: string[]
  series: LineSeries[]
  height?: number
  suffix?: string
  maxLabelCount?: number
}) {
  const activeSeries = series.filter((item) => item.values.some((value) => Number.isFinite(value)))
  if (!labels.length || !activeSeries.length) {
    return <div style={emptyState}>No chart data available.</div>
  }

  const width = 760
  const padding = { top: 22, right: 22, bottom: 42, left: 50 }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom
  const allValues = activeSeries.flatMap((item) => item.values).filter((value) => Number.isFinite(value))
  const minValue = Math.min(...allValues, 0)
  const maxValue = Math.max(...allValues, 1)
  const range = maxValue - minValue || 1
  const ticks = 4
  const labelStep = Math.max(1, Math.ceil(labels.length / maxLabelCount))

  function getX(index: number) {
    if (labels.length === 1) return padding.left + plotWidth / 2
    return padding.left + (plotWidth * index) / (labels.length - 1)
  }

  function getY(value: number) {
    return padding.top + plotHeight - ((value - minValue) / range) * plotHeight
  }

  function buildPath(values: number[]) {
    let path = ''
    values.forEach((value, index) => {
      if (!Number.isFinite(value)) return
      const shouldMove = index === 0 || !Number.isFinite(values[index - 1])
      path += `${shouldMove ? 'M' : 'L'} ${getX(index)} ${getY(value)} `
    })
    return path.trim()
  }

  return (
    <div style={chartShell}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '100%' }} aria-hidden="true">
        <rect x={padding.left} y={padding.top} width={plotWidth} height={plotHeight} rx={18} fill="rgba(244,248,252,0.95)" />

        {Array.from({ length: ticks + 1 }).map((_, index) => {
          const value = minValue + (range * index) / ticks
          const y = padding.top + plotHeight - (plotHeight * index) / ticks
          return (
            <g key={index}>
              <line x1={padding.left} y1={y} x2={padding.left + plotWidth} y2={y} stroke="rgba(15,66,88,0.10)" strokeDasharray="4 6" />
              <text x={padding.left - 10} y={y + 4} textAnchor="end" style={axisText}>
                {`${Math.round(value)}${suffix}`}
              </text>
            </g>
          )
        })}

        {labels.map((label, index) => (
          <g key={label}>
            <line x1={getX(index)} y1={padding.top} x2={getX(index)} y2={padding.top + plotHeight} stroke="rgba(15,66,88,0.05)" />
            {(index % labelStep === 0 || index === labels.length - 1) ? (
              <text x={getX(index)} y={height - 14} textAnchor="middle" style={axisText}>
                {label}
              </text>
            ) : null}
          </g>
        ))}

        {activeSeries.map((item) => {
          const path = buildPath(item.values)

          return (
            <g key={item.label}>
              <path d={path} fill="none" stroke={item.color} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
              {item.values.map((value, index) => (
                Number.isFinite(value) ? (
                  <g key={`${item.label}-${labels[index] || index}`}>
                    <circle cx={getX(index)} cy={getY(value)} r="5.5" fill="#fff" stroke={item.color} strokeWidth="3" />
                  </g>
                ) : null
              ))}
            </g>
          )
        })}
      </svg>

      <div style={legendRow}>
        {activeSeries.map((item) => (
          <div key={item.label} style={legendItem}>
            <span style={{ ...legendDot, background: item.color }} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ForecastGroupedBarChart({
  labels,
  series,
  height = 260,
  suffix = '',
}: {
  labels: string[]
  series: GroupedBarSeries[]
  height?: number
  suffix?: string
}) {
  const activeSeries = series.filter((item) => item.values.some((value) => Number.isFinite(value)))
  if (!labels.length || !activeSeries.length) {
    return <div style={emptyState}>No chart data available.</div>
  }

  const width = 760
  const padding = { top: 22, right: 22, bottom: 42, left: 44 }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom
  const maxValue = Math.max(...activeSeries.flatMap((item) => item.values), 1)
  const groupWidth = plotWidth / labels.length
  const innerGap = 10
  const totalGap = Math.max(8, groupWidth * 0.18)
  const barWidth = Math.max(10, (groupWidth - totalGap - innerGap * (activeSeries.length - 1)) / activeSeries.length)

  return (
    <div style={chartShell}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '100%' }} aria-hidden="true">
        <rect x={padding.left} y={padding.top} width={plotWidth} height={plotHeight} rx={18} fill="rgba(244,248,252,0.95)" />

        {Array.from({ length: 5 }).map((_, index) => {
          const value = (maxValue * index) / 4
          const y = padding.top + plotHeight - (plotHeight * index) / 4
          return (
            <g key={index}>
              <line x1={padding.left} y1={y} x2={padding.left + plotWidth} y2={y} stroke="rgba(15,66,88,0.10)" strokeDasharray="4 6" />
              <text x={padding.left - 10} y={y + 4} textAnchor="end" style={axisText}>
                {`${Math.round(value)}${suffix}`}
              </text>
            </g>
          )
        })}

        {labels.map((label, groupIndex) => {
          const groupStart = padding.left + groupIndex * groupWidth + totalGap / 2
          return (
            <g key={label}>
              {activeSeries.map((item, seriesIndex) => {
                const value = item.values[groupIndex] ?? 0
                const barHeight = Math.max(8, (value / maxValue) * plotHeight)
                const x = groupStart + seriesIndex * (barWidth + innerGap)
                const y = padding.top + plotHeight - barHeight
                return (
                  <g key={`${item.label}-${label}`}>
                    <rect x={x} y={y} width={barWidth} height={barHeight} rx={10} fill={item.color} opacity="0.9" />
                    <text x={x + barWidth / 2} y={y - 8} textAnchor="middle" style={barValueText}>
                      {`${Math.round(value)}${suffix}`}
                    </text>
                  </g>
                )
              })}
              <text x={groupStart + (activeSeries.length * barWidth + (activeSeries.length - 1) * innerGap) / 2} y={height - 14} textAnchor="middle" style={axisText}>
                {label}
              </text>
            </g>
          )
        })}
      </svg>

      <div style={legendRow}>
        {activeSeries.map((item) => (
          <div key={item.label} style={legendItem}>
            <span style={{ ...legendDot, background: item.color }} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const chartShell: CSSProperties = {
  display: 'grid',
  gap: 12,
  minWidth: 0,
  width: '100%',
  overflow: 'hidden',
}

const legendRow: CSSProperties = {
  display: 'flex',
  gap: 14,
  flexWrap: 'wrap',
}

const legendItem: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 12,
  fontWeight: 700,
  color: '#415274',
}

const legendDot: CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: 999,
  display: 'inline-block',
}

const axisText: CSSProperties = {
  fill: '#5B6C8B',
  fontSize: '11px',
  fontWeight: 700,
}

const barValueText: CSSProperties = {
  fill: '#0B2540',
  fontSize: '11px',
  fontWeight: 800,
}

const emptyState: CSSProperties = {
  minHeight: 180,
  display: 'grid',
  placeItems: 'center',
  borderRadius: 18,
  border: '1px dashed rgba(15,66,88,0.14)',
  background: 'rgba(245,249,253,0.8)',
  color: '#5B6C8B',
  fontSize: 13,
}
