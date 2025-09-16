# backend/app/query_rewriter.py
from __future__ import annotations
from typing import List, Optional
import json

REWRITE_SYS = (
    "Sos un asistente que reescribe consultas de usuario para MEJORAR LA BÚSQUEDA "
    "en un índice de documentos. Trabajás en español. "
    "Devolvés SOLO JSON con una clave 'queries' (lista de 2 a 4 variantes). "
    "No expliques nada. No agregues texto fuera del JSON."
)

def _rewrite_prompt(user_q: str, role: Optional[str], category: Optional[str]) -> str:
    ctx = []
    if role:
        ctx.append(f"rol={role}")
    if category:
        ctx.append(f"categoria={category}")
    ctx_str = (" (" + ", ".join(ctx) + ")") if ctx else ""
    return (
        f"Consulta original{ctx_str}: {user_q}\n\n"
        "Instrucciones:\n"
        "- Reformulá la consulta para recuperar documentos relevantes.\n"
        "- Incluí sinónimos/falias comunes (correo/email, baja/cancelar, reporte/informe, plataforma/sistema/herramienta, ticket/caso/incidencia, procesadora/pasarela/gateway).\n"
        "- No inventes datos. Mantené el idioma en español. "
        "- Salida SOLO JSON: {\"queries\": [\"...\",\"...\"]}\n"
        "Sugerí 2 a 4 variantes."
    )

def rewrite_queries(client, model: str, user_q: str, role: Optional[str], category: Optional[str]) -> List[str]:
    """
    Usa LLM para producir variantes de búsqueda.
    Devuelve lista de strings. Si falla, devuelve [user_q].
    """
    try:
        prompt = _rewrite_prompt(user_q, role, category)
        resp = client.chat.completions.create(
            model=model,
            temperature=0.2,
            messages=[
                {"role": "system", "content": REWRITE_SYS},
                {"role": "user", "content": prompt},
            ],
        )
        raw = resp.choices[0].message.content.strip()
        data = json.loads(raw)
        qs = data.get("queries", [])
        # sanitizar
        qs = [q.strip() for q in qs if isinstance(q, str) and q.strip()]
        # siempre incluimos la original al final para asegurar cobertura
        if user_q not in qs:
            qs.append(user_q)
        # de 2 a 4 + original → limitamos a 5
        return qs[:5]
    except Exception:
        return [user_q]
