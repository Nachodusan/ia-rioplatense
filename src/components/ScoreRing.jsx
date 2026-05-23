export default function ScoreRing({ score = 0 }) {
  const radius = 50
  const circ = 2 * Math.PI * radius
  const offset = circ - (score / 100) * circ

  const color =
    score >= 80 ? '#10b981' :  // verde
    score >= 60 ? '#3578ff' :  // azul
    score >= 40 ? '#f59e0b' :  // ámbar
                  '#ef4444'    // rojo

  const etiqueta =
    score >= 80 ? 'Muy natural' :
    score >= 60 ? 'Aceptable' :
    score >= 40 ? 'Mejorable' :
                  'Poco rioplatense'

  return (
    <div className="flex items-center gap-5">
      <div className="relative">
        <svg width="120" height="120" viewBox="0 0 120 120" className="-rotate-90">
          <circle cx="60" cy="60" r={radius} stroke="#e2e8f0" strokeWidth="12" fill="none" />
          <circle
            cx="60" cy="60" r={radius}
            stroke={color}
            strokeWidth="12"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            className="ring-anim"
            style={{ '--ring-offset': offset }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-extrabold text-slate-900 leading-none">{score}</span>
          <span className="text-[10px] uppercase tracking-wider text-slate-500 mt-1">/ 100</span>
        </div>
      </div>
      <div>
        <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Naturalidad rioplatense</div>
        <div className="text-xl font-bold text-slate-900" style={{ color }}>{etiqueta}</div>
        <div className="muted mt-1 max-w-xs">Puntaje calculado a partir de errores detectados, registro y modismos.</div>
      </div>
    </div>
  )
}
