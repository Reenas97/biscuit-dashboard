import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { FaArrowLeft, FaArrowRight, FaBan, FaCalendarDay, FaCheck, FaCircleExclamation, FaClipboardCheck, FaPen, FaPlus, FaTrash, FaXmark } from 'react-icons/fa6'
import { ConfirmButton } from '../components/ConfirmButton'
import { saveLocalData } from '../lib/cloudData'

type StoredProject = { id: string; title: string; deadline: string; status: string; client?: string }
type TaskPriority = 'Baixa' | 'Média' | 'Alta'
type Task = { id: string; title: string; date: string; priority: TaskPriority; projectId?: string; completed: boolean; createdAt: string }
type TaskForm = { title: string; date: string; priority: TaskPriority; projectId: string }
type UnavailableDay = { id: string; date: string; reason: string; createdAt: string }
type UnavailableForm = { date: string; reason: string }

const projectStorageKey = 'reena-biscuit-projects'
const taskStorageKey = 'reena-biscuit-tasks'
const unavailableStorageKey = 'reena-biscuit-unavailable-days'
const weekDays = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']
const emptyTask: TaskForm = { title: '', date: '', priority: 'Média', projectId: '' }

function readStorage<T>(key: string): T[] {
  const saved = localStorage.getItem(key)
  if (!saved) return []
  try { return JSON.parse(saved) as T[] } catch { return [] }
}

function dateKey(date: Date) {
  const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, '0'); const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDate(value: string) { return new Date(`${value}T12:00:00`) }

export function PlanningPage() {
  const [projects] = useState<StoredProject[]>(() => readStorage<StoredProject>(projectStorageKey))
  const [tasks, setTasks] = useState<Task[]>(() => readStorage<Task>(taskStorageKey))
  const [unavailableDays, setUnavailableDays] = useState<UnavailableDay[]>(() => readStorage<UnavailableDay>(unavailableStorageKey))
  const [month, setMonth] = useState(() => { const today = new Date(); return new Date(today.getFullYear(), today.getMonth(), 1) })
  const [form, setForm] = useState<TaskForm | null>(null)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [unavailableForm, setUnavailableForm] = useState<UnavailableForm | null>(null)
  const today = dateKey(new Date())

  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1)
    const start = new Date(first); start.setDate(1 - first.getDay())
    return Array.from({ length: 42 }, (_, index) => { const day = new Date(start); day.setDate(start.getDate() + index); return day })
  }, [month])

  const upcoming = useMemo(() => {
    const projectEvents = projects.filter((project) => project.deadline && project.status !== 'Entregue').map((project) => ({ id: `project-${project.id}`, title: project.title, date: project.deadline, kind: 'project' as const, completed: false }))
    const taskEvents = tasks.filter((task) => !task.completed).map((task) => ({ id: `task-${task.id}`, title: task.title, date: task.date, kind: 'task' as const, completed: task.completed }))
    const unavailableEvents = unavailableDays.map((day) => ({ id: `unavailable-${day.id}`, title: day.reason, date: day.date, kind: 'unavailable' as const, completed: false }))
    return [...projectEvents, ...taskEvents, ...unavailableEvents].filter((item) => item.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6)
  }, [projects, tasks, unavailableDays, today])

  function saveTasks(nextTasks: Task[]) { setTasks(nextTasks); saveLocalData(taskStorageKey, JSON.stringify(nextTasks)) }
  function saveUnavailableDays(nextDays: UnavailableDay[]) { setUnavailableDays(nextDays); saveLocalData(unavailableStorageKey, JSON.stringify(nextDays)) }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!form) return
    const data = { title: form.title.trim(), date: form.date, priority: form.priority, projectId: form.projectId || undefined }
    if (editingTaskId) saveTasks(tasks.map((task) => task.id === editingTaskId ? { ...task, ...data } : task))
    else saveTasks([{ id: crypto.randomUUID(), ...data, completed: false, createdAt: new Date().toISOString() }, ...tasks])
    setForm(null)
    setEditingTaskId(null)
  }

  function editTask(task: Task) {
    setEditingTaskId(task.id)
    setForm({ title: task.title, date: task.date, priority: task.priority, projectId: task.projectId ?? '' })
  }

  function handleUnavailableSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!unavailableForm) return
    saveUnavailableDays([{ id: crypto.randomUUID(), date: unavailableForm.date, reason: unavailableForm.reason.trim(), createdAt: new Date().toISOString() }, ...unavailableDays])
    setUnavailableForm(null)
  }

  function eventsFor(day: Date) {
    const key = dateKey(day)
    return { projects: projects.filter((project) => project.deadline === key), tasks: tasks.filter((task) => task.date === key), unavailable: unavailableDays.filter((item) => item.date === key) }
  }

  return <div className="planning-page">
    <div className="ideas-heading flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0 flex-1"><span className="section-kicker"><FaCalendarDay /> ROTINA DO ATELIÊ</span><h2>Planeje com leveza</h2><p>Reúna prazos de encomendas e tarefas para organizar seus dias de produção.</p></div>
      <div className="planning-actions"><button className="secondary-button" onClick={() => setUnavailableForm({ date: today, reason: '' })} type="button"><FaBan /> Dia indisponível</button><button className="primary-button shrink-0" onClick={() => { setEditingTaskId(null); setForm({ ...emptyTask, date: today }) }} type="button"><FaPlus /> Nova tarefa</button></div>
    </div>

    <div className="planning-layout mt-7">
      <section className="calendar-panel">
        <div className="calendar-heading"><div><span>CALENDÁRIO</span><h3>{month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</h3></div><div><button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Mês anterior" type="button"><FaArrowLeft /></button><button onClick={() => setMonth(new Date())} type="button">Hoje</button><button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Próximo mês" type="button"><FaArrowRight /></button></div></div>
        <div className="calendar-grid calendar-weekdays">{weekDays.map((day) => <span key={day}>{day}</span>)}</div>
        <div className="calendar-grid calendar-days">{days.map((day) => {
          const key = dateKey(day); const events = eventsFor(day); const outside = day.getMonth() !== month.getMonth()
          return <div className={`${outside ? 'calendar-day outside' : 'calendar-day'}${key === today ? ' today' : ''}`} key={key}>
            <span className="calendar-number">{day.getDate()}</span>
            <div className="calendar-events">
              {events.projects.slice(0, 2).map((project) => <Link className="calendar-event project" to="/projetos" key={project.id} title={project.title}>{project.title}</Link>)}
              {events.tasks.slice(0, 2).map((task) => <button className={task.completed ? 'calendar-event task completed' : 'calendar-event task'} onClick={() => saveTasks(tasks.map((item) => item.id === task.id ? { ...item, completed: !item.completed } : item))} type="button" key={task.id} title={task.title}>{task.title}</button>)}
              {events.unavailable.slice(0, 1).map((item) => <span className="calendar-event unavailable" key={item.id} title={`Indisponível: ${item.reason}`}><FaBan /> {item.reason}</span>)}
              {events.projects.length + events.tasks.length + events.unavailable.length > 5 && <small>+{events.projects.length + events.tasks.length + events.unavailable.length - 5}</small>}
            </div>
          </div>
        })}</div>
      </section>

      <aside className="planning-sidebar">
        <section className="upcoming-panel"><span className="section-kicker"><FaCircleExclamation /> PRÓXIMOS COMPROMISSOS</span><h3>O que vem por aí</h3>{upcoming.length > 0 ? <div className="upcoming-list">{upcoming.map((item) => <div className={item.date < today ? 'late' : ''} key={item.id}><time>{parseDate(item.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</time><span><strong>{item.title}</strong><small>{item.kind === 'project' ? 'Entrega de projeto' : item.kind === 'task' ? 'Tarefa do ateliê' : 'Dia indisponível'}</small></span></div>)}</div> : <p>Nenhum compromisso próximo.</p>}</section>
        <section className="tasks-panel"><div className="tasks-heading"><div><span className="section-kicker"><FaClipboardCheck /> TAREFAS</span><h3>Lista do ateliê</h3></div><strong>{tasks.filter((task) => !task.completed).length}</strong></div>
          {tasks.length > 0 ? <div className="task-list">{tasks.map((task) => { const linkedProject = projects.find((project) => project.id === task.projectId); return <div className={task.completed ? 'task-row completed' : 'task-row'} key={task.id}><button className="task-check" onClick={() => saveTasks(tasks.map((item) => item.id === task.id ? { ...item, completed: !item.completed } : item))} type="button" aria-label={`${task.completed ? 'Reabrir' : 'Concluir'} ${task.title}`}>{task.completed && <FaCheck />}</button><span><strong>{task.title}</strong><small>{parseDate(task.date).toLocaleDateString('pt-BR')} · <b className={`priority-text priority-${task.priority.toLocaleLowerCase('pt-BR')}`}>{task.priority}</b></small>{linkedProject && <Link className="task-project-link" to="/projetos">Projeto: {linkedProject.title}</Link>}</span><div className="task-row-actions"><button className="task-edit" onClick={() => editTask(task)} type="button" aria-label={`Editar ${task.title}`}><FaPen /></button><ConfirmButton className="task-delete" title="Excluir tarefa?" message={`A tarefa “${task.title}” será removida do planejamento.`} ariaLabel={`Excluir ${task.title}`} onConfirm={() => saveTasks(tasks.filter((item) => item.id !== task.id))}><FaTrash /></ConfirmButton></div></div> })}</div> : <p>Nenhuma tarefa cadastrada.</p>}
        </section>
        {unavailableDays.length > 0 && <section className="unavailable-panel"><div className="tasks-heading"><div><span className="section-kicker"><FaBan /> INDISPONIBILIDADE</span><h3>Dias bloqueados</h3></div><strong>{unavailableDays.length}</strong></div><div className="unavailable-list">{[...unavailableDays].sort((a, b) => a.date.localeCompare(b.date)).map((item) => <div key={item.id}><time>{parseDate(item.date).toLocaleDateString('pt-BR')}</time><span>{item.reason}</span><ConfirmButton title="Remover dia indisponível?" message={`O dia ${parseDate(item.date).toLocaleDateString('pt-BR')} voltará a ficar disponível.`} ariaLabel={`Remover indisponibilidade de ${item.date}`} onConfirm={() => saveUnavailableDays(unavailableDays.filter((day) => day.id !== item.id))}><FaTrash /></ConfirmButton></div>)}</div></section>}
      </aside>
    </div>

    {form && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setForm(null) }}><section className="idea-modal" role="dialog" aria-modal="true" aria-labelledby="task-form-title"><div className="modal-heading"><div><span className="section-kicker"><FaClipboardCheck /> {editingTaskId ? 'EDITAR TAREFA' : 'NOVA TAREFA'}</span><h2 id="task-form-title">{editingTaskId ? 'Editar planejamento' : 'Adicionar ao planejamento'}</h2></div><button onClick={() => setForm(null)} type="button" aria-label="Fechar formulário"><FaXmark /></button></div><form onSubmit={handleSubmit}><label className="form-field form-field--full">Tarefa<input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Ex.: Comprar massa branca" /></label><label className="form-field form-field--full">Projeto relacionado<select value={form.projectId} onChange={(event) => setForm({ ...form, projectId: event.target.value })}><option value="">Tarefa geral do ateliê</option>{projects.filter((project) => project.status !== 'Entregue').map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select><small>Opcional: selecione o projeto ao qual esta tarefa pertence.</small></label><div className="form-grid"><label className="form-field">Data<input required type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label><label className="form-field">Prioridade<select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as TaskPriority })}><option>Baixa</option><option>Média</option><option>Alta</option></select></label></div><div className="modal-actions"><button className="secondary-button" onClick={() => setForm(null)} type="button">Cancelar</button><button className="primary-button" type="submit">{editingTaskId ? 'Salvar alterações' : 'Adicionar tarefa'}</button></div></form></section></div>}
    {unavailableForm && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setUnavailableForm(null) }}><section className="idea-modal" role="dialog" aria-modal="true" aria-labelledby="unavailable-form-title"><div className="modal-heading"><div><span className="section-kicker"><FaBan /> BLOQUEAR AGENDA</span><h2 id="unavailable-form-title">Adicionar dia indisponível</h2></div><button onClick={() => setUnavailableForm(null)} type="button" aria-label="Fechar formulário"><FaXmark /></button></div><form onSubmit={handleUnavailableSubmit}><label className="form-field form-field--full">Data<input required type="date" value={unavailableForm.date} onChange={(event) => setUnavailableForm({ ...unavailableForm, date: event.target.value })} /></label><label className="form-field form-field--full">Motivo<textarea required rows={3} value={unavailableForm.reason} onChange={(event) => setUnavailableForm({ ...unavailableForm, reason: event.target.value })} placeholder="Ex.: Compromisso pessoal ou viagem" /></label><div className="modal-actions"><button className="secondary-button" onClick={() => setUnavailableForm(null)} type="button">Cancelar</button><button className="primary-button" type="submit">Bloquear dia</button></div></form></section></div>}
  </div>
}
