import { useState } from 'react'

export default function RecommendationsFilterBar({ filters, setFilters, onApply, onClear }: any) {
  const [local, setLocal] = useState<any>(filters || {})

  function apply() {
    setFilters(local)
    onApply && onApply(local)
  }

  function clear() {
    setLocal({})
    setFilters({})
    onClear && onClear()
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
      <input placeholder="Stage" value={local.stage||''} onChange={e=>setLocal({...local, stage: e.target.value})} />
      <select value={local.leakage||''} onChange={e=>setLocal({...local, leakage: e.target.value})}>
        <option value="">Leakage</option>
        <option value="HIGH">High</option>
        <option value="MEDIUM">Medium</option>
        <option value="LOW">Low</option>
      </select>
      <select value={local.fatigue||''} onChange={e=>setLocal({...local, fatigue: e.target.value})}>
        <option value="">Fatigue</option>
        <option value="OK">OK</option>
        <option value="WARM">WARM</option>
        <option value="TIRED">TIRED</option>
        <option value="BURNT_OUT">BURNT_OUT</option>
      </select>
      <input placeholder="Campaign" value={local.campaign||''} onChange={e=>setLocal({...local, campaign: e.target.value})} />
      <button onClick={apply} className="px-3 py-1 bg-blue-600 text-white rounded">Apply</button>
      <button onClick={clear} className="px-3 py-1 border rounded">Clear</button>
    </div>
  )
}
