export default function RecommendationHistoryTable({ history }: any) {
  if (!history) return null
  return (
    <div style={{ marginTop: 12 }}>
      <h4>Action History</h4>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #eee', padding: 6 }}>Lead</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #eee', padding: 6 }}>Action</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #eee', padding: 6 }}>Status</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #eee', padding: 6 }}>Completed By</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #eee', padding: 6 }}>When</th>
          </tr>
        </thead>
        <tbody>
          {history.map((h:any) => (
            <tr key={h.id}>
              <td style={{ padding: 6, borderBottom: '1px solid #fafafa' }}>{h.leadName || '—'}</td>
              <td style={{ padding: 6, borderBottom: '1px solid #fafafa' }}>{h.actionLabel}</td>
              <td style={{ padding: 6, borderBottom: '1px solid #fafafa' }}>{h.status}</td>
              <td style={{ padding: 6, borderBottom: '1px solid #fafafa' }}>{h.completedByName || '—'}</td>
              <td style={{ padding: 6, borderBottom: '1px solid #fafafa' }}>{h.completedAt ? new Date(h.completedAt).toLocaleString() : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
