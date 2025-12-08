import { useState, useRef, useEffect } from 'react'
import './module7.css'
import RoundedButton from './RoundedButton.tsx'
import Page1Stats from './Page1Stats'

export default function Module7Dropdown() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  function getWorkspaceId() {
    const hash = window.location.hash || ''
    const m = hash.match(/#\/workspace\/(.+?)(?:\/|$)/)
    return m ? m[1] : null
  }

  function openInWorkspace() {
    const wid = getWorkspaceId()
    if (!wid) return
    window.location.hash = `#/workspace/${wid}/m07/element1`
    setOpen(false)
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
      <RoundedButton onClick={() => setOpen((s) => !s)} label="Module 7" />
      <div className="m7-panel" aria-hidden={!open}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h4 style={{ margin: 0 }}>Module 7</h4>
          <button
            className="m7-rounded"
            onClick={openInWorkspace}
            style={{ padding: '6px 10px', fontSize: 12 }}
          >
            Open in Workspace
          </button>
        </div>
        <div style={{ marginTop: 8 }}>
          {/* Compact summary version for dropdown */}
          <Page1Stats compact />
        </div>
      </div>
    </div>
  )
}
