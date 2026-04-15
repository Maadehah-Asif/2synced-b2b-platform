export type Module5View = 'home' | 'overview' | 'pipeline' | 'web-engagement' | 'web-visualization' | 'shortcomings' | 'communication'

export function getModule5ViewFromHash(): Module5View {
  if (typeof window === 'undefined') return 'home'
  const hash = window.location.hash || ''
  const queryIndex = hash.indexOf('?')
  if (queryIndex === -1) return 'home'
  const query = hash.slice(queryIndex + 1)
  const params = new URLSearchParams(query)
  const view = params.get('view')
  return view === 'overview' || view === 'pipeline' || view === 'web-engagement' || view === 'web-visualization' || view === 'shortcomings' || view === 'communication' ? view : 'home'
}

export function setModule5View(view: Module5View) {
  if (typeof window === 'undefined') return
  const hash = window.location.hash || ''
  const base = hash.split('?')[0] || '#/workspaces'
  if (view === 'home') {
    window.location.hash = base
    return
  }
  const params = new URLSearchParams()
  params.set('view', view)
  window.location.hash = `${base}?${params.toString()}`
}
