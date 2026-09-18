import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { FaArrowDown, FaArrowTrendDown, FaArrowTrendUp, FaArrowUp, FaCoins, FaPen, FaPlus, FaTrash, FaXmark } from 'react-icons/fa6'
import { ConfirmButton } from '../components/ConfirmButton'
import { saveLocalData } from '../lib/cloudData'
import { useAtelierSettings } from '../settings'

type TransactionType = 'Receita' | 'Despesa'
type Transaction = { id: string; type: TransactionType; description: string; amount: number; date: string; category: string; projectId?: string; createdAt: string }
type TransactionForm = { type: TransactionType; description: string; amount: string; date: string; category: string; projectId: string }
type ProjectMaterial = { quantity: number; unitCost: number }
type Project = { id: string; title: string; materials?: ProjectMaterial[] }
type TimeEntry = { id: string; projectId: string; startedAt: string; endedAt?: string }

const storageKey = 'reena-biscuit-transactions'
const projectsKey = 'reena-biscuit-projects'
const timeEntriesKey = 'reena-biscuit-time-entries'

function readStorage<T>(key: string) {
  try { return JSON.parse(localStorage.getItem(key) || '[]') as T[] } catch { return [] }
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function currency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function duration(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return hours ? `${hours}h ${String(minutes).padStart(2, '0')}min` : `${minutes}min`
}

export function FinancePage() {
  const settings = useAtelierSettings()
  const [transactions, setTransactions] = useState<Transaction[]>(() => readStorage<Transaction>(storageKey))
  const [projects] = useState<Project[]>(() => readStorage<Project>(projectsKey))
  const [timeEntries] = useState<TimeEntry[]>(() => readStorage<TimeEntry>(timeEntriesKey))
  const [selectedMonth, setSelectedMonth] = useState(() => { const today = new Date(); return new Date(today.getFullYear(), today.getMonth(), 1) })
  const [form, setForm] = useState<TransactionForm | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  const currentMonthKey = monthKey(selectedMonth)
  const monthlyTransactions = useMemo(() => transactions.filter((item) => item.date.startsWith(currentMonthKey)).sort((first, second) => second.date.localeCompare(first.date)), [currentMonthKey, transactions])
  const income = monthlyTransactions.filter((item) => item.type === 'Receita').reduce((total, item) => total + item.amount, 0)
  const expenses = monthlyTransactions.filter((item) => item.type === 'Despesa').reduce((total, item) => total + item.amount, 0)
  const balance = income - expenses
  const projectCosts = useMemo(() => projects.map((project) => {
    const seconds = timeEntries.filter((entry) => entry.projectId === project.id).reduce((total, entry) => {
      const start = new Date(entry.startedAt).getTime()
      const end = new Date(entry.endedAt || new Date().toISOString()).getTime()
      return total + Math.max(0, Math.floor((end - start) / 1000))
    }, 0)
    const materials = (project.materials || []).reduce((total, item) => total + item.quantity * item.unitCost, 0)
    const labor = seconds / 3600 * settings.hourlyRate
    return { project, seconds, materials, labor, total: materials + labor }
  }).filter((item) => item.total > 0).sort((first, second) => second.total - first.total), [projects, settings.hourlyRate, timeEntries])

  function saveTransactions(next: Transaction[]) {
    setTransactions(next)
    saveLocalData(storageKey, JSON.stringify(next))
  }

  function openNew() {
    setEditingId(null)
    setForm({ type: 'Receita', description: '', amount: '', date: dateKey(new Date()), category: '', projectId: '' })
  }

  function openEdit(transaction: Transaction) {
    setEditingId(transaction.id)
    setForm({ type: transaction.type, description: transaction.description, amount: String(transaction.amount), date: transaction.date, category: transaction.category, projectId: transaction.projectId || '' })
  }

  function closeForm() { setEditingId(null); setForm(null) }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form) return
    const data = { ...form, description: form.description.trim(), category: form.category.trim(), amount: Number(form.amount) }
    if (editingId) saveTransactions(transactions.map((item) => item.id === editingId ? { ...item, ...data } : item))
    else saveTransactions([{ id: crypto.randomUUID(), ...data, createdAt: new Date().toISOString() }, ...transactions])
    closeForm()
  }

  const monthLabel = selectedMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^./, (letter) => letter.toLocaleUpperCase('pt-BR'))

  return <div className="finance-page">
    <div className="ideas-heading flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0 flex-1"><span className="section-kicker"><FaCoins /> MOVIMENTO DO ATELIÊ</span><h2>Financeiro</h2><p>Registre entradas, saídas e acompanhe os custos das suas peças.</p></div>
      <button className="primary-button shrink-0" onClick={openNew} type="button"><FaPlus /> Novo lançamento</button>
    </div>

    <div className="finance-month mt-7"><button onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1))} type="button">‹</button><button className="finance-month-label" onClick={() => { const today = new Date(); setSelectedMonth(new Date(today.getFullYear(), today.getMonth(), 1)) }} type="button"><strong>{monthLabel}</strong><span>Voltar ao mês atual</span></button><button onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1))} type="button">›</button></div>

    <div className="finance-summary mt-5"><article className="income"><span>Receitas</span><strong>{currency(income)}</strong><FaArrowTrendUp /></article><article className="expense"><span>Despesas</span><strong>{currency(expenses)}</strong><FaArrowTrendDown /></article><article className={balance < 0 ? 'balance negative' : 'balance'}><span>Saldo do mês</span><strong>{currency(balance)}</strong><FaCoins /></article></div>

    <div className="finance-content mt-7">
      <section className="finance-panel"><div className="finance-panel-heading"><div><span className="section-kicker">MOVIMENTAÇÕES</span><h3>{monthlyTransactions.length} {monthlyTransactions.length === 1 ? 'lançamento' : 'lançamentos'}</h3></div></div>
        {monthlyTransactions.length ? <div className="transaction-list">{monthlyTransactions.map((transaction) => {
          const project = projects.find((item) => item.id === transaction.projectId)
          return <article className="transaction-row" key={transaction.id}><div className={transaction.type === 'Receita' ? 'transaction-symbol income' : 'transaction-symbol expense'}>{transaction.type === 'Receita' ? <FaArrowUp /> : <FaArrowDown />}</div><div><span>{transaction.category}</span><strong>{transaction.description}</strong><small>{new Date(`${transaction.date}T12:00:00`).toLocaleDateString('pt-BR')}{project ? ` · ${project.title}` : ''}</small></div><b className={transaction.type === 'Receita' ? 'income-value' : 'expense-value'}>{transaction.type === 'Receita' ? '+' : '−'} {currency(transaction.amount)}</b><button onClick={() => openEdit(transaction)} type="button" aria-label={`Editar ${transaction.description}`}><FaPen /></button><ConfirmButton title="Excluir lançamento?" message={`O lançamento “${transaction.description}” será removido.`} ariaLabel={`Excluir ${transaction.description}`} onConfirm={() => saveTransactions(transactions.filter((item) => item.id !== transaction.id))}><FaTrash /></ConfirmButton></article>
        })}</div> : <div className="finance-empty"><FaCoins /><h3>Nenhum lançamento neste mês</h3><p>Use “Novo lançamento” para registrar uma receita ou despesa.</p></div>}
      </section>

      <aside className="finance-panel project-costs"><span className="section-kicker">CUSTOS DAS PEÇAS</span><h3>Custos por projeto</h3><p>Materiais utilizados e horas trabalhadas, calculados automaticamente.</p>{projectCosts.length ? <div>{projectCosts.map(({ project, seconds, materials, total }) => <article key={project.id}><div><strong>{project.title}</strong><small>{duration(seconds)} · materiais {currency(materials)}</small></div><b>{currency(total)}</b></article>)}</div> : <div className="finance-empty compact"><p>Os custos aparecerão quando houver materiais ou tempo nos projetos.</p></div>}</aside>
    </div>

    {form && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm() }}><section className="idea-modal finance-modal" role="dialog" aria-modal="true" aria-labelledby="finance-form-title"><div className="modal-heading"><div><span className="section-kicker"><FaCoins /> {editingId ? 'EDITAR LANÇAMENTO' : 'NOVO LANÇAMENTO'}</span><h2 id="finance-form-title">{editingId ? 'Atualizar movimentação' : 'Registrar movimentação'}</h2></div><button onClick={closeForm} type="button" aria-label="Fechar formulário"><FaXmark /></button></div><form onSubmit={handleSubmit}>
      <div className="transaction-type-options"><button className={form.type === 'Receita' ? 'active income' : ''} onClick={() => setForm({ ...form, type: 'Receita' })} type="button"><FaArrowUp /> Receita</button><button className={form.type === 'Despesa' ? 'active expense' : ''} onClick={() => setForm({ ...form, type: 'Despesa' })} type="button"><FaArrowDown /> Despesa</button></div>
      <label className="form-field form-field--full">Descrição<input required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Ex.: Pagamento da encomenda" /></label>
      <div className="form-grid"><label className="form-field">Valor (R$)<input required min="0.01" step="0.01" type="number" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></label><label className="form-field">Data<input required type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label><label className="form-field">Categoria<input required value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} placeholder={form.type === 'Receita' ? 'Ex.: Encomenda' : 'Ex.: Materiais'} /></label><label className="form-field">Projeto relacionado<select value={form.projectId} onChange={(event) => setForm({ ...form, projectId: event.target.value })}><option value="">Nenhum</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select></label></div>
      <div className="modal-actions"><button className="secondary-button" onClick={closeForm} type="button">Cancelar</button><button className="primary-button" type="submit">Salvar lançamento</button></div>
    </form></section></div>}
  </div>
}
