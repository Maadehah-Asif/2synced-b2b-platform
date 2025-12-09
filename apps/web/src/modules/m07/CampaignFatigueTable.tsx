type Row = {
  campaignId: string;
  campaignName: string | null;
  channel: string | null;
  leadsTouched: number;
  avgTouches: number;
  percentFatigued: number;
  recommendedAction: string;
}

type Props = {
  rows: Row[];
  onRowClick?: (campaignId: string) => void;
}

export default function CampaignFatigueTable({ rows, onRowClick }: Props) {
  return (
    <div className="card p-4">
      <table className="w-full">
        <thead>
          <tr><th>Campaign</th><th>Channel</th><th>Leads touched</th><th>Avg touches</th><th>% fatigued</th><th>Action</th></tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.campaignId} style={{ cursor: onRowClick ? 'pointer' : 'default' }} onClick={() => onRowClick && onRowClick(r.campaignId)}>
              <td>{r.campaignName || '—'}</td>
              <td>{r.channel || '—'}</td>
              <td>{r.leadsTouched}</td>
              <td>{r.avgTouches}</td>
              <td>{r.percentFatigued}%</td>
              <td>{r.recommendedAction}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
