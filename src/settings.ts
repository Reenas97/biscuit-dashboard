import { useEffect, useState } from 'react'

export type AtelierSettings = {
  studioName: string
  subtitle: string
  ownerName: string
  phone: string
  instagram: string
  email: string
  city: string
  state: string
  currency: string
  logo: string
}

export const settingsStorageKey = 'reena-biscuit-settings'
export const settingsEvent = 'reena-settings-changed'
export const defaultSettings: AtelierSettings = { studioName: 'Reena Biscuit', subtitle: 'Ateliê de biscuit', ownerName: 'Renata', phone: '', instagram: '', email: '', city: '', state: '', currency: 'BRL', logo: '' }

export function loadSettings(): AtelierSettings {
  const saved = localStorage.getItem(settingsStorageKey)
  if (!saved) return defaultSettings
  try { return { ...defaultSettings, ...JSON.parse(saved) as Partial<AtelierSettings> } } catch { return defaultSettings }
}

export function useAtelierSettings() {
  const [settings, setSettings] = useState<AtelierSettings>(loadSettings)
  useEffect(() => {
    const update = () => setSettings(loadSettings())
    window.addEventListener(settingsEvent, update)
    window.addEventListener('storage', update)
    return () => { window.removeEventListener(settingsEvent, update); window.removeEventListener('storage', update) }
  }, [])
  return settings
}
