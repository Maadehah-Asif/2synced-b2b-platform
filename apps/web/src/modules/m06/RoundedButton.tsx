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
