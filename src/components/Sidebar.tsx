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
  FaRightFromBracket,
} from 'react-icons/fa6'
import logo from '../assets/reena-biscuit-logo.png'
import { useAtelierSettings } from '../settings'
import { useAuth } from '../auth/AuthContext'

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
  const settings = useAtelierSettings()
  const { logout } = useAuth()
  const initials = settings.ownerName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'RS'
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark"><img src={settings.logo || logo} alt={`Logo ${settings.studioName}`} /></div>
        <div>
          <strong>{settings.studioName}</strong>
          <span>{settings.subtitle}</span>
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
        <div className="avatar">{initials}</div>
        <div>
          <strong>{settings.ownerName}</strong>
          <span>{settings.city && settings.state ? `${settings.city} · ${settings.state}` : 'Meu ateliê'}</span>
        </div>
        <button className="logout-button" onClick={logout} type="button" aria-label="Sair do Reena Biscuit"><FaRightFromBracket /></button>
      </div>
    </aside>
  )
}
