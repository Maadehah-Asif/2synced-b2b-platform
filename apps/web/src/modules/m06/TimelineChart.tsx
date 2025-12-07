export type TimelinePoint = {
  month: string;
  total: number;
};

type Props = {
  data: TimelinePoint[];
};

export default function TimelineChart({ data }: Props) {
  if (!data || data.length === 0) {
    return <div style={{ fontSize: 12, color: '#666' }}>No timeline data</div>;
  }

  const max = Math.max(...data.map((d) => d.total), 1);

  return (
    <div
      style={{
        padding: 12,
        borderRadius: 12,
        background:
          'linear-gradient(90deg, rgba(236,245,247,0.8), rgba(255,255,255,0.9))',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 18,
          height: 200,
        }}
      >
        {data.map((point, idx) => {
          const ratio = point.total / max;
          const barHeight = Math.max(20, Math.round(ratio * 160));

          return (
            <div
              key={idx}
              style={{
                flex: 1,
                minWidth: 60,
                textAlign: 'center',
                fontSize: 11,
                color: '#042a33',
              }}
            >
              <div
                style={{
                  position: 'relative',
                  height: 180,
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                }}
              >
                <div
                  style={{
                    width: '70%',
                    height: barHeight,
                    borderRadius: 14,
                    background:
                      'linear-gradient(180deg, #65A1BF 0%, #5E94B9 70%, #ACCFDA 100%)',
                    boxShadow: '0 10px 20px rgba(6,24,32,0.14)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {/* VALUE CENTERED INSIDE THE BAR */}
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#ffffff',
                    }}
                  >
                    {Math.round(point.total)}
                  </span>
                </div>
              </div>
              <div style={{ marginTop: 6 }}>{point.month}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
