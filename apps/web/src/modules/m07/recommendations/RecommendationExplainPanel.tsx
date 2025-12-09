import React from 'react'

export default function RecommendationExplainPanel({ open, onClose, signals }: any) {
  if (!open) return null
  return (
    <div style={{ position: 'fixed', right: 0, top: 0, width: 420, height: '100%', background: '#fff', boxShadow: '-4px 0 16px rgba(0,0,0,0.12)', padding: 16, overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Explain Logic</h3>
        <button onClick={onClose} className="px-2 py-1 border rounded">Close</button>
      </div>
      <div style={{ marginTop: 12 }}>
        <h4>Leakage Signals</h4>
        <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(signals?.leakageSignals || {}, null, 2)}</pre>
        <h4>Fatigue Signals</h4>
        <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(signals?.fatigueSignals || {}, null, 2)}</pre>
        <h4>Rules Fired</h4>
        <ul>{(signals?.rulesFired || []).map((r:any,i:number)=>(<li key={i}>{r}</li>))}</ul>
      </div>
    </div>
  )
}
