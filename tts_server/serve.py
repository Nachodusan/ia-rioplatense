"""
Servidor TTS minimalista — solo Piper Daniela (es_AR).

Una sola voz: `daniela` (Piper es_AR-daniela-high, voz femenina argentina nativa).
Genera audio a ~3x tiempo real en CPU. TTFB <1s para frases típicas.

Pipeline:
    texto → normalize → Piper síntesis (WAV) → ffmpeg mastering → MP3
"""

import argparse
import asyncio
import io
import os
import re
import subprocess
import wave
from pathlib import Path

import uvicorn
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


# =====================================================================
# Piper TTS
# =====================================================================
PIPER_VOICE = None
PIPER_OK = False
PIPER_MODEL_PATH = str(Path(__file__).parent / "piper_voices" / "es_AR-daniela-high.onnx")


def _load_piper():
    global PIPER_VOICE, PIPER_OK
    if not os.path.isfile(PIPER_MODEL_PATH):
        print(f"[piper] FATAL: no encontré {PIPER_MODEL_PATH}")
        return
    try:
        from piper import PiperVoice
        print(f"[piper] cargando es_AR-daniela-high…")
        PIPER_VOICE = PiperVoice.load(PIPER_MODEL_PATH)
        PIPER_OK = True
        print(f"[piper] listo (~3x tiempo real, CPU)")
    except Exception as e:
        print(f"[piper] error: {e}")
        PIPER_VOICE = None
        PIPER_OK = False


# Una sola voz expuesta.
VOCES = {
    "daniela": {
        "engine": "piper",
        "voice": "piper:es_AR-daniela-high",
        "label": "Daniela (es-AR)",
        "gender": "femenino",
    },
}
DEFAULT_VOICE = "daniela"


# =====================================================================
# Schema
# =====================================================================
class SpeakRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)
    voice: str = Field(default=DEFAULT_VOICE)
    language: str = Field(default="es")
    enhance: bool = Field(default=True)


# =====================================================================
# Mastering ffmpeg (calidez + presencia + dynaudnorm)
# =====================================================================
def enhance_audio(audio_bytes: bytes) -> bytes:
    """Mastering vocal profesional. Acepta WAV/MP3 → emite MP3."""
    cmd = [
        "ffmpeg", "-loglevel", "error",
        "-i", "pipe:0",
        "-af", (
            "highpass=f=70,"
            "equalizer=f=180:t=q:w=1:g=2.5,"
            "equalizer=f=500:t=q:w=1.5:g=1.0,"
            "equalizer=f=1200:t=q:w=2:g=-2.0,"
            "equalizer=f=4000:t=q:w=1.5:g=2.5,"
            "equalizer=f=10000:t=q:w=1:g=1.5,"
            "acompressor=threshold=-20dB:ratio=3:attack=3:release=80,"
            "dynaudnorm=f=150:g=11:p=0.85,"
            "volume=1.5dB"
        ),
        "-f", "mp3", "-b:a", "192k", "-q:a", "2",
        "pipe:1",
    ]
    try:
        result = subprocess.run(cmd, input=audio_bytes, capture_output=True, check=True, timeout=30)
        return result.stdout
    except subprocess.CalledProcessError as e:
        print(f"[enhance] ffmpeg error: {e.stderr.decode()[:200]}")
        return audio_bytes
    except Exception as e:
        print(f"[enhance] error: {e}")
        return audio_bytes


def normalize_text(text: str) -> str:
    text = re.sub(r"([.!?,;:])([^\s])", r"\1 \2", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


# =====================================================================
# Síntesis Piper
# =====================================================================
def _synth_piper_sync(text: str) -> bytes:
    """Bloqueante. Llamar via asyncio.to_thread."""
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav:
        PIPER_VOICE.synthesize_wav(text, wav)
    return buf.getvalue()


async def _synth_piper(text: str) -> bytes:
    if not PIPER_OK:
        raise HTTPException(status_code=503, detail="Piper no está disponible.")
    return await asyncio.to_thread(_synth_piper_sync, text)


# =====================================================================
# App
# =====================================================================
app = FastAPI(title="TTS · Piper Daniela", version="7.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "engine": "piper + ffmpeg mastering",
        "piper_loaded": PIPER_OK,
        "voices": [
            {"id": k, "label": v["label"], "voice": v["voice"], "gender": v["gender"], "engine": v["engine"]}
            for k, v in VOCES.items()
        ],
        "default": DEFAULT_VOICE,
    }


@app.get("/voices")
def get_voices():
    return health()


@app.post("/speak")
async def speak(req: SpeakRequest):
    cfg = VOCES.get(req.voice) or VOCES[DEFAULT_VOICE]
    clean = normalize_text(req.text)
    try:
        audio = await _synth_piper(clean)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error TTS: {e}")

    if req.enhance:
        audio = await asyncio.to_thread(enhance_audio, audio)

    return Response(
        content=audio,
        media_type="audio/mpeg",
        headers={
            "X-Voice": cfg["voice"],
            "X-Voice-Label": cfg["label"],
            "X-Enhanced": "true" if req.enhance else "false",
            "Cache-Control": "no-store",
        },
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8001)
    args = parser.parse_args()

    _load_piper()

    print()
    print("=" * 56)
    print("  TTS · Piper Daniela (es-AR) + ffmpeg mastering")
    print("=" * 56)
    print(f"  Voz: {DEFAULT_VOICE}")
    print(f"  Piper cargado: {PIPER_OK}")
    print("=" * 56)
    print(f"\nServidor en http://{args.host}:{args.port}\n")

    uvicorn.run(app, host=args.host, port=args.port, log_level="info")


if __name__ == "__main__":
    main()
