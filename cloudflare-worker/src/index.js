const firestoreScope = 'https://www.googleapis.com/auth/datastore'
const tokenEndpoint = 'https://oauth2.googleapis.com/token'
const pauseCron = '*/2 * * * *'
const dailyCron = '0 11 * * *'

let cachedAccessToken = null
let cachedAccessTokenExpiresAt = 0

function base64Url(bytes) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function encodeJson(value) {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)))
}

function pemToBytes(pem) {
  const base64 = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '')
  const binary = atob(base64)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

async function createAccessToken(serviceAccount) {
  if (cachedAccessToken && Date.now() < cachedAccessTokenExpiresAt) return cachedAccessToken
  const now = Math.floor(Date.now() / 1000)
  const header = encodeJson({ alg: 'RS256', typ: 'JWT' })
  const payload = encodeJson({
    iss: serviceAccount.client_email,
    scope: firestoreScope,
    aud: tokenEndpoint,
    iat: now,
    exp: now + 3600,
  })
  const unsignedToken = `${header}.${payload}`
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToBytes(serviceAccount.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    new TextEncoder().encode(unsignedToken),
  )
  const assertion = `${unsignedToken}.${base64Url(new Uint8Array(signature))}`
  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })
  const result = await response.json()
  if (!response.ok || !result.access_token) throw new Error(`Falha ao autenticar no Firebase: ${result.error_description ?? response.status}`)
  cachedAccessToken = result.access_token
  cachedAccessTokenExpiresAt = Date.now() + Math.max(60, Number(result.expires_in ?? 3600) - 120) * 1000
  return cachedAccessToken
}

function decodeValue(value = {}) {
  if ('stringValue' in value) return value.stringValue
  if ('booleanValue' in value) return value.booleanValue
  if ('integerValue' in value) return Number(value.integerValue)
  if ('doubleValue' in value) return value.doubleValue
  if ('timestampValue' in value) return value.timestampValue
  if ('nullValue' in value) return null
  if ('arrayValue' in value) return (value.arrayValue.values ?? []).map(decodeValue)
  if ('mapValue' in value) return decodeFields(value.mapValue.fields ?? {})
  return undefined
}

function decodeFields(fields = {}) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decodeValue(value)]))
}

function encodeValue(value) {
  if (value === null || value === undefined) return { nullValue: null }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } }
  if (typeof value === 'object') return { mapValue: { fields: encodeFields(value) } }
  return { stringValue: String(value) }
}

function encodeFields(data) {
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, encodeValue(value)]))
}

function createFirestoreClient(env) {
  const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT)
  const projectId = serviceAccount.project_id
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`

  async function request(path, options = {}) {
    const token = await createAccessToken(serviceAccount)
    const response = await fetch(`${baseUrl}/${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
      },
    })
    if (response.status === 404) return null
    const result = await response.json()
    if (!response.ok) throw new Error(`Firestore recusou a operação: ${result.error?.message ?? response.status}`)
    return result
  }

  return {
    async get(path) {
      const document = await request(path)
      if (!document) return null
      return { id: document.name.split('/').pop(), ...decodeFields(document.fields) }
    },
    async patch(path, data) {
      const fields = Object.keys(data).map((field) => `updateMask.fieldPaths=${encodeURIComponent(field)}`).join('&')
      return request(`${path}?${fields}`, { method: 'PATCH', body: JSON.stringify({ fields: encodeFields(data) }) })
    },
    async list(path) {
      const items = []
      let pageToken = ''
      do {
        const suffix = pageToken ? `?pageSize=300&pageToken=${encodeURIComponent(pageToken)}` : '?pageSize=300'
        const result = await request(`${path}${suffix}`)
        for (const document of result?.documents ?? []) {
          const id = document.name.split('/').pop()
          if (id !== '_index') items.push({ id, ...decodeFields(document.fields) })
        }
        pageToken = result?.nextPageToken ?? ''
      } while (pageToken)
      return items
    },
  }
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

function formatDateTime(value) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

async function sendTelegram(env, text) {
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text }),
  })
  const result = await response.json()
  if (!response.ok || !result.ok) throw new Error(`Telegram recusou a mensagem: ${result.description ?? response.status}`)
}

function buildDailyMessage({ tasks, projects, unavailableDays }) {
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
  else todayTasks.forEach((task) => {
    const project = projects.find((item) => item.id === task.projectId)
    lines.push(`• ${task.title} (${task.priority})${project ? ` — Projeto: ${project.title}` : ''}`)
  })

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

  lines.push('', '📅 Abrir planejamento:', 'https://reena-dashboard.web.app/planejamento', '', 'Tenha um lindo dia de criações! 🐱')
  return lines.join('\n')
}

async function checkInactiveTimer(env) {
  const firestore = createFirestoreClient(env)
  const userPath = `users/${env.FIREBASE_USER_ID}`
  const timer = await firestore.get(`${userPath}/timer/current`)

  if (timer?.status === 'active' && timer.entryId && timer.heartbeatAt) {
    const heartbeatTime = new Date(timer.heartbeatAt).getTime()
    if (Number.isFinite(heartbeatTime) && Date.now() - heartbeatTime >= 95 * 60 * 1000) {
      const reason = 'Computador em descanso, desligado, navegador fechado ou sem conexão'
      const entryPath = `${userPath}/timeEntries/${timer.entryId}`
      const entry = await firestore.get(entryPath)
      if (entry && !entry.endedAt) {
        await firestore.patch(entryPath, { endedAt: timer.heartbeatAt, autoPaused: true, pauseReason: reason })
      }
      await firestore.patch(`${userPath}/timer/current`, {
        status: 'paused',
        pauseReason: reason,
        updatedAt: new Date().toISOString(),
      })
    }
  }

  const [timeEntries, projects] = await Promise.all([
    firestore.list(`${userPath}/timeEntries`),
    firestore.list(`${userPath}/projects`),
  ])
  let sent = 0
  for (const entry of timeEntries.filter((item) => item.autoPaused && item.endedAt)) {
    const markerPath = `${userPath}/telegramNotifications/auto-pause-${entry.id}`
    if (await firestore.get(markerPath)) continue
    const project = projects.find((item) => item.id === entry.projectId)
    const message = [
      '⏸️ Projeto pausado automaticamente',
      '',
      `Projeto: ${project?.title ?? 'Projeto não encontrado'}`,
      `Horário da pausa: ${formatDateTime(entry.endedAt)}`,
      `Motivo: ${entry.pauseReason ?? 'inatividade detectada'}.`,
      '',
      'Abrir o dashboard:',
      'https://reena-dashboard.web.app/',
    ].join('\n')
    await sendTelegram(env, message)
    await firestore.patch(markerPath, { timeEntryId: entry.id, sentAt: new Date().toISOString() })
    sent += 1
  }
  return { sent }
}

async function sendDailyReminder(env) {
  const firestore = createFirestoreClient(env)
  const userPath = `users/${env.FIREBASE_USER_ID}`
  const today = localDate()
  const markerPath = `${userPath}/automationState/dailyTelegram`
  const marker = await firestore.get(markerPath)
  if (marker?.lastSentDate === today) return { skipped: true }

  const [tasks, projects, unavailableDays] = await Promise.all([
    firestore.list(`${userPath}/tasks`),
    firestore.list(`${userPath}/projects`),
    firestore.list(`${userPath}/unavailableDays`),
  ])
  await sendTelegram(env, buildDailyMessage({ tasks, projects, unavailableDays }))
  await firestore.patch(markerPath, { lastSentDate: today, sentAt: new Date().toISOString() })
  return { sent: true }
}

export default {
  async scheduled(controller, env, context) {
    const task = controller.cron === dailyCron ? sendDailyReminder(env) : checkInactiveTimer(env)
    context.waitUntil(task)
  },
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname === '/health') return Response.json({ ok: true, service: 'reena-telegram-scheduler' })
    return new Response('Reena Telegram Scheduler', { status: 200 })
  },
}

export { pauseCron, dailyCron }
