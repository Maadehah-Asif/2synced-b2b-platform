import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import ModuleBackButton from '../../components/ModuleBackButton';
import { getWorkspaceIdFromHash } from '../../utils/workspace';
import { downloadModuleReportExport, fetchModuleReport, type ModuleReportPayload } from './services';

function getModuleKeyFromHash() {
  const hash = window.location.hash || '';
  const match = hash.match(/\/m08\/(m01|m02|m06|m07)(?:\/|$)/i);
  return match ? match[1].toLowerCase() : null;
}

function getModuleHomeSuffix(moduleKey: string | null) {
  if (!moduleKey) return '';
  return `/${moduleKey}`;
}

function getModuleBadge(moduleKey: string | null) {
  switch (moduleKey) {
    case 'm01':
      return 'Lead Quality & Scoring';
    case 'm02':
      return 'Intent Signals';
    case 'm06':
      return 'Revenue Insight';
    case 'm07':
      return 'Funnel Insight';
    default:
      return 'Report';
  }
}

function getReportTemplate(moduleKey: string | null) {
  switch (moduleKey) {
    case 'm01':
      return {
        coverLabel: 'Lead Readiness Report',
        summaryHeading: '1. Lead Intake Summary',
        snapshotHeading: '2. Intake Performance Snapshot',
        findingsHeading: '3. Lead Pipeline Findings',
        recommendationsHeading: '4. Intake Governance Actions',
        appendixPrefix: 'Appendix',
      };
    case 'm02':
      return {
        coverLabel: 'Intent Prioritization Report',
        summaryHeading: '1. Intent Summary',
        snapshotHeading: '2. Prioritization Snapshot',
        findingsHeading: '3. Intent Findings',
        recommendationsHeading: '4. Priority Actions',
        appendixPrefix: 'Appendix',
      };
    case 'm06':
      return {
        coverLabel: 'Revenue Attribution Report',
        summaryHeading: '1. Revenue Summary',
        snapshotHeading: '2. Attribution Performance Snapshot',
        findingsHeading: '3. Revenue Findings',
        recommendationsHeading: '4. ROI Actions',
        appendixPrefix: 'Appendix',
      };
    case 'm07':
      return {
        coverLabel: 'Funnel Health Report',
        summaryHeading: '1. Funnel Health Summary',
        snapshotHeading: '2. Funnel Performance Snapshot',
        findingsHeading: '3. Funnel Findings',
        recommendationsHeading: '4. Recommended Funnel Actions',
        appendixPrefix: 'Appendix',
      };
    default:
      return {
        coverLabel: 'Management Report',
        summaryHeading: '1. Executive Summary',
        snapshotHeading: '2. Key Performance Snapshot',
        findingsHeading: '3. Principal Findings',
        recommendationsHeading: '4. Recommended Actions',
        appendixPrefix: 'Appendix',
      };
  }
}

function getReportTheme() {
  return {
    hero: 'linear-gradient(135deg, rgba(18,59,87,0.98) 0%, rgba(15,66,88,0.94) 52%, rgba(72,177,217,0.24) 100%)',
    badgeBg: 'rgba(255,255,255,0.12)',
    badgeBorder: 'rgba(255,255,255,0.16)',
    accentBg: 'rgba(15,66,88,0.08)',
    accentText: '#0f4258',
    printAccent: '#0f4258',
  };
}

export default function ModuleReportPage() {
  const [report, setReport] = useState<ModuleReportPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [printReady, setPrintReady] = useState(false);
  const workspaceId = getWorkspaceIdFromHash();
  const moduleKey = getModuleKeyFromHash();
  const template = getReportTemplate(moduleKey);
  const theme = getReportTheme();

  useEffect(() => {
    let active = true;
    async function load() {
      if (!workspaceId || !moduleKey) {
        setMessage('Workspace or module context is missing from the route.');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setMessage('');
        setReport(null);
        const payload = await fetchModuleReport(moduleKey, workspaceId);
        if (!active) return;
        setReport(payload);
      } catch (error: unknown) {
        if (!active) return;
        setReport(null);
        setMessage(error instanceof Error ? error.message : 'Could not load the report.');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [moduleKey, workspaceId]);

  useEffect(() => {
    setPrintReady(false);
    const timer = window.setTimeout(() => setPrintReady(true), 700);
    return () => window.clearTimeout(timer);
  }, [moduleKey, workspaceId]);

  async function handleExport(exportKey: string, filename: string) {
    if (!workspaceId || !moduleKey) return;
    try {
      setMessage('');
      await downloadModuleReportExport(moduleKey, workspaceId, exportKey, filename);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'Could not download the export.');
    }
  }

  function handlePrint() {
    if (!printReady) return;
    window.print();
  }

  return (
    <Layout>
      <style>{`
        @media print {
          html,
          body {
            width: auto !important;
            height: auto !important;
            overflow: visible !important;
            background: #fff !important;
          }

          .report-screen {
            display: none !important;
          }

          .print-report {
            display: block !important;
            width: 100% !important;
            max-width: none !important;
            overflow: visible !important;
          }

          .app-header-shell,
          .workspace-header-shell,
          .app-root .guided-assistant-shell,
          .app-root .guided-assistant-trigger,
          .report-actions,
          .report-downloads,
          .report-back {
            display: none !important;
          }

          .app-root,
          .app-layout,
          .app-main,
          .surface,
          .card-pad,
          .report-shell {
            display: block !important;
            background: #fff !important;
            box-shadow: none !important;
            border: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
            max-height: none !important;
            overflow: visible !important;
          }

          .report-shell {
            font-family: Georgia, "Times New Roman", serif !important;
            color: #111827 !important;
            width: 100% !important;
            max-width: none !important;
            overflow: visible !important;
          }

          .report-hero,
          .report-card,
          .report-table-card {
            background: #fff !important;
            color: #111827 !important;
            border: 1px solid #d1d5db !important;
            box-shadow: none !important;
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .report-grid-two,
          .report-metrics {
            display: block !important;
          }

          .report-grid-two > *,
          .report-metrics > * {
            margin-bottom: 16px !important;
          }

          .report-section {
            break-before: page;
            page-break-before: always;
          }

          .report-table {
            font-size: 11px !important;
          }

          .print-report {
            font-family: Georgia, "Times New Roman", serif !important;
            color: #111827 !important;
          }

          .print-cover,
          .print-main-section,
          .print-appendix {
            break-inside: auto;
            page-break-inside: auto;
            overflow: visible !important;
          }

          .print-block,
          .print-section-shell,
          .print-table-shell {
            break-inside: auto;
            page-break-inside: auto;
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
          }

          .print-page-break {
            break-before: page;
            page-break-before: always;
          }

          .print-heading {
            break-after: avoid-page;
            page-break-after: avoid;
          }

          .print-cover-page {
            min-height: auto;
          }

          .print-main-section {
            margin-top: 10mm;
          }

          .print-main-section + .print-main-section {
            margin-top: 10mm;
          }

          table,
          thead,
          tbody,
          tr,
          td,
          th {
            break-inside: auto !important;
            page-break-inside: auto !important;
          }

          .report-table th,
          .report-table td {
            color: #111827 !important;
            border-color: #d1d5db !important;
          }

          @page {
            size: A4;
            margin: 18mm 14mm;
          }
        }

        @media screen {
          .print-report {
            display: none;
          }
        }
      `}</style>
      <main className="page-root report-shell" style={{ padding: 20 }}>
        <div className="report-screen">
        <div className="report-back" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ModuleBackButton toSuffix={getModuleHomeSuffix(moduleKey)} label="Back" />
          <h2 style={{ marginTop: 16 }}>Report Center</h2>
        </div>

        <section
          className="report-hero"
          style={{
            marginTop: 18,
            borderRadius: 24,
            overflow: 'hidden',
            border: '1px solid rgba(15,66,88,0.08)',
            boxShadow: '0 20px 46px rgba(13,30,60,0.08)',
            background: theme.hero,
            color: '#fff',
          }}
        >
          <div style={{ padding: 28, display: 'grid', gap: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div>
                <div style={{ display: 'inline-flex', padding: '7px 12px', borderRadius: 999, background: theme.badgeBg, border: `1px solid ${theme.badgeBorder}`, fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {getModuleBadge(moduleKey)}
                </div>
                <h1 style={{ margin: '16px 0 8px', fontSize: 36, lineHeight: 1.05, fontWeight: 900, color: '#fff' }}>
                  {report?.title || 'Professional Report'}
                </h1>
                <div style={{ maxWidth: 760, color: 'rgba(255,255,255,0.84)', fontSize: 15, lineHeight: 1.7 }}>
                  {report?.subtitle || 'Loading report context.'}
                </div>
              </div>
              <div className="report-actions" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn-outline btn-sm"
                  onClick={handlePrint}
                  disabled={!printReady}
                  style={{
                    background: 'rgba(255,255,255,0.14)',
                    color: '#fff',
                    borderColor: 'rgba(255,255,255,0.2)',
                    opacity: printReady ? 1 : 0.72,
                    cursor: printReady ? 'pointer' : 'default',
                  }}
                >
                  Download PDF Report
                </button>
              </div>
            </div>

            {report ? (
              <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ color: 'rgba(255,255,255,0.76)', fontSize: 12 }}>
                  Generated {new Date(report.generatedAt).toLocaleString()}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.80)', fontSize: 14, maxWidth: 820, lineHeight: 1.75 }}>
                  This document is designed to be exported as a written PDF report. Use the PDF action above for the narrative report, and use the CSV downloads below only when you need raw supporting data tables.
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {loading ? <div style={{ marginTop: 18 }}>Loading report...</div> : null}
        {!loading && message ? <div style={{ marginTop: 18, color: '#b42318' }}>{message}</div> : null}

        {report ? (
          <>
            <section className="report-metrics" style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              {report.metricCards.map((metric) => (
                <div key={metric.label} className="report-card" style={{ borderRadius: 20, padding: 20, border: '1px solid rgba(15,66,88,0.08)', background: 'linear-gradient(180deg, rgba(255,255,255,1), rgba(246,249,252,0.98))', boxShadow: '0 16px 38px rgba(13,30,60,0.05)' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B7A90' }}>{metric.label}</div>
                  <div style={{ marginTop: 10, fontSize: 30, fontWeight: 900, color: '#0B2540' }}>{metric.value}</div>
                  <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.6, color: '#415274' }}>{metric.helper}</div>
                </div>
              ))}
            </section>

            <section className="report-grid-two" style={{ marginTop: 18, display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 18 }}>
              <div className="report-card" style={{ borderRadius: 22, padding: 22, background: 'linear-gradient(180deg, rgba(255,255,255,1), rgba(247,250,253,0.98))', border: '1px solid rgba(15,66,88,0.08)', boxShadow: '0 16px 38px rgba(13,30,60,0.06)' }}>
                <div style={{ display: 'inline-flex', padding: '6px 11px', borderRadius: 999, background: theme.accentBg, color: theme.accentText, fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {report.overviewTitle}
                </div>
                <div style={{ marginTop: 14, fontSize: 25, fontWeight: 900, color: '#0B2540', lineHeight: 1.2 }}>
                  Management Summary
                </div>
                <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
                  {report.overviewBody.map((item, index) => (
                    <div key={`${index}-${item}`} style={{ borderRadius: 16, padding: 16, border: '1px solid rgba(15,66,88,0.08)', background: 'rgba(255,255,255,0.85)', color: '#415274', lineHeight: 1.8, fontSize: 14 }}>
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div className="report-card" style={{ borderRadius: 22, padding: 22, background: 'linear-gradient(180deg, rgba(243,248,252,0.98), rgba(255,255,255,1))', border: '1px solid rgba(15,66,88,0.08)', boxShadow: '0 16px 38px rgba(13,30,60,0.05)' }}>
                <div style={{ display: 'inline-flex', padding: '6px 11px', borderRadius: 999, background: theme.accentBg, color: theme.accentText, fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Recommended Actions
                </div>
                <div style={{ marginTop: 14, fontSize: 25, fontWeight: 900, color: '#0B2540', lineHeight: 1.2 }}>
                  Recommended Next Steps
                </div>
                <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
                  {report.recommendations.map((item, index) => (
                    <div key={`${index}-${item}`} style={{ borderRadius: 16, padding: 16, border: '1px solid rgba(15,66,88,0.08)', background: '#fff', color: '#415274', lineHeight: 1.75, fontSize: 14 }}>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="report-grid-two" style={{ marginTop: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
              <div className="report-card" style={{ borderRadius: 22, padding: 22, background: '#fff', border: '1px solid rgba(15,66,88,0.08)', boxShadow: '0 16px 38px rgba(13,30,60,0.05)' }}>
                <div style={{ display: 'inline-flex', padding: '6px 11px', borderRadius: 999, background: theme.accentBg, color: theme.accentText, fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Key Findings
                </div>
                <div style={{ marginTop: 14, fontSize: 25, fontWeight: 900, color: '#0B2540', lineHeight: 1.2 }}>
                  Findings
                </div>
                <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
                  {report.highlights.map((item, index) => (
                    <div key={`${index}-${item}`} style={{ borderRadius: 16, padding: 16, border: '1px solid rgba(15,66,88,0.08)', background: 'rgba(247,250,253,0.98)', color: '#415274', lineHeight: 1.75, fontSize: 14 }}>
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div className="report-card report-downloads" style={{ borderRadius: 22, padding: 22, background: '#fff', border: '1px solid rgba(15,66,88,0.08)', boxShadow: '0 16px 38px rgba(13,30,60,0.05)' }}>
                <div style={{ display: 'inline-flex', padding: '6px 11px', borderRadius: 999, background: theme.accentBg, color: theme.accentText, fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Downloads
                </div>
                <div style={{ marginTop: 14, fontSize: 25, fontWeight: 900, color: '#0B2540', lineHeight: 1.2 }}>
                  Supporting Data Exports
                </div>
                <div style={{ marginTop: 8, fontSize: 14, color: '#415274', lineHeight: 1.7 }}>
                  Use the PDF action for the written report. Use the CSV downloads below only when you need the underlying structured data for audit, analysis, or spreadsheet work.
                </div>
                <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
                  {report.exports.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => handleExport(item.key, item.filename)}
                      style={{ borderRadius: 16, padding: 16, border: '1px solid rgba(15,66,88,0.08)', background: '#fff', textAlign: 'left', cursor: 'pointer' }}
                    >
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#0B2540' }}>{item.label}</div>
                      <div style={{ marginTop: 6, fontSize: 13, color: '#415274', lineHeight: 1.65 }}>{item.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="report-section" style={{ marginTop: 18, display: 'grid', gap: 18 }}>
              {report.sections.map((section) => (
                <div key={section.key} className="report-table-card" style={{ borderRadius: 22, padding: 22, background: '#fff', border: '1px solid rgba(15,66,88,0.08)', boxShadow: '0 16px 38px rgba(13,30,60,0.05)', overflowX: 'auto' }}>
                <div style={{ display: 'inline-flex', padding: '6px 11px', borderRadius: 999, background: theme.accentBg, color: theme.accentText, fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Supporting Detail
                </div>
                  <div style={{ marginTop: 14, fontSize: 24, fontWeight: 900, color: '#0B2540' }}>{section.title}</div>
                  <div style={{ marginTop: 8, fontSize: 14, color: '#415274', lineHeight: 1.65 }}>{section.description}</div>
                  <table className="report-table" style={{ width: '100%', borderCollapse: 'collapse', marginTop: 18 }}>
                    <thead>
                      <tr>
                        {section.columns.map((column) => (
                          <th key={column} style={{ textAlign: 'left', padding: '12px 10px', borderBottom: '1px solid rgba(15,66,88,0.12)', color: '#0B2540', fontSize: 13 }}>{column}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {section.rows.length > 0 ? (
                        section.rows.map((row, rowIndex) => (
                          <tr key={`${section.key}-${rowIndex}`}>
                            {row.map((cell, cellIndex) => (
                              <td key={`${section.key}-${rowIndex}-${cellIndex}`} style={{ padding: '12px 10px', borderBottom: '1px solid rgba(15,66,88,0.06)', color: '#415274', fontSize: 13 }}>
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={section.columns.length} style={{ padding: '14px 10px', color: '#6B7A90' }}>
                            No rows are available for this section yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ))}
            </section>
          </>
        ) : null}
        </div>

        {report ? (
          <article className="print-report">
            <section className="print-cover print-cover-page" style={{ padding: '8mm 2mm 0', color: '#111827' }}>
              <div style={{ fontSize: 12, letterSpacing: '0.04em', textTransform: 'none', color: theme.printAccent, fontWeight: 700 }}>
                {getModuleBadge(moduleKey)} {template.coverLabel}
              </div>
              <h1 style={{ fontSize: 30, lineHeight: 1.15, margin: '10mm 0 4mm', fontWeight: 700 }}>
                {report.title}
              </h1>
              <div style={{ fontSize: 14, lineHeight: 1.8, color: '#344054', maxWidth: '170mm' }}>
                {report.subtitle}
              </div>
              <div style={{ marginTop: '8mm', fontSize: 12, color: '#475467' }}>
                Generated on {new Date(report.generatedAt).toLocaleString()}
              </div>
            </section>

            <section className="print-main-section" style={{ padding: '8mm 2mm 0' }}>
              <div className="print-block">
                <h2 className="print-heading" style={{ fontSize: 20, margin: '0 0 4mm', fontWeight: 700, color: theme.printAccent }}>{template.summaryHeading}</h2>
                <div style={{ display: 'grid', gap: '4mm' }}>
                  {report.overviewBody.map((paragraph, index) => (
                    <p key={`print-overview-${index}`} style={{ margin: 0, fontSize: 13, lineHeight: 1.9, color: '#1f2937' }}>
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>
            </section>

            <section className="print-main-section" style={{ padding: '0 2mm' }}>
              <div className="print-block print-section-shell">
                <h2 className="print-heading" style={{ fontSize: 20, margin: '0 0 4mm', fontWeight: 700, color: theme.printAccent }}>{template.snapshotHeading}</h2>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '3mm' }}>
                  <thead>
                    <tr>
                      <th style={printTh}>Metric</th>
                      <th style={printTh}>Current Value</th>
                      <th style={printTh}>Interpretation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.metricCards.map((metric) => (
                      <tr key={`print-metric-${metric.label}`}>
                        <td style={printTd}>{metric.label}</td>
                        <td style={printTd}>{metric.value}</td>
                        <td style={printTd}>{metric.helper}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="print-main-section" style={{ padding: '0 2mm' }}>
              <div className="print-block print-section-shell">
                <h2 className="print-heading" style={{ fontSize: 20, margin: '0 0 4mm', fontWeight: 700, color: theme.printAccent }}>{template.findingsHeading}</h2>
                <ol style={{ margin: '0 0 0 5mm', padding: 0, display: 'grid', gap: '3mm' }}>
                  {report.highlights.map((item, index) => (
                    <li key={`print-highlight-${index}`} style={{ fontSize: 13, lineHeight: 1.85, color: '#1f2937', paddingLeft: '1mm' }}>
                      {item}
                    </li>
                  ))}
                </ol>
              </div>
            </section>

            <section className="print-main-section" style={{ padding: '0 2mm' }}>
              <div className="print-block print-section-shell">
                <h2 className="print-heading" style={{ fontSize: 20, margin: '0 0 4mm', fontWeight: 700, color: theme.printAccent }}>{template.recommendationsHeading}</h2>
                <ol style={{ margin: '0 0 0 5mm', padding: 0, display: 'grid', gap: '3mm' }}>
                  {report.recommendations.map((item, index) => (
                    <li key={`print-rec-${index}`} style={{ fontSize: 13, lineHeight: 1.85, color: '#1f2937', paddingLeft: '1mm' }}>
                      {item}
                    </li>
                  ))}
                </ol>
              </div>
            </section>

            {report.sections.map((section, index) => (
              <section key={`print-section-${section.key}`} className={`print-appendix ${index === 0 ? 'print-page-break' : 'print-page-break'}`} style={{ padding: '6mm 2mm 0' }}>
                <div style={{ fontSize: 12, letterSpacing: '0.04em', textTransform: 'none', color: theme.printAccent, fontWeight: 700 }}>
                  {template.appendixPrefix} {String.fromCharCode(65 + index)}
                </div>
                <h2 className="print-heading" style={{ fontSize: 22, margin: '4mm 0 3mm', fontWeight: 700, color: '#111827' }}>
                  {section.title}
                </h2>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.8, color: '#374151' }}>
                  {section.description}
                </p>
                <table className="print-table-shell" style={{ width: '100%', borderCollapse: 'collapse', marginTop: '6mm' }}>
                  <thead>
                    <tr>
                      {section.columns.map((column) => (
                        <th key={`print-col-${section.key}-${column}`} style={printTh}>{column}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {section.rows.length > 0 ? (
                      section.rows.map((row, rowIndex) => (
                        <tr key={`print-row-${section.key}-${rowIndex}`}>
                          {row.map((cell, cellIndex) => (
                            <td key={`print-cell-${section.key}-${rowIndex}-${cellIndex}`} style={printTd}>
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={section.columns.length} style={printTd}>
                          No supporting rows are currently available for this appendix.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>
            ))}
          </article>
        ) : null}
      </main>
    </Layout>
  );
}

const printTh: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 10px',
  borderBottom: '1px solid #d1d5db',
  borderTop: '1px solid #d1d5db',
  fontSize: 11,
  color: '#111827',
  fontWeight: 700,
  background: '#f8fafc',
};

const printTd: React.CSSProperties = {
  textAlign: 'left',
  verticalAlign: 'top',
  padding: '8px 10px',
  borderBottom: '1px solid #e5e7eb',
  fontSize: 11,
  lineHeight: 1.6,
  color: '#1f2937',
};
