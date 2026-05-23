"""
Verifica el dataset (train.jsonl + valid.jsonl) y muestra estadísticas.

Útil para chequear que los ejemplos están bien formateados antes de
mandarlos al entrenamiento.

Uso:
    cd ai-training
    python scripts/prepare_data.py
"""

import json
import os
import sys
from collections import Counter

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
FILES = ["train.jsonl", "valid.jsonl"]


def validar_archivo(path):
    ejemplos = []
    errores = []

    with open(path, encoding="utf-8") as f:
        for i, line in enumerate(f, start=1):
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError as e:
                errores.append(f"  línea {i}: JSON inválido ({e})")
                continue

            msgs = obj.get("messages")
            if not isinstance(msgs, list) or not msgs:
                errores.append(f"  línea {i}: falta 'messages'")
                continue

            roles = [m.get("role") for m in msgs]
            if "user" not in roles or "assistant" not in roles:
                errores.append(f"  línea {i}: faltan roles user/assistant")
                continue

            ejemplos.append(obj)

    return ejemplos, errores


def main():
    print()
    print("=" * 62)
    print("  Validación del dataset rioplatense")
    print("=" * 62)

    total_ok = 0
    total_err = 0

    for fname in FILES:
        path = os.path.join(DATA_DIR, fname)
        if not os.path.isfile(path):
            print(f"\n❌ Falta {path}")
            total_err += 1
            continue

        ejemplos, errores = validar_archivo(path)
        print(f"\n📂 {fname}")
        print(f"   Ejemplos válidos : {len(ejemplos)}")

        if errores:
            print(f"   Errores          : {len(errores)}")
            for e in errores[:10]:
                print(e)
            total_err += len(errores)
        else:
            print("   Errores          : 0  ✅")

        # Estadísticas rápidas
        long_user = [len(m["content"]) for ej in ejemplos for m in ej["messages"] if m["role"] == "user"]
        long_assist = [len(m["content"]) for ej in ejemplos for m in ej["messages"] if m["role"] == "assistant"]
        if long_user:
            print(f"   Largo prompt     : min {min(long_user)}, max {max(long_user)}, prom {sum(long_user)//len(long_user)}")
        if long_assist:
            print(f"   Largo respuesta  : min {min(long_assist)}, max {max(long_assist)}, prom {sum(long_assist)//len(long_assist)}")

        # Modismos detectados (smoke test cualitativo)
        modismos = ["che", "dale", "posta", "bárbaro", "boludo", "quilombo",
                    "laburo", "bondi", "guita", "pibe", "vos", "tenés", "querés", "podés"]
        cuenta = Counter()
        for ej in ejemplos:
            for m in ej["messages"]:
                if m["role"] != "assistant":
                    continue
                low = m["content"].lower()
                for w in modismos:
                    if f" {w}" in low or low.startswith(w):
                        cuenta[w] += 1
        if cuenta:
            top = ", ".join(f"{w}({n})" for w, n in cuenta.most_common(10))
            print(f"   Modismos top     : {top}")

        total_ok += len(ejemplos)

    print()
    print("=" * 62)
    print(f"  Total ejemplos válidos: {total_ok}")
    print(f"  Total errores         : {total_err}")
    print("=" * 62)
    print()

    return 1 if total_err else 0


if __name__ == "__main__":
    sys.exit(main())
