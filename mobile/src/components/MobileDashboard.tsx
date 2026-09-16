import { useEffect, useMemo, useState } from 'react'
import type { User } from 'firebase/auth'
import { signOut } from 'firebase/auth'
import { collection, doc, onSnapshot } from 'firebase/firestore'
import {
  ActivityIndicator,
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
  deadline?: string
  status: string
  client?: string
  type?: string
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

const inactiveStatuses = new Set(['Stand by', 'Pronto', 'Entregue'])

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
  const [now, setNow] = useState(Date.now())

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

  return (
    <ScrollView contentContainerStyle={styles.dashboard} showsVerticalScrollIndicator={false}>
      <View style={styles.brandRow}>
        <View style={styles.logoMark}><Text style={styles.logoLetter}>R</Text></View>
        <View style={styles.brandText}>
          <Text style={styles.brandName}>Reena Biscuit</Text>
          <Text style={styles.brandSubtitle}>ATELIÊ DE BISCUIT</Text>
        </View>
        <View style={styles.liveBadge}><View style={styles.liveDot} /><Text style={styles.liveText}>ONLINE</Text></View>
      </View>

      <View style={styles.welcomeCard}>
        <Text style={styles.eyebrow}>{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).toLocaleUpperCase('pt-BR')}</Text>
        <Text style={styles.welcomeTitle}>Olá, {ownerFirstName} 🐾</Text>
        <Text style={styles.welcomeText}>Seu ateliê, seus prazos e sua bancada também no celular.</Text>
      </View>

      {loading ? (
        <View style={styles.loadingCard}><ActivityIndicator color="#9A6B56" /><Text style={styles.loadingText}>Sincronizando seu ateliê...</Text></View>
      ) : (
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
              : 'Quando você iniciar um projeto no dashboard, ele aparecerá aqui.'}</Text>
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
                  <View style={[styles.priorityDot, task.priority === 'Alta' && styles.priorityHigh, task.priority === 'Baixa' && styles.priorityLow]} />
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
      )}

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
  welcomeCard: { padding: 21, borderRadius: 22, backgroundColor: '#E9A0A8' },
  eyebrow: { color: '#FFF5F4', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  welcomeTitle: { marginTop: 7, color: '#FFFFFF', fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }), fontSize: 26 },
  welcomeText: { marginTop: 7, color: '#FFF7F6', fontSize: 12, lineHeight: 18 },
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
  deliveryRow: { flexDirection: 'row', alignItems: 'center', marginTop: 15 },
  dateBox: { width: 55, height: 50, alignItems: 'center', justifyContent: 'center', marginRight: 12, borderRadius: 13, backgroundColor: '#F7DDDC' },
  dateBoxText: { color: '#8B6252', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  rowBody: { flex: 1 },
  rowTitle: { color: '#704B3D', fontSize: 12, fontWeight: '800' },
  rowMeta: { marginTop: 3, color: '#A48A80', fontSize: 9 },
  taskRow: { flexDirection: 'row', alignItems: 'center', minHeight: 53, borderBottomWidth: 1, borderBottomColor: '#F2E4E2' },
  projectRow: { flexDirection: 'row', alignItems: 'center', minHeight: 58, borderBottomWidth: 1, borderBottomColor: '#F2E4E2' },
  priorityDot: { width: 8, height: 8, marginRight: 11, borderRadius: 4, backgroundColor: '#E6B75D' },
  priorityHigh: { backgroundColor: '#D86471' },
  priorityLow: { backgroundColor: '#7DAA91' },
  projectIcon: { width: 35, height: 35, alignItems: 'center', justifyContent: 'center', marginRight: 11, borderRadius: 18, backgroundColor: '#F7DDDC' },
  projectIconText: { color: '#D77F8B', fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }), fontSize: 17, fontStyle: 'italic' },
  lateBadge: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: '#FDE0DF', color: '#B84D5C', fontSize: 8, fontWeight: '900' },
  lateText: { color: '#B84D5C', fontSize: 7, fontWeight: '900' },
  warningText: { color: '#B84D5C' },
  countBadge: { minWidth: 25, paddingHorizontal: 7, paddingVertical: 5, overflow: 'hidden', borderRadius: 13, backgroundColor: '#F7DDDC', color: '#8B6252', fontSize: 9, fontWeight: '900', textAlign: 'center' },
  emptyText: { marginTop: 14, color: '#A48A80', fontSize: 11 },
  secondaryButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 18, borderWidth: 1, borderColor: '#D9BCB7', borderRadius: 12 },
  buttonPressed: { opacity: 0.7 },
  secondaryButtonText: { color: '#8B6252', fontSize: 13, fontWeight: '700' },
  footer: { marginTop: 18, color: '#A68B81', fontSize: 10, textAlign: 'center' },
})
