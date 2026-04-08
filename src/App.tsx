import { createSignal, For, onMount, Show } from 'solid-js'
import Scanner from './components/Scanner'
import Generator from './components/Generator'
import { type JanList, loadLists, saveList, deleteList } from './lib/db'

type Tab = 'scanner' | 'generator'

export default function App() {
  const [tab, setTab] = createSignal<Tab>('scanner')
  const [lists, setLists] = createSignal<JanList[]>([])
  const [activeListId, setActiveListId] = createSignal<string>('')
  const [showListMenu, setShowListMenu] = createSignal(false)
  const [newListName, setNewListName] = createSignal('')
  const [creating, setCreating] = createSignal(false)

  onMount(async () => {
    const loaded = await loadLists()
    setLists(loaded)
    if (loaded.length > 0) setActiveListId(loaded[0].id)
  })

  const activeList = () => lists().find((l) => l.id === activeListId())

  async function createList() {
    const name = newListName().trim()
    if (!name) return
    const list: JanList = { id: crypto.randomUUID(), name, createdAt: Date.now() }
    await saveList(list)
    setLists([...lists(), list])
    setActiveListId(list.id)
    setNewListName('')
    setCreating(false)
    setShowListMenu(false)
  }

  async function removeList(id: string) {
    if (!confirm('リストとその全アイテムを削除しますか？')) return
    await deleteList(id)
    const next = lists().filter((l) => l.id !== id)
    setLists(next)
    if (activeListId() === id) setActiveListId(next[0]?.id ?? '')
    setShowListMenu(false)
  }

  return (
    <div class="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header class="bg-white border-b border-gray-200 px-4 py-3 relative">
        <h1 class="text-center text-lg font-bold tracking-tight">JAN Sync</h1>

        {/* リスト選択 */}
        <div class="mt-2 flex items-center gap-2">
          <button
            onClick={() => setShowListMenu(!showListMenu())}
            class="flex-1 flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm"
          >
            <span class="truncate font-medium text-gray-700">
              {activeList()?.name ?? 'リストを選択'}
            </span>
            <span class="ml-1 text-gray-400">▾</span>
          </button>
          <button
            onClick={() => { setCreating(true); setShowListMenu(true) }}
            class="shrink-0 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-blue-600 font-medium"
          >
            ＋ 新規
          </button>
        </div>

        {/* リストメニュー */}
        <Show when={showListMenu()}>
          <div class="absolute left-4 right-4 top-full z-10 mt-1 rounded-xl border border-gray-200 bg-white shadow-lg">
            {/* 新規作成フォーム */}
            <Show when={creating()}>
              <div class="flex gap-2 p-3 border-b border-gray-100">
                <input
                  type="text"
                  placeholder="リスト名"
                  value={newListName()}
                  onInput={(e) => setNewListName(e.currentTarget.value)}
                  onKeyDown={(e) => e.key === 'Enter' && createList()}
                  class="flex-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
                  autofocus
                />
                <button onClick={createList} class="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white">作成</button>
                <button onClick={() => setCreating(false)} class="text-gray-400 text-sm px-1">✕</button>
              </div>
            </Show>

            {/* リスト一覧 */}
            <Show when={lists().length === 0 && !creating()}>
              <p class="p-4 text-center text-sm text-gray-400">リストがありません</p>
            </Show>
            <For each={lists()}>
              {(list) => (
                <div
                  class={`flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 ${list.id === activeListId() ? 'text-blue-600 font-medium' : 'text-gray-700'}`}
                  onClick={() => { setActiveListId(list.id); setShowListMenu(false) }}
                >
                  <span class="text-sm truncate">{list.name}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeList(list.id) }}
                    class="ml-2 shrink-0 text-gray-300 text-base leading-none hover:text-red-400"
                  >
                    ×
                  </button>
                </div>
              )}
            </For>
          </div>
        </Show>

        {/* メニュー外クリックで閉じる */}
        <Show when={showListMenu()}>
          <div class="fixed inset-0 z-0" onClick={() => { setShowListMenu(false); setCreating(false) }} />
        </Show>
      </header>

      {/* タブ */}
      <nav class="flex border-b border-gray-200 bg-white">
        <button
          onClick={() => setTab('scanner')}
          class={`flex-1 py-3 text-sm font-medium transition-colors ${tab() === 'scanner' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
        >
          スキャン
        </button>
        <button
          onClick={() => setTab('generator')}
          class={`flex-1 py-3 text-sm font-medium transition-colors ${tab() === 'generator' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
        >
          生成
        </button>
      </nav>

      {/* コンテンツ */}
      <main class="mx-auto max-w-lg">
        <Show when={!activeListId()}>
          <div class="flex flex-col items-center gap-3 p-8 text-center">
            <p class="text-gray-500 text-sm">「＋ 新規」からリストを作成してください</p>
          </div>
        </Show>
        <Show when={activeListId()}>
          {tab() === 'scanner'
            ? <Scanner listId={activeListId()} />
            : <Generator listId={activeListId()} />
          }
        </Show>
      </main>
    </div>
  )
}
