import React from 'react'

type Props = {
  toSuffix?: string // suffix after workspace id, e.g. '' or '/m06' or '/m01'
  label?: string
}

export default function ModuleBackButton({ toSuffix = '', label = 'Back' }: Props){
  function getWorkspaceId(){
    const hash = window.location.hash || '';
    const m = hash.match(/#\/workspace\/(.+?)(?:\/|$)/);
    return m ? m[1] : null;
  }
  const wid = getWorkspaceId();
  function go(){ if(!wid) return; window.location.hash = `#/workspace/${wid}${toSuffix}` }
  return (
    <button className="btn-outline btn-sm" onClick={go} style={{ marginRight: 8 }}>
      ← {label}
    </button>
  )
}
