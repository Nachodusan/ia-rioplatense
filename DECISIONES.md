# Decisiones técnicas — bitácora del proyecto

> Documento honesto de qué probé, qué falló, qué quedó y por qué. No es marketing — es el proceso real.

---

## 1. Por qué descarté LoRA fine-tuning después de 3 rondas

### El intento

Partiendo de Mistral 7B Instruct v0.3 (4-bit, MLX), entrené 3 versiones LoRA sobre 319 ejemplos curados de español rioplatense:

| Versión | Rank | LR | Iters | Ejemplos | Val loss |
|---|---|---|---|---|---|
| v1 (Phi-3.5 base) | 16 | 1e-5 | 600 | ~150 | descartado por modelo base débil |
| v2 baseline | 16 | 2e-5 | 600 | 177 | **1.06** |
| v3 expandido | 32 | 1.5e-5 | 900 | 446 | 1.18 |
| v4 curado | 16 | 1e-5 | 700 | 319 (filtrado) | **0.33** |

### El hallazgo contraintuitivo

**Corrí evaluación reproducible** (`eval_harness.py`, 50 prompts × densidad de modismos + % léxico ibérico + score 0-100):

| Métrica | v2 baseline ⭐ | v3 | v4 (val loss más baja) |
|---|---|---|---|
| Val loss | 1.06 | 1.18 | **0.33** |
| Score medio eval | **74.8** | 72.8 | 71.2 |
| % respuestas con modismo | **78%** | 60% | 58% |
| % score > 80 | **14%** | 8% | 2% |
| Léxico no local detectado | 2 | 1 | **5** ↑ |

**El modelo con val loss más baja produjo el peor estilo en producción.**

### Por qué pasó

1. **Val loss mide perplejidad, no calidad estilística**. Optimizar perplejidad sobre 319 ejemplos llevó al modelo a memorizar patrones específicos, perdiendo diversidad léxica.
2. **System prompt idéntico en 319 ejemplos** se vuelve "ruido constante" para el modelo, que termina ignorándolo y dependiendo solo de patrones de respuesta.
3. **Curaduría agresiva = sobreajuste estilístico**: filtrar ejemplos "sin modismo evidente" eliminó la diversidad de registro necesaria para conversación natural.

### La lección

> "Val loss bajo ≠ calidad lingüística percibida. Para tareas estilísticas con datasets chicos, **prompt engineering + RAG > fine-tuning**."

Esto cambió el approach completo: paré de entrenar y empecé a pensar en el LLM como un componente al que hay que **guiar en cada turno**, no **moldear de una vez**.

---

## 2. Por qué cambié XTTS-v2 por Piper TTS

### Lo que tenía

**XTTS-v2 con voice cloning** de un sample de 8s ("Franco"):
- Voz humana realista, clonada de un audio real
- Streaming MP3 vía MediaSource Extensions (MSE) en el browser
- Mastering ffmpeg pro (EQ + compresor + dynaudnorm)

### El problema medido

| Métrica | XTTS-v2 Franco | Piper Daniela |
|---|---|---|
| Síntesis frase de 12 palabras | **6.94s** | 0.96s |
| Síntesis frase de 30 palabras | **14.58s** | 2.28s |
| TTFB en el browser (con MSE + buffer) | ~7s | ~1.2s |
| Cortes audibles en respuestas largas | 1-3 por respuesta | 0 |
| Memoria del modelo | 1.7 GB en disco + 2 GB MPS | 114 MB total |
| Tiempo real factor | **~1x** (ajustado) | **~3x** |

### Lo que sacrifiqué

- **Voice cloning** específico ("Franco"). Daniela es una voz pre-entrenada, no es de alguien.
- Voz **femenina** en lugar de masculina (Piper no tiene es_AR masculino oficial).

### Lo que gané

- **6-7x speedup** en latencia perceptual
- **Cero cortes** en frases largas (audio fluido)
- **2 GB menos de disco**, **2 GB menos de RAM** (libera espacio para el LLM)
- Pipeline mucho más simple (sin MSE, sin streaming chunks, sin auto-pausa preventiva)

### Por qué fue la decisión correcta

Para un chat conversacional, **la naturalidad del flujo importa más que la unicidad de la voz**. Una voz neuronal argentina que arranca en 1s y nunca se traba es mejor UX que una voz "más humana" pero que se demora 8s y a veces corta palabras a la mitad.

---

## 3. Por qué RAG con BM25 (y no embeddings)

### Contexto

Tengo 319 ejemplos curados de pares `(pregunta, respuesta porteña)`. Quiero que en cada turno el LLM tenga acceso a los más similares como guía de estilo.

### Las opciones

| Approach | Complejidad | Latencia | Calidad para 319 ejs |
|---|---|---|---|
| Embeddings (sentence-transformers) + FAISS | Alta | ~50ms + memoria | Similar |
| **BM25 (`rank_bm25`, Python puro)** ⭐ | **Baja** | **~10ms** | **Similar** |
| Lookup exacto + heurística | Trivial | ~1ms | Inferior |

### Por qué BM25 ganó

- **319 ejemplos es chico**. BM25 sobre un corpus así no pierde calidad medible vs embeddings.
- **Cero infra extra**. No hay vector DB, no hay modelo de embeddings cargado en RAM.
- **Determinístico y debuggeable**. Si una query retorna un ejemplo raro, abro el código y veo por qué.
- **Tokenización custom para español** trivial (stopwords + acentos NFD).

> "Para retrieval sobre <1000 documentos, BM25 te ahorra 80% de la complejidad sin perder 20% de la calidad."

---

## 4. Por qué el argentinizador runtime es la red de seguridad correcta

### El problema

Incluso con persona + RAG, el LLM se desvía. Genera "Conozgo Renaper", "tienes que ir", "el ordenador", "luego", "vosotros sabéis". Frases que técnicamente son español pero no son **rioplatenses**.

### Por qué NO hacerlo a nivel modelo

- **Re-entrenar para corregir 20 palabras es desproporcionado** (ya vimos que el LoRA ceiling existe).
- **Bajar temperature** reduce diversidad pero no elimina los términos no-locales.
- **Prompt más estricto** ayuda pero no es 100% confiable (el LLM olvida bajo presión).

### La solución: post-procesador con 150+ reglas regex

```js
// Ejemplo del lexico-rioplatense.js
{ patron: /\b(C|c)onozgo\b/g, reemplazo: (_m, c) => `${c}onozco`,
  categoria: 'Typo LLM', severidad: 8, explicacion: '...' },
{ patron: /\b(T|t)ienes\b/g, reemplazo: (_m, c) => `${c}enés`,
  categoria: 'Voseo / Tuteo', severidad: 10, explicacion: '...' },
```

### Categorías cubiertas

- **Voseo / Tuteo** (35 reglas): `tienes → tenés`, `puedes → podés`, `cuéntame → contame`, `dímelo → decímelo`, imperativos cortos (`haz → hacé`, `ven → vení`).
- **Léxico ibérico** (40+ reglas): `coche → auto`, `ordenador → computadora`, `móvil → celular`, `coger → agarrar` (con contexto negativo), `chaval → pibe`, `majo → copado`.
- **Latam neutro** (15 reglas): `platicar → charlar`, `rentar → alquilar`, `aguacate → palta`, `chévere → buenísimo`.
- **Formalismos** (20 reglas): `probablemente → seguramente`, `luego → después`, `mediante → con`, futuros sintéticos → perifrásticos.
- **Typos del LLM** (15 reglas): `conozgo → conozco`, `hize → hice`, `estoyaca → estoy acá`, `un IA → una IA`.
- **Latinismos** (5 reglas): `de facto → directo`, `a priori → de movida`.

### Por qué funciona

- **Determinístico**: si lo veo en el output, sé exactamente qué regla lo corrigió.
- **Composable**: agregar una regla nueva es 1 línea, sin riesgo de regresión.
- **Visible**: cada regla tiene `severidad` y `explicacion` — exportables a un evaluator que muestra al usuario *por qué* se cambió algo.
- **Bypasseable**: si el modelo mejora, sacar reglas es trivial.

### Trade-off honesto

- **No cubre semántica**, solo léxico. Si el LLM dice "deberías ir al consulado" cuando debería decir "andate al RENAPER", la regla no lo detecta.
- **Falsos positivos posibles**: por eso uso `contextoNeg` para reglas vulnerables (ej: `coger frío` no se reemplaza).

---

## 5. Por qué SSE streaming + cola de oraciones

### El problema sin streaming

LLM genera respuesta completa (3-5s) → frontend espera todo → manda al TTS → TTS genera (1-2s) → audio arranca. Total perceptual: **~7s en silencio**.

### Con SSE + cola

Backend usa `mlx_lm.stream_generate()` y emite Server-Sent Events `data: {"sentence": "..."}` por cada oración completa (detectada con regex en `. `, `? `, `! `).

Frontend:
1. Recibe cada oración → pasa por `argentinizar()` → appendea a la UI (texto progresivo).
2. Encola la oración en `useSpeech.hablar()`.
3. La cola dispara TTS secuencial — primera oración suena mientras llegan las siguientes.

**TTFB perceptual: ~3.3s** (vs 7s del modelo bloqueante).

### Lo que descubrí en el proceso

Mi primera implementación encadenaba **un MediaSource nuevo por oración**, lo que generaba gaps audibles entre cada una. La solución que quedó: cola simple de objetos `<audio>` POST+blob, sin MSE — Piper genera tan rápido que el approach simple funciona mejor que el sofisticado.

---

## Mediciones

Todas las latencias medidas en Mac M4 16 GB, conexión local, sin warmup adicional al boot.

| Acción | Tiempo |
|---|---|
| LLM: "Hola" → respuesta | ~3.2s |
| LLM: "Cómo se hace un asado" → respuesta | ~5.5s |
| LLM: primera oración (SSE) | ~3.3s |
| TTS Piper: 12 palabras | ~0.96s |
| TTS Piper: 30 palabras | ~2.28s |
| Pipeline end-to-end (corto) | ~4-5s |
| Pipeline end-to-end (largo) | ~7-9s |

---

## Lo que NO quedó en el proyecto (descarté en el camino)

- **LoRA fine-tuning** — ceiling alcanzado, ver §1.
- **XTTS-v2 voice cloning** — muy lento, ver §2.
- **Edge TTS (Microsoft)** — funcionaba pero suena a "locutor de Azure", no a porteño.
- **Streaming MP3 con MSE + auto-pausa preventiva** — necesario con XTTS, innecesario con Piper.
- **Validador con regeneración** (post-LLM evaluator que reintenta si el score es bajo) — agrega latencia, no quedó claro que mejore vs el argentinizador determinístico.
- **Speculative decoding en MLX** — incompatible con prompt cache reuse, ROI marginal para respuestas cortas.

Las versiones anteriores están en commits previos por si querés revisar el proceso.

---

**Hallazgo final**: el mejor modelo de español rioplatense no es el más entrenado — es el que tiene la mejor *capa de orquestación* alrededor (persona + RAG + post-proceso). Las 3 iteraciones LoRA que fallaron me lo enseñaron mejor que cualquier paper.
