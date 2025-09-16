from functools import lru_cache
from pathlib import Path
import yaml

def _section(title: str, body: str) -> str:
    return f"{title}:\n{body.strip()}\n"

def _bullets(items) -> str:
    return "\n".join([f"- {str(x).strip()}" for x in items])

def build_system_prompt(cfg: dict) -> str:
    parts = []
    if role := cfg.get("role"):
        parts.append(role.strip())

    if bg := cfg.get("background"):
        parts.append(_section("Contexto", bg))

    if goals := cfg.get("goals"):
        parts.append(_section("Objetivos", _bullets(goals)))

    if tone := cfg.get("tone"):
        parts.append(_section("Tono", tone))

    if sg := cfg.get("style_guidelines"):
        parts.append(_section("Guías de estilo", _bullets(sg)))

    if cons := cfg.get("constraints"):
        parts.append(_section("Restricciones", _bullets(cons)))

    if fmt := cfg.get("response_format"):
        parts.append(_section("Formato de respuesta", fmt))

    return "\n\n".join(parts).strip()

@lru_cache(maxsize=1)
def load_prompt(path: str) -> str:
    p = Path(path)
    with p.open("r", encoding="utf-8") as f:
        cfg = yaml.safe_load(f) or {}
    return build_system_prompt(cfg)
