import { doc, setDoc } from 'firebase/firestore'
import { auth, db } from './firebase'

type ActiveTimer = { id: string; projectId: string }

export async function sendTimerHeartbeat(entry: ActiveTimer) {
  const user = auth.currentUser
  if (!user) return
  const now = new Date().toISOString()
  await setDoc(doc(db, 'users', user.uid, 'timer', 'current'), {
    status: 'active',
    entryId: entry.id,
    projectId: entry.projectId,
    heartbeatAt: now,
    updatedAt: now,
  }, { merge: true })
}

export async function stopTimerHeartbeat(reason: string) {
  const user = auth.currentUser
  if (!user) return
  await setDoc(doc(db, 'users', user.uid, 'timer', 'current'), {
    status: 'paused',
    pauseReason: reason,
    updatedAt: new Date().toISOString(),
  }, { merge: true })
}
