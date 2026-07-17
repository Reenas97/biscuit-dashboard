/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { createUserWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { pushLocalData } from '../lib/cloudData'
import { stopTimerHeartbeat } from '../lib/timerHeartbeat'

type AuthContextValue = {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => onAuthStateChanged(auth, (nextUser) => { setUser(nextUser); setLoading(false) }), [])

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    login: async (email, password) => { await signInWithEmailAndPassword(auth, email, password) },
    register: async (name, email, password) => { const credential = await createUserWithEmailAndPassword(auth, email, password); await updateProfile(credential.user, { displayName: name }) },
    logout: async () => {
      const activeUser = auth.currentUser
      const storageKey = 'reena-biscuit-time-entries'
      try {
        const entries = JSON.parse(localStorage.getItem(storageKey) ?? '[]') as { id: string; endedAt?: string }[]
        const activeEntry = Array.isArray(entries) ? entries.find((entry) => !entry.endedAt) : null
        if (activeEntry) {
          localStorage.setItem(storageKey, JSON.stringify(entries.map((entry) => entry.id === activeEntry.id ? { ...entry, endedAt: new Date().toISOString(), pauseReason: 'Logout realizado' } : entry)))
          await stopTimerHeartbeat('Logout realizado')
          if (activeUser) await pushLocalData(activeUser)
        }
      } finally {
        await signOut(auth)
      }
    },
    resetPassword: async (email) => { await sendPasswordResetEmail(auth, email) },
  }), [user, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return context
}
