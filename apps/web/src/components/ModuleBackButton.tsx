import { getWorkspaceIdFromHash } from '../utils/workspace'

type Props = {
  toSuffix?: string
  label?: string
}

export default function ModuleBackButton({ toSuffix = '', label = 'Back' }: Props) {
  const wid = getWorkspaceIdFromHash()

  function goFallback() {
    if (wid) {
      const suffix = toSuffix.startsWith('/') ? toSuffix : `/${toSuffix ?? ''}`
      const normalized = suffix === '/' ? '' : suffix.replace(/\/+/g, '/')
      window.location.hash = `#/workspace/${wid}${normalized}`
      return
    }
    window.location.hash = '#/workspaces'
  }

  function go() {
    const currentHash = window.location.hash
    if (window.history.length > 1) {
      window.history.back()
      window.setTimeout(() => {
        if (window.location.hash === currentHash) goFallback()
      }, 180)
      return
    }
    goFallback()
  }

  return (
    <button className="btn-outline btn-sm module-back-button" onClick={go} style={{ minHeight: 38, marginRight: 8, whiteSpace: 'nowrap' }}>
      {'\u2190'} {label}
    </button>
  )
}
