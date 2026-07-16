import { useEffect, useRef, useState } from 'react'
import { dataChangedEvent, initializeCloudData, pushLocalData } from '../lib/cloudData'
import { settingsEvent } from '../settings'
import { useAuth } from '../auth/AuthContext'

export function CloudSync() {
  const { user } = useAuth()
  const ready = useRef(false)
  const timer = useRef<number | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    if (!user) return
    let active = true
    initializeCloudData(user).then((changed) => {
      if (!active) return
      if (changed) { window.dispatchEvent(new Event(settingsEvent)); window.location.reload(); return }
      ready.current = true; setStatus('ready')
    }).catch(() => { if (active) setStatus('error') })

    const handleChange = () => {
      if (!ready.current) return
      if (timer.current) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => { pushLocalData(user).catch(() => setStatus('error')) }, 350)
    }
    window.addEventListener(dataChangedEvent, handleChange)
    return () => { active = false; window.removeEventListener(dataChangedEvent, handleChange); if (timer.current) window.clearTimeout(timer.current) }
  }, [user])

  if (status === 'loading') return <div className="cloud-status">Sincronizando dados...</div>
  if (status === 'error') return <div className="cloud-status error">Não foi possível sincronizar. Seus dados locais continuam seguros.</div>
  return null
}
