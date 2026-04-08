import { openDB, type IDBPDatabase } from 'idb'

export interface ScannedItem {
  id: string
  jan: string
  name: string
  scannedAt: number // Unix timestamp (ms)
}

const DB_NAME = 'jan-sync'
const STORE = 'scans'
const VERSION = 1

let _db: IDBPDatabase | null = null

async function getDB() {
  if (_db) return _db
  _db = await openDB(DB_NAME, VERSION, {
    upgrade(db) {
      const store = db.createObjectStore(STORE, { keyPath: 'id' })
      store.createIndex('scannedAt', 'scannedAt')
    },
  })
  return _db
}

export async function loadAll(): Promise<ScannedItem[]> {
  const db = await getDB()
  const items = await db.getAllFromIndex(STORE, 'scannedAt')
  return items.reverse() // 新しい順
}

export async function saveItem(item: ScannedItem): Promise<void> {
  const db = await getDB()
  await db.put(STORE, item)
}

export async function removeItem(id: string): Promise<void> {
  const db = await getDB()
  await db.delete(STORE, id)
}

export async function clearAll(): Promise<void> {
  const db = await getDB()
  await db.clear(STORE)
}
