// Deprecated helper: kept only to avoid import errors if referenced.
// All landing behavior (including Google token handling) now lives in
// `modules/core/landing/Landing.tsx`.

export default function Landing() {
  // Immediately redirect to the real landing route/component
  if (typeof window !== 'undefined') {
    window.location.hash = '#/landing'
  }
  return null
}
