import { useMemo, useState } from 'react';
import '../../../styles/dataPreview.css';

type ValidationIssue = {
  field: string;
  message: string;
};

type PreviewRow = {
  rowNumber: number;
  original: Record<string, string>;
  errors?: ValidationIssue[];
  warnings?: ValidationIssue[];
  valid?: boolean;
};

type Props = {
  title: string;
  subtitle: string;
  sourceHeaders: string[];
  rows: PreviewRow[];
  currentStartRow: number;
  totalSelectedRows: number;
};

const PAGE_SIZES = [10, 20, 50] as const;

export default function ImportPreviewStep({ title, subtitle, sourceHeaders, rows, currentStartRow, totalSelectedRows }: Props) {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<number>(20);
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const pageCount = Math.max(1, Math.ceil(rows.length / perPage));
  const safePage = Math.min(page, pageCount);
  const visibleRows = useMemo(() => rows.slice((safePage - 1) * perPage, safePage * perPage), [rows, safePage, perPage]);
  const hasMore = safePage < pageCount;

  function renderPagination() {
    const windowSize = 5;
    let start = Math.max(1, safePage - Math.floor(windowSize / 2));
    if (start + windowSize - 1 > pageCount) start = Math.max(1, pageCount - windowSize + 1);
    const pages: number[] = [];
    for (let cursor = start; cursor <= Math.min(pageCount, start + windowSize - 1); cursor++) pages.push(cursor);
    return (
      <span className="pagination">
        {start > 1 && <button type="button" className="page-btn" onClick={() => setPage(1)}>1</button>}
        {start > 2 && <span className="mx-8 muted">...</span>}
        {pages.map((value) => (
          <button key={value} type="button" className={`page-btn ${value === safePage ? 'active' : ''}`} onClick={() => setPage(value)}>
            {value}
          </button>
        ))}
        {pages[pages.length - 1] < pageCount && (
          <>
            {pages[pages.length - 1] + 1 < pageCount && <span className="mx-8 muted">...</span>}
            <button type="button" className="page-btn" onClick={() => setPage(pageCount)}>{pageCount}</button>
          </>
        )}
      </span>
    );
  }

  function renderTable() {
    return (
      <div className="preview-table-container">
        {visibleRows.length === 0 ? (
          <div className="data-preview-empty">No rows selected for preview.</div>
        ) : (
          <table className="table preview-table">
            <thead>
              <tr>
                <th className="preview-rownum-header">#</th>
                <th>Status</th>
                {sourceHeaders.map((header) => <th key={header}>{header}</th>)}
                <th>Issues</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => {
                const selected = selectedRow === row.rowNumber;
                const errors = row.errors || [];
                const warnings = row.warnings || [];
                const statusLabel = row.valid === false ? 'Invalid' : warnings.length > 0 ? 'Warning' : 'Valid';
                return (
                  <tr key={row.rowNumber} className={selected ? 'row-selected' : ''} onClick={() => setSelectedRow(selected ? null : row.rowNumber)}>
                    <td className="preview-rownum-cell">{row.rowNumber}</td>
                    <td>{statusLabel}</td>
                    {sourceHeaders.map((header) => <td key={`${row.rowNumber}-${header}`}>{row.original[header] ?? ''}</td>)}
                    <td>{[...errors.map((issue) => issue.message), ...warnings.map((issue) => issue.message)].join(' | ') || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  return (
    <div className="data-preview-page" style={{ padding: 0 }}>
      <div className="data-preview-hero">
        <div className="data-preview-hero-copy">
          <div className="data-preview-kicker">Import Preview</div>
          <h2 className="data-preview-title">{title}</h2>
          <p className="data-preview-subtitle">{subtitle}</p>
        </div>
        <div className="data-preview-hero-side">
          <div className="data-preview-stat">
            <span className="data-preview-stat-label">Selected Rows</span>
            <strong>{totalSelectedRows}</strong>
          </div>
          <div className="data-preview-stat">
            <span className="data-preview-stat-label">Preview Page</span>
            <strong>{safePage}</strong>
          </div>
          <div className="data-preview-stat">
            <span className="data-preview-stat-label">Visible Columns</span>
            <strong>{sourceHeaders.length}</strong>
          </div>
        </div>
      </div>

      <div className="data-preview-controls">
        <div className="data-preview-controls-left">
          <div className="data-preview-field">
            <span className="data-preview-label">Rows Per Page</span>
            <select value={perPage} onChange={(event) => { setPerPage(Number(event.target.value)); setPage(1); }}>
              {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </div>
        </div>
        <div className="data-preview-controls-right">
          <div className="data-preview-pagination">
            <button type="button" className="btn-ghost" disabled={safePage <= 1} onClick={() => setPage(Math.max(1, safePage - 1))}>Prev</button>
            {renderPagination()}
            <button type="button" className="btn-ghost" disabled={!hasMore} onClick={() => setPage(Math.min(pageCount, safePage + 1))}>Next</button>
          </div>
          <button type="button" className="btn-primary" onClick={() => setIsFullscreen(true)}>Zoom</button>
        </div>
      </div>

      <div className="data-preview-table-shell">
        <div className="data-preview-table-head">
          <h3 className="data-preview-table-title">Selected CSV Rows</h3>
          <div className="data-preview-table-caption">
            Row numbers are human-friendly and match the selected upload range. Click a row to highlight it while reviewing mapped values and validation issues.
          </div>
        </div>
        {renderTable()}
        <div className="data-preview-scroll-hint">
          Showing rows starting from selected row {currentStartRow}. Preview numbering always matches the row numbers shown to the user.
        </div>
      </div>

      {isFullscreen && (
        <div className="fullscreen-overlay data-preview-fullscreen" role="dialog" aria-modal="true">
          <div className="fullscreen-panel">
            <div className="fullscreen-header">
              <div className="font-700">{title}</div>
              <div>
                <label>Per page: <select value={perPage} onChange={(event) => { setPerPage(Number(event.target.value)); setPage(1); }}>
                  {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
                </select></label>
                <button type="button" className="ml-8" disabled={safePage <= 1} onClick={() => setPage(Math.max(1, safePage - 1))}>Prev</button>
                <span className="mx-8">&nbsp;</span>
                {renderPagination()}
                <span className="mx-8">&nbsp;</span>
                <button type="button" disabled={!hasMore} onClick={() => setPage(Math.min(pageCount, safePage + 1))}>Next</button>
                <button type="button" className="ml-8" onClick={() => setIsFullscreen(false)}>Close</button>
              </div>
            </div>
            <div className="fullscreen-body">
              {renderTable()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
