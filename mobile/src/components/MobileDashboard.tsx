import { useEffect, useMemo, useState } from 'react'
import type { User } from 'firebase/auth'
import { signOut } from 'firebase/auth'
import { arrayRemove, arrayUnion, collection, deleteField, doc, onSnapshot, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore'
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { auth, db } from '../lib/firebase'

type Project = {
  id: string
  title: string
  description?: string
  category?: string
  deadline?: string
  status: string
  client?: string
  type?: string
  referenceLink?: string
  tags?: string[]
  sourceIdeaId?: string
  materials?: ProjectMaterial[]
}

type ProjectMaterial = {
  id: string
  materialId: string
  name: string
  unit: string
  quantity: number
  unitCost: number
}

type ProjectForm = {
  id?: string
  sourceIdeaId?: string
  title: string
  description: string
  category: string
  tags: string
  type: 'Pessoal' | 'Encomenda'
  client: string
  deadline: string
  referenceLink: string
  status: string
}

type Task = {
  id: string
  title: string
  date: string
  endDate?: string
  projectId?: string
  priority: string
  completed: boolean
}

type TimeEntry = {
  id: string
  projectId: string
  startedAt: string
  endedAt?: string
  autoPaused?: boolean
  pauseReason?: string
}

type UnavailableDay = {
  id: string
  date: string
  reason: string
}

type TaskForm = {
  id?: string
  title: string
  startDate: string
  endDate: string
  priority: string
  projectId: string
}

type UnavailableForm = {
  date: string
  reason: string
}

type Client = {
  id: string
  name: string
  phone?: string
  instagram?: string
  email?: string
  notes?: string
}

type ClientForm = {
  id?: string
  name: string
  phone: string
  instagram: string
  email: string
  notes: string
}

type Material = {
  id: string
  name: string
  category: string
  unit: string
  stock: number
  minimumStock: number
  unitCost: number
}

type MaterialForm = {
  id?: string
  name: string
  category: string
  unit: string
  stock: string
  minimumStock: string
  unitCost: string
}

type Idea = {
  id: string
  title: string
  description?: string
  category: string
  priority: string
  tags?: string[]
  link?: string
  favorite?: boolean
  tone?: 'pink' | 'brown' | 'blush'
  converted?: boolean
}

type IdeaForm = {
  id?: string
  title: string
  description: string
  category: string
  priority: string
  tags: string
  link: string
}

type AtelierSettings = {
  studioName?: string
  subtitle?: string
  ownerName?: string
  phone?: string
  instagram?: string
  email?: string
  city?: string
  state?: string
  timerPauseMinutes?: number
  hourlyRate?: number
}

type SettingsForm = {
  studioName: string
  subtitle: string
  ownerName: string
  phone: string
  instagram: string
  email: string
  city: string
  state: string
  timerPauseMinutes: number
  hourlyRate: string
}

type MobilePage = 'home' | 'projects' | 'planning' | 'clients' | 'materials' | 'ideas' | 'settings'

const inactiveStatuses = new Set(['Stand by', 'Pronto', 'Entregue'])
const projectStatuses = ['Planejamento', 'Stand by', 'Modelagem', 'Secagem', 'Pintura', 'Finalização', 'Envernização', 'Pronto', 'Entregue']

function dateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDate(value: string) {
  return new Date(`${value}T12:00:00`)
}

function formatShortDate(value?: string) {
  if (!value) return 'Sem prazo'
  return parseDate(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function formatInputDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

function maskInputDate(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

function parseInputDate(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value)
  if (!match) return null
  const [, day, month, year] = match
  const iso = `${year}-${month}-${day}`
  const parsed = parseDate(iso)
  return dateKey(parsed) === iso ? iso : null
}

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  return hours > 0 ? `${hours}h ${String(minutes).padStart(2, '0')}min` : `${minutes}min`
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function useUserCollection<T extends { id: string }>(userId: string, name: string) {
  const [items, setItems] = useState<T[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => onSnapshot(
    collection(db, 'users', userId, name),
    (snapshot) => {
      setItems(snapshot.docs
        .filter((item) => item.id !== '_index')
        .map((item) => ({ id: item.id, ...item.data() }) as T))
      setReady(true)
    },
    () => setReady(true),
  ), [name, userId])

  return { items, ready }
}

export function MobileDashboard({ user }: { user: User }) {
  const { items: projects, ready: projectsReady } = useUserCollection<Project>(user.uid, 'projects')
  const { items: tasks, ready: tasksReady } = useUserCollection<Task>(user.uid, 'tasks')
  const { items: timeEntries, ready: timeReady } = useUserCollection<TimeEntry>(user.uid, 'timeEntries')
  const { items: unavailableDays, ready: unavailableReady } = useUserCollection<UnavailableDay>(user.uid, 'unavailableDays')
  const { items: clients, ready: clientsReady } = useUserCollection<Client>(user.uid, 'clients')
  const { items: materials, ready: materialsReady } = useUserCollection<Material>(user.uid, 'materials')
  const { items: ideas, ready: ideasReady } = useUserCollection<Idea>(user.uid, 'ideas')
  const [settings, setSettings] = useState<AtelierSettings>({})
  const [settingsForm, setSettingsForm] = useState<SettingsForm>({ studioName: 'Reena Biscuit', subtitle: 'Ateliê de biscuit', ownerName: 'Renata', phone: '', instagram: '', email: '', city: '', state: '', timerPauseMinutes: 20, hourlyRate: '7,37' })
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsError, setSettingsError] = useState('')
  const [selectedMaterialId, setSelectedMaterialId] = useState('')
  const [materialUsageQuantity, setMaterialUsageQuantity] = useState('')
  const [materialUsageError, setMaterialUsageError] = useState('')
  const [materialUsageBusy, setMaterialUsageBusy] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [activePage, setActivePage] = useState<MobilePage>('home')
  const [menuOpen, setMenuOpen] = useState(false)
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [projectPickerOpen, setProjectPickerOpen] = useState(false)
  const [timerBusy, setTimerBusy] = useState(false)
  const [selectedProjectDetailsId, setSelectedProjectDetailsId] = useState<string | null>(null)
  const [updatingProject, setUpdatingProject] = useState(false)
  const [planningMonth, setPlanningMonth] = useState(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })
  const [selectedPlanningDate, setSelectedPlanningDate] = useState<string | null>(null)
  const [taskForm, setTaskForm] = useState<TaskForm | null>(null)
  const [taskFormError, setTaskFormError] = useState('')
  const [savingTask, setSavingTask] = useState(false)
  const [unavailableForm, setUnavailableForm] = useState<UnavailableForm | null>(null)
  const [unavailableFormError, setUnavailableFormError] = useState('')
  const [savingUnavailable, setSavingUnavailable] = useState(false)
  const [removingUnavailableId, setRemovingUnavailableId] = useState<string | null>(null)
  const [clientQuery, setClientQuery] = useState('')
  const [clientForm, setClientForm] = useState<ClientForm | null>(null)
  const [clientFormError, setClientFormError] = useState('')
  const [savingClient, setSavingClient] = useState(false)
  const [materialQuery, setMaterialQuery] = useState('')
  const [materialForm, setMaterialForm] = useState<MaterialForm | null>(null)
  const [materialFormError, setMaterialFormError] = useState('')
  const [savingMaterial, setSavingMaterial] = useState(false)
  const [ideaQuery, setIdeaQuery] = useState('')
  const [showFavoriteIdeas, setShowFavoriteIdeas] = useState(false)
  const [ideaForm, setIdeaForm] = useState<IdeaForm | null>(null)
  const [ideaFormError, setIdeaFormError] = useState('')
  const [savingIdea, setSavingIdea] = useState(false)
  const [updatingFavoriteId, setUpdatingFavoriteId] = useState<string | null>(null)
  const [projectForm, setProjectForm] = useState<ProjectForm | null>(null)
  const [projectFormError, setProjectFormError] = useState('')
  const [savingProject, setSavingProject] = useState(false)

  useEffect(() => onSnapshot(doc(db, 'users', user.uid, 'settings', 'atelier'), (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data() as AtelierSettings
      setSettings(data)
      setSettingsForm({
        studioName: data.studioName || 'Reena Biscuit',
        subtitle: data.subtitle || 'Ateliê de biscuit',
        ownerName: data.ownerName || 'Renata',
        phone: data.phone || '',
        instagram: data.instagram || '',
        email: data.email || '',
        city: data.city || '',
        state: data.state || '',
        timerPauseMinutes: data.timerPauseMinutes || 20,
        hourlyRate: String(data.hourlyRate ?? 7.37).replace('.', ','),
      })
    }
  }), [user.uid])

  const activeEntry = timeEntries.find((entry) => !entry.endedAt)
  const activeProject = projects.find((project) => project.id === activeEntry?.projectId)

  useEffect(() => {
    if (!activeEntry) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [activeEntry])

  useEffect(() => {
    if (!activeEntry) return
    const sendHeartbeat = () => setDoc(doc(db, 'users', user.uid, 'timer', 'current'), {
      status: 'active',
      entryId: activeEntry.id,
      projectId: activeEntry.projectId,
      heartbeatAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { merge: true }).catch(() => undefined)
    sendHeartbeat()
    const heartbeat = setInterval(sendHeartbeat, 60_000)
    return () => clearInterval(heartbeat)
  }, [activeEntry, user.uid])

  const summary = useMemo(() => {
    const today = dateKey(new Date())
    const inactiveIds = new Set(projects.filter((project) => inactiveStatuses.has(project.status)).map((project) => project.id))
    const activeProjects = projects.filter((project) => !inactiveStatuses.has(project.status))
    const pendingTasks = tasks
      .filter((task) => !task.completed)
      .sort((first, second) => (first.endDate || first.date).localeCompare(second.endDate || second.date))
    const overdueTasks = pendingTasks.filter((task) =>
      (task.endDate || task.date) < today && !inactiveIds.has(task.projectId ?? ''),
    )
    const nextProject = activeProjects
      .filter((project) => project.deadline)
      .sort((first, second) => (first.deadline ?? '').localeCompare(second.deadline ?? ''))[0]

    return { activeProjects, pendingTasks, overdueTasks, nextProject, today }
  }, [projects, tasks])

  const activeSeconds = activeEntry
    ? Math.max(0, Math.floor((now - new Date(activeEntry.startedAt).getTime()) / 1000))
    : 0
  const ownerFirstName = settings.ownerName?.trim().split(/\s+/)[0] || 'Renata'
  const loading = !projectsReady || !tasksReady || !timeReady || !unavailableReady || !clientsReady || !materialsReady || !ideasReady
  const timerProjects = summary.activeProjects
  const selectedProject = timerProjects.find((project) => project.id === selectedProjectId)
  const selectedProjectDetails = projects.find((project) => project.id === selectedProjectDetailsId) ?? null
  const selectedProjectTimeEntries = selectedProjectDetails
    ? timeEntries.filter((entry) => entry.projectId === selectedProjectDetails.id)
    : []
  const selectedProjectSeconds = selectedProjectTimeEntries.reduce((total, entry) => {
    const start = new Date(entry.startedAt).getTime()
    const end = entry.endedAt ? new Date(entry.endedAt).getTime() : now
    return total + Math.max(0, Math.floor((end - start) / 1000))
  }, 0)
  const selectedProjectMaterialCost = (selectedProjectDetails?.materials || []).reduce((total, item) => total + item.quantity * item.unitCost, 0)
  const selectedProjectLaborCost = selectedProjectSeconds / 3600 * (settings.hourlyRate ?? 7.37)
  const selectedProjectTotalCost = selectedProjectMaterialCost + selectedProjectLaborCost
  const planningMonthStart = dateKey(new Date(planningMonth.getFullYear(), planningMonth.getMonth(), 1))
  const planningMonthEnd = dateKey(new Date(planningMonth.getFullYear(), planningMonth.getMonth() + 1, 0))
  const planningMonthTasks = useMemo(() => tasks
    .filter((task) => task.date <= planningMonthEnd && (task.endDate || task.date) >= planningMonthStart)
    .sort((first, second) => first.date.localeCompare(second.date)), [planningMonthEnd, planningMonthStart, tasks])
  const planningPendingTasks = planningMonthTasks.filter((task) => !task.completed)
  const planningCompletedTasks = planningMonthTasks.filter((task) => task.completed)
  const planningMonthLabel = planningMonth
    .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    .replace(/^./, (letter) => letter.toLocaleUpperCase('pt-BR'))
  const planningCalendarDays = useMemo(() => {
    const firstDay = new Date(planningMonth.getFullYear(), planningMonth.getMonth(), 1)
    const start = new Date(firstDay)
    start.setDate(1 - firstDay.getDay())
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(start)
      day.setDate(start.getDate() + index)
      return day
    })
  }, [planningMonth])
  const selectedDayTasks = selectedPlanningDate
    ? tasks.filter((task) => task.date <= selectedPlanningDate && (task.endDate || task.date) >= selectedPlanningDate)
    : []
  const selectedDayProjects = selectedPlanningDate
    ? projects.filter((project) => project.deadline === selectedPlanningDate)
    : []
  const selectedDayUnavailable = selectedPlanningDate
    ? unavailableDays.filter((item) => item.date === selectedPlanningDate)
    : []
  const filteredClients = useMemo(() => {
    const query = clientQuery.trim().toLocaleLowerCase('pt-BR')
    const sorted = [...clients].sort((first, second) => first.name.localeCompare(second.name, 'pt-BR'))
    if (!query) return sorted
    return sorted.filter((client) => [client.name, client.phone, client.instagram, client.email]
      .some((value) => value?.toLocaleLowerCase('pt-BR').includes(query)))
  }, [clientQuery, clients])
  const filteredMaterials = useMemo(() => {
    const query = materialQuery.trim().toLocaleLowerCase('pt-BR')
    const sorted = [...materials].sort((first, second) => first.name.localeCompare(second.name, 'pt-BR'))
    if (!query) return sorted
    return sorted.filter((material) => [material.name, material.category, material.unit]
      .some((value) => value.toLocaleLowerCase('pt-BR').includes(query)))
  }, [materialQuery, materials])
  const lowStockMaterials = materials.filter((material) => material.stock <= material.minimumStock)
  const totalStockValue = materials.reduce((sum, material) => sum + material.stock * material.unitCost, 0)
  const filteredIdeas = useMemo(() => {
    const query = ideaQuery.trim().toLocaleLowerCase('pt-BR')
    return ideas.filter((idea) => {
      const matchesFavorite = !showFavoriteIdeas || idea.favorite
      const searchable = `${idea.title} ${idea.description || ''} ${idea.category} ${(idea.tags || []).join(' ')}`.toLocaleLowerCase('pt-BR')
      return matchesFavorite && searchable.includes(query)
    })
  }, [ideaQuery, ideas, showFavoriteIdeas])
  const pageMeta = activePage === 'projects'
    ? { kicker: '🐾 PRODUÇÃO', title: 'Projetos', subtitle: 'Acompanhe todas as etapas das suas peças.' }
    : activePage === 'planning'
      ? { kicker: '✓ ROTINA DO ATELIÊ', title: 'Planejamento', subtitle: 'Veja tarefas, prazos e o que precisa da sua atenção.' }
      : activePage === 'clients'
        ? { kicker: '♡ CLIENTES DO ATELIÊ', title: 'Clientes', subtitle: 'Contatos e histórico de quem encomenda suas peças.' }
        : activePage === 'materials'
          ? { kicker: '□ ESTOQUE DO ATELIÊ', title: 'Materiais', subtitle: 'Controle quantidades, custos e o que precisa ser reposto.' }
          : activePage === 'ideas'
            ? { kicker: '✦ BANCO DE INSPIRAÇÕES', title: 'Ideias', subtitle: 'Guarde referências e organize suas próximas criações.' }
            : { kicker: '⚙ PERSONALIZAÇÃO', title: 'Configurações', subtitle: 'Ajuste os dados e o funcionamento do seu ateliê.' }

  function openPage(page: MobilePage) {
    setActivePage(page)
    setMenuOpen(false)
  }

  async function toggleTask(task: Task) {
    if (updatingTaskId) return
    setUpdatingTaskId(task.id)
    setActionMessage('')
    try {
      const completed = !task.completed
      await updateDoc(doc(db, 'users', user.uid, 'tasks', task.id), {
        completed,
        completedAt: completed ? serverTimestamp() : null,
      })
      setActionMessage(completed ? 'Tarefa concluída com sucesso.' : 'Tarefa reaberta.')
      setTimeout(() => setActionMessage(''), 2500)
    } catch {
      setActionMessage('Não foi possível atualizar a tarefa. Tente novamente.')
    } finally {
      setUpdatingTaskId(null)
    }
  }

  function openNewTask(date = summary.today) {
    setTaskFormError('')
    setTaskForm({ title: '', startDate: formatInputDate(date), endDate: formatInputDate(date), priority: 'Média', projectId: '' })
  }

  function openEditTask(task: Task) {
    setSelectedPlanningDate(null)
    setTaskFormError('')
    setTaskForm({
      id: task.id,
      title: task.title,
      startDate: formatInputDate(task.date),
      endDate: formatInputDate(task.endDate || task.date),
      priority: task.priority,
      projectId: task.projectId || '',
    })
  }

  async function saveTaskForm() {
    if (!taskForm || savingTask) return
    const startDate = parseInputDate(taskForm.startDate)
    const endDate = parseInputDate(taskForm.endDate)
    if (!taskForm.title.trim()) { setTaskFormError('Escreva o nome da tarefa.'); return }
    if (!startDate || !endDate) { setTaskFormError('Use datas válidas no formato dia/mês/ano.'); return }
    if (endDate < startDate) { setTaskFormError('O término não pode ser anterior ao início.'); return }
    setSavingTask(true)
    setTaskFormError('')
    try {
      if (taskForm.id) {
        await updateDoc(doc(db, 'users', user.uid, 'tasks', taskForm.id), {
          title: taskForm.title.trim(),
          date: startDate,
          endDate,
          priority: taskForm.priority,
          projectId: taskForm.projectId || deleteField(),
        })
      } else {
        const taskId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
        const batch = writeBatch(db)
        batch.set(doc(db, 'users', user.uid, 'tasks', taskId), {
          id: taskId,
          title: taskForm.title.trim(),
          date: startDate,
          endDate,
          priority: taskForm.priority,
          ...(taskForm.projectId ? { projectId: taskForm.projectId } : {}),
          completed: false,
          createdAt: new Date().toISOString(),
        })
        batch.set(doc(db, 'users', user.uid, 'tasks', '_index'), { ids: arrayUnion(taskId), updatedAt: serverTimestamp() }, { merge: true })
        await batch.commit()
      }
      setTaskForm(null)
      setActionMessage(taskForm.id ? 'Tarefa atualizada.' : 'Tarefa adicionada ao planejamento.')
      setTimeout(() => setActionMessage(''), 2500)
    } catch {
      setTaskFormError('Não foi possível salvar a tarefa. Tente novamente.')
    } finally {
      setSavingTask(false)
    }
  }

  function openUnavailableForm(date = summary.today) {
    setUnavailableFormError('')
    setUnavailableForm({ date: formatInputDate(date), reason: '' })
  }

  async function saveUnavailableForm() {
    if (!unavailableForm || savingUnavailable) return
    const date = parseInputDate(unavailableForm.date)
    if (!date) { setUnavailableFormError('Use uma data válida no formato dia/mês/ano.'); return }
    if (!unavailableForm.reason.trim()) { setUnavailableFormError('Informe o motivo da indisponibilidade.'); return }
    setSavingUnavailable(true)
    setUnavailableFormError('')
    try {
      const unavailableId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
      const batch = writeBatch(db)
      batch.set(doc(db, 'users', user.uid, 'unavailableDays', unavailableId), {
        id: unavailableId,
        date,
        reason: unavailableForm.reason.trim(),
        createdAt: new Date().toISOString(),
      })
      batch.set(doc(db, 'users', user.uid, 'unavailableDays', '_index'), { ids: arrayUnion(unavailableId), updatedAt: serverTimestamp() }, { merge: true })
      await batch.commit()
      setUnavailableForm(null)
      setActionMessage('Dia indisponível adicionado ao calendário.')
      setTimeout(() => setActionMessage(''), 2500)
    } catch {
      setUnavailableFormError('Não foi possível bloquear este dia. Tente novamente.')
    } finally {
      setSavingUnavailable(false)
    }
  }

  async function removeUnavailableDay(item: UnavailableDay) {
    if (removingUnavailableId) return
    setRemovingUnavailableId(item.id)
    try {
      const batch = writeBatch(db)
      batch.delete(doc(db, 'users', user.uid, 'unavailableDays', item.id))
      batch.set(doc(db, 'users', user.uid, 'unavailableDays', '_index'), { ids: arrayRemove(item.id), updatedAt: serverTimestamp() }, { merge: true })
      await batch.commit()
      setActionMessage('Dia liberado novamente.')
      setTimeout(() => setActionMessage(''), 2500)
    } catch {
      setActionMessage('Não foi possível remover a indisponibilidade.')
    } finally {
      setRemovingUnavailableId(null)
    }
  }

  function openNewClient() {
    setClientFormError('')
    setClientForm({ name: '', phone: '', instagram: '', email: '', notes: '' })
  }

  function openEditClient(client: Client) {
    setClientFormError('')
    setClientForm({ id: client.id, name: client.name, phone: client.phone || '', instagram: client.instagram || '', email: client.email || '', notes: client.notes || '' })
  }

  async function saveClientForm() {
    if (!clientForm || savingClient) return
    if (!clientForm.name.trim()) { setClientFormError('Informe o nome da cliente.'); return }
    setSavingClient(true)
    setClientFormError('')
    const data = {
      name: clientForm.name.trim(),
      phone: clientForm.phone.trim(),
      instagram: clientForm.instagram.trim().replace(/^@/, ''),
      email: clientForm.email.trim(),
      notes: clientForm.notes.trim(),
    }
    try {
      if (clientForm.id) {
        await updateDoc(doc(db, 'users', user.uid, 'clients', clientForm.id), data)
      } else {
        const clientId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
        const batch = writeBatch(db)
        batch.set(doc(db, 'users', user.uid, 'clients', clientId), { id: clientId, ...data, createdAt: new Date().toISOString() })
        batch.set(doc(db, 'users', user.uid, 'clients', '_index'), { ids: arrayUnion(clientId), updatedAt: serverTimestamp() }, { merge: true })
        await batch.commit()
      }
      setClientForm(null)
      setActionMessage(clientForm.id ? 'Cliente atualizada.' : 'Cliente cadastrada.')
      setTimeout(() => setActionMessage(''), 2500)
    } catch {
      setClientFormError('Não foi possível salvar a cliente. Tente novamente.')
    } finally {
      setSavingClient(false)
    }
  }

  function openNewMaterial() {
    setMaterialFormError('')
    setMaterialForm({ name: '', category: '', unit: 'g', stock: '', minimumStock: '', unitCost: '' })
  }

  function openEditMaterial(material: Material) {
    setMaterialFormError('')
    setMaterialForm({ id: material.id, name: material.name, category: material.category, unit: material.unit, stock: String(material.stock), minimumStock: String(material.minimumStock), unitCost: String(material.unitCost) })
  }

  async function saveMaterialForm() {
    if (!materialForm || savingMaterial) return
    const stock = Number(materialForm.stock.replace(',', '.'))
    const minimumStock = Number(materialForm.minimumStock.replace(',', '.'))
    const unitCost = Number(materialForm.unitCost.replace(',', '.'))
    if (!materialForm.name.trim() || !materialForm.category.trim()) { setMaterialFormError('Informe o nome e a categoria do material.'); return }
    if ([stock, minimumStock, unitCost].some((value) => !Number.isFinite(value) || value < 0)) { setMaterialFormError('Preencha estoque, mínimo e custo com valores válidos.'); return }
    setSavingMaterial(true)
    setMaterialFormError('')
    const data = { name: materialForm.name.trim(), category: materialForm.category.trim(), unit: materialForm.unit, stock, minimumStock, unitCost }
    try {
      if (materialForm.id) {
        await updateDoc(doc(db, 'users', user.uid, 'materials', materialForm.id), data)
      } else {
        const materialId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
        const batch = writeBatch(db)
        batch.set(doc(db, 'users', user.uid, 'materials', materialId), { id: materialId, ...data, createdAt: new Date().toISOString() })
        batch.set(doc(db, 'users', user.uid, 'materials', '_index'), { ids: arrayUnion(materialId), updatedAt: serverTimestamp() }, { merge: true })
        await batch.commit()
      }
      setMaterialForm(null)
      setActionMessage(materialForm.id ? 'Material atualizado.' : 'Material cadastrado.')
      setTimeout(() => setActionMessage(''), 2500)
    } catch {
      setMaterialFormError('Não foi possível salvar o material. Tente novamente.')
    } finally {
      setSavingMaterial(false)
    }
  }

  function openNewIdea() {
    setIdeaFormError('')
    setIdeaForm({ title: '', description: '', category: '', priority: 'Média', tags: '', link: '' })
  }

  function openEditIdea(idea: Idea) {
    setIdeaFormError('')
    setIdeaForm({ id: idea.id, title: idea.title, description: idea.description || '', category: idea.category, priority: idea.priority, tags: (idea.tags || []).join(', '), link: idea.link || '' })
  }

  async function saveIdeaForm() {
    if (!ideaForm || savingIdea) return
    if (!ideaForm.title.trim() || !ideaForm.category.trim()) { setIdeaFormError('Informe o nome e a categoria da ideia.'); return }
    if (ideaForm.link.trim() && !/^https?:\/\//i.test(ideaForm.link.trim())) { setIdeaFormError('O link precisa começar com http:// ou https://'); return }
    setSavingIdea(true)
    setIdeaFormError('')
    const data = {
      title: ideaForm.title.trim(),
      description: ideaForm.description.trim(),
      category: ideaForm.category.trim(),
      priority: ideaForm.priority,
      tags: ideaForm.tags.split(',').map((tag) => tag.trim().replace(/^#/, '')).filter(Boolean),
      link: ideaForm.link.trim(),
    }
    try {
      if (ideaForm.id) {
        await updateDoc(doc(db, 'users', user.uid, 'ideas', ideaForm.id), data)
      } else {
        const ideaId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
        const batch = writeBatch(db)
        batch.set(doc(db, 'users', user.uid, 'ideas', ideaId), { id: ideaId, ...data, favorite: false, tone: ['pink', 'brown', 'blush'][ideas.length % 3], converted: false, createdAt: new Date().toISOString() })
        batch.set(doc(db, 'users', user.uid, 'ideas', '_index'), { ids: arrayUnion(ideaId), updatedAt: serverTimestamp() }, { merge: true })
        await batch.commit()
      }
      setIdeaForm(null)
      setActionMessage(ideaForm.id ? 'Ideia atualizada.' : 'Ideia salva no seu banco de inspirações.')
      setTimeout(() => setActionMessage(''), 2500)
    } catch {
      setIdeaFormError('Não foi possível salvar a ideia. Tente novamente.')
    } finally {
      setSavingIdea(false)
    }
  }

  async function toggleIdeaFavorite(idea: Idea) {
    if (updatingFavoriteId) return
    setUpdatingFavoriteId(idea.id)
    try {
      await updateDoc(doc(db, 'users', user.uid, 'ideas', idea.id), { favorite: !idea.favorite })
    } finally {
      setUpdatingFavoriteId(null)
    }
  }

  function openNewProject(sourceIdea?: Idea) {
    setSelectedProjectDetailsId(null)
    setProjectFormError('')
    setProjectForm({
      sourceIdeaId: sourceIdea?.id,
      title: sourceIdea?.title || '',
      description: sourceIdea?.description || '',
      category: sourceIdea?.category || '',
      tags: (sourceIdea?.tags || []).join(', '),
      type: 'Pessoal',
      client: '',
      deadline: '',
      referenceLink: sourceIdea?.link || '',
      status: 'Planejamento',
    })
  }

  function openEditProject(project: Project) {
    setSelectedProjectDetailsId(null)
    setProjectFormError('')
    setProjectForm({
      id: project.id,
      sourceIdeaId: project.sourceIdeaId,
      title: project.title,
      description: project.description || '',
      category: project.category || '',
      tags: (project.tags || []).join(', '),
      type: project.type === 'Encomenda' ? 'Encomenda' : 'Pessoal',
      client: project.client || '',
      deadline: project.deadline ? formatInputDate(project.deadline) : '',
      referenceLink: project.referenceLink || '',
      status: project.status,
    })
  }

  async function saveProjectForm() {
    if (!projectForm || savingProject) return
    const deadline = projectForm.deadline ? parseInputDate(projectForm.deadline) : ''
    if (!projectForm.title.trim() || !projectForm.category.trim()) { setProjectFormError('Informe o nome e a categoria do projeto.'); return }
    if (projectForm.deadline && !deadline) { setProjectFormError('Use uma data de prazo válida no formato dia/mês/ano.'); return }
    if (projectForm.type === 'Encomenda' && !projectForm.client) { setProjectFormError('Escolha a cliente da encomenda.'); return }
    if (projectForm.referenceLink.trim() && !/^https?:\/\//i.test(projectForm.referenceLink.trim())) { setProjectFormError('O link precisa começar com http:// ou https://'); return }
    setSavingProject(true)
    setProjectFormError('')
    const data = {
      title: projectForm.title.trim(),
      description: projectForm.description.trim(),
      category: projectForm.category.trim(),
      tags: projectForm.tags.split(',').map((tag) => tag.trim().replace(/^#/, '')).filter(Boolean),
      type: projectForm.type,
      client: projectForm.type === 'Encomenda' ? projectForm.client : '',
      deadline,
      referenceLink: projectForm.referenceLink.trim(),
      status: projectForm.status,
    }
    try {
      if (projectForm.id) {
        if (inactiveStatuses.has(projectForm.status) && activeEntry?.projectId === projectForm.id) {
          const nowIso = new Date().toISOString()
          const batch = writeBatch(db)
          batch.update(doc(db, 'users', user.uid, 'projects', projectForm.id), data)
          batch.update(doc(db, 'users', user.uid, 'timeEntries', activeEntry.id), { endedAt: nowIso, autoPaused: true, pauseReason: `Projeto movido para ${projectForm.status} no aplicativo mobile` })
          batch.set(doc(db, 'users', user.uid, 'timer', 'current'), { status: 'paused', pauseReason: `Projeto movido para ${projectForm.status} no aplicativo mobile`, updatedAt: nowIso }, { merge: true })
          await batch.commit()
        } else {
          await updateDoc(doc(db, 'users', user.uid, 'projects', projectForm.id), data)
        }
      } else {
        const projectId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
        const batch = writeBatch(db)
        batch.set(doc(db, 'users', user.uid, 'projects', projectId), { id: projectId, ...data, sourceIdeaId: projectForm.sourceIdeaId || '', createdAt: new Date().toISOString() })
        batch.set(doc(db, 'users', user.uid, 'projects', '_index'), { ids: arrayUnion(projectId), updatedAt: serverTimestamp() }, { merge: true })
        if (projectForm.sourceIdeaId) batch.update(doc(db, 'users', user.uid, 'ideas', projectForm.sourceIdeaId), { converted: true })
        await batch.commit()
      }
      setProjectForm(null)
      setActivePage('projects')
      setActionMessage(projectForm.id ? 'Projeto atualizado.' : 'Projeto criado com sucesso.')
      setTimeout(() => setActionMessage(''), 2500)
    } catch {
      setProjectFormError('Não foi possível salvar o projeto. Tente novamente.')
    } finally {
      setSavingProject(false)
    }
  }

  async function saveSettingsForm() {
    if (savingSettings) return
    const hourlyRate = Number(settingsForm.hourlyRate.replace(',', '.'))
    if (!settingsForm.studioName.trim() || !settingsForm.ownerName.trim()) { setSettingsError('Informe o nome do ateliê e da artesã.'); return }
    if (!Number.isFinite(hourlyRate) || hourlyRate < 0) { setSettingsError('Informe um valor válido para a hora de trabalho.'); return }
    setSavingSettings(true)
    setSettingsError('')
    try {
      await setDoc(doc(db, 'users', user.uid, 'settings', 'atelier'), {
        ...settingsForm,
        studioName: settingsForm.studioName.trim(),
        subtitle: settingsForm.subtitle.trim(),
        ownerName: settingsForm.ownerName.trim(),
        phone: settingsForm.phone.trim(),
        instagram: settingsForm.instagram.trim().replace(/^@/, ''),
        email: settingsForm.email.trim(),
        city: settingsForm.city.trim(),
        state: settingsForm.state.trim().toLocaleUpperCase('pt-BR'),
        hourlyRate,
        currency: 'BRL',
        updatedAt: serverTimestamp(),
      }, { merge: true })
      setActionMessage('Configurações salvas com sucesso.')
      setTimeout(() => setActionMessage(''), 2500)
    } catch {
      setSettingsError('Não foi possível salvar as configurações.')
    } finally {
      setSavingSettings(false)
    }
  }

  async function addMaterialToProject() {
    if (!selectedProjectDetails || materialUsageBusy) return
    const material = materials.find((item) => item.id === selectedMaterialId)
    const quantity = Number(materialUsageQuantity.replace(',', '.'))
    if (!material || !Number.isFinite(quantity) || quantity <= 0) { setMaterialUsageError('Escolha um material e informe uma quantidade válida.'); return }
    if (quantity > material.stock) { setMaterialUsageError(`Há apenas ${material.stock.toLocaleString('pt-BR')} ${material.unit} em estoque.`); return }
    setMaterialUsageBusy(true)
    setMaterialUsageError('')
    const usage: ProjectMaterial = { id: `${new Date().toISOString()}-${selectedProjectDetails.materials?.length ?? 0}`, materialId: material.id, name: material.name, unit: material.unit, quantity, unitCost: material.unitCost }
    try {
      const batch = writeBatch(db)
      batch.update(doc(db, 'users', user.uid, 'projects', selectedProjectDetails.id), { materials: [...(selectedProjectDetails.materials || []), usage] })
      batch.update(doc(db, 'users', user.uid, 'materials', material.id), { stock: material.stock - quantity })
      await batch.commit()
      setSelectedMaterialId('')
      setMaterialUsageQuantity('')
      setActionMessage('Material lançado no projeto.')
      setTimeout(() => setActionMessage(''), 2500)
    } catch {
      setMaterialUsageError('Não foi possível lançar o material.')
    } finally {
      setMaterialUsageBusy(false)
    }
  }

  async function removeMaterialFromProject(usage: ProjectMaterial) {
    if (!selectedProjectDetails || materialUsageBusy) return
    const material = materials.find((item) => item.id === usage.materialId)
    setMaterialUsageBusy(true)
    setMaterialUsageError('')
    try {
      const batch = writeBatch(db)
      batch.update(doc(db, 'users', user.uid, 'projects', selectedProjectDetails.id), { materials: (selectedProjectDetails.materials || []).filter((item) => item.id !== usage.id) })
      if (material) batch.update(doc(db, 'users', user.uid, 'materials', material.id), { stock: material.stock + usage.quantity })
      await batch.commit()
      setActionMessage('Material removido e devolvido ao estoque.')
      setTimeout(() => setActionMessage(''), 2500)
    } catch {
      setMaterialUsageError('Não foi possível remover o material.')
    } finally {
      setMaterialUsageBusy(false)
    }
  }

  async function startTimer() {
    if (!selectedProject || activeEntry || timerBusy) return
    setTimerBusy(true)
    setActionMessage('')
    const nowIso = new Date().toISOString()
    const entryId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    try {
      const batch = writeBatch(db)
      batch.set(doc(db, 'users', user.uid, 'timeEntries', entryId), {
        id: entryId,
        projectId: selectedProject.id,
        startedAt: nowIso,
        lastActivityAt: nowIso,
      })
      batch.set(doc(db, 'users', user.uid, 'timeEntries', '_index'), {
        ids: arrayUnion(entryId),
        updatedAt: serverTimestamp(),
      }, { merge: true })
      batch.set(doc(db, 'users', user.uid, 'timer', 'current'), {
        status: 'active',
        entryId,
        projectId: selectedProject.id,
        heartbeatAt: nowIso,
        updatedAt: nowIso,
      }, { merge: true })
      await batch.commit()
      setSelectedProjectId('')
      setActionMessage(`Cronômetro iniciado para ${selectedProject.title}.`)
      setTimeout(() => setActionMessage(''), 2500)
    } catch {
      setActionMessage('Não foi possível iniciar o cronômetro. Tente novamente.')
    } finally {
      setTimerBusy(false)
    }
  }

  async function pauseTimer() {
    if (!activeEntry || timerBusy) return
    setTimerBusy(true)
    setActionMessage('')
    const nowIso = new Date().toISOString()
    try {
      const batch = writeBatch(db)
      batch.update(doc(db, 'users', user.uid, 'timeEntries', activeEntry.id), { endedAt: nowIso })
      batch.set(doc(db, 'users', user.uid, 'timer', 'current'), {
        status: 'paused',
        pauseReason: 'Pausa manual no aplicativo mobile',
        updatedAt: nowIso,
      }, { merge: true })
      await batch.commit()
      setActionMessage('Cronômetro pausado e tempo salvo no projeto.')
      setTimeout(() => setActionMessage(''), 2500)
    } catch {
      setActionMessage('Não foi possível pausar o cronômetro. Tente novamente.')
    } finally {
      setTimerBusy(false)
    }
  }

  async function changeProjectStatus(status: string) {
    if (!selectedProjectDetails || updatingProject || status === selectedProjectDetails.status) return
    setUpdatingProject(true)
    setActionMessage('')
    const shouldPause = inactiveStatuses.has(status) && activeEntry?.projectId === selectedProjectDetails.id
    const nowIso = new Date().toISOString()
    try {
      if (shouldPause && activeEntry) {
        const batch = writeBatch(db)
        batch.update(doc(db, 'users', user.uid, 'projects', selectedProjectDetails.id), { status })
        batch.update(doc(db, 'users', user.uid, 'timeEntries', activeEntry.id), {
          endedAt: nowIso,
          autoPaused: true,
          pauseReason: `Projeto movido para ${status} no aplicativo mobile`,
        })
        batch.set(doc(db, 'users', user.uid, 'timer', 'current'), {
          status: 'paused',
          pauseReason: `Projeto movido para ${status} no aplicativo mobile`,
          updatedAt: nowIso,
        }, { merge: true })
        await batch.commit()
      } else {
        await updateDoc(doc(db, 'users', user.uid, 'projects', selectedProjectDetails.id), { status })
      }
      setActionMessage(`Projeto movido para ${status}.`)
      setTimeout(() => setActionMessage(''), 2500)
    } catch {
      setActionMessage('Não foi possível mudar a etapa do projeto.')
    } finally {
      setUpdatingProject(false)
    }
  }

  return (
    <View style={styles.screen}>
    <ScrollView contentContainerStyle={styles.dashboard} showsVerticalScrollIndicator={false}>
      <View style={styles.brandRow}>
        <View style={styles.logoMark}><Text style={styles.logoLetter}>R</Text></View>
        <View style={styles.brandText}>
          <Text style={styles.brandName}>Reena Biscuit</Text>
          <Text style={styles.brandSubtitle}>ATELIÊ DE BISCUIT</Text>
        </View>
        <Pressable accessibilityLabel="Abrir menu" onPress={() => setMenuOpen(true)} style={({ pressed }) => [styles.menuButton, pressed && styles.buttonPressed]}>
          <Text style={styles.menuButtonIcon}>☰</Text>
        </Pressable>
      </View>

      <Modal animationType="slide" onRequestClose={() => setMenuOpen(false)} transparent visible={menuOpen}>
        <View style={styles.menuBackdrop}>
          <View style={styles.menuSheet}>
            <View style={styles.menuHeading}>
              <View><Text style={styles.sectionKicker}>REENA BISCUIT</Text><Text style={styles.menuTitle}>Menu</Text></View>
              <Pressable accessibilityLabel="Fechar menu" onPress={() => setMenuOpen(false)} style={styles.menuClose}><Text style={styles.menuCloseText}>×</Text></Pressable>
            </View>
            <Pressable onPress={() => openPage('home')} style={[styles.menuItem, activePage === 'home' && styles.menuItemActive]}><Text style={styles.menuItemIcon}>⌂</Text><Text style={styles.menuItemText}>Início</Text></Pressable>
            <Pressable onPress={() => openPage('projects')} style={[styles.menuItem, activePage === 'projects' && styles.menuItemActive]}><Text style={styles.menuItemIcon}>▦</Text><Text style={styles.menuItemText}>Projetos</Text></Pressable>
            <Pressable onPress={() => openPage('planning')} style={[styles.menuItem, activePage === 'planning' && styles.menuItemActive]}><Text style={styles.menuItemIcon}>✓</Text><Text style={styles.menuItemText}>Planejamento</Text></Pressable>
            <Pressable onPress={() => openPage('clients')} style={[styles.menuItem, activePage === 'clients' && styles.menuItemActive]}><Text style={styles.menuItemIcon}>♡</Text><Text style={styles.menuItemText}>Clientes</Text></Pressable>
            <Pressable onPress={() => openPage('materials')} style={[styles.menuItem, activePage === 'materials' && styles.menuItemActive]}><Text style={styles.menuItemIcon}>□</Text><Text style={styles.menuItemText}>Materiais</Text></Pressable>
            <Pressable onPress={() => openPage('ideas')} style={[styles.menuItem, activePage === 'ideas' && styles.menuItemActive]}><Text style={styles.menuItemIcon}>✦</Text><Text style={styles.menuItemText}>Ideias</Text></Pressable>
            <Pressable onPress={() => openPage('settings')} style={[styles.menuItem, activePage === 'settings' && styles.menuItemActive]}><Text style={styles.menuItemIcon}>⚙</Text><Text style={styles.menuItemText}>Configurações</Text></Pressable>
            <View style={styles.menuDivider} />
            <View style={styles.menuSync}><View style={styles.liveDot} /><Text style={styles.menuSyncText}>Firebase conectado e sincronizado</Text></View>
            <Pressable onPress={() => signOut(auth)} style={styles.menuLogout}><Text style={styles.menuLogoutText}>Sair da conta</Text></Pressable>
          </View>
        </View>
      </Modal>

      <Modal animationType="slide" onRequestClose={() => setProjectPickerOpen(false)} transparent visible={projectPickerOpen}>
        <View style={styles.menuBackdrop}>
          <View style={styles.menuSheet}>
            <View style={styles.menuHeading}>
              <View><Text style={styles.sectionKicker}>CRONÔMETRO</Text><Text style={styles.menuTitle}>Escolha o projeto</Text></View>
              <Pressable accessibilityLabel="Fechar projetos" onPress={() => setProjectPickerOpen(false)} style={styles.menuClose}><Text style={styles.menuCloseText}>×</Text></Pressable>
            </View>
            <ScrollView style={styles.projectPickerList}>
              {timerProjects.map((project) => <Pressable key={project.id} onPress={() => { setSelectedProjectId(project.id); setProjectPickerOpen(false) }} style={[styles.projectPickerItem, selectedProjectId === project.id && styles.menuItemActive]}>
                <View style={styles.projectIcon}><Text style={styles.projectIconText}>R</Text></View>
                <View style={styles.rowBody}><Text style={styles.rowTitle}>{project.title}</Text><Text style={styles.rowMeta}>{project.status} · {formatShortDate(project.deadline)}</Text></View>
                {selectedProjectId === project.id ? <Text style={styles.projectSelected}>✓</Text> : null}
              </Pressable>)}
              {!timerProjects.length ? <Text style={styles.emptyText}>Nenhum projeto disponível para iniciar.</Text> : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal animationType="slide" onRequestClose={() => setSelectedProjectDetailsId(null)} transparent visible={Boolean(selectedProjectDetails)}>
        <View style={styles.menuBackdrop}>
          <View style={styles.projectDetailsSheet}>
            <View style={styles.menuHeading}>
              <View style={styles.projectDetailsHeading}><Text style={styles.sectionKicker}>{selectedProjectDetails?.type || 'PROJETO'}</Text><Text numberOfLines={2} style={styles.menuTitle}>{selectedProjectDetails?.title}</Text></View>
              <Pressable accessibilityLabel="Fechar detalhes" onPress={() => setSelectedProjectDetailsId(null)} style={styles.menuClose}><Text style={styles.menuCloseText}>×</Text></Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.projectDetailsMeta}>
                <View><Text style={styles.detailLabel}>CLIENTE</Text><Text style={styles.detailValue}>{selectedProjectDetails?.client || 'Projeto pessoal'}</Text></View>
                <View><Text style={styles.detailLabel}>PRAZO</Text><Text style={styles.detailValue}>{formatShortDate(selectedProjectDetails?.deadline)}</Text></View>
                <View><Text style={styles.detailLabel}>CATEGORIA</Text><Text style={styles.detailValue}>{selectedProjectDetails?.category || 'Não informada'}</Text></View>
              </View>
              {selectedProjectDetails?.description ? <View style={styles.projectDescription}><Text style={styles.detailLabel}>DESCRIÇÃO</Text><Text style={styles.projectDescriptionText}>{selectedProjectDetails.description}</Text></View> : null}
              <View style={styles.projectCostSummary}>
                <View style={styles.projectCostItem}><Text style={styles.detailLabel}>TEMPO</Text><Text style={styles.projectCostValue}>{formatDuration(selectedProjectSeconds)}</Text></View>
                <View style={styles.projectCostItem}><Text style={styles.detailLabel}>MÃO DE OBRA</Text><Text style={styles.projectCostValue}>{formatCurrency(selectedProjectLaborCost)}</Text></View>
                <View style={styles.projectCostItem}><Text style={styles.detailLabel}>MATERIAIS</Text><Text style={styles.projectCostValue}>{formatCurrency(selectedProjectMaterialCost)}</Text></View>
              </View>
              <View style={styles.projectTotalCard}><Text style={styles.projectTotalLabel}>VALOR ACUMULADO DA PEÇA</Text><Text style={styles.projectTotalValue}>{formatCurrency(selectedProjectTotalCost)}</Text></View>
              <View style={styles.projectDetailSection}>
                <View style={styles.projectDetailSectionHeading}><View><Text style={styles.detailLabel}>TEMPO TRABALHADO</Text><Text style={styles.projectSectionTitle}>Sessões do projeto</Text></View><Text style={styles.projectSectionTotal}>{formatDuration(selectedProjectSeconds)}</Text></View>
                {selectedProjectTimeEntries.length ? [...selectedProjectTimeEntries].sort((first, second) => second.startedAt.localeCompare(first.startedAt)).map((entry) => {
                  const start = new Date(entry.startedAt)
                  const end = entry.endedAt ? new Date(entry.endedAt) : null
                  const seconds = Math.max(0, Math.floor(((end?.getTime() ?? now) - start.getTime()) / 1000))
                  return <View key={entry.id} style={styles.timeEntryRow}><View style={styles.rowBody}><Text style={styles.timeEntryDate}>{start.toLocaleDateString('pt-BR')}{entry.autoPaused ? ' · pausa automática' : ''}</Text><Text style={styles.rowMeta}>{start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} — {end ? end.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'em andamento'}</Text></View><Text style={styles.timeEntryDuration}>{formatDuration(seconds)}</Text></View>
                }) : <Text style={styles.projectEmptyText}>Nenhum tempo registrado neste projeto.</Text>}
              </View>
              <View style={styles.projectDetailSection}>
                <View style={styles.projectDetailSectionHeading}><View><Text style={styles.detailLabel}>MATERIAIS UTILIZADOS</Text><Text style={styles.projectSectionTitle}>Consumo da peça</Text></View><Text style={styles.projectSectionTotal}>{formatCurrency(selectedProjectMaterialCost)}</Text></View>
                {(selectedProjectDetails?.materials || []).length ? (selectedProjectDetails?.materials || []).map((usage) => <View key={usage.id} style={styles.materialUsageRow}><View style={styles.rowBody}><Text style={styles.rowTitle}>{usage.name}</Text><Text style={styles.rowMeta}>{usage.quantity.toLocaleString('pt-BR')} {usage.unit} × {formatCurrency(usage.unitCost)}</Text></View><Text style={styles.materialUsageCost}>{formatCurrency(usage.quantity * usage.unitCost)}</Text><Pressable accessibilityLabel={`Remover ${usage.name}`} disabled={materialUsageBusy} onPress={() => removeMaterialFromProject(usage)} style={styles.materialUsageRemove}><Text style={styles.materialUsageRemoveText}>×</Text></Pressable></View>) : <Text style={styles.projectEmptyText}>Nenhum material lançado neste projeto.</Text>}
                {materials.length ? <View style={styles.materialUsageForm}>
                  <Text style={styles.formLabel}>ADICIONAR MATERIAL</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.materialUsagePicker}>{materials.map((material) => <Pressable key={material.id} onPress={() => { setSelectedMaterialId(material.id); setMaterialUsageError('') }} style={[styles.materialUsageOption, selectedMaterialId === material.id && styles.materialUsageOptionActive]}><Text style={[styles.materialUsageOptionName, selectedMaterialId === material.id && styles.materialUsageOptionNameActive]}>{material.name}</Text><Text style={styles.materialUsageOptionStock}>{material.stock.toLocaleString('pt-BR')} {material.unit}</Text></Pressable>)}</ScrollView>
                  <View style={styles.materialUsageControls}><TextInput keyboardType="decimal-pad" onChangeText={(materialUsageQuantity) => { setMaterialUsageQuantity(materialUsageQuantity); setMaterialUsageError('') }} placeholder="Quantidade" placeholderTextColor="#B69B91" style={styles.materialUsageInput} value={materialUsageQuantity} /><Pressable disabled={materialUsageBusy} onPress={addMaterialToProject} style={({ pressed }) => [styles.materialUsageAdd, (pressed || materialUsageBusy) && styles.buttonPressed]}>{materialUsageBusy ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.materialUsageAddText}>＋ Adicionar</Text>}</Pressable></View>
                  {materialUsageError ? <Text style={styles.formError}>{materialUsageError}</Text> : null}
                </View> : <Text style={styles.projectEmptyText}>Cadastre materiais para poder lançá-los aqui.</Text>}
              </View>
              <Text style={styles.statusTitle}>ETAPA DO PROJETO</Text>
              <View style={styles.statusGrid}>{projectStatuses.map((status) => <Pressable disabled={updatingProject} key={status} onPress={() => changeProjectStatus(status)} style={[styles.statusOption, selectedProjectDetails?.status === status && styles.statusOptionActive]}>
                <View style={[styles.statusDot, status === 'Stand by' && styles.statusDotStandBy, (status === 'Pronto' || status === 'Entregue') && styles.statusDotDone]} />
                <Text style={[styles.statusOptionText, selectedProjectDetails?.status === status && styles.statusOptionTextActive]}>{status}</Text>
                {selectedProjectDetails?.status === status ? <Text style={styles.statusCheck}>✓</Text> : null}
              </Pressable>)}</View>
              {updatingProject ? <View style={styles.statusLoading}><ActivityIndicator color="#D77F8B" /><Text style={styles.loadingText}>Atualizando projeto...</Text></View> : null}
              {selectedProjectDetails?.referenceLink ? <Pressable onPress={() => Linking.openURL(selectedProjectDetails.referenceLink || '').catch(() => undefined)} style={styles.projectReferenceButton}><Text style={styles.projectReferenceText}>Abrir referência ↗</Text></Pressable> : null}
              {selectedProjectDetails ? <Pressable onPress={() => openEditProject(selectedProjectDetails)} style={styles.saveTaskButton}><Text style={styles.saveTaskButtonText}>Editar informações do projeto</Text></Pressable> : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal animationType="slide" onRequestClose={() => setProjectForm(null)} transparent visible={Boolean(projectForm)}>
        <View style={styles.menuBackdrop}>
          <View style={styles.projectFormSheet}>
            <View style={styles.menuHeading}>
              <View style={styles.projectDetailsHeading}><Text style={styles.sectionKicker}>{projectForm?.sourceIdeaId ? 'TRANSFORMAR IDEIA' : projectForm?.id ? 'EDITAR PROJETO' : 'NOVO PROJETO'}</Text><Text style={styles.menuTitle}>{projectForm?.id ? 'Editar projeto' : 'Criar projeto'}</Text></View>
              <Pressable accessibilityLabel="Fechar formulário" onPress={() => setProjectForm(null)} style={styles.menuClose}><Text style={styles.menuCloseText}>×</Text></Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.formLabel}>NOME DO PROJETO</Text>
              <TextInput onChangeText={(title) => setProjectForm((current) => current ? { ...current, title } : current)} placeholder="Ex.: Noivinhos com pets" placeholderTextColor="#B69B91" style={styles.formInput} value={projectForm?.title || ''} />
              <Text style={styles.formLabel}>DESCRIÇÃO</Text>
              <TextInput multiline numberOfLines={4} onChangeText={(description) => setProjectForm((current) => current ? { ...current, description } : current)} placeholder="Detalhes da peça..." placeholderTextColor="#B69B91" style={[styles.formInput, styles.reasonInput]} textAlignVertical="top" value={projectForm?.description || ''} />
              <Text style={styles.formLabel}>TIPO</Text>
              <View style={styles.priorityOptions}>{(['Pessoal', 'Encomenda'] as const).map((type) => <Pressable key={type} onPress={() => setProjectForm((current) => current ? { ...current, type, client: type === 'Pessoal' ? '' : current.client } : current)} style={[styles.priorityOption, projectForm?.type === type && styles.priorityOptionActive]}><Text style={[styles.priorityOptionText, projectForm?.type === type && styles.priorityOptionTextActive]}>{type}</Text></Pressable>)}</View>
              {projectForm?.type === 'Encomenda' ? <><Text style={styles.formLabel}>CLIENTE</Text><View>{clients.length ? clients.map((client) => <Pressable key={client.id} onPress={() => setProjectForm((current) => current ? { ...current, client: client.name } : current)} style={[styles.formProjectOption, projectForm.client === client.name && styles.formProjectOptionActive]}><Text style={styles.formProjectText}>{client.name}</Text>{projectForm.client === client.name ? <Text style={styles.statusCheck}>✓</Text> : null}</Pressable>) : <Text style={styles.formHint}>Cadastre uma cliente antes de criar uma encomenda.</Text>}</View></> : null}
              <Text style={styles.formLabel}>CATEGORIA</Text>
              <TextInput onChangeText={(category) => setProjectForm((current) => current ? { ...current, category } : current)} placeholder="Ex.: Noivinhos" placeholderTextColor="#B69B91" style={styles.formInput} value={projectForm?.category || ''} />
              <Text style={styles.formLabel}>PRAZO</Text>
              <TextInput keyboardType="number-pad" maxLength={10} onChangeText={(deadline) => setProjectForm((current) => current ? { ...current, deadline: maskInputDate(deadline) } : current)} placeholder="DD/MM/AAAA (opcional)" placeholderTextColor="#B69B91" style={styles.formInput} value={projectForm?.deadline || ''} />
              <Text style={styles.formLabel}>ETAPA</Text>
              <View style={styles.statusGrid}>{projectStatuses.map((status) => <Pressable key={status} onPress={() => setProjectForm((current) => current ? { ...current, status } : current)} style={[styles.statusOption, projectForm?.status === status && styles.statusOptionActive]}><View style={[styles.statusDot, status === 'Stand by' && styles.statusDotStandBy, (status === 'Pronto' || status === 'Entregue') && styles.statusDotDone]} /><Text style={[styles.statusOptionText, projectForm?.status === status && styles.statusOptionTextActive]}>{status}</Text>{projectForm?.status === status ? <Text style={styles.statusCheck}>✓</Text> : null}</Pressable>)}</View>
              <Text style={styles.formLabel}>TAGS</Text>
              <TextInput autoCapitalize="none" onChangeText={(tags) => setProjectForm((current) => current ? { ...current, tags } : current)} placeholder="gatos, casamento, presente" placeholderTextColor="#B69B91" style={styles.formInput} value={projectForm?.tags || ''} />
              <Text style={styles.formLabel}>LINK DE REFERÊNCIA</Text>
              <TextInput autoCapitalize="none" keyboardType="url" onChangeText={(referenceLink) => setProjectForm((current) => current ? { ...current, referenceLink } : current)} placeholder="https://pinterest.com/..." placeholderTextColor="#B69B91" style={styles.formInput} value={projectForm?.referenceLink || ''} />
              {projectFormError ? <Text style={styles.formError}>{projectFormError}</Text> : null}
              <Pressable disabled={savingProject} onPress={saveProjectForm} style={({ pressed }) => [styles.saveTaskButton, (pressed || savingProject) && styles.buttonPressed]}>{savingProject ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveTaskButtonText}>{projectForm?.id ? 'Salvar alterações' : 'Criar projeto'}</Text>}</Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal animationType="slide" onRequestClose={() => setSelectedPlanningDate(null)} transparent visible={Boolean(selectedPlanningDate)}>
        <View style={styles.menuBackdrop}>
          <View style={styles.dayDetailsSheet}>
            <View style={styles.menuHeading}>
              <View style={styles.projectDetailsHeading}>
                <Text style={styles.sectionKicker}>AGENDA DO DIA</Text>
                <Text style={styles.menuTitle}>{selectedPlanningDate ? parseDate(selectedPlanningDate).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }) : ''}</Text>
              </View>
              <Pressable accessibilityLabel="Fechar agenda do dia" onPress={() => setSelectedPlanningDate(null)} style={styles.menuClose}><Text style={styles.menuCloseText}>×</Text></Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {selectedDayTasks.map((task) => {
                const linkedProject = projects.find((project) => project.id === task.projectId)
                const isLate = !task.completed && (task.endDate || task.date) < summary.today && !inactiveStatuses.has(linkedProject?.status ?? '')
                return <Pressable key={`task-${task.id}`} onPress={() => openEditTask(task)} style={[styles.dayDetailRow, isLate && styles.dayDetailLate, task.completed && styles.dayDetailDone]}>
                  <Text style={styles.dayDetailIcon}>{task.completed ? '✓' : '▣'}</Text>
                  <View style={styles.rowBody}><Text style={[styles.rowTitle, isLate && styles.warningText]}>{task.title}</Text><Text style={styles.rowMeta}>Tarefa · {task.priority}{linkedProject ? ` · ${linkedProject.title}` : ''}</Text></View>
                  <Text style={styles.editGlyph}>✎</Text>
                </Pressable>
              })}
              {selectedDayProjects.map((project) => <Pressable key={`project-${project.id}`} onPress={() => { setSelectedPlanningDate(null); setSelectedProjectDetailsId(project.id) }} style={[styles.dayDetailRow, inactiveStatuses.has(project.status) && styles.dayDetailDone]}>
                <Text style={styles.dayDetailIcon}>R</Text>
                <View style={styles.rowBody}><Text style={styles.rowTitle}>{project.title}</Text><Text style={styles.rowMeta}>Entrega · {project.client || 'Projeto pessoal'} · {project.status}</Text></View>
              </Pressable>)}
              {selectedDayUnavailable.map((item) => <View key={`unavailable-${item.id}`} style={[styles.dayDetailRow, styles.dayDetailUnavailable]}>
                <Text style={styles.dayDetailIcon}>×</Text>
                <View style={styles.rowBody}><Text style={styles.rowTitle}>{item.reason}</Text><Text style={styles.rowMeta}>Dia indisponível</Text></View>
                <Pressable accessibilityLabel={`Remover indisponibilidade: ${item.reason}`} disabled={removingUnavailableId === item.id} onPress={() => removeUnavailableDay(item)} style={styles.removeUnavailableButton}>{removingUnavailableId === item.id ? <ActivityIndicator color="#85808C" size="small" /> : <Text style={styles.removeUnavailableText}>Remover</Text>}</Pressable>
              </View>)}
              {!selectedDayTasks.length && !selectedDayProjects.length && !selectedDayUnavailable.length ? <View style={styles.dayEmpty}><Text style={styles.dayEmptyIcon}>○</Text><Text style={styles.sectionTitle}>Nada planejado</Text><Text style={styles.emptyText}>Este dia está livre no seu ateliê.</Text></View> : null}
              <Pressable onPress={() => { const date = selectedPlanningDate || summary.today; setSelectedPlanningDate(null); openNewTask(date) }} style={styles.addTaskDayButton}><Text style={styles.addTaskDayButtonText}>＋ Adicionar tarefa neste dia</Text></Pressable>
              <Pressable onPress={() => { const date = selectedPlanningDate || summary.today; setSelectedPlanningDate(null); openUnavailableForm(date) }} style={styles.blockDayButton}><Text style={styles.blockDayButtonText}>× Marcar dia como indisponível</Text></Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal animationType="slide" onRequestClose={() => setTaskForm(null)} transparent visible={Boolean(taskForm)}>
        <View style={styles.menuBackdrop}>
          <View style={styles.taskFormSheet}>
            <View style={styles.menuHeading}>
              <View style={styles.projectDetailsHeading}><Text style={styles.sectionKicker}>{taskForm?.id ? 'EDITAR TAREFA' : 'NOVA TAREFA'}</Text><Text style={styles.menuTitle}>{taskForm?.id ? 'Editar planejamento' : 'Adicionar ao planejamento'}</Text></View>
              <Pressable accessibilityLabel="Fechar formulário" onPress={() => setTaskForm(null)} style={styles.menuClose}><Text style={styles.menuCloseText}>×</Text></Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.formLabel}>TAREFA</Text>
              <TextInput onChangeText={(title) => setTaskForm((current) => current ? { ...current, title } : current)} placeholder="Ex.: Terminar gatinhos" placeholderTextColor="#B69B91" style={styles.formInput} value={taskForm?.title || ''} />
              <Text style={styles.formLabel}>PERÍODO</Text>
              <View style={styles.dateInputRow}>
                <View style={styles.dateInputGroup}><Text style={styles.dateInputCaption}>Início</Text><TextInput keyboardType="number-pad" maxLength={10} onChangeText={(startDate) => setTaskForm((current) => current ? { ...current, startDate: maskInputDate(startDate) } : current)} placeholder="DD/MM/AAAA" placeholderTextColor="#B69B91" style={styles.formInput} value={taskForm?.startDate || ''} /></View>
                <View style={styles.dateInputGroup}><Text style={styles.dateInputCaption}>Término</Text><TextInput keyboardType="number-pad" maxLength={10} onChangeText={(endDate) => setTaskForm((current) => current ? { ...current, endDate: maskInputDate(endDate) } : current)} placeholder="DD/MM/AAAA" placeholderTextColor="#B69B91" style={styles.formInput} value={taskForm?.endDate || ''} /></View>
              </View>
              <Text style={styles.formLabel}>PRIORIDADE</Text>
              <View style={styles.priorityOptions}>{['Baixa', 'Média', 'Alta'].map((priority) => <Pressable key={priority} onPress={() => setTaskForm((current) => current ? { ...current, priority } : current)} style={[styles.priorityOption, taskForm?.priority === priority && styles.priorityOptionActive]}><Text style={[styles.priorityOptionText, taskForm?.priority === priority && styles.priorityOptionTextActive]}>{priority}</Text></Pressable>)}</View>
              <Text style={styles.formLabel}>PROJETO RELACIONADO</Text>
              <Pressable onPress={() => setTaskForm((current) => current ? { ...current, projectId: '' } : current)} style={[styles.formProjectOption, !taskForm?.projectId && styles.formProjectOptionActive]}><Text style={styles.formProjectText}>Tarefa geral do ateliê</Text>{!taskForm?.projectId ? <Text style={styles.statusCheck}>✓</Text> : null}</Pressable>
              {projects.filter((project) => !inactiveStatuses.has(project.status)).map((project) => <Pressable key={project.id} onPress={() => setTaskForm((current) => current ? { ...current, projectId: project.id } : current)} style={[styles.formProjectOption, taskForm?.projectId === project.id && styles.formProjectOptionActive]}><Text style={styles.formProjectText}>{project.title}</Text>{taskForm?.projectId === project.id ? <Text style={styles.statusCheck}>✓</Text> : null}</Pressable>)}
              {taskFormError ? <Text style={styles.formError}>{taskFormError}</Text> : null}
              <Pressable disabled={savingTask} onPress={saveTaskForm} style={({ pressed }) => [styles.saveTaskButton, (pressed || savingTask) && styles.buttonPressed]}>{savingTask ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveTaskButtonText}>{taskForm?.id ? 'Salvar alterações' : 'Adicionar tarefa'}</Text>}</Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal animationType="slide" onRequestClose={() => setUnavailableForm(null)} transparent visible={Boolean(unavailableForm)}>
        <View style={styles.menuBackdrop}>
          <View style={styles.unavailableFormSheet}>
            <View style={styles.menuHeading}>
              <View style={styles.projectDetailsHeading}><Text style={styles.sectionKicker}>BLOQUEAR AGENDA</Text><Text style={styles.menuTitle}>Adicionar dia indisponível</Text></View>
              <Pressable accessibilityLabel="Fechar formulário" onPress={() => setUnavailableForm(null)} style={styles.menuClose}><Text style={styles.menuCloseText}>×</Text></Pressable>
            </View>
            <Text style={styles.formLabel}>DATA</Text>
            <TextInput keyboardType="number-pad" maxLength={10} onChangeText={(date) => setUnavailableForm((current) => current ? { ...current, date: maskInputDate(date) } : current)} placeholder="DD/MM/AAAA" placeholderTextColor="#B69B91" style={styles.formInput} value={unavailableForm?.date || ''} />
            <Text style={styles.formLabel}>MOTIVO</Text>
            <TextInput multiline numberOfLines={4} onChangeText={(reason) => setUnavailableForm((current) => current ? { ...current, reason } : current)} placeholder="Ex.: Compromisso pessoal ou viagem" placeholderTextColor="#B69B91" style={[styles.formInput, styles.reasonInput]} textAlignVertical="top" value={unavailableForm?.reason || ''} />
            {unavailableFormError ? <Text style={styles.formError}>{unavailableFormError}</Text> : null}
            <Pressable disabled={savingUnavailable} onPress={saveUnavailableForm} style={({ pressed }) => [styles.saveUnavailableButton, (pressed || savingUnavailable) && styles.buttonPressed]}>{savingUnavailable ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveTaskButtonText}>Bloquear dia</Text>}</Pressable>
          </View>
        </View>
      </Modal>

      <Modal animationType="slide" onRequestClose={() => setClientForm(null)} transparent visible={Boolean(clientForm)}>
        <View style={styles.menuBackdrop}>
          <View style={styles.clientFormSheet}>
            <View style={styles.menuHeading}>
              <View style={styles.projectDetailsHeading}><Text style={styles.sectionKicker}>{clientForm?.id ? 'ATUALIZAR CLIENTE' : 'NOVA CLIENTE'}</Text><Text style={styles.menuTitle}>{clientForm?.id ? 'Editar cliente' : 'Cadastrar cliente'}</Text></View>
              <Pressable accessibilityLabel="Fechar formulário" onPress={() => setClientForm(null)} style={styles.menuClose}><Text style={styles.menuCloseText}>×</Text></Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.formLabel}>NOME</Text>
              <TextInput onChangeText={(name) => setClientForm((current) => current ? { ...current, name } : current)} placeholder="Nome completo" placeholderTextColor="#B69B91" style={styles.formInput} value={clientForm?.name || ''} />
              <Text style={styles.formLabel}>TELEFONE / WHATSAPP</Text>
              <TextInput keyboardType="phone-pad" onChangeText={(phone) => setClientForm((current) => current ? { ...current, phone } : current)} placeholder="(00) 00000-0000" placeholderTextColor="#B69B91" style={styles.formInput} value={clientForm?.phone || ''} />
              <Text style={styles.formLabel}>INSTAGRAM</Text>
              <TextInput autoCapitalize="none" onChangeText={(instagram) => setClientForm((current) => current ? { ...current, instagram } : current)} placeholder="@usuario" placeholderTextColor="#B69B91" style={styles.formInput} value={clientForm?.instagram || ''} />
              <Text style={styles.formLabel}>E-MAIL</Text>
              <TextInput autoCapitalize="none" keyboardType="email-address" onChangeText={(email) => setClientForm((current) => current ? { ...current, email } : current)} placeholder="cliente@email.com" placeholderTextColor="#B69B91" style={styles.formInput} value={clientForm?.email || ''} />
              <Text style={styles.formLabel}>OBSERVAÇÕES</Text>
              <TextInput multiline numberOfLines={4} onChangeText={(notes) => setClientForm((current) => current ? { ...current, notes } : current)} placeholder="Preferências, datas importantes ou outros detalhes..." placeholderTextColor="#B69B91" style={[styles.formInput, styles.reasonInput]} textAlignVertical="top" value={clientForm?.notes || ''} />
              {clientFormError ? <Text style={styles.formError}>{clientFormError}</Text> : null}
              <Pressable disabled={savingClient} onPress={saveClientForm} style={({ pressed }) => [styles.saveTaskButton, (pressed || savingClient) && styles.buttonPressed]}>{savingClient ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveTaskButtonText}>{clientForm?.id ? 'Salvar alterações' : 'Cadastrar cliente'}</Text>}</Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal animationType="slide" onRequestClose={() => setMaterialForm(null)} transparent visible={Boolean(materialForm)}>
        <View style={styles.menuBackdrop}>
          <View style={styles.materialFormSheet}>
            <View style={styles.menuHeading}>
              <View style={styles.projectDetailsHeading}><Text style={styles.sectionKicker}>{materialForm?.id ? 'ATUALIZAR MATERIAL' : 'NOVO MATERIAL'}</Text><Text style={styles.menuTitle}>{materialForm?.id ? 'Editar material' : 'Cadastrar material'}</Text></View>
              <Pressable accessibilityLabel="Fechar formulário" onPress={() => setMaterialForm(null)} style={styles.menuClose}><Text style={styles.menuCloseText}>×</Text></Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.formLabel}>NOME DO MATERIAL</Text>
              <TextInput onChangeText={(name) => setMaterialForm((current) => current ? { ...current, name } : current)} placeholder="Ex.: Massa branca" placeholderTextColor="#B69B91" style={styles.formInput} value={materialForm?.name || ''} />
              <Text style={styles.formLabel}>CATEGORIA</Text>
              <TextInput onChangeText={(category) => setMaterialForm((current) => current ? { ...current, category } : current)} placeholder="Ex.: Massa" placeholderTextColor="#B69B91" style={styles.formInput} value={materialForm?.category || ''} />
              <Text style={styles.formLabel}>UNIDADE DE MEDIDA</Text>
              <View style={styles.unitOptions}>{['g', 'kg', 'ml', 'l', 'cm', 'un'].map((unit) => <Pressable key={unit} onPress={() => setMaterialForm((current) => current ? { ...current, unit } : current)} style={[styles.unitOption, materialForm?.unit === unit && styles.unitOptionActive]}><Text style={[styles.unitOptionText, materialForm?.unit === unit && styles.unitOptionTextActive]}>{unit}</Text></Pressable>)}</View>
              <View style={styles.materialNumberRow}>
                <View style={styles.dateInputGroup}><Text style={styles.formLabel}>ESTOQUE ATUAL</Text><TextInput keyboardType="decimal-pad" onChangeText={(stock) => setMaterialForm((current) => current ? { ...current, stock } : current)} placeholder="0" placeholderTextColor="#B69B91" style={styles.formInput} value={materialForm?.stock || ''} /></View>
                <View style={styles.dateInputGroup}><Text style={styles.formLabel}>ESTOQUE MÍNIMO</Text><TextInput keyboardType="decimal-pad" onChangeText={(minimumStock) => setMaterialForm((current) => current ? { ...current, minimumStock } : current)} placeholder="0" placeholderTextColor="#B69B91" style={styles.formInput} value={materialForm?.minimumStock || ''} /></View>
              </View>
              <Text style={styles.formLabel}>CUSTO POR UNIDADE</Text>
              <TextInput keyboardType="decimal-pad" onChangeText={(unitCost) => setMaterialForm((current) => current ? { ...current, unitCost } : current)} placeholder="0,00" placeholderTextColor="#B69B91" style={styles.formInput} value={materialForm?.unitCost || ''} />
              {materialFormError ? <Text style={styles.formError}>{materialFormError}</Text> : null}
              <Pressable disabled={savingMaterial} onPress={saveMaterialForm} style={({ pressed }) => [styles.saveTaskButton, (pressed || savingMaterial) && styles.buttonPressed]}>{savingMaterial ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveTaskButtonText}>{materialForm?.id ? 'Salvar alterações' : 'Cadastrar material'}</Text>}</Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal animationType="slide" onRequestClose={() => setIdeaForm(null)} transparent visible={Boolean(ideaForm)}>
        <View style={styles.menuBackdrop}>
          <View style={styles.ideaFormSheet}>
            <View style={styles.menuHeading}>
              <View style={styles.projectDetailsHeading}><Text style={styles.sectionKicker}>{ideaForm?.id ? 'EDITAR INSPIRAÇÃO' : 'NOVA INSPIRAÇÃO'}</Text><Text style={styles.menuTitle}>{ideaForm?.id ? 'Editar ideia' : 'Cadastrar ideia'}</Text></View>
              <Pressable accessibilityLabel="Fechar formulário" onPress={() => setIdeaForm(null)} style={styles.menuClose}><Text style={styles.menuCloseText}>×</Text></Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.formLabel}>NOME DA IDEIA</Text>
              <TextInput onChangeText={(title) => setIdeaForm((current) => current ? { ...current, title } : current)} placeholder="Ex.: Topo de bolo jardim encantado" placeholderTextColor="#B69B91" style={styles.formInput} value={ideaForm?.title || ''} />
              <Text style={styles.formLabel}>DESCRIÇÃO</Text>
              <TextInput multiline numberOfLines={4} onChangeText={(description) => setIdeaForm((current) => current ? { ...current, description } : current)} placeholder="Conte um pouco sobre a inspiração..." placeholderTextColor="#B69B91" style={[styles.formInput, styles.reasonInput]} textAlignVertical="top" value={ideaForm?.description || ''} />
              <Text style={styles.formLabel}>CATEGORIA</Text>
              <TextInput onChangeText={(category) => setIdeaForm((current) => current ? { ...current, category } : current)} placeholder="Ex.: Topo de bolo" placeholderTextColor="#B69B91" style={styles.formInput} value={ideaForm?.category || ''} />
              <Text style={styles.formLabel}>PRIORIDADE</Text>
              <View style={styles.priorityOptions}>{['Baixa', 'Média', 'Alta'].map((priority) => <Pressable key={priority} onPress={() => setIdeaForm((current) => current ? { ...current, priority } : current)} style={[styles.priorityOption, ideaForm?.priority === priority && styles.priorityOptionActive]}><Text style={[styles.priorityOptionText, ideaForm?.priority === priority && styles.priorityOptionTextActive]}>{priority}</Text></Pressable>)}</View>
              <Text style={styles.formLabel}>TAGS</Text>
              <TextInput autoCapitalize="none" onChangeText={(tags) => setIdeaForm((current) => current ? { ...current, tags } : current)} placeholder="flores, casamento, gatos" placeholderTextColor="#B69B91" style={styles.formInput} value={ideaForm?.tags || ''} />
              <Text style={styles.formHint}>Separe as tags por vírgulas.</Text>
              <Text style={styles.formLabel}>LINK DE REFERÊNCIA</Text>
              <TextInput autoCapitalize="none" keyboardType="url" onChangeText={(link) => setIdeaForm((current) => current ? { ...current, link } : current)} placeholder="https://pinterest.com/..." placeholderTextColor="#B69B91" style={styles.formInput} value={ideaForm?.link || ''} />
              {ideaFormError ? <Text style={styles.formError}>{ideaFormError}</Text> : null}
              <Pressable disabled={savingIdea} onPress={saveIdeaForm} style={({ pressed }) => [styles.saveTaskButton, (pressed || savingIdea) && styles.buttonPressed]}>{savingIdea ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveTaskButtonText}>{ideaForm?.id ? 'Salvar alterações' : 'Salvar ideia'}</Text>}</Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {activePage === 'home' ? <View style={styles.welcomeCard}>
        <Text style={styles.eyebrow}>{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).toLocaleUpperCase('pt-BR')}</Text>
        <Text style={styles.welcomeTitle}>Olá, {ownerFirstName} 🐾</Text>
        <Text style={styles.welcomeText}>Seu ateliê, seus prazos e sua bancada também no celular.</Text>
      </View> : <View style={styles.pageHeading}>
        <Text style={styles.sectionKicker}>{pageMeta.kicker}</Text>
        <Text style={styles.pageTitle}>{pageMeta.title}</Text>
        <Text style={styles.pageSubtitle}>{pageMeta.subtitle}</Text>
      </View>}

      {actionMessage ? <View style={styles.actionMessage}><Text style={styles.actionMessageText}>{actionMessage}</Text></View> : null}

      {loading ? (
        <View style={styles.loadingCard}><ActivityIndicator color="#9A6B56" /><Text style={styles.loadingText}>Sincronizando seu ateliê...</Text></View>
      ) : activePage === 'home' ? (
        <>
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{summary.activeProjects.length}</Text>
              <Text style={styles.summaryLabel}>Projetos ativos</Text>
            </View>
            <View style={[styles.summaryCard, summary.overdueTasks.length > 0 && styles.summaryCardWarning]}>
              <Text style={[styles.summaryValue, summary.overdueTasks.length > 0 && styles.warningText]}>{summary.overdueTasks.length}</Text>
              <Text style={styles.summaryLabel}>Tarefas atrasadas</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{summary.pendingTasks.length}</Text>
              <Text style={styles.summaryLabel}>Pendentes</Text>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionKicker}>⏱ TRABALHANDO AGORA</Text>
            <Text style={styles.sectionTitle}>{activeProject?.title || 'Nenhum projeto em andamento'}</Text>
            <Text style={styles.sectionText}>{activeEntry
              ? `${formatDuration(activeSeconds)} nesta sessão · iniciado às ${new Date(activeEntry.startedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
              : 'Escolha uma peça para começar a contabilizar o tempo trabalhado.'}</Text>
            {activeEntry ? <Pressable disabled={timerBusy} onPress={pauseTimer} style={({ pressed }) => [styles.timerPauseButton, (pressed || timerBusy) && styles.buttonPressed]}>
              {timerBusy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.timerPauseText}>Ⅱ  Pausar e salvar</Text>}
            </Pressable> : <View style={styles.timerControls}>
              <Pressable onPress={() => setProjectPickerOpen(true)} style={styles.projectSelectButton}>
                <Text style={selectedProject ? styles.projectSelectValue : styles.projectSelectPlaceholder}>{selectedProject?.title || 'Selecionar projeto...'}</Text><Text style={styles.projectSelectArrow}>⌄</Text>
              </Pressable>
              <Pressable disabled={!selectedProject || timerBusy} onPress={startTimer} style={({ pressed }) => [styles.timerStartButton, (!selectedProject || pressed || timerBusy) && styles.timerStartDisabled]}>
                {timerBusy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.timerStartText}>▶ Iniciar</Text>}
              </Pressable>
            </View>}
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeading}>
              <View>
                <Text style={styles.sectionKicker}>📅 PRÓXIMA ENTREGA</Text>
                <Text style={styles.sectionTitle}>Na bancada</Text>
              </View>
              {summary.nextProject?.deadline && summary.nextProject.deadline < summary.today
                ? <Text style={styles.lateBadge}>ATRASADA</Text>
                : null}
            </View>
            {summary.nextProject ? (
              <View style={styles.deliveryRow}>
                <View style={styles.dateBox}><Text style={styles.dateBoxText}>{formatShortDate(summary.nextProject.deadline)}</Text></View>
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle}>{summary.nextProject.title}</Text>
                  <Text style={styles.rowMeta}>{summary.nextProject.client || 'Projeto pessoal'} · {summary.nextProject.status}</Text>
                </View>
              </View>
            ) : <Text style={styles.emptyText}>Nenhuma entrega agendada.</Text>}
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeading}>
              <View>
                <Text style={styles.sectionKicker}>✓ PLANEJAMENTO</Text>
                <Text style={styles.sectionTitle}>Próximas tarefas</Text>
              </View>
              <Text style={styles.countBadge}>{summary.pendingTasks.length}</Text>
            </View>
            {summary.pendingTasks.length ? summary.pendingTasks.slice(0, 5).map((task) => {
              const isLate = (task.endDate || task.date) < summary.today
                && !inactiveStatuses.has(projects.find((project) => project.id === task.projectId)?.status ?? '')
              const linkedProject = projects.find((project) => project.id === task.projectId)
              return (
                <View key={task.id} style={styles.taskRow}>
                  <Pressable accessibilityLabel={`Concluir ${task.title}`} disabled={updatingTaskId === task.id} onPress={() => toggleTask(task)} style={styles.taskCheck}>
                    {updatingTaskId === task.id ? <ActivityIndicator color="#D77F8B" size="small" /> : <Text style={styles.taskCheckText}>✓</Text>}
                  </Pressable>
                  <View style={styles.rowBody}>
                    <Text style={[styles.rowTitle, isLate && styles.warningText]}>{task.title}</Text>
                    <Text style={styles.rowMeta}>{formatShortDate(task.endDate || task.date)}{linkedProject ? ` · ${linkedProject.title}` : ''}</Text>
                  </View>
                  {isLate ? <Text style={styles.lateText}>ATRASADA</Text> : null}
                </View>
              )
            }) : <Text style={styles.emptyText}>Tudo em dia por aqui ✨</Text>}
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeading}>
              <View>
                <Text style={styles.sectionKicker}>🐾 PROJETOS</Text>
                <Text style={styles.sectionTitle}>Em produção</Text>
              </View>
              <Text style={styles.countBadge}>{summary.activeProjects.length}</Text>
            </View>
            {summary.activeProjects.length ? summary.activeProjects.slice(0, 5).map((project) => (
              <View key={project.id} style={styles.projectRow}>
                <View style={styles.projectIcon}><Text style={styles.projectIconText}>R</Text></View>
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle}>{project.title}</Text>
                  <Text style={styles.rowMeta}>{project.status} · {formatShortDate(project.deadline)}</Text>
                </View>
              </View>
            )) : <Text style={styles.emptyText}>Nenhum projeto ativo no momento.</Text>}
          </View>
        </>
      ) : activePage === 'projects' ? (
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeading}>
            <View><Text style={styles.sectionKicker}>TODOS OS PROJETOS</Text><Text style={styles.sectionTitle}>{projects.length} cadastrados</Text></View>
            <View style={styles.planningHeadingActions}><Text style={styles.countBadge}>{summary.activeProjects.length} ativos</Text><Pressable accessibilityLabel="Criar projeto" onPress={() => openNewProject()} style={styles.addTaskButton}><Text style={styles.addTaskButtonText}>＋</Text></Pressable></View>
          </View>
          {projects.length ? [...projects]
            .sort((first, second) => (first.deadline || '9999').localeCompare(second.deadline || '9999'))
            .map((project) => (
              <Pressable key={project.id} onPress={() => setSelectedProjectDetailsId(project.id)} style={({ pressed }) => [styles.projectRowLarge, pressed && styles.projectRowPressed]}>
                <View style={[styles.projectIcon, project.status === 'Stand by' && styles.projectIconStandBy]}><Text style={styles.projectIconText}>R</Text></View>
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle}>{project.title}</Text>
                  <Text style={styles.rowMeta}>{project.client || 'Projeto pessoal'} · {formatShortDate(project.deadline)}</Text>
                </View>
                <Text style={[styles.statusBadge, project.status === 'Stand by' && styles.statusBadgeStandBy, inactiveStatuses.has(project.status) && project.status !== 'Stand by' && styles.statusBadgeDone]}>{project.status}</Text>
              </Pressable>
            )) : <Text style={styles.emptyText}>Nenhum projeto cadastrado.</Text>}
        </View>
      ) : activePage === 'planning' ? (
        <View style={styles.sectionCard}>
          <View style={styles.monthNavigator}>
            <Pressable accessibilityLabel="Mês anterior" onPress={() => setPlanningMonth(new Date(planningMonth.getFullYear(), planningMonth.getMonth() - 1, 1))} style={styles.monthButton}><Text style={styles.monthButtonText}>‹</Text></Pressable>
            <Pressable onPress={() => { const today = new Date(); setPlanningMonth(new Date(today.getFullYear(), today.getMonth(), 1)) }} style={styles.monthLabelButton}>
              <Text style={styles.monthLabel}>{planningMonthLabel}</Text>
              <Text style={styles.monthTodayHint}>TOQUE PARA VOLTAR AO MÊS ATUAL</Text>
            </Pressable>
            <Pressable accessibilityLabel="Próximo mês" onPress={() => setPlanningMonth(new Date(planningMonth.getFullYear(), planningMonth.getMonth() + 1, 1))} style={styles.monthButton}><Text style={styles.monthButtonText}>›</Text></Pressable>
          </View>
          <View style={styles.calendarWeekdays}>{['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map((day) => <Text key={day} style={styles.calendarWeekday}>{day}</Text>)}</View>
          <View style={styles.calendarGrid}>{planningCalendarDays.map((day) => {
            const key = dateKey(day)
            const outsideMonth = day.getMonth() !== planningMonth.getMonth()
            const dayTasks = tasks.filter((task) => task.date <= key && (task.endDate || task.date) >= key)
            const dayProjects = projects.filter((project) => project.deadline === key)
            const dayUnavailable = unavailableDays.some((item) => item.date === key)
            const hasLateTask = dayTasks.some((task) => !task.completed && (task.endDate || task.date) < summary.today && !inactiveStatuses.has(projects.find((project) => project.id === task.projectId)?.status ?? ''))
            const allTasksDone = dayTasks.length > 0 && dayTasks.every((task) => task.completed)
            const hasEvents = dayTasks.length > 0 || dayProjects.length > 0 || dayUnavailable
            return <Pressable accessibilityLabel={`Ver agenda de ${day.toLocaleDateString('pt-BR')}`} key={key} onPress={() => setSelectedPlanningDate(key)} style={[styles.calendarDay, outsideMonth && styles.calendarDayOutside, key === summary.today && styles.calendarDayToday, hasLateTask && styles.calendarDayLate, allTasksDone && !hasLateTask && styles.calendarDayDone]}>
              <Text style={[styles.calendarDayNumber, outsideMonth && styles.calendarDayNumberOutside]}>{day.getDate()}</Text>
              {hasEvents ? <View style={styles.calendarDots}>
                {dayTasks.length ? <View style={[styles.calendarDot, hasLateTask ? styles.calendarDotLate : allTasksDone ? styles.calendarDotDone : null]} /> : null}
                {dayProjects.length ? <View style={[styles.calendarDot, styles.calendarDotProject]} /> : null}
                {dayUnavailable ? <View style={[styles.calendarDot, styles.calendarDotUnavailable]} /> : null}
              </View> : null}
            </Pressable>
          })}</View>
          <View style={styles.calendarLegend}><Text style={styles.calendarLegendText}>● tarefa</Text><Text style={[styles.calendarLegendText, styles.calendarLegendProject]}>● entrega</Text><Text style={[styles.calendarLegendText, styles.calendarLegendUnavailable]}>● indisponível</Text></View>
          <View style={styles.planningListDivider} />
          <View style={styles.sectionHeading}>
            <View><Text style={styles.sectionKicker}>TAREFAS DO MÊS</Text><Text style={styles.sectionTitle}>Lista do ateliê</Text></View>
            <View style={styles.planningHeadingActions}><Text style={styles.countBadge}>{planningPendingTasks.length}</Text><Pressable accessibilityLabel="Adicionar dia indisponível" onPress={() => openUnavailableForm()} style={styles.blockDayHeadingButton}><Text style={styles.blockDayHeadingText}>×</Text></Pressable><Pressable accessibilityLabel="Adicionar tarefa" onPress={() => openNewTask()} style={styles.addTaskButton}><Text style={styles.addTaskButtonText}>＋</Text></Pressable></View>
          </View>
          {planningPendingTasks.length ? planningPendingTasks.map((task) => {
            const linkedProject = projects.find((project) => project.id === task.projectId)
            const isLate = (task.endDate || task.date) < summary.today && !inactiveStatuses.has(linkedProject?.status ?? '')
            return <View key={task.id} style={styles.taskRowLarge}>
              <Pressable accessibilityLabel={`Concluir ${task.title}`} disabled={updatingTaskId === task.id} onPress={() => toggleTask(task)} style={styles.taskCheck}>
                {updatingTaskId === task.id ? <ActivityIndicator color="#D77F8B" size="small" /> : <Text style={styles.taskCheckText}>✓</Text>}
              </Pressable>
              <View style={styles.rowBody}>
                <Text style={[styles.rowTitle, isLate && styles.warningText]}>{task.title}</Text>
                <Text style={styles.rowMeta}>{formatShortDate(task.date)}{task.endDate && task.endDate !== task.date ? ` até ${formatShortDate(task.endDate)}` : ''}{linkedProject ? ` · ${linkedProject.title}` : ''}</Text>
              </View>
              <Pressable accessibilityLabel={`Editar ${task.title}`} onPress={() => openEditTask(task)} style={styles.editTaskButton}><Text style={styles.editGlyph}>✎</Text></Pressable>
              {isLate ? <Text style={styles.lateText}>ATRASADA</Text> : <Text style={styles.priorityText}>{task.priority}</Text>}
            </View>
          }) : <Text style={styles.emptyText}>Nenhuma tarefa pendente neste mês ✨</Text>}

          {planningCompletedTasks.length ? <View style={styles.completedSection}>
            <Text style={styles.completedTitle}>CONCLUÍDAS NESTE MÊS</Text>
            {planningCompletedTasks.map((task) => (
              <View key={task.id} style={styles.completedRow}>
                <Pressable accessibilityLabel={`Reabrir ${task.title}`} disabled={updatingTaskId === task.id} onPress={() => toggleTask(task)} style={[styles.taskCheck, styles.taskCheckCompleted]}>
                  {updatingTaskId === task.id ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.taskCheckCompletedText}>✓</Text>}
                </Pressable>
                <View style={styles.rowBody}><Text style={styles.completedTaskText}>{task.title}</Text><Text style={styles.rowMeta}>Toque no check para reabrir</Text></View>
              </View>
            ))}
          </View> : null}
        </View>
      ) : activePage === 'clients' ? (
        <View>
          <View style={styles.clientsToolbar}>
            <TextInput autoCapitalize="none" onChangeText={setClientQuery} placeholder="Buscar por nome ou contato" placeholderTextColor="#B69B91" style={styles.clientSearchInput} value={clientQuery} />
            <Pressable accessibilityLabel="Cadastrar cliente" onPress={openNewClient} style={styles.newClientButton}><Text style={styles.newClientButtonText}>＋</Text></Pressable>
          </View>
          <Text style={styles.clientCount}>{filteredClients.length} {filteredClients.length === 1 ? 'cliente' : 'clientes'}</Text>
          {filteredClients.length ? filteredClients.map((client) => {
            const orders = projects.filter((project) => project.client?.trim().toLocaleLowerCase('pt-BR') === client.name.trim().toLocaleLowerCase('pt-BR')).length
            return <Pressable key={client.id} onPress={() => openEditClient(client)} style={({ pressed }) => [styles.clientCard, pressed && styles.projectRowPressed]}>
              <View style={styles.clientAvatar}><Text style={styles.clientAvatarText}>{client.name.trim().charAt(0).toLocaleUpperCase('pt-BR') || '♡'}</Text></View>
              <View style={styles.rowBody}>
                <Text style={styles.clientName}>{client.name}</Text>
                <Text style={styles.rowMeta}>{orders} {orders === 1 ? 'encomenda' : 'encomendas'}{client.phone ? ` · ${client.phone}` : ''}</Text>
                {client.instagram ? <Text style={styles.clientContact}>@{client.instagram.replace(/^@/, '')}</Text> : client.email ? <Text style={styles.clientContact}>{client.email}</Text> : null}
                {client.notes ? <Text numberOfLines={2} style={styles.clientNotes}>{client.notes}</Text> : null}
              </View>
              <Text style={styles.editGlyph}>✎</Text>
            </Pressable>
          }) : <View style={styles.clientEmpty}><Text style={styles.dayEmptyIcon}>♡</Text><Text style={styles.sectionTitle}>{clientQuery ? 'Nenhuma cliente encontrada' : 'Nenhuma cliente cadastrada'}</Text><Text style={styles.emptyText}>{clientQuery ? 'Tente buscar por outro nome ou contato.' : 'Toque no botão + para cadastrar a primeira cliente.'}</Text></View>}
        </View>
      ) : activePage === 'materials' ? (
        <View>
          <View style={styles.materialSummaryRow}>
            <View style={styles.materialSummaryCard}><Text style={styles.materialSummaryValue}>{materials.length}</Text><Text style={styles.materialSummaryLabel}>Cadastrados</Text></View>
            <View style={[styles.materialSummaryCard, lowStockMaterials.length > 0 && styles.materialSummaryLow]}><Text style={[styles.materialSummaryValue, lowStockMaterials.length > 0 && styles.warningText]}>{lowStockMaterials.length}</Text><Text style={styles.materialSummaryLabel}>Estoque baixo</Text></View>
            <View style={styles.materialSummaryCard}><Text numberOfLines={1} adjustsFontSizeToFit style={styles.materialSummaryMoney}>{totalStockValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Text><Text style={styles.materialSummaryLabel}>Valor total</Text></View>
          </View>
          <View style={styles.clientsToolbar}>
            <TextInput autoCapitalize="none" onChangeText={setMaterialQuery} placeholder="Buscar material ou categoria" placeholderTextColor="#B69B91" style={styles.clientSearchInput} value={materialQuery} />
            <Pressable accessibilityLabel="Cadastrar material" onPress={openNewMaterial} style={styles.newClientButton}><Text style={styles.newClientButtonText}>＋</Text></Pressable>
          </View>
          {filteredMaterials.length ? filteredMaterials.map((material) => {
            const isLow = material.stock <= material.minimumStock
            return <Pressable key={material.id} onPress={() => openEditMaterial(material)} style={({ pressed }) => [styles.materialCard, isLow && styles.materialCardLow, pressed && styles.projectRowPressed]}>
              <View style={[styles.materialIcon, isLow && styles.materialIconLow]}><Text style={styles.materialIconText}>□</Text></View>
              <View style={styles.rowBody}>
                <Text style={styles.materialCategory}>{material.category || 'Sem categoria'}</Text>
                <Text style={styles.materialName}>{material.name}</Text>
                <View style={styles.materialNumbers}><Text style={[styles.materialStock, isLow && styles.warningText]}>{material.stock.toLocaleString('pt-BR')} {material.unit}</Text><Text style={styles.materialMeta}>mín. {material.minimumStock.toLocaleString('pt-BR')} · {material.unitCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/{material.unit}</Text></View>
              </View>
              {isLow ? <Text style={styles.lowStockBadge}>BAIXO</Text> : <Text style={styles.editGlyph}>✎</Text>}
            </Pressable>
          }) : <View style={styles.clientEmpty}><Text style={styles.dayEmptyIcon}>□</Text><Text style={styles.sectionTitle}>{materialQuery ? 'Nenhum material encontrado' : 'Nenhum material cadastrado'}</Text><Text style={styles.emptyText}>{materialQuery ? 'Tente buscar por outro nome ou categoria.' : 'Toque no botão + para cadastrar o primeiro material.'}</Text></View>}
        </View>
      ) : activePage === 'ideas' ? (
        <View>
          <View style={styles.ideasFilterRow}>
            <TextInput autoCapitalize="none" onChangeText={setIdeaQuery} placeholder="Pesquisar ideias..." placeholderTextColor="#B69B91" style={styles.clientSearchInput} value={ideaQuery} />
            <Pressable accessibilityLabel="Cadastrar ideia" onPress={openNewIdea} style={styles.newClientButton}><Text style={styles.newClientButtonText}>＋</Text></Pressable>
          </View>
          <Pressable onPress={() => setShowFavoriteIdeas((current) => !current)} style={[styles.favoriteFilter, showFavoriteIdeas && styles.favoriteFilterActive]}><Text style={[styles.favoriteFilterText, showFavoriteIdeas && styles.favoriteFilterTextActive]}>♥ {showFavoriteIdeas ? 'Mostrando favoritas' : 'Mostrar somente favoritas'}</Text></Pressable>
          <Text style={styles.clientCount}>{filteredIdeas.length} {filteredIdeas.length === 1 ? 'ideia' : 'ideias'}</Text>
          {filteredIdeas.length ? filteredIdeas.map((idea) => <View key={idea.id} style={[styles.ideaCard, idea.tone === 'brown' && styles.ideaCardBrown, idea.tone === 'blush' && styles.ideaCardBlush]}>
            <View style={styles.ideaHeading}>
              <View style={styles.rowBody}><Text style={styles.materialCategory}>{idea.category || 'Sem categoria'}</Text><Text style={styles.ideaTitle}>{idea.title}</Text></View>
              <Pressable accessibilityLabel={`${idea.favorite ? 'Desfavoritar' : 'Favoritar'} ${idea.title}`} disabled={updatingFavoriteId === idea.id} onPress={() => toggleIdeaFavorite(idea)} style={[styles.favoriteButton, idea.favorite && styles.favoriteButtonActive]}>{updatingFavoriteId === idea.id ? <ActivityIndicator color="#D77F8B" size="small" /> : <Text style={[styles.favoriteButtonText, idea.favorite && styles.favoriteButtonTextActive]}>♥</Text>}</Pressable>
            </View>
            <Text numberOfLines={3} style={styles.ideaDescription}>{idea.description || 'Sem descrição.'}</Text>
            {(idea.tags || []).length ? <View style={styles.ideaTags}>{(idea.tags || []).map((tag) => <Text key={tag} style={styles.ideaTag}>#{tag}</Text>)}</View> : null}
            <View style={styles.ideaFooter}>
              <Text style={[styles.ideaPriority, idea.priority === 'Alta' && styles.ideaPriorityHigh]}>{idea.converted ? 'PROJETO CRIADO' : `PRIORIDADE ${idea.priority.toLocaleUpperCase('pt-BR')}`}</Text>
              {idea.link ? <Pressable onPress={() => Linking.openURL(idea.link || '').catch(() => undefined)} style={styles.ideaLinkButton}><Text style={styles.ideaLinkText}>Abrir referência ↗</Text></Pressable> : null}
              {!idea.converted ? <Pressable accessibilityLabel={`Transformar ${idea.title} em projeto`} onPress={() => openNewProject(idea)} style={styles.convertIdeaButton}><Text style={styles.convertIdeaText}>Criar projeto</Text></Pressable> : null}
              <Pressable accessibilityLabel={`Editar ${idea.title}`} onPress={() => openEditIdea(idea)} style={styles.editTaskButton}><Text style={styles.editGlyph}>✎</Text></Pressable>
            </View>
          </View>) : <View style={styles.clientEmpty}><Text style={styles.dayEmptyIcon}>✦</Text><Text style={styles.sectionTitle}>Nenhuma ideia encontrada</Text><Text style={styles.emptyText}>Mude a busca ou toque em + para guardar uma inspiração.</Text></View>}
        </View>
      ) : (
        <View>
          <View style={styles.settingsCard}>
            <Text style={styles.settingsCardTitle}>Identidade do ateliê</Text>
            <Text style={styles.settingsCardText}>Essas informações aparecem no aplicativo e no dashboard.</Text>
            <Text style={styles.formLabel}>NOME DO ATELIÊ</Text><TextInput onChangeText={(studioName) => setSettingsForm((current) => ({ ...current, studioName }))} style={styles.formInput} value={settingsForm.studioName} />
            <Text style={styles.formLabel}>SUBTÍTULO</Text><TextInput onChangeText={(subtitle) => setSettingsForm((current) => ({ ...current, subtitle }))} style={styles.formInput} value={settingsForm.subtitle} />
            <Text style={styles.formLabel}>NOME DA ARTESÃ</Text><TextInput onChangeText={(ownerName) => setSettingsForm((current) => ({ ...current, ownerName }))} style={styles.formInput} value={settingsForm.ownerName} />
          </View>
          <View style={styles.settingsCard}>
            <Text style={styles.settingsCardTitle}>Contatos</Text>
            <Text style={styles.formLabel}>TELEFONE / WHATSAPP</Text><TextInput keyboardType="phone-pad" onChangeText={(phone) => setSettingsForm((current) => ({ ...current, phone }))} placeholder="(00) 00000-0000" placeholderTextColor="#B69B91" style={styles.formInput} value={settingsForm.phone} />
            <Text style={styles.formLabel}>INSTAGRAM</Text><TextInput autoCapitalize="none" onChangeText={(instagram) => setSettingsForm((current) => ({ ...current, instagram }))} placeholder="@seu_atelie" placeholderTextColor="#B69B91" style={styles.formInput} value={settingsForm.instagram} />
            <Text style={styles.formLabel}>E-MAIL</Text><TextInput autoCapitalize="none" keyboardType="email-address" onChangeText={(email) => setSettingsForm((current) => ({ ...current, email }))} style={styles.formInput} value={settingsForm.email} />
            <View style={styles.materialNumberRow}><View style={styles.dateInputGroup}><Text style={styles.formLabel}>CIDADE</Text><TextInput onChangeText={(city) => setSettingsForm((current) => ({ ...current, city }))} style={styles.formInput} value={settingsForm.city} /></View><View style={styles.settingsStateField}><Text style={styles.formLabel}>ESTADO</Text><TextInput autoCapitalize="characters" maxLength={2} onChangeText={(state) => setSettingsForm((current) => ({ ...current, state: state.toLocaleUpperCase('pt-BR') }))} placeholder="UF" placeholderTextColor="#B69B91" style={styles.formInput} value={settingsForm.state} /></View></View>
          </View>
          <View style={styles.settingsCard}>
            <Text style={styles.settingsCardTitle}>Valor do trabalho</Text><Text style={styles.settingsCardText}>Quanto cada hora trabalhada acrescenta ao valor da peça.</Text>
            <Text style={styles.formLabel}>VALOR DA HORA (R$)</Text><TextInput keyboardType="decimal-pad" onChangeText={(hourlyRate) => setSettingsForm((current) => ({ ...current, hourlyRate }))} placeholder="7,37" placeholderTextColor="#B69B91" style={styles.formInput} value={settingsForm.hourlyRate} />
          </View>
          <View style={styles.settingsCard}>
            <Text style={styles.settingsCardTitle}>Pausa automática</Text><Text style={styles.settingsCardText}>Tempo de inatividade antes de pausar o projeto.</Text>
            <View style={styles.pauseOptions}>{[{ value: 10, label: '10min' }, { value: 20, label: '20min' }, { value: 30, label: '30min' }, { value: 40, label: '40min' }, { value: 60, label: '1h' }, { value: 90, label: '1h30' }, { value: 120, label: '2h' }].map((option) => <Pressable key={option.value} onPress={() => setSettingsForm((current) => ({ ...current, timerPauseMinutes: option.value }))} style={[styles.pauseOption, settingsForm.timerPauseMinutes === option.value && styles.pauseOptionActive]}><Text style={[styles.pauseOptionText, settingsForm.timerPauseMinutes === option.value && styles.pauseOptionTextActive]}>{option.label}</Text></Pressable>)}</View>
          </View>
          {settingsError ? <Text style={styles.formError}>{settingsError}</Text> : null}
          <Pressable disabled={savingSettings} onPress={saveSettingsForm} style={({ pressed }) => [styles.settingsSaveButton, (pressed || savingSettings) && styles.buttonPressed]}>{savingSettings ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveTaskButtonText}>Salvar configurações</Text>}</Pressable>
        </View>
      )}

      <Pressable onPress={() => signOut(auth)} style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}>
        <Text style={styles.secondaryButtonText}>Sair da conta</Text>
      </Pressable>
      <Text style={styles.footer}>Sincronizado com o Reena Biscuit ☁</Text>
    </ScrollView>
      <View style={styles.bottomNavigation}>
        <Pressable onPress={() => openPage('home')} style={[styles.navItem, activePage === 'home' && styles.navItemActive]}><Text style={styles.navIcon}>⌂</Text><Text style={styles.navText}>Início</Text></Pressable>
        <Pressable onPress={() => openPage('projects')} style={[styles.navItem, activePage === 'projects' && styles.navItemActive]}><Text style={styles.navIcon}>▦</Text><Text style={styles.navText}>Projetos</Text></Pressable>
        <Pressable onPress={() => openPage('planning')} style={[styles.navItem, activePage === 'planning' && styles.navItemActive]}><Text style={styles.navIcon}>✓</Text><Text style={styles.navText}>Planejamento</Text></Pressable>
        <Pressable onPress={() => setMenuOpen(true)} style={[styles.navItem, (activePage === 'clients' || activePage === 'materials' || activePage === 'ideas' || activePage === 'settings') && styles.navItemActive]}><Text style={styles.navIcon}>☰</Text><Text style={styles.navText}>Menu</Text></Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8EEEE' },
  dashboard: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 24 },
  brandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  brandText: { flex: 1, marginLeft: 10 },
  logoMark: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E59AA3', borderRadius: 22, backgroundColor: '#FFF8F7' },
  logoLetter: { color: '#E59AA3', fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }), fontSize: 25, fontStyle: 'italic' },
  brandName: { color: '#704B3D', fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }), fontSize: 19 },
  brandSubtitle: { marginTop: 1, color: '#B3867A', fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 20, backgroundColor: '#FFF8F7' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#73A276' },
  liveText: { color: '#77836E', fontSize: 8, fontWeight: '900', letterSpacing: 0.7 },
  menuButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#ECD6D4', borderRadius: 14, backgroundColor: '#FFF8F7' },
  menuButtonIcon: { color: '#8B6252', fontSize: 21, fontWeight: '700' },
  menuBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(76, 49, 40, 0.34)' },
  menuSheet: { paddingHorizontal: 20, paddingTop: 21, paddingBottom: 34, borderTopLeftRadius: 27, borderTopRightRadius: 27, backgroundColor: '#FFFBFA' },
  menuHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 17 },
  menuTitle: { marginTop: 4, color: '#704B3D', fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }), fontSize: 25 },
  menuClose: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: '#F7DDDC' },
  menuCloseText: { color: '#8B6252', fontSize: 25, lineHeight: 27 },
  menuItem: { minHeight: 54, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, marginBottom: 7, borderRadius: 14 },
  menuItemActive: { backgroundColor: '#F8E3E2' },
  menuItemIcon: { width: 31, color: '#D77F8B', fontSize: 20, fontWeight: '800' },
  menuItemText: { color: '#704B3D', fontSize: 14, fontWeight: '800' },
  menuDivider: { height: 1, marginVertical: 12, backgroundColor: '#ECD6D4' },
  menuSync: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 4 },
  menuSyncText: { color: '#77836E', fontSize: 10, fontWeight: '700' },
  menuLogout: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 17, borderWidth: 1, borderColor: '#D9BCB7', borderRadius: 13 },
  menuLogoutText: { color: '#8B6252', fontSize: 12, fontWeight: '800' },
  projectPickerList: { maxHeight: 420 },
  projectPickerItem: { minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11, borderBottomWidth: 1, borderBottomColor: '#F2E4E2', borderRadius: 12 },
  projectSelected: { color: '#73A276', fontSize: 18, fontWeight: '900' },
  projectDetailsSheet: { maxHeight: '88%', paddingHorizontal: 20, paddingTop: 21, paddingBottom: 30, borderTopLeftRadius: 27, borderTopRightRadius: 27, backgroundColor: '#FFFBFA' },
  projectFormSheet: { maxHeight: '94%', paddingHorizontal: 20, paddingTop: 21, paddingBottom: 26, borderTopLeftRadius: 27, borderTopRightRadius: 27, backgroundColor: '#FFFBFA' },
  projectDetailsHeading: { flex: 1, paddingRight: 12 },
  projectDetailsMeta: { flexDirection: 'row', gap: 8, marginBottom: 15 },
  detailLabel: { color: '#D77F8B', fontSize: 7, fontWeight: '900', letterSpacing: 0.7 },
  detailValue: { marginTop: 4, color: '#704B3D', fontSize: 10, fontWeight: '800' },
  projectDescription: { padding: 14, marginBottom: 18, borderRadius: 13, backgroundColor: '#FFF5F4' },
  projectDescriptionText: { marginTop: 6, color: '#8B6F65', fontSize: 10, lineHeight: 16 },
  projectCostSummary: { flexDirection: 'row', gap: 7, marginBottom: 9 },
  projectCostItem: { flex: 1, minHeight: 66, justifyContent: 'space-between', padding: 10, borderWidth: 1, borderColor: '#ECD6D4', borderRadius: 12, backgroundColor: '#FFFBFA' },
  projectCostValue: { color: '#704B3D', fontSize: 11, fontWeight: '900' },
  projectTotalCard: { minHeight: 65, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, marginBottom: 15, borderRadius: 13, backgroundColor: '#9A6B56' },
  projectTotalLabel: { flex: 1, color: '#FDEDEC', fontSize: 8, fontWeight: '900', letterSpacing: 0.6 },
  projectTotalValue: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  projectDetailSection: { padding: 13, marginBottom: 14, borderWidth: 1, borderColor: '#ECD6D4', borderRadius: 14, backgroundColor: '#FFFBFA' },
  projectDetailSectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  projectSectionTitle: { marginTop: 3, color: '#704B3D', fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }), fontSize: 15 },
  projectSectionTotal: { color: '#9A6B56', fontSize: 11, fontWeight: '900' },
  projectEmptyText: { color: '#A48A80', fontSize: 9, lineHeight: 14 },
  timeEntryRow: { minHeight: 46, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F2E4E2' },
  timeEntryDate: { color: '#704B3D', fontSize: 9, fontWeight: '800' },
  timeEntryDuration: { color: '#D77F8B', fontSize: 9, fontWeight: '900' },
  materialUsageRow: { minHeight: 51, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F2E4E2' },
  materialUsageCost: { marginLeft: 6, color: '#9A6B56', fontSize: 8, fontWeight: '900' },
  materialUsageRemove: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', marginLeft: 6, borderRadius: 9, backgroundColor: '#FDE0DF' },
  materialUsageRemoveText: { color: '#B84D5C', fontSize: 18, lineHeight: 20, fontWeight: '700' },
  materialUsageForm: { marginTop: 12, paddingTop: 3 },
  materialUsagePicker: { marginBottom: 10 },
  materialUsageOption: { minWidth: 100, padding: 10, marginRight: 7, borderWidth: 1, borderColor: '#E8CFCC', borderRadius: 11, backgroundColor: '#FFF7F6' },
  materialUsageOptionActive: { borderColor: '#D77F8B', backgroundColor: '#F8E3E2' },
  materialUsageOptionName: { color: '#704B3D', fontSize: 9, fontWeight: '800' },
  materialUsageOptionNameActive: { color: '#B84D5C' },
  materialUsageOptionStock: { marginTop: 3, color: '#A48A80', fontSize: 7 },
  materialUsageControls: { flexDirection: 'row', gap: 7 },
  materialUsageInput: { flex: 1, minHeight: 43, paddingHorizontal: 11, borderWidth: 1, borderColor: '#E8CFCC', borderRadius: 11, backgroundColor: '#FFF7F6', color: '#704B3D', fontSize: 10 },
  materialUsageAdd: { minWidth: 105, minHeight: 43, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#9A6B56' },
  materialUsageAddText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  statusTitle: { marginBottom: 9, color: '#9A7D72', fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  statusGrid: { gap: 7 },
  statusOption: { minHeight: 45, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, borderWidth: 1, borderColor: '#EEE0DE', borderRadius: 12 },
  statusOptionActive: { borderColor: '#E6A2AA', backgroundColor: '#FBE8E7' },
  statusDot: { width: 8, height: 8, marginRight: 10, borderRadius: 4, backgroundColor: '#E59AA3' },
  statusDotStandBy: { backgroundColor: '#8B94A6' },
  statusDotDone: { backgroundColor: '#73A276' },
  statusOptionText: { flex: 1, color: '#7D6258', fontSize: 11, fontWeight: '700' },
  statusOptionTextActive: { color: '#704B3D', fontWeight: '900' },
  statusCheck: { color: '#D77F8B', fontSize: 15, fontWeight: '900' },
  statusLoading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12 },
  projectReferenceButton: { minHeight: 43, alignItems: 'center', justifyContent: 'center', marginTop: 14, borderWidth: 1, borderColor: '#E8CFCC', borderRadius: 11, backgroundColor: '#FFF7F6' },
  projectReferenceText: { color: '#D77F8B', fontSize: 10, fontWeight: '900' },
  dayDetailsSheet: { maxHeight: '82%', paddingHorizontal: 20, paddingTop: 21, paddingBottom: 30, borderTopLeftRadius: 27, borderTopRightRadius: 27, backgroundColor: '#FFFBFA' },
  dayDetailRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, marginBottom: 8, borderWidth: 1, borderColor: '#ECD6D4', borderRadius: 14, backgroundColor: '#FFF8F7' },
  dayDetailLate: { borderColor: '#EAA0A0', backgroundColor: '#FFF0EF' },
  dayDetailDone: { borderColor: '#B9D8BF', backgroundColor: '#EEF7F0' },
  dayDetailUnavailable: { borderColor: '#D9D5DD', backgroundColor: '#F2F0F4' },
  dayDetailIcon: { width: 31, color: '#D77F8B', fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }), fontSize: 18, fontWeight: '800' },
  dayEmpty: { minHeight: 170, alignItems: 'center', justifyContent: 'center' },
  dayEmptyIcon: { marginBottom: 6, color: '#DDB8B4', fontSize: 35 },
  addTaskDayButton: { minHeight: 47, alignItems: 'center', justifyContent: 'center', marginTop: 9, borderRadius: 12, backgroundColor: '#F7DDDC' },
  addTaskDayButtonText: { color: '#8B6252', fontSize: 11, fontWeight: '900' },
  blockDayButton: { minHeight: 47, alignItems: 'center', justifyContent: 'center', marginTop: 8, borderWidth: 1, borderColor: '#D9D5DD', borderRadius: 12, backgroundColor: '#F2F0F4' },
  blockDayButtonText: { color: '#706B77', fontSize: 11, fontWeight: '900' },
  removeUnavailableButton: { minWidth: 55, minHeight: 31, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7, borderRadius: 9, backgroundColor: '#E4E1E7' },
  removeUnavailableText: { color: '#706B77', fontSize: 7, fontWeight: '900' },
  taskFormSheet: { maxHeight: '92%', paddingHorizontal: 20, paddingTop: 21, paddingBottom: 26, borderTopLeftRadius: 27, borderTopRightRadius: 27, backgroundColor: '#FFFBFA' },
  unavailableFormSheet: { paddingHorizontal: 20, paddingTop: 21, paddingBottom: 30, borderTopLeftRadius: 27, borderTopRightRadius: 27, backgroundColor: '#FFFBFA' },
  clientFormSheet: { maxHeight: '92%', paddingHorizontal: 20, paddingTop: 21, paddingBottom: 26, borderTopLeftRadius: 27, borderTopRightRadius: 27, backgroundColor: '#FFFBFA' },
  materialFormSheet: { maxHeight: '92%', paddingHorizontal: 20, paddingTop: 21, paddingBottom: 26, borderTopLeftRadius: 27, borderTopRightRadius: 27, backgroundColor: '#FFFBFA' },
  ideaFormSheet: { maxHeight: '92%', paddingHorizontal: 20, paddingTop: 21, paddingBottom: 26, borderTopLeftRadius: 27, borderTopRightRadius: 27, backgroundColor: '#FFFBFA' },
  formLabel: { marginTop: 13, marginBottom: 7, color: '#9A7D72', fontSize: 8, fontWeight: '900', letterSpacing: 0.7 },
  formInput: { minHeight: 48, paddingHorizontal: 13, borderWidth: 1, borderColor: '#E8CFCC', borderRadius: 12, backgroundColor: '#FFF7F6', color: '#704B3D', fontSize: 12 },
  dateInputRow: { flexDirection: 'row', gap: 9 },
  dateInputGroup: { flex: 1 },
  dateInputCaption: { marginBottom: 5, color: '#A48A80', fontSize: 8, fontWeight: '700' },
  priorityOptions: { flexDirection: 'row', gap: 7 },
  priorityOption: { flex: 1, minHeight: 43, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E8CFCC', borderRadius: 11, backgroundColor: '#FFF7F6' },
  priorityOptionActive: { borderColor: '#D77F8B', backgroundColor: '#F8E3E2' },
  priorityOptionText: { color: '#9A7D72', fontSize: 10, fontWeight: '800' },
  priorityOptionTextActive: { color: '#704B3D' },
  formProjectOption: { minHeight: 45, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, marginBottom: 6, borderWidth: 1, borderColor: '#EEE0DE', borderRadius: 11 },
  formProjectOptionActive: { borderColor: '#E6A2AA', backgroundColor: '#FBE8E7' },
  formProjectText: { flex: 1, color: '#704B3D', fontSize: 10, fontWeight: '700' },
  formError: { marginTop: 10, color: '#B84D5C', fontSize: 10, fontWeight: '800' },
  formHint: { marginTop: 5, color: '#A48A80', fontSize: 8 },
  saveTaskButton: { minHeight: 49, alignItems: 'center', justifyContent: 'center', marginTop: 16, borderRadius: 12, backgroundColor: '#9A6B56' },
  saveTaskButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  reasonInput: { minHeight: 100, paddingTop: 13 },
  saveUnavailableButton: { minHeight: 49, alignItems: 'center', justifyContent: 'center', marginTop: 16, borderRadius: 12, backgroundColor: '#85808C' },
  planningHeadingActions: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  blockDayHeadingButton: { width: 31, height: 31, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#85808C' },
  blockDayHeadingText: { color: '#FFFFFF', fontSize: 20, lineHeight: 21, fontWeight: '600' },
  addTaskButton: { width: 31, height: 31, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#D77F8B' },
  addTaskButtonText: { color: '#FFFFFF', fontSize: 19, lineHeight: 21, fontWeight: '500' },
  editTaskButton: { width: 31, height: 31, alignItems: 'center', justifyContent: 'center', marginHorizontal: 5, borderRadius: 10, backgroundColor: '#FFF0EF' },
  editGlyph: { color: '#D77F8B', fontSize: 15, fontWeight: '900' },
  clientsToolbar: { flexDirection: 'row', gap: 9, marginTop: 12 },
  clientSearchInput: { flex: 1, minHeight: 49, paddingHorizontal: 14, borderWidth: 1, borderColor: '#E8CFCC', borderRadius: 13, backgroundColor: '#FFFBFA', color: '#704B3D', fontSize: 11 },
  newClientButton: { width: 49, height: 49, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#D77F8B' },
  newClientButtonText: { color: '#FFFFFF', fontSize: 25, lineHeight: 27, fontWeight: '500' },
  clientCount: { marginTop: 10, marginBottom: 2, color: '#A48A80', fontSize: 8, fontWeight: '800', textAlign: 'right' },
  clientCard: { minHeight: 94, flexDirection: 'row', alignItems: 'center', padding: 15, marginTop: 10, borderWidth: 1, borderColor: '#ECD6D4', borderRadius: 17, backgroundColor: '#FFFBFA' },
  clientAvatar: { width: 45, height: 45, alignItems: 'center', justifyContent: 'center', marginRight: 12, borderRadius: 23, backgroundColor: '#F7DDDC' },
  clientAvatarText: { color: '#D77F8B', fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }), fontSize: 21, fontWeight: '700' },
  clientName: { color: '#704B3D', fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }), fontSize: 16 },
  clientContact: { marginTop: 4, color: '#D77F8B', fontSize: 9, fontWeight: '800' },
  clientNotes: { marginTop: 5, color: '#9A7D72', fontSize: 9, lineHeight: 13 },
  clientEmpty: { minHeight: 240, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  unitOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  unitOption: { width: '30%', minHeight: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E8CFCC', borderRadius: 11, backgroundColor: '#FFF7F6' },
  unitOptionActive: { borderColor: '#D77F8B', backgroundColor: '#F8E3E2' },
  unitOptionText: { color: '#9A7D72', fontSize: 10, fontWeight: '900' },
  unitOptionTextActive: { color: '#704B3D' },
  materialNumberRow: { flexDirection: 'row', gap: 9 },
  materialSummaryRow: { flexDirection: 'row', gap: 7, marginTop: 12 },
  materialSummaryCard: { flex: 1, minHeight: 83, justifyContent: 'space-between', padding: 11, borderWidth: 1, borderColor: '#ECD6D4', borderRadius: 15, backgroundColor: '#FFFBFA' },
  materialSummaryLow: { borderColor: '#EAA0A0', backgroundColor: '#FFF2F1' },
  materialSummaryValue: { color: '#D77F8B', fontSize: 21, fontWeight: '900' },
  materialSummaryMoney: { color: '#9A6B56', fontSize: 13, fontWeight: '900' },
  materialSummaryLabel: { color: '#8B6252', fontSize: 7, fontWeight: '800' },
  materialCard: { minHeight: 91, flexDirection: 'row', alignItems: 'center', padding: 14, marginTop: 10, borderWidth: 1, borderColor: '#ECD6D4', borderRadius: 17, backgroundColor: '#FFFBFA' },
  materialCardLow: { borderColor: '#EAA0A0', backgroundColor: '#FFF8F7' },
  materialIcon: { width: 43, height: 43, alignItems: 'center', justifyContent: 'center', marginRight: 12, borderRadius: 13, backgroundColor: '#F7DDDC' },
  materialIconLow: { backgroundColor: '#FDE0DF' },
  materialIconText: { color: '#D77F8B', fontSize: 21, fontWeight: '900' },
  materialCategory: { color: '#D77F8B', fontSize: 7, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase' },
  materialName: { marginTop: 3, color: '#704B3D', fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }), fontSize: 15 },
  materialNumbers: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 6 },
  materialStock: { color: '#55795E', fontSize: 10, fontWeight: '900' },
  materialMeta: { color: '#A48A80', fontSize: 8 },
  lowStockBadge: { paddingHorizontal: 7, paddingVertical: 5, overflow: 'hidden', borderRadius: 8, backgroundColor: '#FDE0DF', color: '#B84D5C', fontSize: 7, fontWeight: '900' },
  ideasFilterRow: { flexDirection: 'row', gap: 9, marginTop: 12 },
  favoriteFilter: { alignSelf: 'flex-start', marginTop: 9, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#E8CFCC', borderRadius: 18, backgroundColor: '#FFFBFA' },
  favoriteFilterActive: { borderColor: '#D77F8B', backgroundColor: '#F8E3E2' },
  favoriteFilterText: { color: '#9A7D72', fontSize: 8, fontWeight: '800' },
  favoriteFilterTextActive: { color: '#B84D5C' },
  ideaCard: { padding: 17, marginTop: 11, borderWidth: 1, borderColor: '#ECCFD0', borderRadius: 18, backgroundColor: '#FFF8F7' },
  ideaCardBrown: { borderColor: '#DCCBC3', backgroundColor: '#FBF5F1' },
  ideaCardBlush: { borderColor: '#EAD9D6', backgroundColor: '#FFFBFA' },
  ideaHeading: { flexDirection: 'row', alignItems: 'flex-start' },
  ideaTitle: { marginTop: 4, color: '#704B3D', fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }), fontSize: 17 },
  favoriteButton: { width: 35, height: 35, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: '#FFFFFF' },
  favoriteButtonActive: { backgroundColor: '#F7DDDC' },
  favoriteButtonText: { color: '#D7B7B4', fontSize: 17 },
  favoriteButtonTextActive: { color: '#D86471' },
  ideaDescription: { marginTop: 9, color: '#8B6F65', fontSize: 10, lineHeight: 16 },
  ideaTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 10 },
  ideaTag: { paddingHorizontal: 7, paddingVertical: 4, overflow: 'hidden', borderRadius: 9, backgroundColor: '#F7DDDC', color: '#9A6B56', fontSize: 7, fontWeight: '800' },
  ideaFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 13, paddingTop: 11, borderTopWidth: 1, borderTopColor: '#ECD6D4' },
  ideaPriority: { flex: 1, color: '#8A8D70', fontSize: 7, fontWeight: '900' },
  ideaPriorityHigh: { color: '#B84D5C' },
  ideaLinkButton: { paddingHorizontal: 8, paddingVertical: 7 },
  ideaLinkText: { color: '#D77F8B', fontSize: 8, fontWeight: '900' },
  convertIdeaButton: { paddingHorizontal: 9, paddingVertical: 7, borderRadius: 9, backgroundColor: '#E9D6CC' },
  convertIdeaText: { color: '#704B3D', fontSize: 7, fontWeight: '900' },
  settingsCard: { padding: 17, marginTop: 12, borderWidth: 1, borderColor: '#ECD6D4', borderRadius: 18, backgroundColor: '#FFFBFA' },
  settingsCardTitle: { color: '#704B3D', fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }), fontSize: 18 },
  settingsCardText: { marginTop: 5, marginBottom: 3, color: '#9A7D72', fontSize: 9, lineHeight: 14 },
  settingsStateField: { width: 80 },
  pauseOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 13 },
  pauseOption: { minWidth: '22%', minHeight: 40, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 9, borderWidth: 1, borderColor: '#E8CFCC', borderRadius: 11, backgroundColor: '#FFF7F6' },
  pauseOptionActive: { borderColor: '#D77F8B', backgroundColor: '#F8E3E2' },
  pauseOptionText: { color: '#9A7D72', fontSize: 9, fontWeight: '900' },
  pauseOptionTextActive: { color: '#704B3D' },
  settingsSaveButton: { minHeight: 51, alignItems: 'center', justifyContent: 'center', marginTop: 14, borderRadius: 13, backgroundColor: '#9A6B56' },
  monthNavigator: { minHeight: 64, flexDirection: 'row', alignItems: 'center', marginBottom: 20, paddingHorizontal: 5, borderRadius: 15, backgroundColor: '#FFF5F4' },
  monthButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#F7DDDC' },
  monthButtonText: { color: '#9A6B56', fontSize: 30, lineHeight: 32, fontWeight: '500' },
  monthLabelButton: { flex: 1, alignItems: 'center', paddingHorizontal: 5 },
  monthLabel: { color: '#704B3D', fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }), fontSize: 15 },
  monthTodayHint: { marginTop: 3, color: '#B3867A', fontSize: 6, fontWeight: '900', letterSpacing: 0.45 },
  calendarWeekdays: { flexDirection: 'row', marginBottom: 5 },
  calendarWeekday: { width: '14.2857%', color: '#A48A80', fontSize: 6, fontWeight: '900', textAlign: 'center' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarDay: { width: '14.2857%', aspectRatio: 0.9, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#F1E5E3', backgroundColor: '#FFFBFA' },
  calendarDayOutside: { opacity: 0.35 },
  calendarDayToday: { borderWidth: 2, borderColor: '#D77F8B', backgroundColor: '#FFF2F1' },
  calendarDayLate: { backgroundColor: '#FDE5E3' },
  calendarDayDone: { backgroundColor: '#E6F2E8' },
  calendarDayNumber: { color: '#704B3D', fontSize: 10, fontWeight: '800' },
  calendarDayNumberOutside: { color: '#B69B91' },
  calendarDots: { flexDirection: 'row', gap: 2, marginTop: 4 },
  calendarDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#E59AA3' },
  calendarDotLate: { backgroundColor: '#C34E5D' },
  calendarDotDone: { backgroundColor: '#73A276' },
  calendarDotProject: { backgroundColor: '#9A6B56' },
  calendarDotUnavailable: { backgroundColor: '#85808C' },
  calendarLegend: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 10 },
  calendarLegendText: { color: '#D77F8B', fontSize: 7, fontWeight: '800' },
  calendarLegendProject: { color: '#9A6B56' },
  calendarLegendUnavailable: { color: '#85808C' },
  planningListDivider: { height: 1, marginVertical: 20, backgroundColor: '#ECD6D4' },
  welcomeCard: { padding: 21, borderRadius: 22, backgroundColor: '#E9A0A8' },
  eyebrow: { color: '#FFF5F4', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  welcomeTitle: { marginTop: 7, color: '#FFFFFF', fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }), fontSize: 26 },
  welcomeText: { marginTop: 7, color: '#FFF7F6', fontSize: 12, lineHeight: 18 },
  pageHeading: { paddingHorizontal: 4, paddingVertical: 10 },
  pageTitle: { marginTop: 5, color: '#704B3D', fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }), fontSize: 28 },
  pageSubtitle: { marginTop: 5, color: '#9A7D72', fontSize: 11, lineHeight: 17 },
  actionMessage: { marginTop: 10, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, backgroundColor: '#DFEFE3' },
  actionMessageText: { color: '#55795E', fontSize: 10, fontWeight: '800', textAlign: 'center' },
  loadingCard: { minHeight: 150, alignItems: 'center', justifyContent: 'center', gap: 11, marginTop: 14, borderRadius: 18, backgroundColor: '#FFFBFA' },
  loadingText: { color: '#9A7D72', fontSize: 12 },
  summaryRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  summaryCard: { flex: 1, minHeight: 100, justifyContent: 'space-between', padding: 13, borderWidth: 1, borderColor: '#ECD6D4', borderRadius: 16, backgroundColor: '#FFFBFA' },
  summaryCardWarning: { borderColor: '#EAA0A0', backgroundColor: '#FFF2F1' },
  summaryValue: { color: '#E28E9A', fontSize: 25, fontWeight: '800' },
  summaryLabel: { color: '#704B3D', fontSize: 10, fontWeight: '700', lineHeight: 14 },
  sectionCard: { marginTop: 12, padding: 18, borderWidth: 1, borderColor: '#ECD6D4', borderRadius: 18, backgroundColor: '#FFFBFA' },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionKicker: { color: '#D77F8B', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  sectionTitle: { marginTop: 5, color: '#704B3D', fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }), fontSize: 20 },
  sectionText: { marginTop: 8, color: '#9A7D72', fontSize: 11, lineHeight: 17 },
  timerControls: { marginTop: 15, gap: 9 },
  projectSelectButton: { minHeight: 47, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 13, borderWidth: 1, borderColor: '#E8CFCC', borderRadius: 12, backgroundColor: '#FFF7F6' },
  projectSelectPlaceholder: { color: '#B69B91', fontSize: 11 },
  projectSelectValue: { flex: 1, color: '#704B3D', fontSize: 11, fontWeight: '800' },
  projectSelectArrow: { color: '#D77F8B', fontSize: 18, fontWeight: '800' },
  timerStartButton: { minHeight: 47, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#9A6B56' },
  timerStartDisabled: { opacity: 0.45 },
  timerStartText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  timerPauseButton: { minHeight: 47, alignItems: 'center', justifyContent: 'center', marginTop: 15, borderRadius: 12, backgroundColor: '#D77F8B' },
  timerPauseText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  deliveryRow: { flexDirection: 'row', alignItems: 'center', marginTop: 15 },
  dateBox: { width: 55, height: 50, alignItems: 'center', justifyContent: 'center', marginRight: 12, borderRadius: 13, backgroundColor: '#F7DDDC' },
  dateBoxText: { color: '#8B6252', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  rowBody: { flex: 1 },
  rowTitle: { color: '#704B3D', fontSize: 12, fontWeight: '800' },
  rowMeta: { marginTop: 3, color: '#A48A80', fontSize: 9 },
  taskRow: { flexDirection: 'row', alignItems: 'center', minHeight: 53, borderBottomWidth: 1, borderBottomColor: '#F2E4E2' },
  projectRow: { flexDirection: 'row', alignItems: 'center', minHeight: 58, borderBottomWidth: 1, borderBottomColor: '#F2E4E2' },
  projectRowLarge: { flexDirection: 'row', alignItems: 'center', minHeight: 69, borderBottomWidth: 1, borderBottomColor: '#F2E4E2' },
  projectRowPressed: { opacity: 0.55 },
  taskRowLarge: { flexDirection: 'row', alignItems: 'center', minHeight: 65, borderBottomWidth: 1, borderBottomColor: '#F2E4E2' },
  taskCheck: { width: 29, height: 29, alignItems: 'center', justifyContent: 'center', marginRight: 11, borderWidth: 1, borderColor: '#DDA4AA', borderRadius: 9, backgroundColor: '#FFF8F7' },
  taskCheckText: { color: '#D77F8B', fontSize: 14, fontWeight: '900' },
  taskCheckCompleted: { borderColor: '#73A276', backgroundColor: '#73A276' },
  taskCheckCompletedText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  priorityDot: { width: 8, height: 8, marginRight: 11, borderRadius: 4, backgroundColor: '#E6B75D' },
  priorityHigh: { backgroundColor: '#D86471' },
  priorityLow: { backgroundColor: '#7DAA91' },
  projectIcon: { width: 35, height: 35, alignItems: 'center', justifyContent: 'center', marginRight: 11, borderRadius: 18, backgroundColor: '#F7DDDC' },
  projectIconText: { color: '#D77F8B', fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }), fontSize: 17, fontStyle: 'italic' },
  projectIconStandBy: { backgroundColor: '#E8E9EC' },
  statusBadge: { maxWidth: 92, paddingHorizontal: 8, paddingVertical: 5, overflow: 'hidden', borderRadius: 9, backgroundColor: '#F7DDDC', color: '#8B6252', fontSize: 7, fontWeight: '900', textAlign: 'center' },
  statusBadgeStandBy: { backgroundColor: '#E8E9EC', color: '#697080' },
  statusBadgeDone: { backgroundColor: '#DFEFE3', color: '#55795E' },
  priorityText: { color: '#A48A80', fontSize: 8, fontWeight: '800' },
  completedSection: { marginTop: 22, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#ECD6D4' },
  completedTitle: { marginBottom: 4, color: '#9A7D72', fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  completedRow: { flexDirection: 'row', alignItems: 'center', minHeight: 58 },
  completedTaskText: { color: '#9A7D72', fontSize: 11, fontWeight: '700', textDecorationLine: 'line-through' },
  lateBadge: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: '#FDE0DF', color: '#B84D5C', fontSize: 8, fontWeight: '900' },
  lateText: { color: '#B84D5C', fontSize: 7, fontWeight: '900' },
  warningText: { color: '#B84D5C' },
  countBadge: { minWidth: 25, paddingHorizontal: 7, paddingVertical: 5, overflow: 'hidden', borderRadius: 13, backgroundColor: '#F7DDDC', color: '#8B6252', fontSize: 9, fontWeight: '900', textAlign: 'center' },
  emptyText: { marginTop: 14, color: '#A48A80', fontSize: 11 },
  bottomNavigation: { flexDirection: 'row', marginHorizontal: 12, marginTop: 6, marginBottom: 8, padding: 6, borderWidth: 1, borderColor: '#ECD6D4', borderRadius: 18, backgroundColor: '#FFFBFA', shadowColor: '#704B3D', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.08, shadowRadius: 9, elevation: 8 },
  navItem: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 13 },
  navItemActive: { backgroundColor: '#F8E3E2' },
  navIcon: { color: '#D77F8B', fontSize: 17, fontWeight: '800' },
  navText: { marginTop: 3, color: '#8B6252', fontSize: 7, fontWeight: '800' },
  secondaryButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 18, borderWidth: 1, borderColor: '#D9BCB7', borderRadius: 12 },
  buttonPressed: { opacity: 0.7 },
  secondaryButtonText: { color: '#8B6252', fontSize: 13, fontWeight: '700' },
  footer: { marginTop: 18, color: '#A68B81', fontSize: 10, textAlign: 'center' },
})
