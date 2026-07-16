import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const requiredVariables = [
  'FIREBASE_SERVICE_ACCOUNT',
  'FIREBASE_USER_ID',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_CHAT_ID',
]

for (const variable of requiredVariables) {
  if (!process.env[variable]) throw new Error(`Configuração ausente: ${variable}`)
}

const credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
initializeApp({ credential: cert(credentials) })

const db = getFirestore()
const userId = process.env.FIREBASE_USER_ID

async function readIndexedCollection(name) {
  const reference = db.collection('users').doc(userId).collection(name)
  const index = await reference.doc('_index').get()
  const ids = Array.isArray(index.data()?.ids) ? index.data().ids : []
  if (ids.length === 0) return []
  const documents = await db.getAll(...ids.map((id) => reference.doc(id)))
  return documents.filter((document) => document.exists).map((document) => document.data())
}

function localDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function daysFromToday(date) {
  const today = new Date(`${localDate()}T12:00:00-03:00`)
  const target = new Date(`${date}T12:00:00-03:00`)
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

function formatDate(date) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(`${date}T12:00:00-03:00`))
}

function buildMessage({ tasks, projects, unavailableDays }) {
  const today = localDate()
  const todayTasks = tasks.filter((task) => task.date === today && !task.completed)
  const upcomingProjects = projects
    .filter((project) => project.deadline && project.status !== 'Entregue')
    .map((project) => ({ ...project, days: daysFromToday(project.deadline) }))
    .filter((project) => project.days >= 0 && project.days <= 7)
    .sort((first, second) => first.deadline.localeCompare(second.deadline))
  const unavailable = unavailableDays.filter((day) => day.date === today)

  const lines = ['🐾 Bom dia! Aqui está o cronograma da Reena Biscuit:']

  lines.push('', '📋 Tarefas de hoje')
  if (todayTasks.length === 0) lines.push('• Nenhuma tarefa pendente.')
  else todayTasks.forEach((task) => lines.push(`• ${task.title} (${task.priority})`))

  lines.push('', '🎀 Prazos dos próximos 7 dias')
  if (upcomingProjects.length === 0) lines.push('• Nenhuma entrega próxima.')
  else upcomingProjects.forEach((project) => {
    const when = project.days === 0 ? 'hoje' : project.days === 1 ? 'amanhã' : `${formatDate(project.deadline)} (${project.days} dias)`
    lines.push(`• ${project.title} — ${when}`)
  })

  if (unavailable.length > 0) {
    lines.push('', '🚫 Indisponibilidade')
    unavailable.forEach((day) => lines.push(`• ${day.reason}`))
  }

  lines.push('', 'Tenha um lindo dia de criações! 🐱')
  return lines.join('\n')
}

const [tasks, projects, unavailableDays] = await Promise.all([
  readIndexedCollection('tasks'),
  readIndexedCollection('projects'),
  readIndexedCollection('unavailableDays'),
])

const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    chat_id: process.env.TELEGRAM_CHAT_ID,
    text: buildMessage({ tasks, projects, unavailableDays }),
  }),
})

const result = await response.json()
if (!response.ok || !result.ok) throw new Error(`Telegram recusou a mensagem: ${result.description ?? response.status}`)
console.log('Resumo diário enviado com sucesso.')
