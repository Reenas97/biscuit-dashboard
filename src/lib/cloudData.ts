import {
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { db } from './firebase'

export const dataChangedEvent = 'reena-local-data-changed'

type CollectionConfig = {
  storageKey: string
  collectionName: string
}

const collectionConfigs: CollectionConfig[] = [
  { storageKey: 'reena-biscuit-ideas', collectionName: 'ideas' },
  { storageKey: 'reena-biscuit-projects', collectionName: 'projects' },
  { storageKey: 'reena-biscuit-clients', collectionName: 'clients' },
  { storageKey: 'reena-biscuit-materials', collectionName: 'materials' },
  { storageKey: 'reena-biscuit-tasks', collectionName: 'tasks' },
  { storageKey: 'reena-biscuit-unavailable-days', collectionName: 'unavailableDays' },
  { storageKey: 'reena-biscuit-goals', collectionName: 'goals' },
]

const settingsStorageKey = 'reena-biscuit-settings'
export const syncedStorageKeys = [...collectionConfigs.map(({ storageKey }) => storageKey), settingsStorageKey]

function parseArray(value: string | null): Record<string, unknown>[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === 'object' && typeof item.id === 'string') : []
  } catch {
    return []
  }
}

function parseObject(value: string | null): Record<string, unknown> | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function legacyValue(legacyData: Record<string, string>, key: string) {
  return legacyData[key] ?? localStorage.getItem(key)
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([first], [second]) => first.localeCompare(second))
        .map(([key, item]) => [key, canonicalize(item)]),
    )
  }
  return value
}

function hasSameJson(currentValue: string | null, nextValue: unknown) {
  if (!currentValue) return false
  try {
    return JSON.stringify(canonicalize(JSON.parse(currentValue))) === JSON.stringify(canonicalize(nextValue))
  } catch {
    return false
  }
}

async function replaceCollection(user: User, config: CollectionConfig, items: Record<string, unknown>[]) {
  const reference = collection(db, 'users', user.uid, config.collectionName)
  const indexReference = doc(reference, '_index')
  const currentIndex = await getDoc(indexReference)
  const currentIds = Array.isArray(currentIndex.data()?.ids) ? currentIndex.data()?.ids as string[] : []
  const nextIds = new Set(items.map((item) => item.id as string))
  const batch = writeBatch(db)

  currentIds.forEach((id) => {
    if (!nextIds.has(id)) batch.delete(doc(reference, id))
  })
  items.forEach((item) => batch.set(doc(reference, item.id as string), item))
  batch.set(indexReference, { ids: [...nextIds], updatedAt: serverTimestamp() })
  await batch.commit()
}

async function readCollection(user: User, config: CollectionConfig) {
  const reference = collection(db, 'users', user.uid, config.collectionName)
  const index = await getDoc(doc(reference, '_index'))
  const ids = Array.isArray(index.data()?.ids) ? index.data()?.ids as string[] : []
  const documents = await Promise.all(ids.map((id) => getDoc(doc(reference, id))))
  return documents.filter((item) => item.exists()).map((item) => item.data())
}

async function migrateLegacyData(user: User) {
  const schemaReference = doc(db, 'users', user.uid, 'app', 'schema')
  const schema = await getDoc(schemaReference)
  if (schema.data()?.version === 3) return

  const legacy = await getDoc(doc(db, 'users', user.uid, 'app', 'state'))
  const legacyData = (legacy.data()?.data ?? {}) as Record<string, string>

  await Promise.all(collectionConfigs.map(async (config) => {
    const items = parseArray(legacyValue(legacyData, config.storageKey))
    await replaceCollection(user, config, items)
  }))

  const settings = parseObject(legacyValue(legacyData, settingsStorageKey))
  if (settings) await setDoc(doc(db, 'users', user.uid, 'settings', 'atelier'), settings)
  await setDoc(schemaReference, { version: 3, migratedAt: serverTimestamp() })
}

export function saveLocalData(key: string, value: string) {
  localStorage.setItem(key, value)
  window.dispatchEvent(new Event(dataChangedEvent))
}

export function removeLocalData(key: string) {
  localStorage.removeItem(key)
  window.dispatchEvent(new Event(dataChangedEvent))
}

export async function pushLocalData(user: User) {
  await Promise.all(collectionConfigs.map((config) =>
    replaceCollection(user, config, parseArray(localStorage.getItem(config.storageKey))),
  ))

  const settings = parseObject(localStorage.getItem(settingsStorageKey))
  if (settings) {
    await setDoc(doc(db, 'users', user.uid, 'settings', 'atelier'), { ...settings, updatedAt: serverTimestamp() })
  }
}

export async function initializeCloudData(user: User) {
  await migrateLegacyData(user)
  let changed = false

  const cloudCollections = await Promise.all(collectionConfigs.map(async (config) => ({
    config,
    items: await readCollection(user, config),
  })))

  for (const { config, items } of cloudCollections) {
    const nextValue = JSON.stringify(items)
    if (!hasSameJson(localStorage.getItem(config.storageKey), items)) {
      localStorage.setItem(config.storageKey, nextValue)
      changed = true
    }
  }

  const settings = await getDoc(doc(db, 'users', user.uid, 'settings', 'atelier'))
  if (settings.exists()) {
    const settingsData = { ...settings.data() }
    delete settingsData.updatedAt
    const nextValue = JSON.stringify(settingsData)
    if (!hasSameJson(localStorage.getItem(settingsStorageKey), settingsData)) {
      localStorage.setItem(settingsStorageKey, nextValue)
      changed = true
    }
  }

  return changed
}
