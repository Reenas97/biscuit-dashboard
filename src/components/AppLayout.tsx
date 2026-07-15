import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

const titles: Record<string, string> = {
  '/': 'Dashboard',
  '/ideias': 'Ideias',
  '/projetos': 'Projetos',
  '/clientes': 'Clientes',
  '/planejamento': 'Planejamento',
  '/materiais': 'Materiais',
  '/metas': 'Metas',
  '/configuracoes': 'Configurações',
}

export function AppLayout() {
  const { pathname } = useLocation()

  return (
    <div className="app-shell">
      <Sidebar />
      <main>
        <Topbar title={titles[pathname] ?? 'Reena Biscuit'} />
        <section className="page-content">
          <Outlet />
        </section>
      </main>
    </div>
  )
}
