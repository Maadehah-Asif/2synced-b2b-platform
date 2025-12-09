import type { FunnelHealthResponse } from './useFunnelHealth';

interface ExportSectionProps {
  data: FunnelHealthResponse | null;
  loading: boolean;
}

export function ExportSection({ data, loading }: ExportSectionProps) {
  const hasData = data && data.exportUrls;

  const handleDownload = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '24px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
      }}
    >
      <h4 style={{ margin: '0 0 16px 0', color: '#0B2540', fontSize: '16px', fontWeight: 600 }}>
        Export Data
      </h4>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <button
          onClick={() => {
            if (hasData) {
              handleDownload(data.exportUrls.csv, 'funnel-health.csv');
            }
          }}
          disabled={!hasData || loading}
          style={{
            padding: '10px 20px',
            backgroundColor: hasData && !loading ? '#0A1A75' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: hasData && !loading ? 'pointer' : 'not-allowed',
            transition: 'all 200ms ease',
            opacity: hasData && !loading ? 1 : 0.6,
          }}
        >
          📊 Export CSV
        </button>

        <button
          onClick={() => {
            if (hasData) {
              handleDownload(data.exportUrls.pdf, 'funnel-health.pdf');
            }
          }}
          disabled={!hasData || loading}
          style={{
            padding: '10px 20px',
            backgroundColor: hasData && !loading ? '#0A1A75' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: hasData && !loading ? 'pointer' : 'not-allowed',
            transition: 'all 200ms ease',
            opacity: hasData && !loading ? 1 : 0.6,
          }}
        >
          📄 Export PDF
        </button>
      </div>

      <div style={{ marginTop: '12px', fontSize: '12px', color: '#999' }}>
        {loading && 'Loading data...'}
        {!loading && !hasData && 'No export data available. Load data above first.'}
        {!loading && hasData && 'Click to download funnel health report in your preferred format.'}
      </div>
    </div>
  );
}
