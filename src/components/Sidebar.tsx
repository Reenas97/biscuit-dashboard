import { NavLink } from 'react-router-dom'
import {
  FaBoxOpen,
  FaBullseye,
  FaCalendarDays,
  FaClipboardList,
  FaGear,
  FaHouse,
  FaLightbulb,
  FaUsers,
} from 'react-icons/fa6'
import logo from '../assets/reena-biscuit-logo.png'

const sections = [
  { icon: FaHouse, label: 'Dashboard', path: '/' },
  { icon: FaLightbulb, label: 'Ideias', path: '/ideias' },
  { icon: FaClipboardList, label: 'Projetos', path: '/projetos' },
  { icon: FaUsers, label: 'Clientes', path: '/clientes' },
  { icon: FaCalendarDays, label: 'Planejamento', path: '/planejamento' },
  { icon: FaBoxOpen, label: 'Materiais', path: '/materiais' },
  { icon: FaBullseye, label: 'Metas', path: '/metas' },
  { icon: FaGear, label: 'Configurações', path: '/configuracoes' },
]

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark"><img src={logo} alt="Logo Reena Biscuit" /></div>
        <div>
          <strong>Reena Biscuit</strong>
          <span>Ateliê de biscuit</span>
        </div>
      </div>

      <nav aria-label="Navegação principal">
        {sections.map((section) => {
          const Icon = section.icon

          return (
            <NavLink
              className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
              end={section.path === '/'}
              key={section.path}
              to={section.path}
            >
              <Icon className="nav-icon" aria-hidden="true" />
              <span className="nav-label">{section.label}</span>
            </NavLink>
          )
        })}
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
