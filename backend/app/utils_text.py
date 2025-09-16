# backend/app/utils_text.py
import re, unicodedata

SYNONYMS = {
    # comunes en CX
    "mail": ["correo", "email", "e-mail"],
    "excel": ["hoja de cálculo", "spreadsheet"],
    "plataforma": ["herramienta", "sistema", "app"],
    "baja": ["desactivar", "dar de baja", "eliminar"],
    "alta": ["activar", "dar de alta", "crear"],
}

def normalize(s: str) -> str:
    s = s.lower().strip()
    s = "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))
    s = re.sub(r"\s+", " ", s)
    return s

def expand_synonyms(q: str) -> list[str]:
    qn = normalize(q)
    variants = {qn}
    for pivot, xs in SYNONYMS.items():
        for x in xs:
            if x in qn:
                variants.add(qn.replace(x, pivot))
    return list(variants)
