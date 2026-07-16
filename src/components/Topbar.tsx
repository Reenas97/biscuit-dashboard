import { FaBell } from 'react-icons/fa6'
import { useAtelierSettings } from '../settings'

type TopbarProps = { title: string }

export function Topbar({ title }: TopbarProps) {
  const settings = useAtelierSettings()
  return (
    <header className="topbar">
      <div>
        <span className="eyebrow">{settings.studioName.toLocaleUpperCase('pt-BR')}</span>
        <h1>{title}</h1>
      </div>
      <button className="notification" type="button" aria-label="Notificações"><FaBell /></button>
    </header>
  )
}
