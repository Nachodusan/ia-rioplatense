"""
Convierte el dataset de formato system+user+assistant al formato user+assistant
fusionando el system prompt dentro del primer mensaje del usuario.

Mistral 7B Instruct v0.3 no acepta role: system en su chat template, así que
necesitamos este formato. El resultado también funciona con Phi-3.5 y Llama.

Uso:
    cd ai-training
    python scripts/convert_to_mistral_format.py
"""
import json
import os

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
FILES = ["train.jsonl", "valid.jsonl"]


def convert(messages):
    """Fusiona system en el primer user. Mantiene resto intacto."""
    new = []
    system_text = None
    for m in messages:
        if m["role"] == "system":
            system_text = m["content"]
        elif m["role"] == "user":
            content = m["content"]
            if system_text:
                content = f"{system_text}\n\n{content}"
                system_text = None
            new.append({"role": "user", "content": content})
        else:
            new.append(m)
    return new


def main():
    for fname in FILES:
        path = os.path.join(DATA_DIR, fname)
        if not os.path.isfile(path):
            print(f"⚠️  No encontré {path}")
            continue

        with open(path, encoding="utf-8") as f:
            objs = [json.loads(line) for line in f if line.strip()]

        # Skip si ya está convertido (ningún ejemplo tiene system)
        has_system = any(m["role"] == "system" for o in objs for m in o["messages"])
        if not has_system:
            print(f"✅ {fname} ya está en formato sin system, no toco.")
            continue

        converted = [{"messages": convert(o["messages"])} for o in objs]

        with open(path, "w", encoding="utf-8") as f:
            for obj in converted:
                f.write(json.dumps(obj, ensure_ascii=False) + "\n")

        print(f"✅ {fname}: {len(converted)} ejemplos convertidos a formato Mistral-compatible.")


if __name__ == "__main__":
    main()
