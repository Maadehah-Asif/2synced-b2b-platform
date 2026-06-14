/**
 * Module: Revenue Attribution & ROI (m06)
 * Layer: Frontend
 * File: RoundedButton.tsx
 * Purpose: Supports the R ou nd ed Bu tt on flow for this module.
 * Notes: Documentation header added for maintainability.
 */

import './rounded-button.css'

type Props = {
  onClick?: () => void
  label?: string
}

export default function RoundedButton({ onClick, label }: Props) {
  return (
    <button className="m7-rounded" onClick={onClick} aria-label={label}>
      {label}
    </button>
  )
}
