# IA Rioplatense 🇦🇷

> [Versión en español](README.es.md)

> **An open-source LLM that talks, listens and thinks like someone from Buenos
> Aires — running entirely local on Apple Silicon.**

A voice chat with a *porteño* persona built on **Llama 3.1 8B**, with **RAG over
319 curated examples**, **local TTS in a native Argentine voice**, and a **lexical
post-processor** that enforces *voseo* and Rioplatense vocabulary at runtime.

![demo](docs/demo.gif)

## Why

General-purpose LLMs — even the large ones — default to "neutral" or Iberian
Spanish. *"Tú tienes que ir"*, *"vale"*, *"el ordenador"*, *"coger el bus"*: all
of it sounds wrong in the Río de la Plata.

**Goal**: a conversational AI that sounds authentically *porteño* — voseo, local
idiom, colloquial register — without losing coherence or speed, and without
depending on any cloud API.

## Results

| Metric | Value |
|---|---|
| **Base model** | Llama 3.1 8B Instruct (4-bit, MLX) |
| **Voice** | Piper TTS · `es_AR-daniela-high` (local, ONNX) |
| **LLM latency** | 3–6 s per response (Apple Silicon M4) |
| **TTS latency (TTFB)** | ~0.9 s |
| **RAG corpus** | 319 curated examples, BM25 retrieval |
| **Runtime lexical coverage** | 150+ contextual regex rules |
| **Runtime memory** | ~6 GB (LLM + TTS + frontend) |
| **API cost** | $0 — fully local |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND (React + Vite, :5173)                             │
│  • Web Speech API (es-AR) for microphone input              │
│  • SSE streaming from the LLM (progressive text)            │
│  • Runtime "argentinizer" (150+ rules)                      │
└──────────┬──────────────────────────────────────┬───────────┘
           │ POST /chat/stream                    │ POST /speak
           ▼                                      ▼
┌──────────────────────────────┐    ┌────────────────────────┐
│  LLM SERVER (:8000)          │    │  TTS SERVER (:8001)    │
│  FastAPI + mlx-lm            │    │  FastAPI + Piper       │
│                              │    │                        │
│  • Llama 3.1 8B 4-bit        │    │  • es_AR-daniela-high  │
│  • "porteño" persona prompt  │    │  • ffmpeg mastering    │
│  • RAG (BM25 over 319 ex.)   │    │  • Output: MP3 192kbps │
│  • Sentence-level SSE stream │    │                        │
└──────────────────────────────┘    └────────────────────────┘
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for the detailed data flow.

## Technical decisions — the part worth reading

This project went through **three failed fine-tuning iterations** before reaching
the current design. Every decision is documented with its real trade-off:

- **Why I dropped LoRA fine-tuning.** Three rounds; validation loss fell from
  1.06 → 0.33 while linguistic quality **got worse**. The metric improved and the
  product degraded, which is the whole lesson.
- **Why Piper TTS replaced XTTS-v2** — 6× speedup, native Argentine voice, no loss
  in intelligibility.
- **Why BM25 and not embeddings** — 319 examples makes a vector database overkill.
- **Why the runtime argentinizer is the right safety net** — it covers the LLM's
  lexical slips without retraining anything.

→ [DECISIONES.md](DECISIONES.md) — an honest log of the process, with metrics.

## Stack

`Python` · `MLX` · `Llama 3.1 8B` · `BM25` · `Piper TTS` · `FastAPI` · `React + Vite` · `Web Speech API` · `ffmpeg`
