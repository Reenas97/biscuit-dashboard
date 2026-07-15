import { FaBell } from 'react-icons/fa6'

type TopbarProps = { title: string }

export function Topbar({ title }: TopbarProps) {
  return (
    <header className="topbar">
      <div>
        <span className="eyebrow">REENA BISCUIT</span>
        <h1>{title}</h1>
      </div>
      <button className="notification" type="button" aria-label="Notificações"><FaBell /></button>
    </header>
  )
}
