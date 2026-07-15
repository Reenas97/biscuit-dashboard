type TopbarProps = { title: string }

export function Topbar({ title }: TopbarProps) {
  return (
    <header className="topbar">
      <div>
        <span className="eyebrow">REENA STUDIO</span>
        <h1>{title}</h1>
      </div>
      <button className="notification" type="button" aria-label="Notificações">○</button>
    </header>
  )
}
