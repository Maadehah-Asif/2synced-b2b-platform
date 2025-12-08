import Layout from '../../components/Layout'
import ModuleBackButton from '../../components/ModuleBackButton'
import Page1Stats from './Page1Stats'
import './module6.css'

export default function Element1Page() {
  // workspace id available via ModuleBackButton internally when needed
  return (
    <Layout>
      <main className="page-root">
        {/* Page title and back button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ModuleBackButton toSuffix="/m06" />
          <h2 style={{ marginTop: 16, marginBottom: 0 }}>Module 6 — Home</h2>
        </div>
        {/* Module action buttons moved to Module7Home */}
        {/* NO CONTAINER, NO MAX WIDTH, NO CENTERING, NO WRAPPER */}
        <Page1Stats />

      </main>
    </Layout>
  )
}
