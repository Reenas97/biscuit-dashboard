import { useCallback, useEffect, useRef, useState } from 'react'
import { FaClock, FaPause, FaPlay } from 'react-icons/fa6'
import { dataChangedEvent, saveLocalData } from '../lib/cloudData'

type TimeEntry = {
  id: string
  projectId: string
  startedAt: string
  endedAt?: string
  autoPaused?: boolean
  pauseReason?: string
}

type IdleDetectorInstance = EventTarget & {
  userState: 'active' | 'idle' | null
  screenState: 'locked' | 'unlocked' | null
  start(options: { threshold: number; signal: AbortSignal }): Promise<void>
}

type IdleDetectorConstructor = {
  new(): IdleDetectorInstance
}

const storageKey = 'reena-biscuit-time-entries'
const warningAfterMs = 80 * 60 * 1000
const pauseAfterWarningMs = 10 * 60 * 1000

function readEntries() {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) ?? '[]')
    return Array.isArray(parsed) ? parsed as TimeEntry[] : []
  } catch {
    return []
  }
}

function getIdleDetector() {
  return (window as Window & { IdleDetector?: IdleDetectorConstructor }).IdleDetector
}

function showComputerNotification(title: string, body: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  const notification = new Notification(title, { body, tag: 'reena-biscuit-timer', requireInteraction: true })
  notification.onclick = () => {
    window.focus()
    notification.close()
  }
}

export function TimeTrackingGuard() {
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(() => readEntries().find((entry) => !entry.endedAt) ?? null)
  const [showWarning, setShowWarning] = useState(false)
  const pauseTimer = useRef<number | null>(null)

  const refreshActiveEntry = useCallback(() => {
    setActiveEntry(readEntries().find((entry) => !entry.endedAt) ?? null)
  }, [])

  const pauseEntry = useCallback((automatic: boolean, reason?: string) => {
    const entries = readEntries()
    const current = entries.find((entry) => !entry.endedAt)
    if (!current) return
    const nextEntries = entries.map((entry) => entry.id === current.id ? {
      ...entry,
      endedAt: new Date().toISOString(),
      ...(automatic ? { autoPaused: true, pauseReason: reason } : {}),
    } : entry)
    saveLocalData(storageKey, JSON.stringify(nextEntries))
    setActiveEntry(null)
    setShowWarning(false)
    if (pauseTimer.current) window.clearTimeout(pauseTimer.current)
    if (automatic) showComputerNotification('Projeto pausado automaticamente', reason ?? 'O cronômetro foi pausado por inatividade.')
  }, [])

  useEffect(() => {
    window.addEventListener(dataChangedEvent, refreshActiveEntry)
    return () => window.removeEventListener(dataChangedEvent, refreshActiveEntry)
  }, [refreshActiveEntry])

  useEffect(() => {
    if (!activeEntry) return
    const IdleDetectorApi = getIdleDetector()
    if (!IdleDetectorApi) return
    const controller = new AbortController()
    const detector = new IdleDetectorApi()

    const handleIdleChange = () => {
      if (detector.screenState === 'locked') {
        pauseEntry(true, 'Tela bloqueada ou computador em modo de descanso')
        return
      }
      if (detector.userState === 'idle') {
        setShowWarning(true)
        showComputerNotification('Você ainda está trabalhando?', 'O projeto será pausado automaticamente em 10 minutos.')
        if (pauseTimer.current) window.clearTimeout(pauseTimer.current)
        pauseTimer.current = window.setTimeout(
          () => pauseEntry(true, 'Computador sem interação por mais de 1h30'),
          pauseAfterWarningMs,
        )
        return
      }
      setShowWarning(false)
      if (pauseTimer.current) window.clearTimeout(pauseTimer.current)
    }

    detector.addEventListener('change', handleIdleChange)
    detector.start({ threshold: warningAfterMs, signal: controller.signal }).catch(() => undefined)
    return () => {
      controller.abort()
      detector.removeEventListener('change', handleIdleChange)
      if (pauseTimer.current) window.clearTimeout(pauseTimer.current)
    }
  }, [activeEntry, pauseEntry])

  if (!showWarning || !activeEntry) return null

  return <div className="timer-warning-backdrop" role="presentation">
    <section className="timer-warning" role="alertdialog" aria-modal="true" aria-labelledby="timer-warning-title">
      <FaClock />
      <span className="section-kicker">COMPUTADOR INATIVO</span>
      <h2 id="timer-warning-title">Você ainda está trabalhando?</h2>
      <p>O computador está sem interação há 1h20. O projeto será pausado automaticamente em 10 minutos.</p>
      <div>
        <button className="secondary-button" onClick={() => pauseEntry(false)} type="button"><FaPause /> Pausar agora</button>
        <button className="primary-button" onClick={() => setShowWarning(false)} type="button"><FaPlay /> Ainda estou trabalhando</button>
      </div>
    </section>
  </div>
}
