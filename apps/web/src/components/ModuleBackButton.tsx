import React from 'react'
import { getWorkspaceIdFromHash } from '../utils/workspace'

type Props = {
  toSuffix?: string // suffix after workspace id, e.g. '' or '/m06' or '/m01'
  label?: string
}

export default function ModuleBackButton({ toSuffix = '', label = 'Back' }: Props){
  const wid = getWorkspaceIdFromHash();
  function go(){
    if (wid) {
      const suffix = toSuffix.startsWith('/') ? toSuffix : `/${toSuffix ?? ''}`;
      const normalized = suffix === '/' ? '' : suffix.replace(/\/+/g, '/');
      window.location.hash = `#/workspace/${wid}${normalized}`;
    } else {
      window.location.hash = '#/workspaces';
    }
  }
  return (
    <button className="btn-outline btn-sm" onClick={go} style={{ marginRight: 8 }}>
      ← {label}
    </button>
  )
}
