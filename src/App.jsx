import ChatRioplatense from './components/ChatRioplatense.jsx'

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* HEADER */}
      <header className="border-b border-ink-100/80 bg-ivory-50/70 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-ink-900 to-ink-700 text-white
                              flex items-center justify-center font-bold text-sm shadow-soft">
                ñ
              </div>
              <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-gold-500 ring-2 ring-ivory-50" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-[13px] font-semibold text-ink-900 tracking-tight">
                IA Rioplatense
              </span>
              <span className="text-[11px] text-ink-500">
                Llama 3.1 8B · RAG · Piper Daniela
              </span>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs text-ink-500">
            <span className="font-mono">v1.0</span>
            <span className="text-ink-300">·</span>
            <span>built with React + MLX</span>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="border-b border-ink-100/60">
        <div className="max-w-5xl mx-auto px-6 pt-14 sm:pt-20 pb-10 sm:pb-14">
          <div className="animate-fade-up">
            <div className="eyebrow mb-5">Demo — Formador en IA</div>
            <h1 className="display-1 mb-4">
              Una IA que habla{' '}
              <span className="font-display text-signal-700">argentino</span> de
              verdad.
            </h1>
            <p className="lead max-w-2xl">
              Llama 3.1 8B con persona porteña + RAG sobre 319 ejemplos curados.
              Hablale por micrófono y te contesta con voz clonada — todo corriendo
              local en Apple Silicon (MLX + XTTS-v2 con Metal).
            </p>

            {/* Métricas */}
            <div className="mt-8 flex flex-wrap gap-x-8 gap-y-4 text-sm">
              <Metric label="Modelo base" value="Llama 3.1 8B" sub="4-bit MLX" />
              <Metric label="Few-shot" value="RAG BM25" sub="319 ejemplos" />
              <Metric label="Voz" value="Piper Daniela" sub="es-AR · local" />
              <Metric label="Pipeline" value="~3-5s" sub="LLM + Piper" />
            </div>
          </div>
        </div>
      </section>

      {/* MAIN */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-10 sm:py-14">
        <div className="animate-fade-up" style={{ animationDelay: '120ms' }}>
          <ChatRioplatense />
        </div>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-ink-100/80 bg-ivory-50/50">
        <div className="max-w-5xl mx-auto px-6 py-6 flex flex-wrap items-center justify-between gap-3 text-xs text-ink-500">
          <div>
            <span className="font-medium text-ink-700">IA Rioplatense</span>
            <span className="mx-2 text-ink-300">·</span>
            React · Vite · Tailwind · MLX-LM · Piper TTS
          </div>
          <div className="font-mono">
            localhost:5173
          </div>
        </div>
      </footer>
    </div>
  )
}

function Metric({ label, value, sub }) {
  return (
    <div>
      <div className="eyebrow mb-1">{label}</div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold tracking-tight text-ink-900">{value}</span>
        <span className="text-xs text-ink-500">{sub}</span>
      </div>
    </div>
  )
}
