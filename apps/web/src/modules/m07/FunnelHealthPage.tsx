import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';
import { FilterBar } from './FilterBar';
import { KPITiles } from './KPITiles';
import { SankeyChart } from './SankeyChart';
import { FunnelChart } from './FunnelChart';
import { StageVelocityTable } from './StageVelocityTable';
import { LeakageHeatmap } from './LeakageHeatmap';
import { ExportSection } from './ExportSection';
import { useFunnelHealth, type FunnelHealthFilters } from './useFunnelHealth';

function getWorkspaceId() {
  const hash = window.location.hash || '';
  const m = hash.match(/#\/workspace\/(.+?)(?:\/|$)/);
  return m ? m[1] : null;
}

export default function FunnelHealthPage() {
  const workspaceId = getWorkspaceId();
  const [filters, setFilters] = useState<FunnelHealthFilters>({});
  const { data, loading, error, refetch, validationErrors } = useFunnelHealth(workspaceId, filters);

  // Redirect if no workspace ID
  useEffect(() => {
    if (!workspaceId) {
      window.location.hash = '#/workspaces';
    }
  }, [workspaceId]);

  const handleApplyFilters = (newFilters: FunnelHealthFilters) => {
    setFilters(newFilters);
  };

  if (!workspaceId) {
    return (
      <Layout>
        <main className="page-root" style={{ padding: '24px' }}>
          <div style={{ color: '#999' }}>Redirecting...</div>
        </main>
      </Layout>
    );
  }

  return (
    <Layout>
      <main className="page-root">
        {/* Page Header */}
        <div style={{ padding: '24px 24px 0' }}>
          <h2 style={{ margin: '0 0 8px 0', color: '#0B2540', fontSize: '28px', fontWeight: 800 }}>
            Funnel Health & Stage Movement
          </h2>
          <p style={{ margin: '0', fontSize: '14px', color: '#666' }}>
            Analyze lead progression, identify bottlenecks, and track stage velocity.
          </p>
          <div style={{ marginTop: '12px' }}>
            <ModuleBackButton toSuffix={'/module7'} />
          </div>
        </div>

        {/* Global error banner */}
        {error && Object.keys(validationErrors).length === 0 && (
          <div
            style={{
              margin: '24px 24px 0',
              backgroundColor: '#fee2e2',
              color: '#991b1b',
              padding: '16px',
              borderRadius: '6px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '14px',
            }}
          >
            <div>
              <strong>Failed to load funnel data.</strong> {error}
            </div>
            <button
              onClick={() => refetch()}
              style={{
                padding: '8px 16px',
                backgroundColor: 'transparent',
                color: '#991b1b',
                border: '1px solid #991b1b',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600,
                transition: 'all 200ms ease',
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLButtonElement).style.backgroundColor = '#fecaca';
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLButtonElement).style.backgroundColor = 'transparent';
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Filter Bar */}
        <div style={{ padding: '24px 24px 0' }}>
          <FilterBar onApplyFilters={handleApplyFilters} loading={loading} />
        </div>

        {/* Validation errors in filter bar are handled by FilterBar component */}

        {/* Content Section */}
        <div style={{ padding: '0 24px 24px' }}>
          {/* KPI Tiles */}
          <div style={{ marginBottom: '24px' }}>
            <KPITiles data={data} loading={loading} error={error} />
          </div>

          {/* Charts Row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '24px',
              marginBottom: '24px',
            }}
          >
            <div>
              <SankeyChart data={data} loading={loading} />
            </div>
            <div>
              <FunnelChart data={data} loading={loading} />
            </div>
          </div>

          {/* Stage Velocity Table */}
          <div style={{ marginBottom: '24px' }}>
            <StageVelocityTable data={data} loading={loading} />
          </div>

          {/* Leakage Heatmap */}
          <div style={{ marginBottom: '24px' }}>
            <LeakageHeatmap data={data} loading={loading} />
          </div>

          {/* Export Section */}
          <div>
            <ExportSection data={data} loading={loading} />
          </div>
        </div>
      </main>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </Layout>
  );
}
