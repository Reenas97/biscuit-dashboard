import * as Notifications from 'expo-notifications'
import * as TaskManager from 'expo-task-manager'
import { Platform } from 'react-native'
import { arrayUnion, collection, doc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { auth, db } from './firebase'

const TIMER_NOTIFICATION_ID = 'reena-biscuit-active-timer'
const TIMER_CHANNEL_ID = 'reena-biscuit-timer-lockscreen-v2'
const TIMER_ACTIVE_CATEGORY = 'reenaTimerActive'
const TIMER_PAUSED_CATEGORY = 'reenaTimerPaused'
const TIMER_NOTIFICATION_TASK = 'reena-biscuit-timer-notification-task'
const PAUSE_ACTION = 'pauseTimer'
const RESUME_ACTION = 'resumeTimer'
const inactiveStatuses = new Set(['Stand by', 'Pronto', 'Entregue'])

type TimerNotificationData = {
  kind: 'reena-biscuit-timer'
  timerState: 'active' | 'paused'
  uid: string
  entryId: string
  projectId: string
  projectTitle: string
}

type ShowTimerNotificationInput = Omit<TimerNotificationData, 'kind' | 'timerState'>

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    priority: Notifications.AndroidNotificationPriority.DEFAULT,
  }),
})

function isTimerNotificationData(value: unknown): value is TimerNotificationData {
  if (!value || typeof value !== 'object') return false
  const data = value as Partial<TimerNotificationData>
  return data.kind === 'reena-biscuit-timer'
    && (data.timerState === 'active' || data.timerState === 'paused')
    && typeof data.uid === 'string'
    && typeof data.entryId === 'string'
    && typeof data.projectId === 'string'
    && typeof data.projectTitle === 'string'
}

async function showTimerNotification(input: ShowTimerNotificationInput, timerState: 'active' | 'paused') {
  if (Platform.OS !== 'android') return

  await Notifications.scheduleNotificationAsync({
    identifier: TIMER_NOTIFICATION_ID,
    content: {
      title: timerState === 'active' ? `⏱ ${input.projectTitle}` : `⏸ ${input.projectTitle}`,
      body: timerState === 'active'
        ? 'Cronômetro em andamento · toque em Pausar quando terminar.'
        : 'Cronômetro pausado · toque em Retomar para continuar.',
      data: {
        kind: 'reena-biscuit-timer',
        timerState,
        ...input,
      } satisfies TimerNotificationData,
      categoryIdentifier: timerState === 'active' ? TIMER_ACTIVE_CATEGORY : TIMER_PAUSED_CATEGORY,
      sticky: true,
      autoDismiss: false,
      sound: false,
      color: '#D77F8B',
      priority: Notifications.AndroidNotificationPriority.DEFAULT,
    },
    trigger: { channelId: TIMER_CHANNEL_ID },
  })
}

async function waitForMatchingUser(uid: string) {
  await auth.authStateReady()
  return auth.currentUser?.uid === uid
}

async function pauseTimerFromNotification(data: TimerNotificationData) {
  if (!await waitForMatchingUser(data.uid)) return
  const nowIso = new Date().toISOString()
  const paused = await runTransaction(db, async (transaction) => {
    const entryReference = doc(db, 'users', data.uid, 'timeEntries', data.entryId)
    const entrySnapshot = await transaction.get(entryReference)
    if (!entrySnapshot.exists() || entrySnapshot.data().endedAt) return false

    transaction.update(entryReference, {
      endedAt: nowIso,
      pauseReason: 'Pausa pela notificação do aplicativo mobile',
    })
    transaction.set(doc(db, 'users', data.uid, 'timer', 'current'), {
      status: 'paused',
      entryId: data.entryId,
      projectId: data.projectId,
      projectTitle: data.projectTitle,
      pauseReason: 'Pausa pela notificação do aplicativo mobile',
      updatedAt: nowIso,
    }, { merge: true })
    return true
  })

  if (paused) await showTimerNotification(data, 'paused')
}

async function resumeTimerFromNotification(data: TimerNotificationData) {
  if (!await waitForMatchingUser(data.uid)) return
  const nowIso = new Date().toISOString()
  const entryReference = doc(collection(db, 'users', data.uid, 'timeEntries'))
  const resumed = await runTransaction(db, async (transaction) => {
    const timerReference = doc(db, 'users', data.uid, 'timer', 'current')
    const projectReference = doc(db, 'users', data.uid, 'projects', data.projectId)
    const [timerSnapshot, projectSnapshot] = await Promise.all([
      transaction.get(timerReference),
      transaction.get(projectReference),
    ])
    const timer = timerSnapshot.data()
    const project = projectSnapshot.data()

    if (timer?.status === 'active' || !projectSnapshot.exists() || inactiveStatuses.has(String(project?.status || ''))) {
      return null
    }

    transaction.set(entryReference, {
      id: entryReference.id,
      projectId: data.projectId,
      startedAt: nowIso,
      lastActivityAt: nowIso,
    })
    transaction.set(doc(db, 'users', data.uid, 'timeEntries', '_index'), {
      ids: arrayUnion(entryReference.id),
      updatedAt: serverTimestamp(),
    }, { merge: true })
    transaction.set(timerReference, {
      status: 'active',
      entryId: entryReference.id,
      projectId: data.projectId,
      projectTitle: data.projectTitle,
      heartbeatAt: nowIso,
      updatedAt: nowIso,
    }, { merge: true })
    return entryReference.id
  })

  if (resumed) {
    await showTimerNotification({ ...data, entryId: resumed }, 'active')
  }
}

async function handleTimerNotificationResponse(response: Notifications.NotificationResponse) {
  const timerData = response.notification.request.content.data
  if (!isTimerNotificationData(timerData)) return
  if (response.actionIdentifier === PAUSE_ACTION) await pauseTimerFromNotification(timerData)
  if (response.actionIdentifier === RESUME_ACTION) await resumeTimerFromNotification(timerData)
}

if (Platform.OS === 'android' && !TaskManager.isTaskDefined(TIMER_NOTIFICATION_TASK)) {
  TaskManager.defineTask<Notifications.NotificationTaskPayload>(TIMER_NOTIFICATION_TASK, async ({ data, error }) => {
    if (error || !('actionIdentifier' in data)) return Notifications.BackgroundNotificationTaskResult.Failed
    const timerData = data.notification.request.content.data
    if (!isTimerNotificationData(timerData)) return Notifications.BackgroundNotificationTaskResult.NoData

    try {
      await handleTimerNotificationResponse(data)
      return Notifications.BackgroundNotificationTaskResult.NewData
    } catch {
      return Notifications.BackgroundNotificationTaskResult.Failed
    }
  })

  void Notifications.registerTaskAsync(TIMER_NOTIFICATION_TASK).catch(() => undefined)
  Notifications.addNotificationResponseReceivedListener((response) => {
    void handleTimerNotificationResponse(response)
  })
}

export async function ensureTimerNotificationSetup() {
  if (Platform.OS !== 'android') return false

  await Notifications.setNotificationChannelAsync(TIMER_CHANNEL_ID, {
    name: 'Projeto em andamento',
    description: 'Mostra o projeto em andamento na tela bloqueada e permite pausar ou retomar o cronômetro.',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: null,
    enableVibrate: false,
    showBadge: false,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  })
  await Notifications.setNotificationCategoryAsync(TIMER_ACTIVE_CATEGORY, [{
    identifier: PAUSE_ACTION,
    buttonTitle: 'Pausar',
    options: { opensAppToForeground: false },
  }])
  await Notifications.setNotificationCategoryAsync(TIMER_PAUSED_CATEGORY, [{
    identifier: RESUME_ACTION,
    buttonTitle: 'Retomar',
    options: { opensAppToForeground: false },
  }])

  const currentPermission = await Notifications.getPermissionsAsync()
  const permission = currentPermission.granted
    ? currentPermission
    : await Notifications.requestPermissionsAsync()
  return permission.granted
}

export async function showActiveTimerNotification(input: ShowTimerNotificationInput) {
  if (!await ensureTimerNotificationSetup()) return false
  await showTimerNotification(input, 'active')
  return true
}

export async function showPausedTimerNotification(input: ShowTimerNotificationInput) {
  if (Platform.OS !== 'android') return
  await showTimerNotification(input, 'paused')
}

export async function dismissActiveTimerNotification() {
  if (Platform.OS !== 'android') return
  const notifications = await Notifications.getPresentedNotificationsAsync()
  const activeNotifications = notifications.filter((notification) => {
    const data = notification.request.content.data
    return isTimerNotificationData(data) && data.timerState === 'active'
  })
  await Promise.all(activeNotifications.map((notification) =>
    Notifications.dismissNotificationAsync(notification.request.identifier),
  ))
}
