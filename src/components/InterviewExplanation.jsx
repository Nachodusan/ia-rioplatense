export default function InterviewExplanation() {
  return (
    <section className="card p-6 sm:p-7">
      <div className="flex items-center gap-3 mb-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 text-white flex items-center justify-center font-extrabold">EN</div>
        <h2 className="section-title">Cómo explicaría este proyecto en una entrevista</h2>
      </div>

      <div className="prose prose-slate max-w-none text-sm leading-relaxed text-slate-700 space-y-3">
        <p>
          <span className="font-semibold text-slate-900">Resumen ejecutivo. </span>
          Este proyecto es un evaluador automatizado de español rioplatense para respuestas generadas por modelos
          de lenguaje. Recibe un prompt, la respuesta del modelo, una variante regional (Argentina, Uruguay o
          rioplatense general) y un tono esperado, y devuelve un puntaje de naturalidad, los errores detectados,
          una respuesta corregida y recomendaciones concretas para el equipo de entrenamiento.
        </p>

        <p>
          <span className="font-semibold text-slate-900">Motivación. </span>
          Los LLMs tienden a producir un español neutro o ibérico por defecto. Para un usuario rioplatense, frases
          como «¿tú quieres reservar una cita?» suenan ajenas y rompen la confianza. Como formador de IA, mi
          trabajo es identificar estas brechas con precisión lingüística y traducirlas en señales accionables
          para el modelo (datos de entrenamiento, ejemplos contrastivos, criterios de RLHF).
        </p>

        <p>
          <span className="font-semibold text-slate-900">Cómo funciona. </span>
          La app combina reglas heurísticas (voseo vs. tuteo, léxico regional, falsos amigos, frases prefabricadas
          de IA) con análisis de registro: dado el tono esperado, evalúa si la respuesta usa modismos coherentes
          o, al contrario, los usa en contextos formales donde no corresponden. El puntaje pondera severidad y
          contexto, y el módulo de sugerencias propone reescrituras automáticas.
        </p>

        <p>
          <span className="font-semibold text-slate-900">Qué aporta al modelo. </span>
          Cada evaluación termina con una recomendación accionable: ampliar el corpus voseante, reforzar el
          diccionario léxico Argentina/Uruguay, reducir frases robóticas mediante RLHF con anotadores locales o
          mejorar el control de registro. Es exactamente el tipo de retroalimentación que un equipo de fine-tuning
          puede convertir en datasets o en criterios de evaluación.
        </p>

        <p>
          <span className="font-semibold text-slate-900">Por qué lo construí. </span>
          Quería mostrar de forma tangible cómo pienso el rol de formador en IA: no se trata sólo de corregir
          oraciones, sino de diseñar un sistema de evaluación reproducible, con categorías claras y trazables, que
          pueda escalar al trabajo de un equipo de anotadores. Esta demo es una primera versión basada en reglas;
          en producción la combinaría con evaluaciones LLM-as-a-judge y revisión humana experta.
        </p>
      </div>

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { titulo: 'Lingüística aplicada', detalle: 'Voseo, léxico regional, registro y pragmática del Río de la Plata.' },
          { titulo: 'Pensamiento de producto', detalle: 'Interfaz simple, dataset reutilizable y output accionable.' },
          { titulo: 'Mentalidad de formador', detalle: 'Errores categorizados y recomendaciones para el equipo de modelo.' },
        ].map(b => (
          <div key={b.titulo} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-brand-700">{b.titulo}</div>
            <div className="text-sm text-slate-700 mt-1">{b.detalle}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
