import { useState } from 'react'

const VARIANTES = ['Argentina', 'Uruguay', 'rioplatense general']
const TONOS = ['formal', 'informal', 'laboral', 'técnico', 'cotidiano']

export default function EvaluationForm({ valores, onChange, onEvaluar, onLimpiar, evaluando }) {
  const [errorLocal, setErrorLocal] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    if (!valores.prompt.trim() || !valores.respuesta.trim()) {
      setErrorLocal('Completá el prompt y la respuesta del modelo antes de evaluar.')
      return
    }
    setErrorLocal('')
    onEvaluar()
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6 sm:p-7 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="section-title">Entrada de evaluación</h2>
        <span className="muted">Ingresá el prompt y la respuesta a analizar</span>
      </div>

      <div>
        <label className="label">Prompt del usuario</label>
        <textarea
          className="textarea"
          placeholder="Ej.: Saludá a un cliente y ofrecele ayuda para sacar un turno médico."
          value={valores.prompt}
          onChange={(e) => onChange({ ...valores, prompt: e.target.value })}
        />
      </div>

      <div>
        <label className="label">Respuesta del modelo</label>
        <textarea
          className="textarea min-h-[140px]"
          placeholder="Ej.: Hola, ¿cómo estás? Si tú deseas, puedo ayudarte a reservar una cita con el doctor."
          value={valores.respuesta}
          onChange={(e) => onChange({ ...valores, respuesta: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Variante</label>
          <select
            className="select"
            value={valores.variante}
            onChange={(e) => onChange({ ...valores, variante: e.target.value })}
          >
            {VARIANTES.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Tono esperado</label>
          <select
            className="select"
            value={valores.tono}
            onChange={(e) => onChange({ ...valores, tono: e.target.value })}
          >
            {TONOS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {errorLocal && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorLocal}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button type="submit" className="btn-primary" disabled={evaluando}>
          {evaluando ? (
            <>
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity=".25" strokeWidth="4"/>
                <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
              </svg>
              Evaluando…
            </>
          ) : (
            <>
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                <path d="M5 12l4 4L19 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Evaluar respuesta
            </>
          )}
        </button>
        <button type="button" onClick={onLimpiar} className="btn-ghost">
          Limpiar
        </button>
      </div>
    </form>
  )
}
