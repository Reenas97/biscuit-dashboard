import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FaArrowRight, FaCalendarDays, FaCat, FaPaw } from 'react-icons/fa6'

type StoredIdea = { id: string }
type StoredProject = { id: string; title: string; deadline: string; status: string; type: string }

function readStorage<T>(key: string): T[] {
  const saved = localStorage.getItem(key)
  if (!saved) return []
  try { return JSON.parse(saved) as T[] } catch { return [] }
}

function formatToday() {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
    .format(new Date())
    .toLocaleUpperCase('pt-BR')
}

export function DashboardPage() {
  const [ideas] = useState(() => readStorage<StoredIdea>('reena-biscuit-ideas'))
  const [projects] = useState(() => readStorage<StoredProject>('reena-biscuit-projects'))
  const upcomingProjects = projects
    .filter((project) => project.deadline)
    .sort((a, b) => a.deadline.localeCompare(b.deadline))
  const nextProject = upcomingProjects[0]

  return (
    <>
      <div className="welcome-card">
        <div>
          <span className="eyebrow">{formatToday()}</span>
          <h2>Bom dia, Renata <FaPaw className="greeting-paw" /></h2>
          <p>Um resumo do que precisa da sua atenção hoje.</p>
        </div>
        <div className="cat-scene">
          <FaPaw className="scene-paw scene-paw-one" />
          <FaPaw className="scene-paw scene-paw-two" />
          <FaCat className="decorative-cat" />
        </div>
      </div>

      <div className="summary-grid mt-[18px] grid grid-cols-1 gap-4 md:grid-cols-3">
        <article><span>Projetos ativos</span><strong>{projects.length}</strong><small>{projects.length === 1 ? 'Projeto em andamento' : 'Projetos em andamento'}</small></article>
        <article><span>Próximas entregas</span><strong>{upcomingProjects.length}</strong><small>{upcomingProjects.length ? 'Com prazo definido' : 'Nenhum prazo próximo'}</small></article>
        <article><span>Ideias salvas</span><strong>{ideas.length}</strong><small>Seu banco de inspirações</small></article>
      </div>

      {nextProject ? (
        <div className="dashboard-next-project">
          <div className="next-project-icon"><FaCalendarDays /></div>
          <div>
            <span>PRÓXIMA ENTREGA</span>
            <h3>{nextProject.title}</h3>
            <p>{new Date(`${nextProject.deadline}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
          </div>
          <Link to="/projetos">Ver projetos <FaArrowRight /></Link>
        </div>
      ) : (
        <div className="empty-panel">
          <div className="empty-icon"><FaPaw /></div>
          <h3>Seu espaço está pronto</h3>
          <p>Crie um projeto com prazo para acompanhar sua próxima entrega aqui.</p>
        </div>
      )}
    </>
  )
}
