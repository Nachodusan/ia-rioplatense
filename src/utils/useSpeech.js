import { useCallback, useEffect, useRef, useState } from 'react'

// ============================================================================
// Hook de voz simplificado — solo Piper (Daniela es-AR).
//
// Reconocimiento: Web Speech API del navegador.
// Síntesis: TTS local con Piper (~3x tiempo real, TTFB <1s).
//
// Cola de oraciones: cuando el chat SSE entrega oraciones del LLM una por una,
// se encolan acá y se reproducen secuencialmente sin pisarse.
// ============================================================================

const RECOG_LANG = 'es-AR'
const TTS_URL = 'http://localhost:8001'

export function useSpeech() {
  const [escuchando, setEscuchando] = useState(false)
  const [hablando, setHablando] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [conversacionActiva, setConversacionActiva] = useState(false)

  const [ttsAvailable, setTtsAvailable] = useState(false)
  const [voces, setVoces] = useState([])

  const recognitionRef = useRef(null)
  const onResultRef = useRef(null)
  const audioRef = useRef(null)
  const abortRef = useRef(null)
  const queueRef = useRef([])
  const processingRef = useRef(false)

  const SpeechRecognition =
    typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition)
  const reconocimientoSoportado = !!SpeechRecognition

  // Voz fija — solo daniela
  const voiceId = 'daniela'

  // ---- Reconocimiento ----
  useEffect(() => {
    if (!SpeechRecognition) return
    const r = new SpeechRecognition()
    r.lang = RECOG_LANG
    r.interimResults = false
    r.maxAlternatives = 1
    r.continuous = false
    r.onresult = (event) => {
      const text = event.results[0]?.[0]?.transcript ?? ''
      if (text && onResultRef.current) onResultRef.current(text)
    }
    r.onend = () => setEscuchando(false)
    r.onerror = () => setEscuchando(false)
    recognitionRef.current = r
    return () => { try { r.abort() } catch {} }
  }, [SpeechRecognition])

  const escuchar = useCallback((onResult) => {
    if (!recognitionRef.current || escuchando) return
    onResultRef.current = onResult
    try {
      recognitionRef.current.start()
      setEscuchando(true)
    } catch {
      try { recognitionRef.current.abort() } catch {}
      setEscuchando(false)
    }
  }, [escuchando])

  const dejarEscuchar = useCallback(() => {
    if (!recognitionRef.current) return
    try { recognitionRef.current.stop() } catch {}
    setEscuchando(false)
  }, [])

  // ---- Polling del TTS server ----
  useEffect(() => {
    let cancel = false
    async function ping() {
      try {
        const r = await fetch(`${TTS_URL}/health`, { signal: AbortSignal.timeout(2000) })
        if (!r.ok) throw new Error()
        const data = await r.json()
        if (cancel) return
        setTtsAvailable(true)
        setVoces(data.voices || [])
      } catch {
        if (cancel) return
        setTtsAvailable(false)
        setVoces([])
      }
    }
    ping()
    const id = setInterval(ping, 10000)
    return () => { cancel = true; clearInterval(id) }
  }, [])

  // No-op para mantener API (el frontend antes ofrecía cambiar voz)
  const elegirVoz = useCallback(() => {}, [])

  // ---- Síntesis: POST blob, simple y rápido ----
  const _speakOne = useCallback(async (texto) => {
    const ac = new AbortController()
    abortRef.current = ac
    let audioObjectUrl = null
    try {
      const r = await fetch(`${TTS_URL}/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: texto, voice: voiceId, language: 'es' }),
        signal: ac.signal,
      })
      if (!r.ok) throw new Error(`TTS ${r.status}`)
      const blob = await r.blob()
      if (ac.signal.aborted) return
      audioObjectUrl = URL.createObjectURL(blob)
      const audio = new Audio(audioObjectUrl)
      audioRef.current = audio
      await new Promise((resolve) => {
        audio.onended = resolve
        audio.onerror = resolve
        audio.play().catch(resolve)
      })
    } finally {
      if (abortRef.current === ac) abortRef.current = null
      if (audioRef.current && audioRef.current.src === audioObjectUrl) audioRef.current = null
      if (audioObjectUrl) { try { URL.revokeObjectURL(audioObjectUrl) } catch {} }
    }
  }, [])

  const _processQueue = useCallback(async () => {
    if (processingRef.current) return
    processingRef.current = true
    setHablando(true)
    try {
      while (queueRef.current.length > 0) {
        const next = queueRef.current.shift()
        try {
          await _speakOne(next)
        } catch (e) {
          if (e?.name !== 'AbortError') console.error('Error TTS:', e)
        }
      }
    } finally {
      processingRef.current = false
      setHablando(false)
    }
  }, [_speakOne])

  // API pública: encola un texto y dispara el procesador en background.
  const hablar = useCallback((texto) => {
    if (!voiceEnabled || !texto || !ttsAvailable) return
    queueRef.current.push(texto)
    _processQueue()
  }, [voiceEnabled, ttsAvailable, _processQueue])

  const callar = useCallback(() => {
    queueRef.current = []
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    if (abortRef.current) { try { abortRef.current.abort() } catch {}; abortRef.current = null }
    setHablando(false)
  }, [])

  const probarVoz = useCallback(async () => {
    queueRef.current = []
    queueRef.current.push('Hola che, soy Daniela. ¿Cómo andás?')
    _processQueue()
  }, [_processQueue])

  // ---- Conversación continua ----
  const iniciarConversacion = useCallback(() => setConversacionActiva(true), [])
  const detenerConversacion = useCallback(() => {
    setConversacionActiva(false)
    if (recognitionRef.current) { try { recognitionRef.current.abort() } catch {} }
    setEscuchando(false)
    callar()
  }, [callar])

  useEffect(() => () => {
    if (audioRef.current) audioRef.current.pause()
    if (abortRef.current) { try { abortRef.current.abort() } catch {} }
  }, [])

  return {
    escuchando, hablando, voiceEnabled,
    conversacionActiva,
    ttsAvailable, voces, voiceId,
    reconocimientoSoportado,
    escuchar, dejarEscuchar,
    hablar, callar, probarVoz,
    elegirVoz,
    iniciarConversacion, detenerConversacion,
    setVoiceEnabled,
  }
}
