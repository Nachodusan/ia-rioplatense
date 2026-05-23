"""
Harness de evaluación del LoRA rioplatense.

Toma 50 prompts de evaluación, genera respuestas con un adapter dado, y
calcula métricas porteñas:
  - Densidad de modismos rioplatenses por respuesta
  - % de respuestas con al menos 1 modismo
  - Detección de léxico ibérico/neutro (contaminación)
  - Detección de tuteo (vos vs tú)
  - Largo promedio de respuesta
  - Score compuesto (0-100)

Uso:
    # Comparar baseline (v2) vs nuevo (current)
    python scripts/eval_harness.py --adapter ./adapters_v2_backup --label baseline > baseline.json
    python scripts/eval_harness.py --adapter ./adapters --label nuevo > nuevo.json
    python scripts/eval_harness.py --compare baseline.json nuevo.json
"""

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path

# Lazy import — solo si vamos a generar
def _load_model(model_name, adapter_path):
    from mlx_lm import load
    return load(model_name, adapter_path=adapter_path)


PROMPTS_EVAL = [
    # Saludos / casual
    "Hola, ¿cómo va?",
    "Buen día, ¿qué tal?",
    "Hace mil que no nos hablamos",
    "Estoy aburrido",
    "Qué hacés loco",
    # Trámites y servicios
    "Necesito sacar turno con el médico",
    "¿Cómo renuevo el DNI?",
    "Me llegó una multa, ¿qué hago?",
    "¿Cómo abro una caja de ahorro?",
    "Necesito sacar el registro de conducir",
    # Plata y finanzas
    "Conviene tener pesos o dólares ahora",
    "¿Cómo hago dólar MEP?",
    "Tengo deudas con la tarjeta",
    "¿En qué invierto mi plata?",
    "Necesito ahorrar más",
    # Trabajo y carrera
    "Tengo una entrevista mañana",
    "Cómo pido aumento al jefe",
    "Estoy podrido del laburo",
    "Me echaron del trabajo",
    "Quiero ser freelance",
    # Comida y cultura
    "Cómo hago un buen asado",
    "Recomendame una pizzería en Buenos Aires",
    "Cómo se ceba un mate",
    "Receta de milanesa a la napolitana",
    "Qué tomo en un café porteño",
    # Tech
    "Qué lenguaje aprendo para programar",
    "Mi compu va lenta",
    "Qué es la nube",
    "Cómo me protejo de phishing",
    "Cómo aprendo inglés para tech",
    # Emocional / relaciones
    "Estoy medio bajón",
    "Me cortaron",
    "Mi vieja no me habla",
    "Tengo ansiedad",
    "No puedo dormir hace días",
    # Vida diaria
    "Hace mucho frío hoy",
    "Llueve a baldazos",
    "Tengo gripe",
    "Quiero adoptar un perro",
    "Necesito hacer ejercicio",
    # Modismos
    "Qué significa che",
    "Qué quiere decir laburo",
    "Qué es un quilombo",
    # Prompts trampa (tuteo)
    "¿Tú podrías ayudarme?",
    "¿Cómo te llamas?",
    "Quiero un coche barato",
    "Necesito un móvil nuevo",
    "Hola che, qué tal el día tuyo",
    # Cultura BA
    "Qué hago un domingo en Buenos Aires",
    "Recomendame un barrio para conocer",
]


# Modismos rioplatenses para detección
MODISMOS = [
    'che', 'dale', 'posta', 'bárbaro', 'copado', 'groso', 'joya', 'laburo', 'laburar',
    'quilombo', 'bondi', 'mango', 'mangos', 'guita', 'pibe', 'piba', 'flaco', 'flaca',
    'boludo', 'boluda', 'zarpado', 'banda', 'mina', 'fiaca', 'embole', 'morfar',
    'flashear', 'garompa', 'facha', 'tranqui', 'bardo', 'birra', 'pucho', 'piola',
    'mandate', 'fijate', 'contame', 'viste', 'andá', 'tirá', 'bancá',
]

# Léxico no porteño que NO debería aparecer
LEXICO_NO_LOCAL = [
    r'\btío\b', r'\btía\b', r'\bvale\b', r'\bguay\b', r'\bmola\b', r'\bestupendo\b',
    r'\bordenador\b', r'\bmóvil\b', r'\bcoger\b', r'\bpatata\b', r'\bfresa\b',
    r'\bcoche\b', r'\bcarro\b', r'\bahorita\b', r'\bchavo\b', r'\bchava\b',
    r'\btú\b', r'\bcontigo\b', r'\bvosotros\b', r'\btienes\b', r'\bquieres\b',
    r'\bpuedes\b', r'\bsabes\b', r'\bhaces\b', r'\beres\b',
    r'\bgafas\b', r'\bjersey\b', r'\bnevera\b', r'\bfrigorífico\b', r'\bbocadillo\b',
    r'\bconducir\b', r'\bcurrar\b', r'\bcurro\b',
]

# Frases robóticas IA
FRASES_ROBOTICAS = [
    r'como modelo de lenguaje',
    r'soy un modelo de lenguaje',
    r'estoy aquí para ayudarte',
    r'no dudes en consultarme',
    r'lamento la confusión',
    r'el día de hoy',
    r'espero haber sido de ayuda',
]


def evaluar_respuesta(respuesta: str):
    """Devuelve dict con métricas de una respuesta."""
    r_lower = respuesta.lower()

    # Conteo modismos
    modismos_encontrados = sum(1 for m in MODISMOS if re.search(rf'\b{m}\b', r_lower))

    # Conteo léxico no local
    leximpros = []
    for pat in LEXICO_NO_LOCAL:
        if re.search(pat, r_lower):
            leximpros.append(pat.strip(r'\b'))

    # Frases robóticas
    roboticas = []
    for pat in FRASES_ROBOTICAS:
        if re.search(pat, r_lower):
            roboticas.append(pat)

    # Score 0-100
    score = 70  # base
    score += min(modismos_encontrados * 5, 25)  # +5 por modismo, max +25
    score -= len(leximpros) * 8                  # -8 por palabra no local
    score -= len(roboticas) * 10                 # -10 por frase robótica
    if modismos_encontrados == 0 and len(respuesta) > 50:
        score -= 5  # bajar si no usa NINGÚN modismo y la respuesta es larga
    score = max(0, min(100, score))

    return {
        'modismos_count': modismos_encontrados,
        'lexico_no_local': leximpros,
        'frases_roboticas': roboticas,
        'score': score,
        'length_chars': len(respuesta),
    }


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


def generar(model, tokenizer, prompt, max_tokens=150, temperature=0.8, top_p=0.93):
    """Genera respuesta usando MLX-LM."""
    from mlx_lm import generate
    try:
        from mlx_lm.sample_utils import make_sampler, make_logits_processors
        has_sampler = True
    except Exception:
        has_sampler = False

    # Mistral compat: fusionar system en user
    messages = [
        {"role": "user", "content": SYSTEM_PROMPT + "\n\n" + prompt}
    ]
    prompt_text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)

    kwargs = {"prompt": prompt_text, "max_tokens": max_tokens, "verbose": False}
    if has_sampler:
        try:
            kwargs["sampler"] = make_sampler(temp=temperature, top_p=top_p)
            kwargs["logits_processors"] = make_logits_processors(
                repetition_penalty=1.15, repetition_context_size=80
            )
        except Exception:
            pass

    output = generate(model, tokenizer, **kwargs)
    # Limpiar stop tokens (Mistral)
    for stop in ['</s>', '[INST]', '[/INST]', '<unk>']:
        if stop in output:
            output = output.split(stop)[0]
    return output.strip()


def correr_eval(adapter_path, model_name, label):
    """Corre la evaluación con un adapter dado y devuelve resultados."""
    print(f"\n[{label}] Cargando modelo (adapter={adapter_path})...", file=sys.stderr)
    if adapter_path and not os.path.isdir(adapter_path):
        adapter_path = None

    model, tokenizer = _load_model(model_name, adapter_path)
    print(f"[{label}] Modelo listo. Generando {len(PROMPTS_EVAL)} respuestas...", file=sys.stderr)

    resultados = []
    t0 = time.time()
    for i, prompt in enumerate(PROMPTS_EVAL):
        resp = generar(model, tokenizer, prompt)
        evalu = evaluar_respuesta(resp)
        resultados.append({
            'prompt': prompt,
            'respuesta': resp,
            **evalu,
        })
        if (i + 1) % 5 == 0:
            print(f"  {i+1}/{len(PROMPTS_EVAL)}...", file=sys.stderr)

    elapsed = time.time() - t0
    print(f"[{label}] Generadas en {elapsed:.0f}s", file=sys.stderr)

    # Agregar métricas globales
    total = len(resultados)
    with_modismo = sum(1 for r in resultados if r['modismos_count'] > 0)
    sum_modismos = sum(r['modismos_count'] for r in resultados)
    sum_score = sum(r['score'] for r in resultados)
    score_gt_80 = sum(1 for r in resultados if r['score'] > 80)
    total_lex_impuro = sum(len(r['lexico_no_local']) for r in resultados)
    total_robotica = sum(len(r['frases_roboticas']) for r in resultados)

    summary = {
        'label': label,
        'adapter': adapter_path,
        'total': total,
        'avg_score': round(sum_score / total, 1),
        'pct_with_modismo': round(with_modismo * 100 / total, 1),
        'pct_score_gt_80': round(score_gt_80 * 100 / total, 1),
        'avg_modismos_per_response': round(sum_modismos / total, 2),
        'total_lexico_no_local': total_lex_impuro,
        'total_frases_roboticas': total_robotica,
        'elapsed_seconds': round(elapsed, 1),
    }
    return {'summary': summary, 'results': resultados}


def comparar(file_a, file_b):
    a = json.loads(Path(file_a).read_text())
    b = json.loads(Path(file_b).read_text())
    sa, sb = a['summary'], b['summary']
    print(f"\n{'='*70}")
    print(f"  COMPARACIÓN: {sa['label']} vs {sb['label']}")
    print(f"{'='*70}")
    print(f"{'Métrica':<35} {'baseline':<15} {'nuevo':<15} {'delta':<10}")
    print(f"{'-'*70}")
    for key, label in [
        ('avg_score', 'Score medio'),
        ('pct_with_modismo', '% con ≥1 modismo'),
        ('pct_score_gt_80', '% score > 80'),
        ('avg_modismos_per_response', 'Densidad modismos'),
        ('total_lexico_no_local', 'Léxico no local total'),
        ('total_frases_roboticas', 'Frases robóticas total'),
    ]:
        va, vb = sa[key], sb[key]
        delta = vb - va
        flag = '↑' if delta > 0 else ('↓' if delta < 0 else '=')
        print(f"{label:<35} {str(va):<15} {str(vb):<15} {flag} {abs(delta):.2f}")
    print(f"{'='*70}\n")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--adapter", default="./adapters", help="Path al adapter (vacío = sin LoRA)")
    parser.add_argument("--label", default="actual", help="Etiqueta para identificar este run")
    parser.add_argument("--model", default="mlx-community/Mistral-7B-Instruct-v0.3-4bit")
    parser.add_argument("--compare", nargs=2, metavar=("FILE_A", "FILE_B"), help="Comparar 2 JSONs de eval")
    args = parser.parse_args()

    if args.compare:
        comparar(*args.compare)
        return

    output = correr_eval(args.adapter, args.model, args.label)
    print(json.dumps(output, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
