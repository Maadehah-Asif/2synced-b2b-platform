import { useState, useRef, useEffect } from 'react'
import './module6.css'
import RoundedButton from './RoundedButton.tsx'
import Page1Stats from './Page1Stats'

export default function Module6Dropdown() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  function getWorkspaceId(){
    const hash = window.location.hash || '';
    const m = hash.match(/#\/workspace\/(.+?)(?:\/|$)/);
    return m ? m[1] : null;
  }

  function openInWorkspace(){
    const wid = getWorkspaceId();
    if(!wid) return;
    window.location.hash = `#/workspace/${wid}/m06/element1`;
    setOpen(false);
  }

  function go(path: string){
    const wid = getWorkspaceId();
    if(!wid) return;
    window.location.hash = `#/workspace/${wid}${path}`;
    setOpen(false);
  }

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return
      if (!ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('click', onDoc)
    return () => document.removeEventListener('click', onDoc)
  }, [])

  return (
    <div className={`m7-root ${open ? 'open' : ''}`} ref={ref}>
      <RoundedButton onClick={() => setOpen(s => !s)} label="Module 6" />
      <div className="m7-panel" aria-hidden={!open}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ margin: 0 }}>Module 6</h4>
          <button className="m7-rounded" onClick={openInWorkspace} style={{ padding: '6px 10px', fontSize: 12 }}>Open in Workspace</button>
        </div>
        <div style={{ marginTop: 8 }}>
          <Page1Stats />
        </div>
        <div style={{ marginTop: 12, display:'grid', gap:6 }}>
          <button className="m7-link" style={{ textAlign:'left' }} onClick={()=>go('/m06/campaigns/manage')}>Campaign Manager</button>
          <button className="m7-link" style={{ textAlign:'left' }} onClick={()=>go('/m06/campaigns')}>View Campaigns</button>
          <button className="m7-link" style={{ textAlign:'left' }} onClick={()=>go('/m06/touches/input')}>Add Touches</button>
          <button className="m7-link" style={{ textAlign:'left' }} onClick={()=>go('/m06/touches')}>Campaign Touches</button>
          <button className="m7-link" style={{ textAlign:'left' }} onClick={()=>go('/m06/journeys')}>Journey Preview</button>
          <button className="m7-link" style={{ textAlign:'left' }} onClick={()=>go('/m06/run-attribution')}>Run Attribution</button>
        </div>
      </div>
    </div>
  )
}
