import { createSignal, Show } from 'solid-js'
import { IconHelp, IconX } from './icons'

export default function HelpModal() {
  const [open, setOpen] = createSignal(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        class="absolute right-0 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:text-blue-600 active:scale-95 active:bg-slate-100 touch-manipulation transition-colors"
        aria-label="使い方とヒント"
      >
        <IconHelp class="h-[22px] w-[22px]" />
      </button>

      <Show when={open()}>
        <div class="fixed inset-0 z-[60] flex items-center justify-center p-4" role="presentation">
          <button
            type="button"
            class="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px] transition-opacity cursor-default"
            aria-label="閉じる"
            onClick={() => setOpen(false)}
          />
          <div
            class="relative z-[61] flex w-full max-w-md max-h-[85vh] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/10"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="help-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div class="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-5 py-4">
              <h3 id="help-modal-title" class="text-[17px] font-bold text-slate-800">
                使い方・Tips
              </h3>
              <button
                type="button"
                class="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 active:scale-95 active:bg-slate-200/50 touch-manipulation"
                onClick={() => setOpen(false)}
                aria-label="閉じる"
              >
                <IconX class="h-[22px] w-[22px]" />
              </button>
            </div>
            
            <div class="flex-1 overflow-y-auto px-5 py-4 pb-6 overscroll-contain">
              <div class="flex flex-col gap-5">
                
                <section>
                  <h4 class="mb-1.5 font-bold text-slate-700 text-sm flex items-center gap-1.5"><span class="text-blue-500">◆</span> リストの管理について</h4>
                  <p class="text-sm text-slate-600 leading-relaxed">
                    作成から <span class="font-semibold text-amber-600">7日以上</span> 経過したリストには「7日超」のラベルが付きます。スマホの容量圧迫を防ぐため、出力の終わった古いデータは小まめに削除してください。
                  </p>
                </section>

                <section>
                  <h4 class="mb-1.5 font-bold text-slate-700 text-sm flex items-center gap-1.5"><span class="text-blue-500">◆</span> データ出力（エクスポート）</h4>
                  <ul class="list-none space-y-1.5 text-sm text-slate-600 leading-relaxed">
                    <li class="flex items-start gap-1.5">
                      <span class="mt-0.5 text-slate-400">-</span>
                      <span><span class="font-semibold text-slate-800">TSV出力を推奨</span>します。CSVをExcelで開くとJANコードの先頭の「0」が消えてしまう問題（0落ち）を防げます。</span>
                    </li>
                    <li class="flex items-start gap-1.5">
                      <span class="mt-0.5 text-slate-400">-</span>
                      <span>「個数を行展開」をオンにすると、個数が3個の商品は <span class="font-semibold text-slate-800">1個ずつの行として3行</span> 出力されます。システム取り込みの際に便利です。</span>
                    </li>
                    <li class="flex items-start gap-1.5">
                      <span class="mt-0.5 text-slate-400">-</span>
                      <span>用途に応じて、出力する列（価格や日時など）を自由に絞り込めます。</span>
                    </li>
                  </ul>
                </section>

                <section>
                  <h4 class="mb-1.5 font-bold text-slate-700 text-sm flex items-center gap-1.5"><span class="text-blue-500">◆</span> 相場検索の小技</h4>
                  <p class="text-sm text-slate-600 leading-relaxed">
                    スキャン画面で名前欄に <span class="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-800">Amazon</span> や <span class="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-800">メルカリ</span> と入力してからGoogle/Yahooボタンを押すと、JANコードと一緒に検索されるので相場チェックに役立ちます。
                  </p>
                </section>

                <section>
                  <h4 class="mb-1.5 font-bold text-slate-700 text-sm flex items-center gap-1.5"><span class="text-blue-500">◆</span> カメラとライト</h4>
                  <ul class="list-none space-y-1.5 text-sm text-slate-600 leading-relaxed">
                    <li class="flex items-start gap-1.5">
                      <span class="mt-0.5 text-slate-400">-</span>
                      <span>スキャン中に画面右下のボタンでライトが点灯します（対応機種のみ）。</span>
                    </li>
                    <li class="flex items-start gap-1.5">
                      <span class="mt-0.5 text-slate-400">-</span>
                      <span>カメラの映像が真っ暗なままの場合は、スマホまたはブラウザの設定から <span class="font-semibold text-slate-800">カメラへのアクセスを許可</span> してください。</span>
                    </li>
                  </ul>
                </section>

              </div>
            </div>
            
            <div class="border-t border-slate-100 p-4">
              <button
                type="button"
                class="w-full min-h-12 rounded-xl bg-blue-600 text-base font-semibold text-white shadow-md active:scale-[0.98] transition-transform touch-manipulation"
                onClick={() => setOpen(false)}
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      </Show>
    </>
  )
}
