type Row = {
  leadId: string;
  leadName: string | null;
  fatigueLevel: string;
  touchCount: number;
  lastTouchAt: string | null;
  lastCampaignName: string | null;
  ownerName: string | null;
}

type Props = {
  rows: Row[];
  onRowClick?: (leadId: string) => void;
}

export default function FatiguedLeadsTable({ rows, onRowClick }: Props) {
  return (
    <div className="card p-4">
      <table className="w-full">
        <thead>
          <tr><th>Lead</th><th>Level</th><th>Touches</th><th>Last touch</th><th>Last campaign</th><th>Owner</th></tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.leadId} style={{ cursor: onRowClick ? 'pointer' : 'default' }} onClick={() => onRowClick && onRowClick(r.leadId)}>
              <td>{r.leadName || '—'}</td>
              <td>{r.fatigueLevel}</td>
              <td>{r.touchCount}</td>
              <td>{r.lastTouchAt ? new Date(r.lastTouchAt).toLocaleString() : '—'}</td>
              <td>{r.lastCampaignName || '—'}</td>
              <td>{r.ownerName || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
