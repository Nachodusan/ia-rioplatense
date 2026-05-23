import { useState } from 'react'

function qualityLabel(q) {
  if (q === 3) return { label: 'Premium', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
  if (q === 2) return { label: 'Google',  cls: 'bg-sky-100 text-sky-700 border-sky-200' }
  return { label: 'Default', cls: 'bg-slate-100 text-slate-600 border-slate-200' }
}

export default function VoiceSettings({
  voces, vozActual, elegirVoz, probarVoz,
  rate, pitch, setRate, setPitch,
  voiceQuality, onClose,
}) {
  const [abierto, setAbierto] = useState(false)

  if (voces.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        No detecté voces en español. Probá Chrome o Safari, o bajá voces desde
        Ajustes del sistema → Accesibilidad → Voz hablada.
      </div>
    )
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        className="chip bg-white border-slate-300 text-slate-700 hover:bg-slate-50 transition"
        title="Cambiar voz"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="inline -mt-0.5 mr-1">
          <path d="M12 2v20M5 8v8M19 8v8M2 11v2M22 11v2M8 5v14M16 5v14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        voz: <span className="font-semibold ml-1">{vozActual?.name || '—'}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className="inline ml-1">
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {abierto && (
        <>
          {/* Overlay para cerrar al hacer clic afuera */}
          <div
            className="fixed inset-0 z-30"
            onClick={() => setAbierto(false)}
          />
          <div className="absolute z-40 mt-2 w-[420px] max-w-[90vw] right-0 rounded-2xl border border-slate-200 bg-white shadow-soft p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
              Voces disponibles en español
            </div>

            <div className="max-h-64 overflow-y-auto space-y-1 mb-3 pr-1">
              {voces.map(v => {
                const q = qualityLabel(voiceQuality(v))
                const sel = vozActual?.voiceURI === v.voiceURI
                return (
                  <div
                    key={v.voiceURI}
                    className={`rounded-lg border px-2.5 py-2 flex items-center justify-between gap-2 transition ${
                      sel ? 'border-brand-400 bg-brand-50' : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-slate-900 truncate">{v.name}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                        <span>{v.lang}</span>
                        <span className={`chip text-[10px] py-0 px-1.5 ${q.cls}`}>{q.label}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => probarVoz(v)}
                        className="rounded-md border border-slate-300 bg-white hover:bg-slate-100 px-2 py-1 text-xs"
                        title="Probar esta voz"
                      >
                        ▶
                      </button>
                      <button
                        type="button"
                        onClick={() => { elegirVoz(v.voiceURI); setAbierto(false); onClose?.() }}
                        className={`rounded-md px-2 py-1 text-xs font-semibold border ${
                          sel
                            ? 'bg-brand-600 text-white border-brand-700'
                            : 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800'
                        }`}
                      >
                        {sel ? '✓ usando' : 'usar'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Sliders de rate/pitch */}
            <div className="border-t border-slate-200 pt-3 space-y-2">
              <label className="block text-xs text-slate-600">
                <div className="flex items-center justify-between mb-1">
                  <span>Velocidad</span>
                  <span className="font-mono text-[11px] text-slate-500">{rate.toFixed(2)}x</span>
                </div>
                <input
                  type="range" min="0.6" max="1.4" step="0.05"
                  value={rate}
                  onChange={(e) => setRate(parseFloat(e.target.value))}
                  className="w-full accent-brand-600"
                />
              </label>
              <label className="block text-xs text-slate-600">
                <div className="flex items-center justify-between mb-1">
                  <span>Tono</span>
                  <span className="font-mono text-[11px] text-slate-500">{pitch.toFixed(2)}</span>
                </div>
                <input
                  type="range" min="0.7" max="1.3" step="0.05"
                  value={pitch}
                  onChange={(e) => setPitch(parseFloat(e.target.value))}
                  className="w-full accent-brand-600"
                />
              </label>
            </div>

            <div className="mt-3 rounded-lg bg-slate-50 border border-slate-200 p-2.5 text-[11px] text-slate-600 leading-snug">
              <div className="font-semibold text-slate-700 mb-1">¿Voz robótica?</div>
              Buscá una con etiqueta <span className="chip text-[10px] py-0 px-1.5 bg-emerald-100 text-emerald-700 border-emerald-200">Premium</span>.
              Si no tenés, descargá voces neuronales en
              <span className="italic"> Ajustes del sistema → Accesibilidad → Contenido hablado → Voz del sistema → Administrar voces</span>.
              Probá «Diego (Premium)», «Lupe (Premium)» o «Mónica (Premium)».
            </div>
          </div>
        </>
      )}
    </div>
  )
}
