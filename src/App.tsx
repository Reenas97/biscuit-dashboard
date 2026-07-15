import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { DashboardPage } from './pages/DashboardPage'
import { PlaceholderPage } from './pages/PlaceholderPage'
import './App.css'

const placeholderPages = [
  { path: 'ideias', title: 'Ideias', icon: '✦', description: 'Guarde inspirações e transforme-as em projetos quando estiver pronta.' },
  { path: 'projetos', title: 'Projetos', icon: '▣', description: 'Acompanhe encomendas e projetos pessoais em cada etapa.' },
  { path: 'clientes', title: 'Clientes', icon: '♙', description: 'Organize contatos, pedidos e o histórico de cada cliente.' },
  { path: 'planejamento', title: 'Planejamento', icon: '□', description: 'Visualize tarefas, prazos e sua disponibilidade.' },
  { path: 'materiais', title: 'Materiais', icon: '◇', description: 'Acompanhe estoque, consumo e sua lista de compras.' },
  { path: 'metas', title: 'Metas', icon: '◎', description: 'Defina objetivos e acompanhe seu progresso.' },
  { path: 'configuracoes', title: 'Configurações', icon: '⚙', description: 'Personalize o Reena Studio para a sua rotina.' },
]

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
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
