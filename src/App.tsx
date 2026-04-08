import { createSignal } from 'solid-js'
import Scanner from './components/Scanner'
import Generator from './components/Generator'

type Tab = 'scanner' | 'generator'

export default function App() {
  const [tab, setTab] = createSignal<Tab>('scanner')

  return (
    <div class="min-h-screen bg-gray-50">
      <header class="bg-white border-b border-gray-200 px-4 py-3">
        <h1 class="text-center text-lg font-bold tracking-tight">JAN Sync</h1>
      </header>

      <nav class="flex border-b border-gray-200 bg-white">
        <button
          onClick={() => setTab('scanner')}
          class={`flex-1 py-3 text-sm font-medium transition-colors ${
            tab() === 'scanner'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-500'
          }`}
        >
          スキャン
        </button>
        <button
          onClick={() => setTab('generator')}
          class={`flex-1 py-3 text-sm font-medium transition-colors ${
            tab() === 'generator'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-500'
          }`}
        >
          生成
        </button>
      </nav>

      <main class="mx-auto max-w-lg">
        {tab() === 'scanner' ? <Scanner /> : <Generator />}
      </main>
    </div>
  )
}
