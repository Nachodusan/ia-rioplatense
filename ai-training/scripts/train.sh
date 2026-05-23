#!/usr/bin/env bash
# =====================================================================
# Fine-tuning LoRA sobre un modelo base para que entienda rioplatense.
# Optimizado para Apple Silicon (M1/M2/M3) usando MLX-LM.
# =====================================================================
#
# Uso:
#   cd ai-training
#   bash scripts/train.sh
#
# El primer run baja el modelo base desde Hugging Face (puede tardar
# unos minutos según conexión). Después corre el entrenamiento.
# =====================================================================

set -euo pipefail

cd "$(dirname "$0")/.."

# Elegí el modelo base aquí. Recomendación por defecto: Phi-3.5 mini 4bit
# (3.8B params, anda en cualquier Mac con 8+ GB de RAM unificada).
MODEL="${MODEL:-mlx-community/Mistral-7B-Instruct-v0.3-4bit}"

# Otras opciones (descomentá la que prefieras):
# MODEL="mlx-community/Phi-3.5-mini-instruct-4bit"
# MODEL="mlx-community/Meta-Llama-3.1-8B-Instruct-4bit"

echo ""
echo "================================================================"
echo "  Fine-tuning rioplatense con LoRA + MLX-LM"
echo "================================================================"
echo "  Modelo base : $MODEL"
echo "  Dataset     : ./data/train.jsonl + ./data/valid.jsonl"
echo "  Adaptador   : ./adapters/"
echo "  Config      : ./configs/lora_config.yaml"
echo "================================================================"
echo ""

mlx_lm.lora \
  --model "$MODEL" \
  --train \
  --data ./data \
  --config ./configs/lora_config.yaml \
  --adapter-path ./adapters

echo ""
echo "Listo. Adaptador guardado en ./adapters/"
echo "Para probarlo:   python scripts/chat.py"
echo "Para servirlo:   python scripts/serve.py"
