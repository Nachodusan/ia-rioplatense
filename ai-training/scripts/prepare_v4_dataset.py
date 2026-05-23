"""
Prepara dataset v4: unifica system prompt + filtra densidad de modismos.

Causa raíz del fallo de v3:
  - Los 270 ejemplos nuevos tenían system prompt corto ("Sos un asistente
    porteño..., respondés corto"), mientras que los 177 originales tenían el
    prompt largo de 90 palabras. Esto diluyó la fuerza estilística.

Estrategia v4:
  1. Aplicar el system prompt ÚNICO RICO a TODOS los ejemplos
  2. Filtrar respuestas que NO tengan al menos 1 modismo rioplatense
     (excepto las muy cortas tipo saludos)
  3. Generar train_v4.jsonl y valid_v4.jsonl con formato Mistral-compatible

Output: data/train.jsonl, data/valid.jsonl (sobrescritura con backup .v3bak)
"""

import json
import re
import shutil
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

# System prompt unificado (el rico del frontend / serve.py)
SYSTEM_PROMPT = """Sos un asistente porteño, de Buenos Aires. Hablás como un argentino real de barrio, con voseo natural y vocabulario bonaerense fluido. Nada de español neutro ni ibérico.

REGLAS DE ORO (no las rompas nunca):
1. Voseo SIEMPRE: "vos tenés / vos querés / vos podés / vos sabés / vos hacés / vos vas". JAMÁS "tú tienes" ni "puedes" ni "haces".
2. NUNCA uses estas palabras (son de España o latam neutro): tío/tía, vale, guay, mola, estupendo, ordenador, móvil, coger, patata, fresa, melocotón, coche, carro, plática, chavos, ahorita.
3. EN SU LUGAR usá: che, dale, copado/buenísimo/joya, bárbaro, computadora, celular, agarrar/tomar, papa, frutilla, durazno, auto, plata/guita, pibes, ahora.
4. EVITÁ clichés de IA: "como modelo de lenguaje", "estoy aquí para ayudarte", "lamento la confusión", "no dudes en consultarme".
5. Variedad léxica: arrancá distinto (Dale / Mirá / Fijate / Listo / Joya / Tal cual / Claro / Obvio / Posta), NO siempre con "¡Bárbaro, che!".
6. Respondé corto: 1-2 oraciones, como charla por teléfono.
7. Vocabulario porteño bienvenido (sin abusar): che, dale, posta, bárbaro, copado, groso, joya, laburo, laburar, quilombo, bondi, mango, guita, pibe, mina, fiaca, embole, morfar, flashear, zarpado.
8. Si el usuario aprueba algo, confirmá positivo.
9. USÁ la info que te dio el usuario, NO repreguntés."""

# Modismos para contar densidad (incluye conjugaciones voseantes)
MODISMOS = [
    'che', 'dale', 'posta', 'bárbaro', 'copado', 'groso', 'joya', 'laburo', 'laburar',
    'quilombo', 'bondi', 'mango', 'mangos', 'guita', 'pibe', 'piba', 'flaco', 'flaca',
    'boludo', 'boluda', 'zarpado', 'banda', 'mina', 'fiaca', 'embole', 'morfar',
    'flashear', 'garompa', 'facha', 'tranqui', 'bardo', 'birra', 'pucho', 'piola',
    'mandate', 'fijate', 'contame', 'viste', 'andá', 'tirá', 'bancá', 'tomate',
    'sacate', 'hacete', 'pegale', 'mirá', 'dale', 'che',
    # Conjugaciones voseo (cuentan como argentinas)
    'tenés', 'querés', 'podés', 'sabés', 'hacés', 'vivís', 'decís', 'sos',
    'vos', 'venís', 'salís', 'andás',
]


def contar_modismos(texto: str) -> int:
    txt = texto.lower()
    return sum(1 for m in MODISMOS if re.search(rf'\b{re.escape(m)}\b', txt))


def extraer_user_y_assistant(messages):
    """Extrae el user real (sin system embebido) y la respuesta del assistant.
    Si los mensajes ya tienen system separado, lo ignora.
    Si el user tiene system embebido (formato Mistral), lo separa."""
    user_text = None
    assistant_text = None
    for m in messages:
        role = m.get('role')
        content = m.get('content', '')
        if role == 'user' and user_text is None:
            # Detectar si tiene system embebido (formato Mistral viejo)
            if content.startswith('Sos un asistente') and '\n\n' in content:
                _, real_user = content.split('\n\n', 1)
                user_text = real_user.strip()
            else:
                user_text = content.strip()
        elif role == 'assistant' and assistant_text is None:
            assistant_text = content.strip()
    return user_text, assistant_text


def main():
    for fname in ['train.jsonl', 'valid.jsonl']:
        path = DATA_DIR / fname
        if not path.exists():
            print(f"  {fname}: no existe, salto")
            continue

        # Backup
        bak = path.with_suffix('.jsonl.v3bak')
        if not bak.exists():
            shutil.copy(path, bak)
            print(f"  Backup: {bak.name}")

        # Procesar
        total_original = 0
        sin_modismo = 0
        cortos_ok = 0
        descartados = 0
        kept = []

        with open(path, encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                obj = json.loads(line)
                total_original += 1

                user_text, assistant_text = extraer_user_y_assistant(obj.get('messages', []))
                if not user_text or not assistant_text:
                    descartados += 1
                    continue

                n_mod = contar_modismos(assistant_text)

                # Política de filtrado:
                # - si la respuesta tiene >= 1 modismo → keep
                # - si la respuesta es corta (<60 chars), aceptar igual (saludos)
                # - sino → descartar
                if n_mod >= 1:
                    pass  # keep
                elif len(assistant_text) < 60:
                    cortos_ok += 1  # keep (saludo o respuesta corta natural)
                else:
                    sin_modismo += 1
                    descartados += 1
                    continue

                # Generar formato Mistral-compatible: system fusionado en user
                new_user = f"{SYSTEM_PROMPT}\n\n{user_text}"
                kept.append({
                    "messages": [
                        {"role": "user", "content": new_user},
                        {"role": "assistant", "content": assistant_text},
                    ]
                })

        # Escribir resultado
        with open(path, 'w', encoding='utf-8') as f:
            for obj in kept:
                f.write(json.dumps(obj, ensure_ascii=False) + '\n')

        print(f"\n  {fname}:")
        print(f"    Original total : {total_original}")
        print(f"    Descartados sin modismo (largo): {sin_modismo}")
        print(f"    Aceptados cortos (sin modismo): {cortos_ok}")
        print(f"    Final kept     : {len(kept)}")

        # Estadísticas
        if kept:
            modismos_count = sum(contar_modismos(o['messages'][1]['content']) for o in kept)
            con_modismo = sum(1 for o in kept if contar_modismos(o['messages'][1]['content']) > 0)
            print(f"    Densidad modismos/respuesta: {modismos_count/len(kept):.2f}")
            print(f"    % con ≥1 modismo: {con_modismo*100/len(kept):.0f}%")


if __name__ == "__main__":
    main()
