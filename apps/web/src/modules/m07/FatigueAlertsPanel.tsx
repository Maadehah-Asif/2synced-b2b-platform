type Props = {
  alerts: { sentAt: string; count: number }[] | null;
}

export default function FatigueAlertsPanel({ alerts }: Props) {
  if (!alerts || !alerts.length) return <div className="card p-4">No alerts</div>;
  return (
    <div className="card p-4">
      <div className="text-sm">Alerts</div>
      <ul>
        {alerts.map((a, i) => (
          <li key={i}>{new Date(a.sentAt).toLocaleString()} — {a.count} sent</li>
        ))}
      </ul>
    </div>
  )
}
