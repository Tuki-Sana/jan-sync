import { openDB, type IDBPDatabase } from 'idb'

export interface JanList {
  id: string
  name: string
  createdAt: number
}

export interface ScannedItem {
  id: string
  listId: string
  jan: string
  name: string
  retailPrice?: number // 定価(税抜)
  salePrice?: number   // 売価(税抜)
  scannedAt: number
}

export function taxIn(price: number) {
  return Math.round(price * 1.1)
}

const DB_NAME = 'jan-sync'
const LISTS_STORE = 'lists'
const SCANS_STORE = 'scans'
const VERSION = 2

let _db: IDBPDatabase | null = null

async function getDB() {
  if (_db) return _db
  _db = await openDB(DB_NAME, VERSION, {
    upgrade(db, oldVersion, _newVersion, tx) {
      // v1 → v2: lists ストア追加、scans に listId インデックス追加
      if (oldVersion < 1) {
        const scans = db.createObjectStore(SCANS_STORE, { keyPath: 'id' })
        scans.createIndex('scannedAt', 'scannedAt')
      }
      if (oldVersion < 2) {
        db.createObjectStore(LISTS_STORE, { keyPath: 'id' })
        // 既存の scans ストアに listId インデックスを追加
        const scans = tx.objectStore(SCANS_STORE)
        scans.createIndex('listId', 'listId')
      }
    },
  })
  return _db
}

// ── リスト操作 ──────────────────────────────────────────

export async function loadLists(): Promise<JanList[]> {
  const db = await getDB()
  const all = await db.getAll(LISTS_STORE)
  return all.sort((a, b) => a.createdAt - b.createdAt)
}

export async function saveList(list: JanList): Promise<void> {
  const db = await getDB()
  await db.put(LISTS_STORE, list)
}

export async function deleteList(id: string): Promise<void> {
  const db = await getDB()
  // リストに属するアイテムも削除
  const items = await db.getAllFromIndex(SCANS_STORE, 'listId', id)
  const tx = db.transaction([LISTS_STORE, SCANS_STORE], 'readwrite')
  await Promise.all([
    tx.objectStore(LISTS_STORE).delete(id),
    ...items.map((i: ScannedItem) => tx.objectStore(SCANS_STORE).delete(i.id)),
    tx.done,
  ])
}

// ── アイテム操作 ────────────────────────────────────────

export async function loadByList(listId: string): Promise<ScannedItem[]> {
  const db = await getDB()
  const items = await db.getAllFromIndex(SCANS_STORE, 'listId', listId)
  return items.sort((a: ScannedItem, b: ScannedItem) => b.scannedAt - a.scannedAt)
}

export async function saveItem(item: ScannedItem): Promise<void> {
  const db = await getDB()
  await db.put(SCANS_STORE, item)
}

export async function removeItem(id: string): Promise<void> {
  const db = await getDB()
  await db.delete(SCANS_STORE, id)
}

export async function clearByList(listId: string): Promise<void> {
  const db = await getDB()
  const items = await db.getAllFromIndex(SCANS_STORE, 'listId', listId)
  const tx = db.transaction(SCANS_STORE, 'readwrite')
  await Promise.all([
    ...items.map((i: ScannedItem) => tx.store.delete(i.id)),
    tx.done,
  ])
}
