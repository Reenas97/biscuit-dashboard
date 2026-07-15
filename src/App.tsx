import { Navigate, Route, Routes } from 'react-router-dom'
import {
  FaBoxOpen,
  FaBullseye,
  FaCalendarDays,
  FaGear,
  FaUsers,
} from 'react-icons/fa6'
import { AppLayout } from './components/AppLayout'
import { DashboardPage } from './pages/DashboardPage'
import { IdeasPage } from './pages/IdeasPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { PlaceholderPage } from './pages/PlaceholderPage'
import './App.scss'

const placeholderPages = [
  { path: 'clientes', title: 'Clientes', icon: FaUsers, description: 'Organize contatos, pedidos e o histórico de cada cliente.' },
  { path: 'planejamento', title: 'Planejamento', icon: FaCalendarDays, description: 'Visualize tarefas, prazos e sua disponibilidade.' },
  { path: 'materiais', title: 'Materiais', icon: FaBoxOpen, description: 'Acompanhe estoque, consumo e sua lista de compras.' },
  { path: 'metas', title: 'Metas', icon: FaBullseye, description: 'Defina objetivos e acompanhe seu progresso.' },
  { path: 'configuracoes', title: 'Configurações', icon: FaGear, description: 'Personalize o Reena Biscuit para a sua rotina.' },
]

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="ideias" element={<IdeasPage />} />
        <Route path="projetos" element={<ProjectsPage />} />
        {placeholderPages.map((page) => (
          <Route
            key={page.path}
            path={page.path}
            element={<PlaceholderPage {...page} />}
          />
        ))}
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
