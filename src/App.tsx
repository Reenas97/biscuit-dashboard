import { Navigate, Route, Routes } from 'react-router-dom'
import {
  FaBullseye,
  FaGear,
} from 'react-icons/fa6'
import { AppLayout } from './components/AppLayout'
import { DashboardPage } from './pages/DashboardPage'
import { IdeasPage } from './pages/IdeasPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { MaterialsPage } from './pages/MaterialsPage'
import { ClientsPage } from './pages/ClientsPage'
import { PlanningPage } from './pages/PlanningPage'
import { PlaceholderPage } from './pages/PlaceholderPage'
import './App.scss'

const placeholderPages = [
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
        <Route path="materiais" element={<MaterialsPage />} />
        <Route path="clientes" element={<ClientsPage />} />
        <Route path="planejamento" element={<PlanningPage />} />
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
