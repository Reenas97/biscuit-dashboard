import { useEffect, useMemo, useState } from 'react'
import type { User } from 'firebase/auth'
import { signOut } from 'firebase/auth'
import { arrayUnion, collection, doc, onSnapshot, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore'
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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
}

type AtelierSettings = {
  ownerName?: string
}

type MobilePage = 'home' | 'projects' | 'planning'

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

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  return hours > 0 ? `${hours}h ${String(minutes).padStart(2, '0')}min` : `${minutes}min`
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
  const [settings, setSettings] = useState<AtelierSettings>({})
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

  useEffect(() => onSnapshot(doc(db, 'users', user.uid, 'settings', 'atelier'), (snapshot) => {
    if (snapshot.exists()) setSettings(snapshot.data() as AtelierSettings)
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
  const loading = !projectsReady || !tasksReady || !timeReady
  const timerProjects = summary.activeProjects
  const selectedProject = timerProjects.find((project) => project.id === selectedProjectId)
  const selectedProjectDetails = projects.find((project) => project.id === selectedProjectDetailsId) ?? null

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
              <Text style={styles.statusTitle}>ETAPA DO PROJETO</Text>
              <View style={styles.statusGrid}>{projectStatuses.map((status) => <Pressable disabled={updatingProject} key={status} onPress={() => changeProjectStatus(status)} style={[styles.statusOption, selectedProjectDetails?.status === status && styles.statusOptionActive]}>
                <View style={[styles.statusDot, status === 'Stand by' && styles.statusDotStandBy, (status === 'Pronto' || status === 'Entregue') && styles.statusDotDone]} />
                <Text style={[styles.statusOptionText, selectedProjectDetails?.status === status && styles.statusOptionTextActive]}>{status}</Text>
                {selectedProjectDetails?.status === status ? <Text style={styles.statusCheck}>✓</Text> : null}
              </Pressable>)}</View>
              {updatingProject ? <View style={styles.statusLoading}><ActivityIndicator color="#D77F8B" /><Text style={styles.loadingText}>Atualizando projeto...</Text></View> : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {activePage === 'home' ? <View style={styles.welcomeCard}>
        <Text style={styles.eyebrow}>{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).toLocaleUpperCase('pt-BR')}</Text>
        <Text style={styles.welcomeTitle}>Olá, {ownerFirstName} 🐾</Text>
        <Text style={styles.welcomeText}>Seu ateliê, seus prazos e sua bancada também no celular.</Text>
      </View> : <View style={styles.pageHeading}>
        <Text style={styles.sectionKicker}>{activePage === 'projects' ? '🐾 PRODUÇÃO' : '✓ ROTINA DO ATELIÊ'}</Text>
        <Text style={styles.pageTitle}>{activePage === 'projects' ? 'Projetos' : 'Planejamento'}</Text>
        <Text style={styles.pageSubtitle}>{activePage === 'projects' ? 'Acompanhe todas as etapas das suas peças.' : 'Veja tarefas, prazos e o que precisa da sua atenção.'}</Text>
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
            <Text style={styles.countBadge}>{summary.activeProjects.length} ativos</Text>
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
      ) : (
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeading}>
            <View><Text style={styles.sectionKicker}>TAREFAS PENDENTES</Text><Text style={styles.sectionTitle}>Lista do ateliê</Text></View>
            <Text style={styles.countBadge}>{summary.pendingTasks.length}</Text>
          </View>
          {summary.pendingTasks.length ? summary.pendingTasks.map((task) => {
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
              {isLate ? <Text style={styles.lateText}>ATRASADA</Text> : <Text style={styles.priorityText}>{task.priority}</Text>}
            </View>
          }) : <Text style={styles.emptyText}>Tudo em dia por aqui ✨</Text>}

          {tasks.some((task) => task.completed) ? <View style={styles.completedSection}>
            <Text style={styles.completedTitle}>CONCLUÍDAS RECENTEMENTE</Text>
            {tasks.filter((task) => task.completed).slice(0, 5).map((task) => (
              <View key={task.id} style={styles.completedRow}>
                <Pressable accessibilityLabel={`Reabrir ${task.title}`} disabled={updatingTaskId === task.id} onPress={() => toggleTask(task)} style={[styles.taskCheck, styles.taskCheckCompleted]}>
                  {updatingTaskId === task.id ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.taskCheckCompletedText}>✓</Text>}
                </Pressable>
                <View style={styles.rowBody}><Text style={styles.completedTaskText}>{task.title}</Text><Text style={styles.rowMeta}>Toque no check para reabrir</Text></View>
              </View>
            ))}
          </View> : null}
        </View>
      )}

      <View style={styles.bottomNavigation}>
        <Pressable onPress={() => openPage('home')} style={[styles.navItem, activePage === 'home' && styles.navItemActive]}><Text style={styles.navIcon}>⌂</Text><Text style={styles.navText}>Início</Text></Pressable>
        <Pressable onPress={() => openPage('projects')} style={[styles.navItem, activePage === 'projects' && styles.navItemActive]}><Text style={styles.navIcon}>▦</Text><Text style={styles.navText}>Projetos</Text></Pressable>
        <Pressable onPress={() => openPage('planning')} style={[styles.navItem, activePage === 'planning' && styles.navItemActive]}><Text style={styles.navIcon}>✓</Text><Text style={styles.navText}>Planejamento</Text></Pressable>
        <Pressable onPress={() => setMenuOpen(true)} style={styles.navItem}><Text style={styles.navIcon}>☰</Text><Text style={styles.navText}>Menu</Text></Pressable>
      </View>

      <Pressable onPress={() => signOut(auth)} style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}>
        <Text style={styles.secondaryButtonText}>Sair da conta</Text>
      </Pressable>
      <Text style={styles.footer}>Sincronizado com o Reena Biscuit ☁</Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  dashboard: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 38 },
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
  projectDetailsHeading: { flex: 1, paddingRight: 12 },
  projectDetailsMeta: { flexDirection: 'row', gap: 8, marginBottom: 15 },
  detailLabel: { color: '#D77F8B', fontSize: 7, fontWeight: '900', letterSpacing: 0.7 },
  detailValue: { marginTop: 4, color: '#704B3D', fontSize: 10, fontWeight: '800' },
  projectDescription: { padding: 14, marginBottom: 18, borderRadius: 13, backgroundColor: '#FFF5F4' },
  projectDescriptionText: { marginTop: 6, color: '#8B6F65', fontSize: 10, lineHeight: 16 },
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
  bottomNavigation: { flexDirection: 'row', marginTop: 16, padding: 6, borderWidth: 1, borderColor: '#ECD6D4', borderRadius: 18, backgroundColor: '#FFFBFA' },
  navItem: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 13 },
  navItemActive: { backgroundColor: '#F8E3E2' },
  navIcon: { color: '#D77F8B', fontSize: 17, fontWeight: '800' },
  navText: { marginTop: 3, color: '#8B6252', fontSize: 7, fontWeight: '800' },
  secondaryButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 18, borderWidth: 1, borderColor: '#D9BCB7', borderRadius: 12 },
  buttonPressed: { opacity: 0.7 },
  secondaryButtonText: { color: '#8B6252', fontSize: 13, fontWeight: '700' },
  footer: { marginTop: 18, color: '#A68B81', fontSize: 10, textAlign: 'center' },
})
