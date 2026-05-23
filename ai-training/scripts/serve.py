"""
Servidor HTTP que expone el LLM a la app React.

Cambios v2 (Llama 3.1 8B + persona + RAG):
- Modelo base: Llama 3.1 8B Instruct 4-bit (vs Mistral 7B). Mejor español OOB.
- Sin LoRA: ceiling alcanzado en re-entrenamientos previos (ver memoria proyecto).
- Persona estable "Tomi" en lugar de "asistente genérico".
- Few-shot dinámico: BM25 sobre 319 ejemplos de train.jsonl, top-3 por turno.
- Soporte nativo de role:"system" (Llama 3.1 sí lo tiene, fin del fusion hack).

Endpoints:
    GET  /health         → status
    GET  /system_prompt  → persona+reglas (consumido por el frontend)
    POST /chat           → conversación

Uso:
    python scripts/serve.py
    python scripts/serve.py --model mlx-community/Meta-Llama-3.1-8B-Instruct-4bit
"""

import argparse
import os
import re
import sys
import time
from pathlib import Path
from typing import List, Optional

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from mlx_lm import load, generate, stream_generate
try:
    from mlx_lm.sample_utils import make_sampler, make_logits_processors
    _HAS_SAMPLER_UTILS = True
except Exception:
    _HAS_SAMPLER_UTILS = False
import json as _json
from fastapi.responses import StreamingResponse

# Path setup para importar el retriever (mismo dir)
sys.path.insert(0, str(Path(__file__).parent))
from retriever import FewShotRetriever, format_fewshot_block  # noqa: E402


# =====================================================================
# Persona + reglas — la fuente única de verdad
# =====================================================================
PERSONA_PROMPT = """Sos un porteño de Buenos Aires. Hablás natural, como con un amigo. NO sos asistente ni modelo. Respondé lo que te preguntan, sin meter datos personales tuyos (edad, barrio, trabajo) salvo que te pregunten.

REGLAS DURAS (no romper nunca):
- Voseo SIEMPRE: vos tenés, podés, sabés, hacés, querés, decís, sos. JAMÁS tú, tienes, puedes, eres, haces, dices.
- NUNCA usar: tío, vale, guay, ordenador, móvil, coger, patata, coche, plática, ahorita, luego, debes, eres, cuéntame.
- USAR en su lugar: che, dale, copado, joya, bárbaro, computadora, celular, agarrar, papa, auto, plata, pibe, después, tenés que, sos, contame.
- NO digas: "como modelo de lenguaje", "estoy aquí para ayudarte", "lamento la confusión". Sos persona.
- MÁXIMO 2 oraciones cortas, total 25-30 palabras. Mejor decir menos pero completo. NUNCA pases de 40 palabras.
- Para trámites: 3 pasos máximo, MUY breves (5-8 palabras cada uno).
- Variá los inicios (Dale, Mirá, Posta, Joya, Obvio, Fijate), no arranques igual cada vez.
- Usá lo que el usuario te dijo. NO repreguntes lo que ya sabés."""


# =====================================================================
# Estado global
# =====================================================================
MODEL = None
TOKENIZER = None
MODEL_NAME = ""
ADAPTER_PATH: Optional[str] = None
RETRIEVER: Optional[FewShotRetriever] = None


# =====================================================================
# Esquemas Pydantic
# =====================================================================
class Message(BaseModel):
    role: str = Field(..., description="system | user | assistant")
    content: str


class ChatRequest(BaseModel):
    messages: List[Message]
    max_tokens: int = Field(default=90, ge=1, le=2048)
    temperature: float = Field(default=0.75, ge=0.0, le=2.0)
    top_p: float = Field(default=0.92, ge=0.0, le=1.0)
    repetition_penalty: float = Field(default=1.10, ge=0.0, le=2.0)
    repetition_context_size: int = Field(default=40, ge=1, le=512)
    use_system_prompt: bool = Field(default=True)
    use_rag: bool = Field(default=True, description="Inyectar top-3 ejemplos similares del corpus.")


class ChatResponse(BaseModel):
    reply: str
    model: str
    adapter: Optional[str] = None
    latency_ms: int = 0
    rag_examples: int = 0


# =====================================================================
# App
# =====================================================================
app = FastAPI(title="IA Rioplatense · Llama 3.1 8B + RAG", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model": MODEL_NAME,
        "adapter": ADAPTER_PATH,
        "rag_examples": len(RETRIEVER.examples) if RETRIEVER else 0,
    }


@app.get("/system_prompt")
def get_system_prompt():
    """Fuente única de verdad para la persona — el frontend la consume
    al boot para no duplicar el texto en JS."""
    return {"system_prompt": PERSONA_PROMPT}


def _build_system_with_rag(user_query: str, base_system: str) -> str:
    """Compone el system prompt final: persona + (opcional) few-shot dinámico."""
    if not RETRIEVER or not user_query.strip():
        return base_system
    pairs = RETRIEVER.retrieve(user_query, k=3, min_score=0.3)
    if not pairs:
        return base_system
    fewshot = format_fewshot_block(pairs)
    return f"{base_system}\n\n{fewshot}"


STOP_PATTERNS = [
    # Llama 3.x
    r"<\|eot_id\|>", r"<\|start_header_id\|>", r"<\|end_header_id\|>", r"<\|endoftext\|>",
    # Phi-3.5
    r"<\|end\|>", r"<\|user\|>", r"<\|assistant\|>", r"<\|system\|>",
    # Mistral / generic
    r"</s>", r"<s>", r"\[INST\]", r"\[/INST\]", r"<unk>",
]


def _prepare_chat_prompt(req: ChatRequest):
    """Construye el prompt + retorna (prompt_str, gen_kwargs sin prompt). Lógica
    común entre /chat y /chat/stream para evitar drift."""
    messages = [m.model_dump() for m in req.messages]
    last_user = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
    incoming_system = next((m["content"] for m in messages if m["role"] == "system"), None)
    base_system = incoming_system if incoming_system else PERSONA_PROMPT
    rag_count = 0
    if req.use_rag and RETRIEVER:
        before = len(base_system)
        base_system = _build_system_with_rag(last_user, base_system)
        if len(base_system) > before:
            rag_count = base_system.count("Usuario:") - (incoming_system.count("Usuario:") if incoming_system else 0)
    non_system = [m for m in messages if m["role"] != "system"]
    if req.use_system_prompt or incoming_system:
        messages = [{"role": "system", "content": base_system}] + non_system
    else:
        messages = non_system
    if not any(m["role"] == "user" for m in messages):
        raise HTTPException(status_code=400, detail="La conversación no tiene mensajes de usuario.")
    prompt = TOKENIZER.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    sampler_kwargs = {}
    if _HAS_SAMPLER_UTILS:
        try:
            sampler_kwargs["sampler"] = make_sampler(temp=req.temperature, top_p=req.top_p)
            sampler_kwargs["logits_processors"] = make_logits_processors(
                repetition_penalty=req.repetition_penalty,
                repetition_context_size=req.repetition_context_size,
            )
        except Exception as e:
            print(f"[warn] sampler/logits avanzado falló: {e}")
    return prompt, sampler_kwargs, rag_count


def _clip_stop(text: str) -> str:
    """Corta en el primer stop pattern."""
    earliest = len(text)
    for pat in STOP_PATTERNS:
        m = re.search(pat, text)
        if m and m.start() < earliest:
            earliest = m.start()
    return text[:earliest]


_SENTENCE_END_RE = re.compile(r"([\.\!\?])(\s|$)")


@app.post("/chat/stream")
async def chat_stream(req: ChatRequest):
    """Server-Sent Events: emite eventos por cada oración detectada para que el
    cliente pueda disparar TTS en paralelo a la generación del LLM.

    Eventos:
      data: {"sentence": "...", "i": N}\\n\\n   ← por cada oración terminada
      data: {"done": true, "full": "...", "latency_ms": N}\\n\\n   ← al final
      data: {"error": "..."}\\n\\n   ← si algo se rompe
    """
    if MODEL is None or TOKENIZER is None:
        raise HTTPException(status_code=503, detail="El modelo todavía no está cargado.")

    try:
        prompt, sampler_kwargs, _ = _prepare_chat_prompt(req)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error armando el prompt: {e}")

    def stream_iter():
        import time
        t0 = time.time()
        buffer = ""
        full = ""
        sentence_idx = 0
        try:
            for resp in stream_generate(MODEL, TOKENIZER, prompt=prompt,
                                        max_tokens=req.max_tokens, **sampler_kwargs):
                delta = resp.text or ""
                if not delta:
                    if resp.finish_reason is not None:
                        break
                    continue
                buffer += delta
                full += delta

                # Cortar en stop patterns por las dudas
                clipped = _clip_stop(buffer)
                if clipped != buffer:
                    buffer = clipped
                    if buffer.strip():
                        sentence_idx += 1
                        payload = _json.dumps({"sentence": buffer.strip(), "i": sentence_idx})
                        yield f"data: {payload}\n\n"
                    break

                # Emitir oraciones completas
                while True:
                    m = _SENTENCE_END_RE.search(buffer)
                    if not m:
                        break
                    end = m.end()
                    sentence = buffer[:end].strip()
                    buffer = buffer[end:]
                    if sentence:
                        sentence_idx += 1
                        payload = _json.dumps({"sentence": sentence, "i": sentence_idx})
                        yield f"data: {payload}\n\n"

                if resp.finish_reason is not None:
                    break

            # Flush del buffer residual si quedó algo sin terminar en punto
            tail = _clip_stop(buffer).strip()
            if tail:
                sentence_idx += 1
                payload = _json.dumps({"sentence": tail, "i": sentence_idx})
                yield f"data: {payload}\n\n"

            full_clean = _clip_stop(full).strip()
            done_payload = _json.dumps({
                "done": True,
                "full": full_clean,
                "latency_ms": int((time.time() - t0) * 1000),
                "sentences": sentence_idx,
            })
            yield f"data: {done_payload}\n\n"
        except Exception as e:
            err = _json.dumps({"error": str(e)})
            yield f"data: {err}\n\n"

    return StreamingResponse(
        stream_iter(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    if MODEL is None or TOKENIZER is None:
        raise HTTPException(status_code=503, detail="El modelo todavía no está cargado.")

    t0 = time.time()
    messages = [m.model_dump() for m in req.messages]

    # Encontrar el último user message para usar como query del RAG
    last_user = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")

    # Determinar el system prompt: el que mandó el cliente, o el de persona por default.
    incoming_system = next((m["content"] for m in messages if m["role"] == "system"), None)
    base_system = incoming_system if incoming_system else PERSONA_PROMPT

    # Opcional: inyectar ejemplos few-shot del RAG (BM25)
    rag_count = 0
    if req.use_rag and RETRIEVER:
        before_len = len(base_system)
        base_system = _build_system_with_rag(last_user, base_system)
        if len(base_system) > before_len:
            # Approx: cada par agrega ~2 líneas extra al prompt
            rag_count = base_system.count("Usuario:") - (incoming_system.count("Usuario:") if incoming_system else 0)

    # Reconstruir mensajes: system al frente, resto sin systems extra
    non_system = [m for m in messages if m["role"] != "system"]
    if req.use_system_prompt or incoming_system:
        messages = [{"role": "system", "content": base_system}] + non_system
    else:
        messages = non_system

    # Safeguard: tiene que haber al menos un user
    if not any(m["role"] == "user" for m in messages):
        raise HTTPException(status_code=400, detail="La conversación no tiene mensajes de usuario.")

    try:
        prompt = TOKENIZER.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error armando el prompt: {e}")

    gen_kwargs = {"prompt": prompt, "max_tokens": req.max_tokens, "verbose": False}
    if _HAS_SAMPLER_UTILS:
        try:
            gen_kwargs["sampler"] = make_sampler(temp=req.temperature, top_p=req.top_p)
            gen_kwargs["logits_processors"] = make_logits_processors(
                repetition_penalty=req.repetition_penalty,
                repetition_context_size=req.repetition_context_size,
            )
        except Exception as e:
            print(f"[warn] sampler/logits avanzado falló: {e}")

    output = generate(MODEL, TOKENIZER, **gen_kwargs)

    if output.startswith(prompt):
        output = output[len(prompt):]

    earliest = len(output)
    for pat in STOP_PATTERNS:
        m = re.search(pat, output)
        if m and m.start() < earliest:
            earliest = m.start()
    output = output[:earliest].strip()

    latency_ms = int((time.time() - t0) * 1000)
    return ChatResponse(
        reply=output,
        model=MODEL_NAME,
        adapter=ADAPTER_PATH,
        latency_ms=latency_ms,
        rag_examples=rag_count,
    )


# =====================================================================
# Bootstrap
# =====================================================================
def main():
    global MODEL, TOKENIZER, MODEL_NAME, ADAPTER_PATH, RETRIEVER

    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--model",
        default="mlx-community/Meta-Llama-3.1-8B-Instruct-4bit",
        help="Modelo base. Default: Llama 3.1 8B Instruct 4-bit.",
    )
    parser.add_argument(
        "--adapter",
        default="",
        help="Carpeta del adapter LoRA. Default: '' (sin LoRA — Llama no tiene LoRA compatible).",
    )
    parser.add_argument(
        "--data",
        default=str(Path(__file__).parent.parent / "data" / "train.jsonl"),
        help="JSONL con ejemplos para indexar en el RAG.",
    )
    parser.add_argument("--no-rag", action="store_true", help="Deshabilitar RAG (solo persona + reglas).")
    parser.add_argument("--no-warmup", action="store_true", help="Saltar warmup al boot.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()

    adapter_path = args.adapter if args.adapter and os.path.isdir(args.adapter) else None
    if args.adapter and not adapter_path:
        print(f"⚠️  No encontré adaptador en '{args.adapter}'. Cargando modelo base sin LoRA.")

    print(f"Cargando modelo {args.model}…")
    MODEL, TOKENIZER = load(args.model, adapter_path=adapter_path)
    MODEL_NAME = args.model
    ADAPTER_PATH = adapter_path
    print(f"Modelo listo.")

    if not args.no_rag and os.path.isfile(args.data):
        try:
            RETRIEVER = FewShotRetriever(args.data)
        except Exception as e:
            print(f"⚠️  RAG deshabilitado por error al indexar {args.data}: {e}")
            RETRIEVER = None

    if not args.no_warmup:
        try:
            print("Warmup: inferencia descartable…")
            t0 = time.time()
            warmup_prompt = TOKENIZER.apply_chat_template(
                [{"role": "system", "content": PERSONA_PROMPT},
                 {"role": "user", "content": "hola"}],
                tokenize=False,
                add_generation_prompt=True,
            )
            _ = generate(MODEL, TOKENIZER, prompt=warmup_prompt, max_tokens=10, verbose=False)
            print(f"Warmup completo en {time.time()-t0:.1f}s.")
        except Exception as e:
            print(f"⚠️  Warmup falló (no es bloqueante): {e}")

    print(f"Servidor en http://{args.host}:{args.port}")
    print(f"  Modelo: {MODEL_NAME}")
    print(f"  Adapter: {ADAPTER_PATH or '(ninguno)'}")
    print(f"  RAG: {len(RETRIEVER.examples) if RETRIEVER else 0} ejemplos indexados")
    uvicorn.run(app, host=args.host, port=args.port, log_level="info")


if __name__ == "__main__":
    main()
