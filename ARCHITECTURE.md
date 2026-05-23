# Arquitectura

## Flujo end-to-end (un turno de conversación)

```
┌─────────────┐                                                              
│   USUARIO   │  "Necesito sacar el DNI"                                     
└──────┬──────┘                                                              
       │ 1. Habla por micrófono                                              
       ▼                                                                     
┌──────────────────────────────────────────────────────────────────────┐    
│  FRONTEND (React, :5173)                                              │    
│                                                                       │    
│  ┌────────────────────────┐                                          │    
│  │ Web Speech API (es-AR) │  → transcript                           │    
│  └────────────────────────┘                                          │    
│           │                                                          │    
│           ▼                                                          │    
│  ┌────────────────────────┐                                          │    
│  │ Anti-eco filter        │  ← descarta si overlap con última       │    
│  │ (palabras > 3 chars)   │     respuesta IA                         │    
│  └────────────────────────┘                                          │    
│           │ 2. POST /chat/stream                                     │    
└───────────┼──────────────────────────────────────────────────────────┘    
            ▼                                                                
┌──────────────────────────────────────────────────────────────────────┐    
│  LLM SERVER (FastAPI + mlx-lm, :8000)                                │    
│                                                                       │    
│  ┌────────────────────────────────────────────────────┐              │    
│  │ _prepare_chat_prompt()                              │              │    
│  │   • persona prompt (fijo, ~100 palabras)            │              │    
│  │   • RAG retrieval (BM25 sobre 319 ejemplos)         │  → 3 ejs    │    
│  │   • mensajes user/assistant del historial           │              │    
│  └────────────────────────────────────────────────────┘              │    
│           │                                                          │    
│           ▼                                                          │    
│  ┌────────────────────────────────────────────────────┐              │    
│  │ mlx_lm.stream_generate()                           │              │    
│  │   Llama 3.1 8B Instruct 4-bit (Apple Metal)        │              │    
│  └────────────────────────────────────────────────────┘              │    
│           │                                                          │    
│           ▼                                                          │    
│  ┌────────────────────────────────────────────────────┐              │    
│  │ Sentence splitter (regex en . ? !)                 │              │    
│  │ Emite SSE: data: {"sentence": "Joya, ..."}        │              │    
│  └────────────────────────────────────────────────────┘              │    
│           │ 3. Server-Sent Events                                    │    
└───────────┼──────────────────────────────────────────────────────────┘    
            ▼                                                                
┌──────────────────────────────────────────────────────────────────────┐    
│  FRONTEND — handler SSE                                              │    
│                                                                       │    
│  Por cada `sentence` recibida:                                       │    
│   4a. argentinizar(sentence)  ← 150+ reglas regex contextuales      │    
│   4b. appendear al mensaje assistant (UI ve texto progresivo)        │    
│   4c. useSpeech.hablar(sentence)  ← encola para TTS secuencial      │    
└───────────────────────────────────────────────┬──────────────────────┘    
                                                │ 5. POST /speak                
                                                ▼                                
                          ┌─────────────────────────────────────────┐         
                          │  TTS SERVER (FastAPI + Piper, :8001)    │         
                          │                                         │         
                          │  ┌──────────────────────────────────┐  │         
                          │  │ normalize_text()                  │  │         
                          │  │   • espaciado puntuación          │  │         
                          │  └──────────────────────────────────┘  │         
                          │           │                            │         
                          │           ▼                            │         
                          │  ┌──────────────────────────────────┐  │         
                          │  │ PiperVoice.synthesize_wav()      │  │         
                          │  │   es_AR-daniela-high (ONNX, CPU) │  │         
                          │  │   Output: WAV 22kHz mono         │  │         
                          │  └──────────────────────────────────┘  │         
                          │           │                            │         
                          │           ▼                            │         
                          │  ┌──────────────────────────────────┐  │         
                          │  │ ffmpeg mastering (subprocess)    │  │         
                          │  │   highpass + EQ 4-band +         │  │         
                          │  │   compressor + dynaudnorm        │  │         
                          │  │   Output: MP3 192kbps            │  │         
                          │  └──────────────────────────────────┘  │         
                          └────────────────┬────────────────────────┘         
                                           │ 6. audio/mpeg blob               
                                           ▼                                  
                          ┌──────────────────────────────────────┐           
                          │  FRONTEND — cola TTS                 │           
                          │  • blob → URL.createObjectURL        │           
                          │  • new Audio(url).play()             │           
                          │  • al onended → próxima en cola      │           
                          └──────────────────────────────────────┘           
                                           │                                  
                                           ▼                                  
                                       USUARIO escucha                       
```

---

## Componentes

### Frontend (`src/`)

| Archivo | Responsabilidad |
|---|---|
| `App.jsx` | Layout, header, footer, cards de stats |
| `components/ChatRioplatense.jsx` | Estado del chat, SSE handler, anti-eco, lifecycle |
| `components/VoiceSettings.jsx` | UI del selector de voces (simplificado a 1 voz) |
| `utils/useSpeech.js` | Hook: Web Speech API + cola TTS + AbortController |
| `utils/argentinizar.js` | Aplica reglas del léxico al output del LLM |
| `utils/lexico-rioplatense.js` | Tabla de 150+ reemplazos regex (fuente de verdad) |
| `utils/evaluator.js` | Score de calidad lingüística (no usado en runtime, util para eval) |

### LLM Server (`ai-training/scripts/`)

| Archivo | Responsabilidad |
|---|---|
| `serve.py` | FastAPI con endpoints `/health`, `/chat`, `/chat/stream` |
| `retriever.py` | Carga `train.jsonl` y expone `retrieve(query, k=3)` con BM25 |
| `eval_harness.py` | Benchmarking A/B sobre 50 prompts curados |

### TTS Server (`tts_server/`)

| Archivo | Responsabilidad |
|---|---|
| `serve.py` | FastAPI con `/health` y `/speak`. Piper + ffmpeg en subprocess |
| `piper_voices/` | Modelos ONNX descargados (no en git, ver setup.sh) |

---

## Decisiones de diseño relevantes

### Por qué los 3 servers separados (LLM 8000, TTS 8001, Frontend 5173)

- **Aislamiento de fallos**: si XTTS o Piper crashean por OOM, el LLM sigue funcionando.
- **Restart independiente**: cambiar prompt → restart LLM solo (3s) vs todo el stack (15s).
- **CORS dev-friendly**: cada server abre solo `localhost:*` regex, sin overhead.

### Por qué SSE (no WebSocket)

- **One-way streaming**: el frontend solo necesita recibir del LLM, no enviar mid-stream.
- **HTTP semantics**: re-uso de auth, CORS, proxy, etc.
- **Trivial implementación**: `StreamingResponse` en FastAPI nativo.

### Por qué cola de oraciones (no streaming MSE)

Probado, descartado. Cada `MediaSource` paga su propio TTFB de TTS al inicio → gaps audibles entre oraciones. Con Piper que genera en <1s, una cola simple de `<audio>` POST+blob da mejor UX que la complejidad de MSE.

### Por qué Web Speech API nativa (no Whisper local)

- es-AR built-in en Chrome/Safari.
- Cero infra adicional.
- Latencia ~instantánea (post-procesa en el browser).
- Trade-off: no funciona offline, no funciona en Firefox bien. Para un demo de Mac, suficiente.

---

## Manejo de memoria en Apple Silicon

Mac M4 16 GB unified memory. Carga simultánea:

| Componente | Memoria | Notas |
|---|---|---|
| Llama 3.1 8B 4-bit (MLX) | ~4.5 GB | Reside en GPU/CPU shared |
| Llama KV cache | ~0.5 GB | Crece con contexto |
| Piper Daniela (ONNX) | ~120 MB | CPU only, muy chico |
| Frontend (browser) | ~200 MB | Chrome + React tree |
| FastAPI overhead | ~100 MB × 2 | servers Python |
| **Total** | **~5.7 GB** | Cómodo en 16 GB |

Sin XTTS-v2 (que ocupaba 2 GB extra cuando estaba) ahora hay margen para subir contexto del LLM o agregar features.
