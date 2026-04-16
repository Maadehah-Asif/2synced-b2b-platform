import type { CSSProperties } from 'react'

export function insightBarWidth(value: number, max: number, floor = 8) {
  if (!max || max <= 0) return `${floor}%`
  return `${Math.max(floor, Math.min(100, Math.round((value / max) * 100)))}%`
}

export const insightTokens = {
  panel: {
    borderRadius: 22,
    padding: 22,
    background: 'linear-gradient(180deg, rgba(255,255,255,1), rgba(247,250,253,0.98))',
    border: '1px solid rgba(15,66,88,0.08)',
    boxShadow: '0 16px 38px rgba(13,30,60,0.06)',
  } satisfies CSSProperties,
  panelSoft: {
    borderRadius: 22,
    padding: 22,
    background: 'linear-gradient(180deg, rgba(243,248,252,0.98), rgba(255,255,255,1))',
    border: '1px solid rgba(15,66,88,0.08)',
    boxShadow: '0 16px 38px rgba(13,30,60,0.05)',
  } satisfies CSSProperties,
  tableWrap: {
    borderRadius: 16,
    overflow: 'hidden',
    border: '1px solid rgba(15,66,88,0.08)',
    background: '#fff',
  } satisfies CSSProperties,
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    background: '#fff',
  } satisfies CSSProperties,
  th: {
    padding: 12,
    textAlign: 'left',
    borderBottom: '1px solid #e5e7eb',
    fontSize: 12,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: '#5B6C8B',
    background: '#f7fafc',
  } satisfies CSSProperties,
  td: {
    padding: 12,
    borderBottom: '1px solid #eef2f7',
    fontSize: 13,
    color: '#415274',
  } satisfies CSSProperties,
  tdStrong: {
    padding: 12,
    borderBottom: '1px solid #eef2f7',
    fontSize: 13,
    color: '#0B2540',
    fontWeight: 800,
  } satisfies CSSProperties,
  row: {
    borderBottom: '1px solid #eef2f7',
  } satisfies CSSProperties,
  track: {
    width: '100%',
    height: 10,
    borderRadius: 999,
    background: 'rgba(15,66,88,0.08)',
    overflow: 'hidden',
  } satisfies CSSProperties,
  fill: {
    height: '100%',
    borderRadius: 999,
    background: 'linear-gradient(135deg, #0f4258 0%, #2b6f8a 100%)',
  } satisfies CSSProperties,
  mutedText: {
    fontSize: 13,
    lineHeight: 1.7,
    color: '#415274',
  } satisfies CSSProperties,
  twoCol: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.45fr) minmax(320px, 0.95fr)',
    gap: 18,
  } satisfies CSSProperties,
  equalCol: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 18,
  } satisfies CSSProperties,
} as const
