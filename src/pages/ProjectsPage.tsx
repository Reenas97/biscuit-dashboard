import { useState } from 'react'
import { FaCalendarDays, FaClipboardList, FaTrash, FaUser } from 'react-icons/fa6'

type Project = {
  id: string
  title: string
  description: string
  category: string
  tags: string[]
  type: 'Pessoal' | 'Encomenda'
  client: string
  deadline: string
  status: 'Planejamento'
  sourceIdeaId: string
  createdAt: string
}

const projectStorageKey = 'reena-biscuit-projects'

function loadProjects() {
  const saved = localStorage.getItem(projectStorageKey)
  if (!saved) return []
  try { return JSON.parse(saved) as Project[] } catch { return [] }
}

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>(loadProjects)

  function deleteProject(id: string) {
    const nextProjects = projects.filter((project) => project.id !== id)
    setProjects(nextProjects)
    localStorage.setItem(projectStorageKey, JSON.stringify(nextProjects))
  }

  return (
    <div className="projects-page">
      <div className="ideas-heading">
        <span className="section-kicker"><FaClipboardList /> PROJETOS EM ANDAMENTO</span>
        <h2>Da inspiração para a bancada</h2>
        <p>Acompanhe os trabalhos que já saíram do papel e estão sendo planejados ou produzidos.</p>
      </div>

      {projects.length > 0 ? (
        <div className="projects-grid mt-7 grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {projects.map((project) => (
            <article className="project-card" key={project.id}>
              <div className="project-card-heading">
                <span>{project.type}</span>
                <strong>{project.status}</strong>
              </div>
              <h3>{project.title}</h3>
              <p>{project.description || 'Projeto criado a partir do banco de ideias.'}</p>
              <div className="project-info">
                {project.client && <span><FaUser /> {project.client}</span>}
                <span><FaCalendarDays /> {project.deadline ? new Date(`${project.deadline}T12:00:00`).toLocaleDateString('pt-BR') : 'Sem prazo'}</span>
              </div>
              <div className="idea-tags">{project.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>
              <button className="project-delete" onClick={() => deleteProject(project.id)} type="button" aria-label={`Excluir projeto ${project.title}`}><FaTrash /> Excluir projeto</button>
            </article>
          ))}
        </div>
      ) : (
        <div className="ideas-empty mt-7">
          <FaClipboardList />
          <h3>Nenhum projeto ainda</h3>
          <p>Converta uma ideia para vê-la aparecer aqui.</p>
        </div>
      )}
    </div>
  )
}
