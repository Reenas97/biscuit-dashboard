import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { DashboardPage } from './pages/DashboardPage'
import { IdeasPage } from './pages/IdeasPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { MaterialsPage } from './pages/MaterialsPage'
import { ClientsPage } from './pages/ClientsPage'
import { PlanningPage } from './pages/PlanningPage'
import { GoalsPage } from './pages/GoalsPage'
import { SettingsPage } from './pages/SettingsPage'
import { LoginPage } from './pages/LoginPage'
import { useAuth } from './auth/AuthContext'
import './App.scss'

function App() {
  const { user, loading } = useAuth()
  if (loading) return <div className="auth-loading"><span /><p>Preparando seu ateliê...</p></div>
  if (!user) return <LoginPage />
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="ideias" element={<IdeasPage />} />
        <Route path="projetos" element={<ProjectsPage />} />
        <Route path="materiais" element={<MaterialsPage />} />
        <Route path="clientes" element={<ClientsPage />} />
        <Route path="planejamento" element={<PlanningPage />} />
        <Route path="metas" element={<GoalsPage />} />
        <Route path="configuracoes" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
