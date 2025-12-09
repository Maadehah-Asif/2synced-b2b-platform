import React from 'react'
import Layout from '../../../components/Layout'
import ModuleBackButton from '../../../components/ModuleBackButton'
import useRecommendations from './useRecommendations'
import RecommendationsFilterBar from './RecommendationsFilterBar'
import RecommendationExplainPanel from './RecommendationExplainPanel'
import RecommendationHistoryTable from './RecommendationHistoryTable'

export default function RecommendationsPage(){
  const { data, loading, error, refetch, run, markDone, dismiss, filters, setFilters } = useRecommendations()
  const [openExplain, setOpenExplain] = React.useState(false)
  const [selectedSignals, setSelectedSignals] = React.useState<any>(null)

  function openExplainPanel(signals:any){
    setSelectedSignals(signals)
    setOpenExplain(true)
  }

  return (
    <Layout>
      <main className="page-root">
        <h2 style={{ marginTop: 16 }}>Recommendations</h2>
        <div style={{ marginTop: 8 }}>
          <ModuleBackButton toSuffix={'/module7'} />
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={{ marginBottom: 8 }}>
            <button onClick={() => run()} className="px-4 py-2 bg-blue-700 text-white rounded">Run recommendations</button>
            <button onClick={() => refetch()} className="ml-2 px-3 py-2 border rounded">Refresh</button>
          </div>

          <RecommendationsFilterBar filters={filters} setFilters={setFilters} onApply={()=>refetch()} onClear={()=>refetch()} />

          {loading && <div>Loading...</div>}
          {error && <div style={{ color: 'red' }}>Error: {String(error)}</div>}

          {!loading && data && (
            <div>
              <div style={{ marginBottom: 12 }}>
                <strong>Open:</strong> {data.summary?.openCount || 0} — <strong>High urgency:</strong> {data.summary?.highUrgencyCount || 0}
              </div>

              <div>
                {(data.recommendations || []).length === 0 && <div>All good — no open recommendations</div>}
                {(data.recommendations || []).map((r:any) => (
                  <div key={String(r.id)} style={{ padding: 10, border: '1px solid #eee', marginBottom: 8, borderRadius: 6, display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ maxWidth: '70%' }}>
                      <div style={{ fontWeight: 700 }}>{r.leadName || r.leadId} — {r.companyName || ''}</div>
                      <div style={{ fontSize: 12, color: '#666' }}>{r.currentStage} • leakage: {typeof r.leakageProbability === 'number' ? (r.leakageProbability.toFixed(2)) : '—'} • fatigue: {r.fatigueLevel}</div>
                      <div style={{ marginTop: 8, fontSize: 15 }}>{r.actionLabel || r.recommendedAction}</div>
                      <div style={{ fontSize: 12, color: '#444', marginTop: 6 }}>{r.shortExplanation}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12 }}>Impact: {r.impactScore}</div>
                      <div style={{ marginTop: 8 }}>
                        <button onClick={() => markDone(r.id)} className="px-3 py-1 bg-green-600 text-white rounded">Done</button>
                        <button onClick={() => dismiss(r.id)} className="px-3 py-1 ml-2 bg-gray-200 rounded">Dismiss</button>
                        <button onClick={()=>openExplainPanel(data.explainableSignals && data.explainableSignals[r.id])} className="px-3 py-1 ml-2 border rounded">Explain</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <RecommendationHistoryTable history={data.history} />
            </div>
          )}
        </div>

        <RecommendationExplainPanel open={!!openExplain} onClose={()=>setOpenExplain(false)} signals={selectedSignals} />
      </main>
    </Layout>
  )
}
