import Layout from '../../components/Layout'
import Page1Stats from './Page1Stats'

export default function Element1Page() {
  return (
    <Layout>
      <main className="page-root">

        {/* Page title */}
        <h2 style={{ marginTop: 16 }}>Module 7 — Page 1 Stats</h2>

        {/* NO CONTAINER, NO MAX WIDTH, NO CENTERING, NO WRAPPER */}
        <Page1Stats />

      </main>
    </Layout>
  )
}
