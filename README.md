# IA Rioplatense 🇦🇷

> **Un LLM open-source que habla, escucha y entiende como un porteño — todo corriendo local en Apple Silicon.**

Un chat por voz con persona porteña construida sobre **Llama 3.1 8B**, con **RAG sobre 319 ejemplos curados**, **TTS local con voz argentina nativa** y un **post-procesador léxico** que asegura voseo + vocabulario rioplatense en runtime.

![demo](docs/demo.gif)

---

## Por qué este proyecto

Los LLMs generalistas (incluso los grandes) hablan español "neutro" o ibérico por defecto. "Tú tienes que ir", "vale", "el ordenador", "coger el bus" — todo eso suena extraño en el Río de la Plata.

**Objetivo**: una IA conversacional que suene auténticamente porteña — voseo, modismos, registro coloquial — sin sacrificar coherencia ni velocidad, y sin depender de APIs cloud.

---

## Resultados

| Métrica | Valor |
|---|---|
| **Modelo base** | Llama 3.1 8B Instruct (4-bit, MLX) |
| **Voz** | Piper TTS · `es_AR-daniela-high` (local, ONNX) |
| **Latencia LLM** | 3-6s por respuesta (Apple Silicon M4) |
| **Latencia TTS (TTFB)** | ~0.9s |
| **RAG corpus** | 319 ejemplos curados, retrieval BM25 |
| **Cobertura léxica runtime** | 150+ reglas regex contextuales |
| **Memoria runtime** | ~6 GB (LLM + TTS + frontend) |
| **Costo de API** | $0 — todo local |

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND (React + Vite, :5173)                             │
│  • Web Speech API (es-AR) para entrada por micrófono        │
│  • SSE streaming del LLM (texto progresivo)                 │
│  • Argentinizador runtime (150+ reglas)                     │
└──────────┬──────────────────────────────────────┬───────────┘
           │ POST /chat/stream                    │ POST /speak
           ▼                                      ▼
┌──────────────────────────────┐    ┌────────────────────────┐
│  LLM SERVER (:8000)          │    │  TTS SERVER (:8001)    │
│  FastAPI + mlx-lm            │    │  FastAPI + Piper       │
│                              │    │                        │
│  • Llama 3.1 8B 4-bit        │    │  • es_AR-daniela-high  │
│  • Persona "porteño" prompt  │    │  • ffmpeg mastering    │
│  • RAG (BM25 sobre 319 ejs)  │    │  • Output: MP3 192kbps │
│  • Stream por oración (SSE)  │    │                        │
└──────────────────────────────┘    └────────────────────────┘
```

Ver [ARCHITECTURE.md](ARCHITECTURE.md) para flujo de datos detallado.

---

## Decisiones técnicas (lo que más vale leer)

Este proyecto pasó por **3 iteraciones de fine-tuning fallidas** antes de llegar a la solución actual. Cada decisión está documentada con su trade-off real:

- **Por qué descarté LoRA fine-tuning** (3 rondas, val loss bajó de 1.06 → 0.33 pero la calidad lingüística **empeoró**)
- **Por qué reemplacé XTTS-v2 por Piper TTS** (6x speedup, voz argentina nativa, sin sacrificar entendibilidad)
- **Por qué RAG con BM25 y no embeddings** (319 ejemplos = overkill para vector DB)
- **Por qué el argentinizador runtime es la red de seguridad correcta** (cubre alucinaciones léxicas del LLM sin re-entrenar)

→ [DECISIONES.md](DECISIONES.md) — bitácora honesta del proceso, con métricas

---

## Stack

| Capa | Tech | Por qué |
|---|---|---|
| **Frontend** | React 18 + Vite + Tailwind | DX rápido, HMR, bundle chico |
| **STT** | Web Speech API nativa | Sin server, sin API key, es-AR built-in |
| **LLM** | Llama 3.1 8B Instruct 4-bit via [MLX-LM](https://github.com/ml-explore/mlx) | Mejor español OOB que Mistral, optimizado para Apple Silicon |
| **RAG** | `rank_bm25` (Python puro) | Cero infra extra, perfecto para 319 ejs |
| **TTS** | [Piper TTS](https://github.com/rhasspy/piper) | Voz argentina nativa, 3x tiempo real en CPU |
| **Mastering audio** | ffmpeg (highpass + EQ + compresor + dynaudnorm) | Calidez vocal en MP3 192kbps |
| **Servers** | FastAPI + Uvicorn | Async, SSE nativo, contratos claros |
| **Léxico runtime** | Tabla de reemplazos regex contextuales | Red de seguridad anti-drift del modelo |

---

## Requisitos

- **Mac Apple Silicon** (M1+ con 16 GB unified memory recomendado)
- **Python 3.11+** y **Node 18+**
- **ffmpeg** (`brew install ffmpeg`)
- **~5 GB de disco** para el modelo Llama (descarga única)

> **Nota**: el proyecto fue diseñado para Apple Silicon (MLX usa Metal). Funciona en Mac Intel/Linux/Windows con cambios en el LLM serve (ej: usar `llama.cpp` en vez de mlx-lm) — el resto del stack (Piper, React, etc.) es multiplataforma.

---

## Cómo correrlo

```bash
git clone https://github.com/Nachodusan/ia-rioplatense.git
cd ia-rioplatense
./setup.sh         # instala deps + descarga modelos (~5 GB, una vez)
./run.sh           # arranca los 3 servers en paralelo
# → abrir http://localhost:5173
```

Ver [SETUP.md](SETUP.md) si querés correr cada server manual o tunear configuraciones.

---

## Estructura

```
ia-rioplatense/
├── src/                     # Frontend React
│   ├── components/          # ChatRioplatense, VoiceSettings
│   └── utils/               # useSpeech, argentinizar, lexico-rioplatense
├── ai-training/             # Backend LLM
│   ├── scripts/
│   │   ├── serve.py         # FastAPI + Llama 3.1 + RAG
│   │   ├── retriever.py     # BM25 sobre train.jsonl
│   │   └── eval_harness.py  # 50 prompts de eval A/B
│   └── data/train.jsonl     # 319 ejemplos curados (RAG corpus)
├── tts_server/              # Backend TTS
│   └── serve.py             # FastAPI + Piper + ffmpeg mastering
├── ARCHITECTURE.md          # Diagrama y flujo de datos
├── DECISIONES.md            # Bitácora de las decisiones técnicas
└── setup.sh                 # Bootstrap completo
```

---

## Demo

- 🎥 **Video demo**: [link a Loom/YouTube] *(2 min, muestra chat por voz + decisiones)*
- 📊 **Métricas medidas**: [latencias y benchmarks](DECISIONES.md#mediciones)

---

## Autor

**Ignacio Duque** (Nachodusan)
[LinkedIn](https://linkedin.com/in/...) · [Portfolio](https://...)

Proyecto construido como showcase técnico para postulación a empresa de IA conversacional.

---

## Licencia

MIT — ver [LICENSE](LICENSE)
