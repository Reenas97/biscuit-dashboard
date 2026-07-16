import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FaArrowRight, FaBoxesStacked, FaBullseye, FaCalendarDays, FaClock, FaClipboardCheck, FaFolderPlus, FaPause, FaPaw, FaPlay, FaPlus, FaTriangleExclamation, FaUserPlus } from 'react-icons/fa6'
import { GiCat } from 'react-icons/gi'
import { useAtelierSettings } from '../settings'
import { saveLocalData } from '../lib/cloudData'

type StoredIdea = { id: string }
type StoredProject = { id: string; title: string; deadline: string; status: string; type: string; client?: string }
type StoredClient = { id: string }
type StoredTask = { id: string; title: string; date: string; completed: boolean; priority: string }
type StoredMaterial = { id: string; name: string; stock: number; minimumStock: number; unit: string }
type StoredGoal = { id: string; title: string; target: number; current: number; unit: string; deadline: string }
type StoredUnavailable = { id: string; date: string; reason: string }
type TimeEntry = { id: string; projectId: string; startedAt: string; endedAt?: string }

const timeStorageKey = 'reena-biscuit-time-entries'

function readStorage<T>(key: string): T[] {
  const saved = localStorage.getItem(key)
  if (!saved) return []
  try { return JSON.parse(saved) as T[] } catch { return [] }
}

function formatToday() {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).format(new Date()).toLocaleUpperCase('pt-BR')
}

function dateKey(date: Date) {
  const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, '0'); const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function displayGoalValue(value: number, unit: string) {
  if (unit === 'R$') return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  return `${value.toLocaleString('pt-BR')} ${unit}`.trim()
}

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return hours > 0 ? `${hours}h ${String(minutes).padStart(2, '0')}min` : `${minutes}min ${String(seconds).padStart(2, '0')}s`
}

export function DashboardPage() {
  const settings = useAtelierSettings()
  const [ideas] = useState(() => readStorage<StoredIdea>('reena-biscuit-ideas'))
  const [projects] = useState(() => readStorage<StoredProject>('reena-biscuit-projects'))
  const [clients] = useState(() => readStorage<StoredClient>('reena-biscuit-clients'))
  const [tasks] = useState(() => readStorage<StoredTask>('reena-biscuit-tasks'))
  const [materials] = useState(() => readStorage<StoredMaterial>('reena-biscuit-materials'))
  const [goals] = useState(() => readStorage<StoredGoal>('reena-biscuit-goals'))
  const [unavailable] = useState(() => readStorage<StoredUnavailable>('reena-biscuit-unavailable-days'))
  const [timeEntries, setTimeEntries] = useState(() => readStorage<TimeEntry>(timeStorageKey))
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const today = dateKey(new Date())
  const activeProjects = projects.filter((project) => project.status !== 'Entregue')
  const datedProjects = activeProjects.filter((project) => project.deadline).sort((a, b) => a.deadline.localeCompare(b.deadline))
  const overdueProjects = datedProjects.filter((project) => project.deadline < today)
  const nextProject = datedProjects.find((project) => project.deadline >= today) ?? overdueProjects[0]
  const pendingTasks = tasks.filter((task) => !task.completed).sort((a, b) => a.date.localeCompare(b.date))
  const lowStock = materials.filter((material) => material.stock <= material.minimumStock)
  const nextUnavailable = unavailable.filter((item) => item.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0]
  const currentGoal = goals.find((goal) => goal.current < goal.target) ?? goals[0]
  const goalPercentage = currentGoal?.target > 0 ? Math.min(100, Math.round((currentGoal.current / currentGoal.target) * 100)) : 0
  const activeEntry = timeEntries.find((entry) => !entry.endedAt)
  const activeProject = projects.find((project) => project.id === activeEntry?.projectId)

  useEffect(() => {
    if (!activeEntry) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [activeEntry])

  function saveTimeEntries(entries: TimeEntry[]) {
    setTimeEntries(entries)
    saveLocalData(timeStorageKey, JSON.stringify(entries))
  }

  function startTimer() {
    if (!selectedProjectId || activeEntry) return
    saveTimeEntries([{ id: crypto.randomUUID(), projectId: selectedProjectId, startedAt: new Date().toISOString() }, ...timeEntries])
    setNow(Date.now())
  }

  function stopTimer() {
    if (!activeEntry) return
    saveTimeEntries(timeEntries.map((entry) => entry.id === activeEntry.id ? { ...entry, endedAt: new Date().toISOString() } : entry))
  }

  function projectSeconds(projectId: string) {
    return timeEntries.filter((entry) => entry.projectId === projectId).reduce((total, entry) => {
      const end = entry.endedAt ? new Date(entry.endedAt).getTime() : now
      return total + Math.max(0, Math.floor((end - new Date(entry.startedAt).getTime()) / 1000))
    }, 0)
  }

  const projectsWithTime = projects.map((project) => ({ project, seconds: projectSeconds(project.id) })).filter((item) => item.seconds > 0).sort((a, b) => b.seconds - a.seconds)

  return <>
    <div className="welcome-card"><div><span className="eyebrow">{formatToday()}</span><h2>Bom dia, {settings.ownerName.split(/\s+/)[0] || 'Renata'} <FaPaw className="greeting-paw" /></h2><p>{overdueProjects.length ? `${overdueProjects.length} ${overdueProjects.length === 1 ? 'entrega precisa' : 'entregas precisam'} da sua atenção.` : 'Um resumo do que precisa da sua atenção hoje.'}</p></div><div className="cat-scene"><FaPaw className="scene-paw scene-paw-one" /><FaPaw className="scene-paw scene-paw-two" /><GiCat className="decorative-cat" /></div></div>

    <div className="summary-grid dashboard-summary mt-[18px]">
      <Link to="/projetos"><span>Projetos ativos</span><strong>{activeProjects.length}</strong><small>{overdueProjects.length ? `${overdueProjects.length} com prazo atrasado` : 'Produção em andamento'}</small></Link>
      <Link to="/clientes"><span>Clientes</span><strong>{clients.length}</strong><small>Contatos cadastrados</small></Link>
      <Link to="/planejamento"><span>Tarefas pendentes</span><strong>{pendingTasks.length}</strong><small>{pendingTasks.length ? 'Itens no planejamento' : 'Tudo em dia por aqui'}</small></Link>
      <Link to="/materiais"><span>Estoque baixo</span><strong>{lowStock.length}</strong><small>{lowStock.length ? 'Materiais para repor' : 'Estoque saudável'}</small></Link>
    </div>

    <section className="dashboard-timer mt-[18px]">
      <div className="dashboard-timer-heading"><div><span className="section-kicker"><FaClock /> TRABALHANDO AGORA</span><h3>{activeProject ? activeProject.title : 'Cronômetro de produção'}</h3><p>{activeEntry ? `Tempo desta sessão: ${formatDuration(Math.max(0, Math.floor((now - new Date(activeEntry.startedAt).getTime()) / 1000)))}` : 'Escolha um projeto para contabilizar o tempo de trabalho.'}</p></div>{activeEntry ? <button className="timer-stop" onClick={stopTimer} type="button"><FaPause /> Pausar</button> : <div className="timer-start"><select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)} aria-label="Projeto em produção"><option value="">Selecione um projeto...</option>{activeProjects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select><button disabled={!selectedProjectId} onClick={startTimer} type="button"><FaPlay /> Iniciar</button></div>}</div>
      {projectsWithTime.length > 0 && <div className="dashboard-time-totals">{projectsWithTime.slice(0, 4).map(({ project, seconds }) => <div key={project.id}><span>{project.title}</span><strong>{formatDuration(seconds)}</strong></div>)}</div>}
    </section>

    <div className="dashboard-main-grid mt-[18px]">
      <section className="dashboard-focus">
        <div className="dashboard-section-heading"><div><span className="section-kicker"><FaCalendarDays /> PRÓXIMA ENTREGA</span><h3>Na bancada</h3></div><Link to="/projetos">Ver projetos <FaArrowRight /></Link></div>
        {nextProject ? <div className={nextProject.deadline < today ? 'dashboard-next-project overdue' : 'dashboard-next-project'}><div className="next-project-icon"><FaCalendarDays /></div><div><span>{nextProject.deadline < today ? 'PRAZO ATRASADO' : nextProject.type}</span><h3>{nextProject.title}</h3><p>{new Date(`${nextProject.deadline}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}{nextProject.client ? ` · ${nextProject.client}` : ''}</p></div><Link to="/projetos">Abrir <FaArrowRight /></Link></div> : <div className="dashboard-inline-empty"><FaPaw /><span><strong>Nenhuma entrega agendada</strong><small>Crie um projeto com prazo para acompanhar aqui.</small></span></div>}

        <div className="dashboard-lists">
          <div><div className="dashboard-mini-heading"><span><FaClipboardCheck /> Próximas tarefas</span><Link to="/planejamento">Planejamento</Link></div>{pendingTasks.length ? <div className="dashboard-task-list">{pendingTasks.slice(0, 4).map((task) => <div key={task.id}><span className={`dashboard-priority priority-${task.priority.toLocaleLowerCase('pt-BR')}`} /><strong>{task.title}</strong><time>{task.date ? new Date(`${task.date}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : 'Sem data'}</time></div>)}</div> : <p className="dashboard-muted">Nenhuma tarefa pendente.</p>}</div>
          <div><div className="dashboard-mini-heading"><span><FaBoxesStacked /> Estoque</span><Link to="/materiais">Materiais</Link></div>{lowStock.length ? <div className="dashboard-stock-list">{lowStock.slice(0, 4).map((material) => <div key={material.id}><FaTriangleExclamation /><span><strong>{material.name}</strong><small>{material.stock.toLocaleString('pt-BR')} {material.unit} disponíveis</small></span></div>)}</div> : <p className="dashboard-muted">Nenhum material com estoque baixo.</p>}</div>
        </div>
      </section>

      <aside className="dashboard-side">
        <section className="dashboard-goal"><div className="dashboard-section-heading"><div><span className="section-kicker"><FaBullseye /> META EM DESTAQUE</span><h3>Seu progresso</h3></div></div>{currentGoal ? <><strong>{currentGoal.title}</strong><div className="dashboard-goal-values"><span>{displayGoalValue(currentGoal.current, currentGoal.unit)}</span><b>{goalPercentage}%</b><span>{displayGoalValue(currentGoal.target, currentGoal.unit)}</span></div><div className="goal-progress"><span style={{ width: `${goalPercentage}%` }} /></div><Link to="/metas">Ver todas as metas <FaArrowRight /></Link></> : <div className="dashboard-side-empty"><p>Você ainda não criou uma meta.</p><Link to="/metas">Criar meta <FaArrowRight /></Link></div>}</section>
        <section className="dashboard-availability"><span className="section-kicker"><FaCalendarDays /> DISPONIBILIDADE</span><h3>Próximo bloqueio</h3>{nextUnavailable ? <div><time>{new Date(`${nextUnavailable.date}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}</time><p>{nextUnavailable.reason}</p></div> : <p>Nenhum dia indisponível agendado.</p>}<Link to="/planejamento">Abrir calendário <FaArrowRight /></Link></section>
        <section className="dashboard-shortcuts"><span className="section-kicker"><FaPlus /> ATALHOS</span><div><Link to="/projetos"><FaFolderPlus /> Projeto</Link><Link to="/clientes"><FaUserPlus /> Cliente</Link><Link to="/materiais"><FaBoxesStacked /> Material</Link><Link to="/planejamento"><FaClipboardCheck /> Tarefa</Link></div></section>
        <section className="dashboard-ideas"><FaPaw /><span><strong>{ideas.length} {ideas.length === 1 ? 'ideia salva' : 'ideias salvas'}</strong><small>Seu banco de inspirações</small></span><Link to="/ideias"><FaArrowRight /></Link></section>
      </aside>
    </div>
  </>
}
