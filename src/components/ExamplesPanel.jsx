import { useState } from 'react'

export default function ExamplesPanel({ ejemplos, onCargar }) {
  const [expandidoId, setExpandidoId] = useState(null)

  return (
    <section className="card p-6 sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h2 className="section-title">Dataset de evaluación lingüística</h2>
          <p className="muted">10 ejemplos curados de respuestas de IA con errores rioplatenses. Hacé clic en «Cargar» para evaluarlos.</p>
        </div>
        <span className="chip bg-slate-100 text-slate-700 border-slate-200">{ejemplos.length} ejemplos</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ejemplos.map(ej => {
          const expandido = expandidoId === ej.id
          return (
            <article key={ej.id} className="rounded-2xl border border-slate-200 bg-white/70 p-4 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold tracking-wider text-brand-700 uppercase">#{String(ej.id).padStart(2, '0')}</span>
                <div className="flex gap-1.5">
                  <span className="chip bg-brand-50 text-brand-700 border-brand-200">{ej.variante}</span>
                  <span className="chip bg-accent-500/10 text-accent-600 border-accent-500/30">{ej.tono}</span>
                </div>
              </div>

              <h3 className="text-sm font-semibold text-slate-900 leading-snug">{ej.prompt}</h3>

              <div className="mt-3 text-sm text-slate-700">
                <span className="font-semibold text-slate-900">Respuesta del modelo: </span>
                <span className="italic">«{ej.respuesta_modelo}»</span>
              </div>

              {expandido && (
                <div className="mt-3 space-y-2 text-sm">
                  <div>
                    <span className="chip bg-rose-50 text-rose-700 border-rose-200">{ej.categoria}</span>
                  </div>
                  <p><span className="font-semibold text-slate-900">Error: </span>{ej.error_detectado}</p>
                  <p><span className="font-semibold text-slate-900">Explicación: </span>{ej.explicacion}</p>
                  <p><span className="font-semibold text-slate-900">Respuesta correcta: </span><span className="text-emerald-700">«{ej.respuesta_correcta}»</span></p>
                </div>
              )}

              <div className="mt-4 flex items-center gap-2">
                <button onClick={() => onCargar(ej)} className="btn-primary text-xs px-3 py-2">
                  Cargar y evaluar
                </button>
                <button onClick={() => setExpandidoId(expandido ? null : ej.id)} className="btn-ghost text-xs px-3 py-2">
                  {expandido ? 'Ocultar análisis' : 'Ver análisis esperado'}
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
