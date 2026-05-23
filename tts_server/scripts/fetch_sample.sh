#!/usr/bin/env bash
# =====================================================================
# Descarga un audio de YouTube y lo procesa como sample de voz para XTTS.
#
# Uso:
#   bash scripts/fetch_sample.sh <youtube_url> <voice_id> [start_seconds] [duration_seconds]
#
# Ejemplo:
#   bash scripts/fetch_sample.sh "https://youtube.com/watch?v=XXX" maradona 30 15
#
# El audio se baja, se extrae como mono WAV a 24kHz (lo que XTTS espera),
# se recorta al tramo indicado y se guarda en samples/<voice_id>.wav
# =====================================================================

set -euo pipefail

cd "$(dirname "$0")/.."

URL="${1:?Pasá el URL de YouTube como primer argumento}"
VOICE="${2:?Pasá el nombre del sample como segundo argumento (ej: maradona)}"
START="${3:-0}"
DUR="${4:-15}"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Descargando audio de YouTube..."
yt-dlp -x --audio-format wav --audio-quality 0 \
  -o "$TMP/raw.%(ext)s" "$URL"

RAW="$TMP/raw.wav"
[ -f "$RAW" ] || { echo "No se pudo bajar el audio"; exit 1; }

echo "Procesando: mono 24kHz, recortando desde ${START}s por ${DUR}s..."
ffmpeg -hide_banner -loglevel error -y \
  -ss "$START" -t "$DUR" \
  -i "$RAW" \
  -ac 1 -ar 24000 -af "loudnorm=I=-16:LRA=11:TP=-1.5" \
  "samples/${VOICE}.wav"

echo ""
echo "Listo. Sample guardado en: samples/${VOICE}.wav"
echo "Verificá que se escuche limpio:  afplay samples/${VOICE}.wav"
