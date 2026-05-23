"""
Retriever BM25 sobre train.jsonl para few-shot dinámico.

Los 319 ejemplos del dataset se cargan UNA vez al boot. En cada turno
recuperamos los top-k más similares al mensaje del usuario y los
inyectamos como few-shot en el prompt.

Cada ejemplo del JSONL tiene:
  user[0].content = "[SYSTEM_PROMPT_LARGO]\n\n[PREGUNTA REAL]"
  assistant[0].content = "[RESPUESTA]"

Extraemos solo la pregunta real (lo que viene después del último \n\n).
"""

import json
import re
from pathlib import Path
from typing import List, Tuple

from rank_bm25 import BM25Okapi


_STOPWORDS_ES = {
    "a", "al", "ante", "bajo", "con", "contra", "de", "del", "desde", "durante",
    "en", "entre", "hacia", "hasta", "mediante", "para", "por", "según", "sin",
    "sobre", "tras", "el", "la", "los", "las", "un", "una", "unos", "unas",
    "y", "o", "u", "ni", "que", "se", "no", "si", "su", "sus", "es", "son",
    "lo", "le", "les", "me", "te", "mi", "tu", "ya", "vos", "yo",
}


def _tokenize(text: str) -> List[str]:
    """Tokenización simple: lowercase + alfa + filtrar stopwords cortas."""
    tokens = re.findall(r"\b[a-záéíóúñ]{2,}\b", text.lower())
    return [t for t in tokens if t not in _STOPWORDS_ES]


def _extract_user_question(content: str) -> str:
    """Extrae la pregunta real eliminando el system prompt embebido.
    El dataset legacy concatenaba system\\n\\npregunta en el user message."""
    parts = content.rsplit("\n\n", 1)
    return parts[-1].strip()


class FewShotRetriever:
    def __init__(self, jsonl_path: str | Path):
        self.examples: List[Tuple[str, str]] = []  # [(pregunta, respuesta), ...]
        path = Path(jsonl_path)
        with path.open("r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    continue
                msgs = obj.get("messages", [])
                if len(msgs) < 2:
                    continue
                user_msg = msgs[0].get("content", "")
                assistant_msg = msgs[1].get("content", "")
                pregunta = _extract_user_question(user_msg)
                respuesta = assistant_msg.strip()
                if pregunta and respuesta:
                    self.examples.append((pregunta, respuesta))

        # Índice BM25 sobre las preguntas
        tokenized = [_tokenize(q) for q, _ in self.examples]
        self.bm25 = BM25Okapi(tokenized) if tokenized else None
        print(f"[retriever] Indexados {len(self.examples)} ejemplos para few-shot dinámico.")

    def retrieve(self, query: str, k: int = 3, min_score: float = 0.3) -> List[Tuple[str, str]]:
        """Devuelve los top-k pares (pregunta, respuesta) más similares al query.
        Si el score top está bajo el threshold, devuelve lista vacía para no
        contaminar el prompt con ejemplos irrelevantes."""
        if not self.bm25 or not query.strip():
            return []
        q_tokens = _tokenize(query)
        if not q_tokens:
            return []
        scores = self.bm25.get_scores(q_tokens)
        # Top-k índices por score descendente
        ranked = sorted(range(len(scores)), key=lambda i: -scores[i])[:k]
        if not ranked or scores[ranked[0]] < min_score:
            return []
        return [self.examples[i] for i in ranked if scores[i] >= min_score]


def format_fewshot_block(pairs: List[Tuple[str, str]]) -> str:
    """Formatea ejemplos como bloque de texto para inyectar en el system prompt."""
    if not pairs:
        return ""
    lines = ["EJEMPLOS DE CÓMO RESPONDÉS (seguí este tono):"]
    for q, a in pairs:
        lines.append(f"Usuario: {q}")
        lines.append(f"Vos: {a}")
        lines.append("")
    return "\n".join(lines).strip()
