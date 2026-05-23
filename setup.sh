#!/usr/bin/env bash
# ============================================================================
# IA Rioplatense — bootstrap completo
#
# Instala dependencias y descarga modelos. Una sola vez por máquina.
# Requisitos previos: Mac Apple Silicon, Python 3.11+, Node 18+, ffmpeg.
# ============================================================================
set -euo pipefail

cd "$(dirname "$0")"

echo "╔════════════════════════════════════════════════════════╗"
echo "║  IA Rioplatense — setup                                ║"
echo "╚════════════════════════════════════════════════════════╝"

# --- 0. Pre-checks --------------------------------------------------------
command -v python3 >/dev/null || { echo "❌ Falta python3 (3.11+)"; exit 1; }
command -v node >/dev/null    || { echo "❌ Falta node (18+)"; exit 1; }
command -v ffmpeg >/dev/null  || { echo "❌ Falta ffmpeg — instalá con: brew install ffmpeg"; exit 1; }

# --- 1. Frontend ----------------------------------------------------------
echo ""
echo "→ [1/3] Frontend (npm install)…"
npm install --no-fund --no-audit

# --- 2. LLM server (ai-training) ------------------------------------------
echo ""
echo "→ [2/3] LLM server (venv + mlx-lm)…"
if [ ! -d ai-training/.venv ]; then
    python3 -m venv ai-training/.venv
fi
./ai-training/.venv/bin/pip install --upgrade pip --quiet
./ai-training/.venv/bin/pip install --quiet \
    mlx-lm fastapi 'uvicorn[standard]' pydantic rank-bm25

# Descarga del modelo Llama 3.1 8B 4-bit (~4.5 GB, una vez)
echo "    Descargando Llama 3.1 8B 4-bit MLX (~4.5 GB, una sola vez)…"
./ai-training/.venv/bin/python -c "
from huggingface_hub import snapshot_download
snapshot_download('mlx-community/Meta-Llama-3.1-8B-Instruct-4bit', max_workers=4)
print('    ✓ modelo OK')
"

# --- 3. TTS server (Piper) ------------------------------------------------
echo ""
echo "→ [3/3] TTS server (venv + Piper)…"
if [ ! -d tts_server/.venv ]; then
    python3 -m venv tts_server/.venv
fi
./tts_server/.venv/bin/pip install --upgrade pip --quiet
./tts_server/.venv/bin/pip install --quiet -r tts_server/requirements.txt

# Descarga del modelo Piper es_AR-daniela-high (~114 MB, una vez)
mkdir -p tts_server/piper_voices
if [ ! -f tts_server/piper_voices/es_AR-daniela-high.onnx ]; then
    echo "    Descargando voz Daniela (es-AR, Piper)…"
    curl -sL -o tts_server/piper_voices/es_AR-daniela-high.onnx \
        "https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_AR/daniela/high/es_AR-daniela-high.onnx"
    curl -sL -o tts_server/piper_voices/es_AR-daniela-high.onnx.json \
        "https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_AR/daniela/high/es_AR-daniela-high.onnx.json"
    echo "    ✓ Daniela OK"
fi

echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║  ✓ Setup completo                                      ║"
echo "║                                                        ║"
echo "║  Para arrancar:  ./run.sh                              ║"
echo "║  Luego abrir:    http://localhost:5173                 ║"
echo "╚════════════════════════════════════════════════════════╝"
