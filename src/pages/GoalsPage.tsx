import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { FaBullseye, FaCheck, FaPen, FaPlus, FaTrash, FaXmark } from 'react-icons/fa6'
import { ConfirmButton } from '../components/ConfirmButton'
import { saveLocalData } from '../lib/cloudData'

type GoalType = 'Faturamento' | 'Encomendas' | 'Produção' | 'Personalizada'
type Goal = { id: string; title: string; type: GoalType; target: number; current: number; unit: string; deadline: string; createdAt: string }
type GoalForm = { title: string; type: GoalType; target: string; current: string; unit: string; deadline: string }

const storageKey = 'reena-biscuit-goals'
const emptyForm: GoalForm = { title: '', type: 'Faturamento', target: '', current: '0', unit: 'R$', deadline: '' }

function loadGoals() {
  const saved = localStorage.getItem(storageKey)
  if (!saved) return []
  try { return JSON.parse(saved) as Goal[] } catch { return [] }
}

function defaultUnit(type: GoalType) {
  if (type === 'Faturamento') return 'R$'
  if (type === 'Encomendas') return 'encomendas'
  if (type === 'Produção') return 'peças'
  return ''
}

function displayValue(value: number, unit: string) {
  if (unit === 'R$') return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  return `${value.toLocaleString('pt-BR')} ${unit}`.trim()
}

export function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>(loadGoals)
  const [form, setForm] = useState<GoalForm | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const completed = useMemo(() => goals.filter((goal) => goal.current >= goal.target), [goals])

  function saveGoals(nextGoals: Goal[]) { setGoals(nextGoals); saveLocalData(storageKey, JSON.stringify(nextGoals)) }
  function openNew() { setEditingId(null); setForm(emptyForm) }
  function openEdit(goal: Goal) { setEditingId(goal.id); setForm({ title: goal.title, type: goal.type, target: String(goal.target), current: String(goal.current), unit: goal.unit, deadline: goal.deadline }) }
  function closeForm() { setEditingId(null); setForm(null) }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!form) return
    const data = { title: form.title.trim(), type: form.type, target: Number(form.target), current: Number(form.current), unit: form.unit.trim(), deadline: form.deadline }
    if (editingId) saveGoals(goals.map((goal) => goal.id === editingId ? { ...goal, ...data } : goal))
    else saveGoals([{ id: crypto.randomUUID(), ...data, createdAt: new Date().toISOString() }, ...goals])
    closeForm()
  }

  return <div className="goals-page">
    <div className="ideas-heading flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0 flex-1"><span className="section-kicker"><FaBullseye /> OBJETIVOS DO ATELIÊ</span><h2>Sonhos com direção</h2><p>Transforme seus planos em metas visíveis e acompanhe cada avanço.</p></div>
      <button className="primary-button shrink-0" onClick={openNew} type="button"><FaPlus /> Nova meta</button>
    </div>

    <div className="goals-summary mt-7"><article><span>Metas cadastradas</span><strong>{goals.length}</strong></article><article><span>Em andamento</span><strong>{goals.length - completed.length}</strong></article><article><span>Concluídas</span><strong>{completed.length}</strong></article></div>

    {goals.length > 0 ? <div className="goals-grid mt-6">{goals.map((goal) => {
      const percentage = goal.target > 0 ? Math.min(100, Math.round((goal.current / goal.target) * 100)) : 0
      const isComplete = goal.current >= goal.target
      return <article className={isComplete ? 'goal-card completed' : 'goal-card'} key={goal.id}>
        <div className="goal-card-heading"><span>{goal.type}</span>{isComplete && <strong><FaCheck /> Concluída</strong>}</div>
        <h3>{goal.title}</h3>
        <div className="goal-progress-label"><span>{displayValue(goal.current, goal.unit)}</span><b>{percentage}%</b><span>{displayValue(goal.target, goal.unit)}</span></div>
        <div className="goal-progress"><span style={{ width: `${percentage}%` }} /></div>
        <div className="goal-deadline"><span>Prazo</span><strong>{goal.deadline ? new Date(`${goal.deadline}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Sem prazo definido'}</strong></div>
        <div className="goal-actions"><button onClick={() => openEdit(goal)} type="button"><FaPen /> Atualizar</button><ConfirmButton title="Excluir meta?" message={`A meta “${goal.title}” e seu progresso serão removidos.`} ariaLabel={`Excluir ${goal.title}`} onConfirm={() => saveGoals(goals.filter((item) => item.id !== goal.id))}><FaTrash /></ConfirmButton></div>
      </article>
    })}</div> : <div className="ideas-empty mt-7"><FaBullseye /><h3>Nenhuma meta cadastrada</h3><p>Crie uma meta de faturamento, encomendas ou produção para acompanhar seu crescimento.</p></div>}

    {form && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm() }}><section className="idea-modal" role="dialog" aria-modal="true" aria-labelledby="goal-form-title"><div className="modal-heading"><div><span className="section-kicker"><FaBullseye /> {editingId ? 'ATUALIZAR META' : 'NOVA META'}</span><h2 id="goal-form-title">{editingId ? 'Atualizar progresso' : 'Criar uma meta'}</h2></div><button onClick={closeForm} type="button" aria-label="Fechar formulário"><FaXmark /></button></div><form onSubmit={handleSubmit}>
      <label className="form-field form-field--full">Nome da meta<input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Ex.: Faturar R$ 2.000 em agosto" /></label>
      <div className="form-grid"><label className="form-field">Tipo<select value={form.type} onChange={(event) => { const type = event.target.value as GoalType; setForm({ ...form, type, unit: defaultUnit(type) }) }}><option>Faturamento</option><option>Encomendas</option><option>Produção</option><option>Personalizada</option></select></label><label className="form-field">Prazo<input type="date" value={form.deadline} onChange={(event) => setForm({ ...form, deadline: event.target.value })} /></label><label className="form-field">Objetivo<input required min="0.01" step="0.01" type="number" value={form.target} onChange={(event) => setForm({ ...form, target: event.target.value })} /></label><label className="form-field">Progresso atual<input required min="0" step="0.01" type="number" value={form.current} onChange={(event) => setForm({ ...form, current: event.target.value })} /></label></div>
      <label className="form-field form-field--full">Unidade<input required value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} placeholder="Ex.: peças, encomendas ou R$" /><small>A unidade é preenchida automaticamente conforme o tipo, mas você pode alterá-la.</small></label>
      <div className="modal-actions"><button className="secondary-button" onClick={closeForm} type="button">Cancelar</button><button className="primary-button" type="submit">{editingId ? 'Salvar progresso' : 'Criar meta'}</button></div>
    </form></section></div>}
  </div>
}
