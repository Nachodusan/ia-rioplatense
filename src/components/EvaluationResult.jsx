import ScoreRing from './ScoreRing.jsx'

const colorPorCategoria = {
  'Voseo / Tuteo':            'bg-rose-50 text-rose-700 border-rose-200',
  'Conjugación voseante':     'bg-rose-50 text-rose-700 border-rose-200',
  'Inconsistencia voseo/tuteo':'bg-rose-50 text-rose-700 border-rose-200',
  'Léxico regional':          'bg-amber-50 text-amber-700 border-amber-200',
  'Falsos amigos':            'bg-orange-50 text-orange-700 border-orange-200',
  'Modismos':                 'bg-violet-50 text-violet-700 border-violet-200',
  'Falta de naturalidad':     'bg-sky-50 text-sky-700 border-sky-200',
  'Tono robótico':            'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
  'Registro inadecuado':      'bg-teal-50 text-teal-700 border-teal-200',
  'Precisión semántica':      'bg-slate-100 text-slate-700 border-slate-200',
}

export default function EvaluationResult({ resultado, valores }) {
  if (!resultado) {
    return (
      <div className="card p-6 sm:p-7 h-full flex flex-col justify-center items-center text-center">
        <div className="h-14 w-14 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M3 12a9 9 0 1 0 9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <h3 className="section-title">Esperando evaluación</h3>
        <p className="muted max-w-sm mt-1">Completá el formulario o cargá uno de los ejemplos del dataset para ver el análisis lingüístico.</p>
      </div>
    )
  }

  const { score, errores, respuestaSugerida, recomendacion, resumen } = resultado

  return (
    <div className="card p-6 sm:p-7 space-y-6">
      {/* Cabecera con puntaje */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-200">
        <ScoreRing score={score} />
        <div className="flex flex-col gap-1 text-sm">
          <div className="flex items-center gap-2">
            <span className="muted">Variante:</span>
            <span className="chip bg-brand-50 text-brand-700 border-brand-200">{valores.variante}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="muted">Tono esperado:</span>
            <span className="chip bg-accent-500/10 text-accent-600 border-accent-500/30">{valores.tono}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="muted">Errores detectados:</span>
            <span className="chip bg-slate-100 text-slate-700 border-slate-200">{resumen.totalErrores}</span>
          </div>
        </div>
      </div>

      {/* Errores */}
      <div>
        <h3 className="section-title mb-3">Errores detectados</h3>
        {errores.length === 0 ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            ¡Bárbaro! No se detectaron errores significativos. La respuesta suena natural en rioplatense.
          </div>
        ) : (
          <ul className="space-y-3">
            {errores.map((e, i) => (
              <li key={i} className="rounded-xl border border-slate-200 bg-white/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <span className={`chip ${colorPorCategoria[e.categoria] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                    {e.categoria}
                  </span>
                  <span className="muted">Severidad: <span className="font-semibold text-slate-700">{e.severidad}</span></span>
                </div>
                <div className="text-sm text-slate-900">
                  <span className="font-semibold">Fragmento: </span>
                  <span className="italic">«{e.fragmento}»</span>
                </div>
                <p className="text-sm text-slate-700 mt-1 leading-relaxed">
                  <span className="font-semibold text-slate-900">Explicación: </span>{e.explicacion}
                </p>
                {e.sugerencia && (
                  <p className="text-sm text-slate-700 mt-1">
                    <span className="font-semibold text-slate-900">Sugerencia: </span>
                    <span className="text-brand-700 font-medium">{e.sugerencia}</span>
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Respuesta sugerida */}
      <div>
        <h3 className="section-title mb-2">Respuesta corregida sugerida</h3>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
          {respuestaSugerida || '—'}
        </div>
        <p className="muted mt-2">
          Reescritura automática basada en las reglas detectadas. Para una versión más natural, un anotador humano puede refinarla.
        </p>
      </div>

      {/* Recomendación para el modelo */}
      <div>
        <h3 className="section-title mb-2">Recomendación para mejorar el modelo</h3>
        <div className="rounded-xl border border-brand-200 bg-brand-50/70 p-4 text-sm text-slate-800 leading-relaxed">
          {recomendacion}
        </div>
      </div>

      {/* Modismos detectados */}
      {resumen.modismosDetectados.length > 0 && (
        <div>
          <h3 className="section-title mb-2">Modismos rioplatenses detectados</h3>
          <div className="flex flex-wrap gap-2">
            {resumen.modismosDetectados.map(m => (
              <span key={m} className="chip bg-violet-50 text-violet-700 border-violet-200">{m}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
