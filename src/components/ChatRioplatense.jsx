import { useEffect, useRef, useState } from 'react'
import { useSpeech } from '../utils/useSpeech.js'
import { argentinizar } from '../utils/argentinizar.js'

const API_URL = 'http://localhost:8000'
// El system prompt + persona vive en el backend (GET /system_prompt).
// El frontend NO duplica el texto — solo manda mensajes user/assistant y deja
// que el server aplique la persona + RAG few-shot. Esto evita drift entre
// dos copias del prompt y permite tunear el tono sin recompilar el frontend.

// ============================================================================
// Subcomponentes visuales
// ============================================================================

function StatusDot({ status }) {
  const cfg = {
    online:  { color: 'bg-emerald-500', ring: 'bg-emerald-500/30', label: 'Online' },
    offline: { color: 'bg-rose-500',    ring: 'bg-rose-500/0',     label: 'Offline' },
    checking:{ color: 'bg-amber-400',   ring: 'bg-amber-400/30',   label: 'Verificando' },
  }[status]
  return (
    <span className="inline-flex items-center gap-2">
      <span className="relative inline-flex">
        <span className={`h-2 w-2 rounded-full ${cfg.color}`} />
        {status !== 'offline' && (
          <span className={`absolute inset-0 h-2 w-2 rounded-full ${cfg.ring} animate-ping`} />
        )}
      </span>
      <span className="text-[11px] font-medium text-ink-600">{cfg.label}</span>
    </span>
  )
}

function PillGroup({ options, value, onChange }) {
  return (
    <div className="pill-group">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`pill ${value === opt.value ? 'pill-active' : ''}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function Bubble({ role, content, timestamp }) {
  const isUser = role === 'user'
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} animate-fade-up`}>
      {/* Avatar */}
      <div className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-bold ${
        isUser
          ? 'bg-ink-900 text-white'
          : 'bg-gradient-to-br from-signal-600 to-accent-600 text-white'
      }`}>
        {isUser ? 'VOS' : 'IA'}
      </div>

      {/* Burbuja */}
      <div className={`max-w-[78%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'bg-ink-900 text-ivory-100 rounded-tr-sm'
            : 'bg-white border border-ink-100 text-ink-800 rounded-tl-sm shadow-soft'
        }`}>
          {content}
        </div>
        {timestamp && (
          <span className="text-[10px] text-ink-400 mt-1 font-mono">
            {timestamp}
          </span>
        )}
      </div>
    </div>
  )
}

function ThinkingBubble({ seconds }) {
  return (
    <div className="flex gap-3 flex-row animate-fade-up">
      <div className="relative shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-signal-600 to-accent-600 text-white flex items-center justify-center text-[11px] font-bold">
        IA
        <span className="absolute -inset-1 rounded-full bg-signal-400/20 animate-ping" />
      </div>
      <div className="flex items-center gap-3 max-w-[78%] rounded-2xl rounded-tl-sm px-4 py-3
                      bg-white border-2 border-signal-200
                      animate-pulse-soft">
        <span className="text-[14px] font-medium text-ink-800">Pensando</span>
        <span className="inline-flex gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-signal-600 animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="h-1.5 w-1.5 rounded-full bg-signal-600 animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="h-1.5 w-1.5 rounded-full bg-signal-600 animate-bounce" style={{ animationDelay: '300ms' }} />
        </span>
        <span className="text-[11px] text-ink-400 font-mono tabular-nums">
          {seconds}s
        </span>
      </div>
    </div>
  )
}

// ============================================================================
// Componente principal
// ============================================================================

export default function ChatRioplatense() {
  const [serverStatus, setServerStatus] = useState('checking')
  const [serverInfo, setServerInfo] = useState(null)
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '¡Che, qué hacés! Soy una IA argentina. Apretá el botón verde y hablame.', t: Date.now() },
  ])
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [thinkingSeconds, setThinkingSeconds] = useState(0)
  const scrollRef = useRef(null)

  const {
    escuchando, hablando, voiceEnabled,
    conversacionActiva,
    ttsAvailable, voces, voiceId,
    reconocimientoSoportado,
    escuchar, hablar, callar, probarVoz,
    elegirVoz,
    iniciarConversacion, detenerConversacion,
    setVoiceEnabled,
  } = useSpeech()

  // Timer de pensamiento
  useEffect(() => {
    if (!enviando) { setThinkingSeconds(0); return }
    setThinkingSeconds(0)
    const id = setInterval(() => setThinkingSeconds(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [enviando])

  // Health check del LLM
  useEffect(() => {
    let cancel = false
    async function ping() {
      try {
        const r = await fetch(`${API_URL}/health`)
        if (!r.ok) throw new Error()
        const data = await r.json()
        if (cancel) return
        setServerStatus('online')
        setServerInfo(data)
      } catch {
        if (cancel) return
        setServerStatus('offline')
      }
    }
    ping()
    const id = setInterval(ping, 8000)
    return () => { cancel = true; clearInterval(id) }
  }, [])

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, enviando])

  // Auto-leer respuestas
  const lastSpokenRef = useRef(null)
  useEffect(() => {
    if (!voiceEnabled) return
    const last = messages[messages.length - 1]
    if (!last || last.role !== 'assistant') return
    if (lastSpokenRef.current === last) return
    if (messages.length === 1) { lastSpokenRef.current = last; return }
    // Si el mensaje viene de streaming, las oraciones ya se hablaron una por una.
    // Este auto-speak es solo fallback para el path non-streaming (/chat clásico).
    if (last.streaming || last.sentencesSpoken) { lastSpokenRef.current = last; return }
    lastSpokenRef.current = last
    hablar(last.content)
  }, [messages, voiceEnabled, hablar])

  // Anti-eco
  const ultimaRespuestaIaRef = useRef('')
  useEffect(() => {
    const last = messages[messages.length - 1]
    if (last?.role === 'assistant' && messages.length > 1) {
      ultimaRespuestaIaRef.current = last.content
    }
  }, [messages])

  function normalize(s) {
    return (s || '').toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[.,!?¿¡;:()"]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3)
  }
  function esEcoDeIa(transcript) {
    const tw = normalize(transcript)
    const iw = normalize(ultimaRespuestaIaRef.current)
    if (tw.length === 0 || iw.length === 0) return false
    const setIa = new Set(iw)
    const matches = tw.filter(w => setIa.has(w)).length
    return matches >= 3 || (tw.length > 0 && matches / tw.length >= 0.5)
  }

  async function mandarTexto(texto) {
    if (!texto?.trim() || enviando) return
    callar()
    const userMsg = { role: 'user', content: texto.trim(), t: Date.now() }
    const assistantStub = { role: 'assistant', content: '', t: Date.now() + 1, streaming: true }
    const nuevos = [...messages, userMsg]
    setMessages([...nuevos, assistantStub])
    setEnviando(true)
    setError('')

    try {
      const historiaParaModelo = nuevos[0]?.role === 'assistant' ? nuevos.slice(1) : nuevos
      const body = {
        messages: historiaParaModelo,
        max_tokens: 90,
        temperature: 0.75,
        top_p: 0.92,
        repetition_penalty: 1.10,
        repetition_context_size: 40,
        use_system_prompt: true,
        use_rag: true,
      }
      // SSE streaming: el backend emite eventos `data: {"sentence": "..."}`
      // por cada oración terminada del LLM. Por cada oración:
      //   1. argentinizar el texto
      //   2. appendar al mensaje assistant en la UI
      //   3. encolar para hablar (la cola del TTS lo reproduce en orden)
      const r = await fetch(`${API_URL}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
        body: JSON.stringify(body),
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const reader = r.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let acumulado = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        // Parsear bloques SSE separados por \n\n
        let idx
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const raw = buffer.slice(0, idx); buffer = buffer.slice(idx + 2)
          const line = raw.split('\n').find(l => l.startsWith('data: '))
          if (!line) continue
          let evt
          try { evt = JSON.parse(line.slice(6)) } catch { continue }
          if (evt.sentence) {
            const sentenceArg = argentinizar(evt.sentence)
            acumulado = acumulado ? `${acumulado} ${sentenceArg}` : sentenceArg
            const finalAcum = acumulado
            setMessages(prev => {
              const copy = [...prev]
              const lastIdx = copy.length - 1
              if (copy[lastIdx]?.role === 'assistant') {
                copy[lastIdx] = { ...copy[lastIdx], content: finalAcum, streaming: true }
              }
              return copy
            })
            hablar(sentenceArg)
          } else if (evt.done) {
            const finalText = argentinizar(evt.full || acumulado)
            setMessages(prev => {
              const copy = [...prev]
              const lastIdx = copy.length - 1
              if (copy[lastIdx]?.role === 'assistant') {
                copy[lastIdx] = { ...copy[lastIdx], content: finalText, streaming: false, sentencesSpoken: true }
              }
              return copy
            })
          } else if (evt.error) {
            throw new Error(evt.error)
          }
        }
      }
    } catch (e) {
      console.error('SSE error:', e)
      setError('No pude conectarme con el modelo. Verificá que el server MLX esté arriba.')
      // Limpiar el stub vacío si hubo error
      setMessages(prev => {
        const copy = [...prev]
        const lastIdx = copy.length - 1
        if (copy[lastIdx]?.role === 'assistant' && !copy[lastIdx].content) {
          copy.pop()
        }
        return copy
      })
    } finally {
      setEnviando(false)
    }
  }

  const handleTranscript = useRef(null)
  handleTranscript.current = (texto) => {
    const limpio = texto.trim()
    if (limpio.length < 3) return
    if (esEcoDeIa(limpio)) {
      console.log('[anti-eco] descartado:', limpio)
      return
    }
    mandarTexto(limpio)
  }

  // Loop conversación continua con cooldown anti-eco
  useEffect(() => {
    if (!conversacionActiva) return
    if (enviando || hablando || escuchando) return
    if (serverStatus !== 'online') return
    const id = setTimeout(() => {
      escuchar((texto) => handleTranscript.current?.(texto))
    }, 1500)
    return () => clearTimeout(id)
  }, [conversacionActiva, enviando, hablando, escuchando, serverStatus, escuchar])

  function toggleConversacion() {
    if (conversacionActiva) detenerConversacion()
    else iniciarConversacion()
  }

  function limpiar() {
    detenerConversacion()
    setMessages([{ role: 'assistant', content: '¡Listo, arrancamos de cero!', t: Date.now() }])
    setError('')
  }

  function formatTime(ts) {
    if (!ts) return ''
    const d = new Date(ts)
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  }

  // Estado actual textual
  const estadoCfg =
    serverStatus !== 'online' ? { text: 'Conectando con el modelo', color: 'text-amber-700' }
    : escuchando ? { text: 'Te estoy escuchando', color: 'text-rose-700' }
    : enviando ? { text: 'Pensando la respuesta', color: 'text-signal-700' }
    : hablando ? { text: 'Hablando', color: 'text-accent-600' }
    : conversacionActiva ? { text: 'Esperando que hables', color: 'text-ink-500' }
    : { text: 'Tocá el botón para empezar', color: 'text-ink-500' }

  // Pill options for voice selector
  const voiceOptions = voces.map(v => ({
    value: v.id,
    label: v.label.split(' ')[0], // "Tomás" / "Elena"
  }))

  return (
    <section className="card overflow-hidden">
      {/* TOOLBAR */}
      <div className="px-5 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-ink-100">
        <div className="flex items-center gap-4">
          <StatusDot status={serverStatus} />
          {serverInfo?.adapter && (
            <span className="chip bg-ink-900 text-ivory-100 border-ink-900 font-mono text-[10px]">
              LoRA
            </span>
          )}
          {ttsAvailable && (
            <span className="chip bg-emerald-50 text-emerald-700 border-emerald-200">
              voz neuronal · es-AR Edge
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {ttsAvailable && voiceOptions.length > 0 && (
            <PillGroup
              options={voiceOptions}
              value={voiceId}
              onChange={(id) => { callar(); elegirVoz(id) }}
            />
          )}

          {ttsAvailable && (
            <button
              type="button"
              onClick={probarVoz}
              disabled={hablando}
              className="btn-icon"
              title="Probar la voz"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </button>
          )}

          <button
            type="button"
            onClick={() => { if (voiceEnabled) callar(); setVoiceEnabled(!voiceEnabled) }}
            className="btn-icon"
            title={voiceEnabled ? 'Silenciar' : 'Activar voz'}
          >
            {voiceEnabled ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M11 5L6 9H2v6h4l5 4V5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                <path d="M15.5 8.5a5 5 0 0 1 0 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M11 5L6 9H2v6h4l5 4V5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                <path d="M22 9l-6 6M16 9l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            )}
          </button>

          <button
            type="button"
            onClick={limpiar}
            className="btn-icon"
            title="Limpiar conversación"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m-9 4v8m4-8v8m-9-12l1.5 14a2 2 0 0 0 2 1.5h7a2 2 0 0 0 2-1.5L19 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* HISTORIAL */}
      <div
        ref={scrollRef}
        className="h-[460px] overflow-y-auto px-5 sm:px-6 py-5 space-y-4
                   bg-gradient-to-b from-ivory-50/50 to-white"
      >
        {messages.map((m, i) => (
          <Bubble key={i} role={m.role} content={m.content} timestamp={formatTime(m.t)} />
        ))}
        {enviando && <ThinkingBubble seconds={thinkingSeconds} />}
      </div>

      {/* ERROR */}
      {error && (
        <div className="mx-5 sm:mx-6 mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* CONTROL */}
      <div className="px-5 sm:px-6 py-6 border-t border-ink-100 bg-ivory-50/30">
        <div className="flex flex-col items-center gap-4">
          {/* Status text */}
          <div className={`text-sm font-medium ${estadoCfg.color} flex items-center gap-2 min-h-[20px]`}>
            {(escuchando || hablando) && (
              <span className="relative inline-flex">
                <span className="h-2 w-2 rounded-full bg-current animate-ping absolute" />
                <span className="h-2 w-2 rounded-full bg-current relative" />
              </span>
            )}
            {estadoCfg.text}
          </div>

          {/* Botón gigante */}
          {!reconocimientoSoportado ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 text-center max-w-md">
              Tu navegador no soporta reconocimiento de voz. Probá Chrome, Edge o Safari.
            </div>
          ) : (
            <button
              type="button"
              onClick={toggleConversacion}
              disabled={serverStatus !== 'online'}
              className={`
                relative w-28 h-28 sm:w-32 sm:h-32 rounded-full
                flex items-center justify-center
                transition-all duration-300 select-none
                disabled:opacity-40 disabled:cursor-not-allowed
                ${conversacionActiva
                  ? escuchando
                    ? 'bg-gradient-to-br from-rose-500 to-pink-600 text-white scale-105'
                    : enviando
                      ? 'bg-gradient-to-br from-signal-500 to-signal-700 text-white'
                      : hablando
                        ? 'bg-gradient-to-br from-accent-500 to-purple-700 text-white'
                        : 'bg-gradient-to-br from-amber-500 to-orange-600 text-white'
                  : 'bg-gradient-to-br from-signal-600 to-signal-800 text-white hover:scale-105 active:scale-100 animate-button-pulse'
                }
              `}
              title={conversacionActiva ? 'Detener conversación' : 'Iniciar conversación'}
            >
              {/* Ondas mientras escucha */}
              {escuchando && (
                <>
                  <span className="absolute inset-0 rounded-full bg-rose-400 animate-wave" />
                  <span className="absolute inset-0 rounded-full bg-rose-300 animate-wave-delay" />
                </>
              )}

              {/* Glow estático */}
              <span className={`absolute inset-0 rounded-full ${
                conversacionActiva ? '' : 'shadow-glow'
              }`} />

              {/* Ícono */}
              {conversacionActiva ? (
                <svg width="38" height="38" viewBox="0 0 24 24" fill="currentColor" className="relative z-10">
                  <rect x="6" y="6" width="12" height="12" rx="2"/>
                </svg>
              ) : (
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" className="relative z-10">
                  <rect x="9" y="2" width="6" height="12" rx="3" stroke="currentColor" strokeWidth="2"/>
                  <path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              )}
            </button>
          )}

          {/* Label del botón */}
          {reconocimientoSoportado && (
            <div className="text-center">
              <div className="text-[15px] font-semibold tracking-tight text-ink-900">
                {conversacionActiva ? 'Detener' : 'Iniciar conversación'}
              </div>
              <div className="text-[12px] text-ink-500 mt-0.5">
                {conversacionActiva
                  ? 'Apretá para terminar'
                  : 'Hablale en argento y te contesta'}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
