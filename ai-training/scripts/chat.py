"""
Chat interactivo con el modelo fine-tuneado en rioplatense.

Uso:
    cd ai-training
    python scripts/chat.py
    python scripts/chat.py --model mlx-community/Mistral-7B-Instruct-v0.3-4bit

Cargá el adaptador LoRA entrenado y arrancá a conversar.
"""

import argparse
import os
import sys

from mlx_lm import load, generate

SYSTEM_PROMPT = (
    "Sos un asistente argentino. Hablás siempre en español rioplatense, "
    "con voseo y modismos locales. Sonás cercano, claro y nunca robótico."
)


def build_prompt(tokenizer, history):
    """Aplica el chat template del modelo a la historia de mensajes."""
    return tokenizer.apply_chat_template(
        history,
        tokenize=False,
        add_generation_prompt=True,
    )


def main():
    parser = argparse.ArgumentParser(description="Chat con la IA rioplatense fine-tuneada.")
    parser.add_argument(
        "--model",
        default="mlx-community/Mistral-7B-Instruct-v0.3-4bit",
        help="Modelo base (debe coincidir con el usado en entrenamiento).",
    )
    parser.add_argument(
        "--adapter",
        default="./adapters",
        help="Carpeta con los pesos LoRA. Pasá '' para usar el modelo sin adaptador.",
    )
    parser.add_argument("--max-tokens", type=int, default=400)
    parser.add_argument("--temp", type=float, default=0.7)
    args = parser.parse_args()

    adapter_path = args.adapter if args.adapter and os.path.isdir(args.adapter) else None
    if args.adapter and not adapter_path:
        print(f"⚠️  No encontré adaptador en '{args.adapter}'. Cargando modelo base sin LoRA.")

    print(f"Cargando modelo {args.model}...")
    model, tokenizer = load(args.model, adapter_path=adapter_path)
    print("Listo. Escribí tu mensaje. Comandos: /reset para limpiar, /quit para salir.\n")

    history = [{"role": "system", "content": SYSTEM_PROMPT}]

    while True:
        try:
            user = input("Vos > ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break

        if not user:
            continue
        if user.lower() in {"/quit", "/exit", "salir"}:
            break
        if user.lower() == "/reset":
            history = [{"role": "system", "content": SYSTEM_PROMPT}]
            print("(historia reiniciada)\n")
            continue

        history.append({"role": "user", "content": user})
        prompt = build_prompt(tokenizer, history)

        response = generate(
            model,
            tokenizer,
            prompt=prompt,
            max_tokens=args.max_tokens,
            verbose=False,
        )

        # Algunos modelos devuelven sólo lo nuevo, otros el prompt entero.
        if response.startswith(prompt):
            response = response[len(prompt):]
        response = response.strip()

        print(f"IA > {response}\n")
        history.append({"role": "assistant", "content": response})


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
