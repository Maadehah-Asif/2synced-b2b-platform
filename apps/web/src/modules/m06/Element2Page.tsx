/**
 * Module: Revenue Attribution & ROI (m06)
 * Layer: Frontend
 * File: Element2Page.tsx
 * Purpose: Supports the E le me nt2 Pa ge flow for this module.
 * Notes: Documentation header added for maintainability.
 */

import React from 'react'
import Layout from '../../components/Layout'
import ModuleBackButton from '../../components/ModuleBackButton'

export default function Element2Page(){
  return (
    <Layout>
      <main className="page-root">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ModuleBackButton toSuffix="/m06" />
          <h2 style={{ marginTop: 16, marginBottom: 0 }}>Revenue Insight Page Removed</h2>
        </div>
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 14, color: '#444' }}>
            The previous "Element 2" page (Attribution Runner) has been removed. Use the Revenue Insight main dashboard for overview and runs.
          </div>
        </div>
      </main>
    </Layout>
  )
}
