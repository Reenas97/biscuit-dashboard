import type { IconType } from 'react-icons'

type PlaceholderPageProps = {
  title: string
  icon: IconType
  description: string
}

export function PlaceholderPage({ title, icon: Icon, description }: PlaceholderPageProps) {
  return (
    <div className="empty-panel page-placeholder">
      <div className="empty-icon"><Icon /></div>
      <h2>{title}</h2>
      <p>{description}</p>
      <span>Esta página será construída em uma próxima etapa.</span>
    </div>
  )
}
