import { useState } from 'react'

type Props = {
  onRun: (opts: { windowDays: number; threshold: number; channels: string[] }) => Promise<void>;
  loading: boolean;
}

export default function FatigueControlPanel({ onRun, loading }: Props) {
  const [windowDays, setWindowDays] = useState<number>(7);
  const [threshold, setThreshold] = useState<number>(8);
  const [channels, setChannels] = useState<string[]>([]);

  function toggleChannel(ch: string) {
    setChannels(prev => prev.includes(ch) ? prev.filter(x => x !== ch) : [...prev, ch]);
  }

  return (
    <div className="card p-4" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <div>
        <div className="text-sm">Time window</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          {[7,14,30].map(d => (
            <button key={d} className={`btn ${windowDays === d ? 'btn-primary' : ''}`} onClick={() => setWindowDays(d)}>{d}d</button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-sm">Touch threshold</div>
        <input type="number" value={threshold} onChange={e => setThreshold(Number(e.target.value))} className="p-1 border rounded" style={{ width: 120 }} />
      </div>

      <div>
        <div className="text-sm">Channels</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          {['email','ads','linkedin','calls'].map(ch => (
            <label key={ch} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={channels.includes(ch)} onChange={() => toggleChannel(ch)} /> {ch}
            </label>
          ))}
        </div>
      </div>

      <div style={{ marginLeft: 'auto' }}>
        <button className="btn btn-primary" onClick={() => onRun({ windowDays, threshold, channels })} disabled={loading}>{loading ? 'Running...' : 'Run Fatigue Detection'}</button>
      </div>
    </div>
  )
}
