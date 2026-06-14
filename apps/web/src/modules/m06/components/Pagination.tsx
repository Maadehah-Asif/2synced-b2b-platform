/**
 * Module: Revenue Attribution & ROI (m06)
 * Layer: Frontend
 * File: Pagination.tsx
 * Purpose: Supports the P ag in at io n flow for this module.
 * Notes: Documentation header added for maintainability.
 */

type Props = {
  page: number
  total: number
  limit: number
  onPage: (page: number) => void
}

export default function Pagination({ page, total, limit, onPage }: Props) {
  if (!total || total <= limit) return null

  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, limit)))
  const windowSize = 5
  let start = Math.max(1, page - Math.floor(windowSize / 2))
  if (start + windowSize - 1 > totalPages) start = Math.max(1, totalPages - windowSize + 1)

  const pages: number[] = []
  for (let i = 0; i < windowSize && start + i <= totalPages; i += 1) pages.push(start + i)

  return (
    <span className="pagination">
      {start > 1 ? <button type="button" className="page-btn" onClick={() => onPage(1)}>1</button> : null}
      {start > 2 ? <span className="mx-8 muted">...</span> : null}
      {pages.map((item) => (
        <button key={item} type="button" className={`page-btn ${item === page ? 'active' : ''}`} onClick={() => onPage(item)}>
          {item}
        </button>
      ))}
      {pages[pages.length - 1] < totalPages ? (
        <>
          <span className="mx-8 muted">...</span>
          <button type="button" className="page-btn" onClick={() => onPage(totalPages)}>{totalPages}</button>
        </>
      ) : null}
    </span>
  )
}
