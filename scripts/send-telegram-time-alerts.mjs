import { cert, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

const requiredVariables = ['FIREBASE_SERVICE_ACCOUNT', 'FIREBASE_USER_ID', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID']
for (const variable of requiredVariables) {
  if (!process.env[variable]) throw new Error(`Configuração ausente: ${variable}`)
}

initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) })
const db = getFirestore()
const userId = process.env.FIREBASE_USER_ID
const userReference = db.collection('users').doc(userId)

async function readIndexedCollection(name) {
  const reference = userReference.collection(name)
  const index = await reference.doc('_index').get()
  const ids = Array.isArray(index.data()?.ids) ? index.data().ids : []
  if (ids.length === 0) return []
  const documents = await db.getAll(...ids.map((id) => reference.doc(id)))
  return documents.filter((document) => document.exists).map((document) => document.data())
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

const timerReference = userReference.collection('timer').doc('current')
const timerSnapshot = await timerReference.get()
const timerState = timerSnapshot.data()

if (timerState?.status === 'active' && timerState.entryId && timerState.heartbeatAt) {
  const heartbeatTime = new Date(timerState.heartbeatAt).getTime()
  const heartbeatExpired = Number.isFinite(heartbeatTime) && Date.now() - heartbeatTime >= 95 * 60 * 1000
  if (heartbeatExpired) {
    const reason = 'Computador em descanso, desligado, navegador fechado ou sem conexão'
    const entryReference = userReference.collection('timeEntries').doc(timerState.entryId)
    const entrySnapshot = await entryReference.get()
    if (entrySnapshot.exists && !entrySnapshot.data()?.endedAt) {
      await entryReference.set({ endedAt: timerState.heartbeatAt, autoPaused: true, pauseReason: reason }, { merge: true })
    }
    await timerReference.set({ status: 'paused', pauseReason: reason, updatedAt: new Date().toISOString() }, { merge: true })
  }
}

const [timeEntries, projects] = await Promise.all([
  readIndexedCollection('timeEntries'),
  readIndexedCollection('projects'),
])

const automaticPauses = timeEntries.filter((entry) => entry.id && entry.autoPaused && entry.endedAt)
let sent = 0

for (const entry of automaticPauses) {
  const marker = userReference.collection('telegramNotifications').doc(`auto-pause-${entry.id}`)
  if ((await marker.get()).exists) continue
  const project = projects.find((item) => item.id === entry.projectId)
  const projectName = project?.title ?? 'Projeto não encontrado'
  const message = [
    '⏸️ Projeto pausado automaticamente',
    '',
    `Projeto: ${projectName}`,
    `Horário da pausa: ${formatDateTime(entry.endedAt)}`,
    `Motivo: ${entry.pauseReason ?? 'inatividade detectada'}.`,
    '',
    'Abrir o dashboard:',
    'https://reena-dashboard.web.app/',
  ].join('\n')

  const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text: message }),
  })
  const result = await response.json()
  if (!response.ok || !result.ok) throw new Error(`Telegram recusou a mensagem: ${result.description ?? response.status}`)
  await marker.set({ timeEntryId: entry.id, sentAt: FieldValue.serverTimestamp() })
  sent += 1
}

console.log(sent ? `${sent} aviso(s) de pausa enviado(s).` : 'Nenhuma pausa automática nova.')
