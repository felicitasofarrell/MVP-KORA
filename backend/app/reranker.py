from __future__ import annotations
from typing import List, Dict
from openai import OpenAI

def _get_text(h: Dict) -> str:
    """Soporta ambos formatos: 'chunk_text' (nuestro) o 'text' (fallback)."""
    return (h.get("chunk_text") or h.get("text") or "").strip()

def rerank_with_llm(
    client: OpenAI,
    model: str,
    question: str,
    hits: List[Dict],
    top_m: int = 6
) -> List[Dict]:
    """
    Reordena los hits por relevancia semántica. No cambia el contenido de cada hit.
    hits esperados: [{"chunk_text":..., "score":..., "chunk_meta": {...}}, ...]
    """
    if not hits:
        return []

    # Lote acotado para abaratar prompt
    sample = hits[:18]
    numbered = [f"{i+1}. {_get_text(h)[:900]}" for i, h in enumerate(sample)]

    prompt = (
        "Ordená los siguientes fragmentos por relevancia para responder la pregunta.\n"
        "Devolveme SOLO una lista de números (ids) separados por comas, sin explicación.\n\n"
        f"Pregunta: {question}\n\nFragmentos:\n" + "\n\n".join(numbered)
    )

    out = client.chat.completions.create(
        model=model,
        temperature=0.0,
        messages=[{"role": "user", "content": prompt}],
    ).choices[0].message.content or ""

    import re
    order = [int(x) - 1 for x in re.findall(r"\d+", out)]
    order = [i for i in order if 0 <= i < len(sample)]

    seen, ranked = set(), []
    for i in order:
        if i not in seen:
            seen.add(i)
            ranked.append(sample[i])
        if len(ranked) >= top_m:
            break

    # Fallback si el modelo devolvió pocos índices
    if len(ranked) < top_m:
        for h in sample:
            if h not in ranked:
                ranked.append(h)
            if len(ranked) >= top_m:
                break

    return ranked[:top_m]