"""
Limpia el formato del dataset: extrae el system prompt embebido en cada
user message y lo pone como mensaje separado de rol "system".

Antes:
    {"messages": [
      {"role": "user", "content": "Sos un asistente del Río de la Plata...\\n\\nHola"},
      {"role": "assistant", "content": "..."}
    ]}

Después:
    {"messages": [
      {"role": "system", "content": "Sos un asistente del Río de la Plata..."},
      {"role": "user", "content": "Hola"},
      {"role": "assistant", "content": "..."}
    ]}

Uso:
    python scripts/clean_dataset.py
"""

import json
import os
import shutil
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
FILES = ["train.jsonl", "valid.jsonl"]

# Marcador de separación entre system y user real en el contenido fusionado
SEPARATOR = "\n\n"


def split_system_from_user(user_content: str):
    """Si el user content empieza con un system prompt fusionado (terminado en \\n\\n),
    devolvemos (system, user_real). Si no detectamos system, devolvemos (None, user_content)."""
    # Heurística: si el contenido empieza con frases típicas del system prompt
    triggers = [
        "Sos un asistente",
        "Sos una IA",
        "Sos un porteño",
    ]
    if not any(user_content.startswith(t) for t in triggers):
        return None, user_content

    # Buscar el primer separator
    if SEPARATOR not in user_content:
        return None, user_content

    parts = user_content.split(SEPARATOR, 1)
    if len(parts) != 2:
        return None, user_content
    return parts[0].strip(), parts[1].strip()


def clean_file(path: Path, backup: bool = True):
    bak = path.with_suffix(path.suffix + ".bak")
    if backup and not bak.exists():
        shutil.copy(path, bak)
        print(f"  Backup: {bak.name}")

    cleaned = []
    n_split = 0
    n_already_ok = 0

    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            obj = json.loads(line)
            messages = obj.get("messages", [])
            if not messages:
                continue

            # Si ya tiene un system separado, dejarlo
            if messages[0].get("role") == "system":
                cleaned.append(obj)
                n_already_ok += 1
                continue

            # Si arranca con user que tiene system embebido, separarlo
            first = messages[0]
            if first.get("role") == "user":
                sys_text, user_real = split_system_from_user(first.get("content", ""))
                if sys_text:
                    new_messages = [
                        {"role": "system", "content": sys_text},
                        {"role": "user", "content": user_real},
                        *messages[1:],
                    ]
                    cleaned.append({"messages": new_messages})
                    n_split += 1
                    continue

            # Caso default: dejar como está
            cleaned.append(obj)

    with open(path, "w", encoding="utf-8") as f:
        for obj in cleaned:
            f.write(json.dumps(obj, ensure_ascii=False) + "\n")

    print(f"  {path.name}: {n_split} reestructurados, {n_already_ok} ya OK, total {len(cleaned)}")


def main():
    print(f"Limpiando datasets en {DATA_DIR}...")
    for fname in FILES:
        path = DATA_DIR / fname
        if not path.exists():
            print(f"  {fname}: no existe, salto")
            continue
        clean_file(path)
    print("Listo.")


if __name__ == "__main__":
    main()
