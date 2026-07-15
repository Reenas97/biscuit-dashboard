type PlaceholderPageProps = {
  title: string
  icon: string
  description: string
}

export function PlaceholderPage({ title, icon, description }: PlaceholderPageProps) {
  return (
    <div className="empty-panel page-placeholder">
      <div className="empty-icon">{icon}</div>
      <h2>{title}</h2>
      <p>{description}</p>
      <span>Esta página será construída em uma próxima etapa.</span>
    </div>
  )
}
