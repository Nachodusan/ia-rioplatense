#!/usr/bin/env bash
# ============================================================================
# IA Rioplatense — arranque local
#
# Levanta los 3 servers en paralelo y los apaga juntos con Ctrl+C.
# ============================================================================
set -euo pipefail

cd "$(dirname "$0")"

# Sanity check
if [ ! -d ai-training/.venv ] || [ ! -d tts_server/.venv ] || [ ! -d node_modules ]; then
    echo "❌ Falta correr ./setup.sh primero"
    exit 1
fi

if [ ! -f tts_server/piper_voices/es_AR-daniela-high.onnx ]; then
    echo "❌ Falta el modelo Piper. Corré ./setup.sh"
    exit 1
fi

# Cleanup al salir
PIDS=()
cleanup() {
    echo ""
    echo "→ apagando servers…"
    for pid in "${PIDS[@]}"; do
        kill "$pid" 2>/dev/null || true
    done
    wait 2>/dev/null
    exit 0
}
trap cleanup INT TERM

echo "╔════════════════════════════════════════════════════════╗"
echo "║  IA Rioplatense — arrancando 3 servers                 ║"
echo "║                                                        ║"
echo "║  LLM      → http://localhost:8000  (Llama 3.1 8B)      ║"
echo "║  TTS      → http://localhost:8001  (Piper Daniela)     ║"
echo "║  Frontend → http://localhost:5173  ← abrir esto        ║"
echo "║                                                        ║"
echo "║  Ctrl+C para apagar todo                               ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# Backend LLM
./ai-training/.venv/bin/python ai-training/scripts/serve.py &
PIDS+=("$!")

# Backend TTS
./tts_server/.venv/bin/python tts_server/serve.py &
PIDS+=("$!")

# Frontend (Vite)
npm run dev -- --host 127.0.0.1 &
PIDS+=("$!")

wait
