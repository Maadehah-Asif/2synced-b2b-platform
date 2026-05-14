import { useEffect } from 'react'
import { getWorkspaceIdFromHash } from '../utils/workspace'

type Props = {
  toSuffix?: string
  label?: string
}

export default function ModuleBackButton({ toSuffix = '', label = 'Back' }: Props) {
  const wid = getWorkspaceIdFromHash()

  useEffect(() => {
    rememberHash(window.location.hash)
    const onHashChange = () => rememberHash(window.location.hash)
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  function goFallback() {
    if (wid) {
      const fallbackSuffix = toSuffix || inferModuleHomeSuffix(window.location.hash)
      const suffix = fallbackSuffix.startsWith('/') ? fallbackSuffix : `/${fallbackSuffix ?? ''}`
      const normalized = suffix === '/' ? '' : suffix.replace(/\/+/g, '/')
      window.location.hash = `#/workspace/${wid}${normalized}`
      return
    }
    window.location.hash = '#/workspaces'
  }

  function go() {
    const previousHash = takePreviousMeaningfulHash(window.location.hash)
    if (previousHash) {
      window.location.hash = previousHash
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

const HASH_STACK_KEY = 'b2b-platform:hash-stack'

function readHashStack() {
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(HASH_STACK_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function rememberHash(hash: string) {
  if (!hash) return
  const stack = readHashStack()
  if (stack[stack.length - 1] === hash) return
  const next = [...stack, hash].slice(-30)
  window.sessionStorage.setItem(HASH_STACK_KEY, JSON.stringify(next))
}

function takePreviousMeaningfulHash(currentHash: string) {
  const stack = readHashStack()
  while (stack[stack.length - 1] === currentHash) stack.pop()
  const previous = stack.pop()
  window.sessionStorage.setItem(HASH_STACK_KEY, JSON.stringify(stack))
  if (!previous) return null
  if (!sameWorkspace(previous, currentHash)) return null
  return previous
}

function sameWorkspace(a: string, b: string) {
  const workspaceA = a.match(/#\/workspace\/(.+?)(?:\/|$)/)?.[1] || null
  const workspaceB = b.match(/#\/workspace\/(.+?)(?:\/|$)/)?.[1] || null
  return workspaceA && workspaceA === workspaceB
}

function inferModuleHomeSuffix(hash: string) {
  const matched = hash.match(/#\/workspace\/[^/]+\/(m\d{2})(?:\/([^?]+))?(\?.*)?$/)
  if (!matched) return ''
  const hasSubPage = Boolean(matched[2] || matched[3])
  return hasSubPage ? `/${matched[1]}` : ''
}
