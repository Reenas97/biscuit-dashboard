import { NavLink } from 'react-router-dom'

const sections = [
  { icon: '⌂', label: 'Dashboard', path: '/' },
  { icon: '✦', label: 'Ideias', path: '/ideias' },
  { icon: '▣', label: 'Projetos', path: '/projetos' },
  { icon: '♙', label: 'Clientes', path: '/clientes' },
  { icon: '□', label: 'Planejamento', path: '/planejamento' },
  { icon: '◇', label: 'Materiais', path: '/materiais' },
  { icon: '◎', label: 'Metas', path: '/metas' },
  { icon: '⚙', label: 'Configurações', path: '/configuracoes' },
]

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">R</div>
        <div>
          <strong>Reena Studio</strong>
          <span>Ateliê de biscuit</span>
        </div>
      </div>

      <nav aria-label="Navegação principal">
        {sections.map((section) => (
          <NavLink
            className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
            end={section.path === '/'}
            key={section.path}
            to={section.path}
          >
            <span className="nav-icon" aria-hidden="true">{section.icon}</span>
            <span className="nav-label">{section.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="avatar">RS</div>
        <div>
          <strong>Renata</strong>
          <span>Meu ateliê</span>
        </div>
      </div>
    </aside>
  )
}
