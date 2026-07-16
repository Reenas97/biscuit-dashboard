import { useCallback, useEffect, useRef, useState } from 'react'
import { FaClock, FaPause, FaPlay } from 'react-icons/fa6'
import { dataChangedEvent, saveLocalData } from '../lib/cloudData'

type TimeEntry = {
  id: string
  projectId: string
  startedAt: string
  endedAt?: string
  lastActivityAt?: string
  autoPaused?: boolean
  pauseReason?: string
}

const storageKey = 'reena-biscuit-time-entries'
const warningAfterMs = 80 * 60 * 1000
const pauseAfterMs = 90 * 60 * 1000

function readEntries() {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) ?? '[]')
    return Array.isArray(parsed) ? parsed as TimeEntry[] : []
  } catch {
    return []
  }
}

export function TimeTrackingGuard() {
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(() => readEntries().find((entry) => !entry.endedAt) ?? null)
  const [showWarning, setShowWarning] = useState(false)
  const lastSavedActivity = useRef(0)

  const refreshActiveEntry = useCallback(() => {
    setActiveEntry(readEntries().find((entry) => !entry.endedAt) ?? null)
  }, [])

  const registerActivity = useCallback(() => {
    const entries = readEntries()
    const current = entries.find((entry) => !entry.endedAt)
    if (!current) return
    const currentTime = Date.now()
    setShowWarning(false)
    if (currentTime - lastSavedActivity.current < 60_000) return
    lastSavedActivity.current = currentTime
    const activityAt = new Date(currentTime).toISOString()
    const nextEntries = entries.map((entry) => entry.id === current.id ? { ...entry, lastActivityAt: activityAt } : entry)
    saveLocalData(storageKey, JSON.stringify(nextEntries))
    setActiveEntry({ ...current, lastActivityAt: activityAt })
  }, [])

  const pauseAutomaticallyIfNeeded = useCallback(() => {
    const entries = readEntries()
    const current = entries.find((entry) => !entry.endedAt)
    if (!current) {
      setActiveEntry(null)
      setShowWarning(false)
      return
    }
    const lastActivity = new Date(current.lastActivityAt ?? current.startedAt).getTime()
    const inactiveFor = Date.now() - lastActivity
    if (inactiveFor >= pauseAfterMs) {
      const endedAt = new Date(lastActivity + pauseAfterMs).toISOString()
      const nextEntries = entries.map((entry) => entry.id === current.id ? {
        ...entry,
        endedAt,
        autoPaused: true,
        pauseReason: 'Inatividade por mais de 1h30',
      } : entry)
      saveLocalData(storageKey, JSON.stringify(nextEntries))
      setActiveEntry(null)
      setShowWarning(false)
      return
    }
    setActiveEntry(current)
    setShowWarning(inactiveFor >= warningAfterMs)
  }, [])

  const pauseNow = useCallback(() => {
    const entries = readEntries()
    const current = entries.find((entry) => !entry.endedAt)
    if (!current) return
    const nextEntries = entries.map((entry) => entry.id === current.id ? { ...entry, endedAt: new Date().toISOString() } : entry)
    saveLocalData(storageKey, JSON.stringify(nextEntries))
    setActiveEntry(null)
    setShowWarning(false)
  }, [])

  useEffect(() => {
    window.addEventListener(dataChangedEvent, refreshActiveEntry)
    return () => window.removeEventListener(dataChangedEvent, refreshActiveEntry)
  }, [refreshActiveEntry])

  useEffect(() => {
    if (!activeEntry) return
    const activityEvents: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'touchstart', 'scroll']
    activityEvents.forEach((eventName) => window.addEventListener(eventName, registerActivity, { passive: true }))
    window.addEventListener('focus', pauseAutomaticallyIfNeeded)
    document.addEventListener('visibilitychange', pauseAutomaticallyIfNeeded)
    const initialCheck = window.setTimeout(pauseAutomaticallyIfNeeded, 0)
    const timer = window.setInterval(pauseAutomaticallyIfNeeded, 30_000)
    return () => {
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, registerActivity))
      window.removeEventListener('focus', pauseAutomaticallyIfNeeded)
      document.removeEventListener('visibilitychange', pauseAutomaticallyIfNeeded)
      window.clearTimeout(initialCheck)
      window.clearInterval(timer)
    }
  }, [activeEntry, pauseAutomaticallyIfNeeded, registerActivity])

  if (!showWarning || !activeEntry) return null

  return <div className="timer-warning-backdrop" role="presentation">
    <section className="timer-warning" role="alertdialog" aria-modal="true" aria-labelledby="timer-warning-title">
      <FaClock />
      <span className="section-kicker">CRONÔMETRO ATIVO</span>
      <h2 id="timer-warning-title">Você ainda está trabalhando?</h2>
      <p>Não detectamos atividade há 1h20. O projeto será pausado automaticamente em 10 minutos.</p>
      <div>
        <button className="secondary-button" onClick={pauseNow} type="button"><FaPause /> Pausar agora</button>
        <button className="primary-button" onClick={registerActivity} type="button"><FaPlay /> Ainda estou trabalhando</button>
      </div>
    </section>
  </div>
}
