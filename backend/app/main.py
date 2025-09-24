from __future__ import annotations

import os
from pathlib import Path
from typing import Optional, List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from openai import OpenAI

from .utils_text import expand_synonyms
from .reranker import rerank_with_llm
from .prompt_loader import load_prompt
from .rag import get_retriever, build_context
from .query_rewriter import rewrite_queries

load_dotenv()

API_BASES = ["http://localhost:5173", "http://127.0.0.1:5173"]

app = FastAPI(title="KORA MVP - Nubceo CX")
app.add_middleware(
    CORSMiddleware,
    allow_origins=API_BASES,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
OPENAI_MODEL  = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
REWRITE_MODEL = os.getenv("REWRITE_MODEL", OPENAI_MODEL)
EMBED_MODEL   = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
ENABLE_QUERY_REWRITE = os.getenv("ENABLE_QUERY_REWRITE", "1") == "1"
PROMPT_PATH   = os.getenv("PROMPT_PATH")

class AskRequest(BaseModel):
    question: str
    role: Optional[str] = None
    category: Optional[str] = None

class AskResponse(BaseModel):
    answer: str

@app.get("/")
def root():
    return {"service": "KORA MVP - Nubceo CX", "endpoints": ["/health", "/ask", "/prompt", "/debug", "/docs"]}

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/prompt")
def get_prompt():
    try:
        p = load_prompt(PROMPT_PATH)
        return {"path": PROMPT_PATH, "prompt": p[:1000] + ("..." if len(p) > 1000 else "")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"prompt load failed: {type(e).__name__}: {e}")

@app.get("/debug")
def debug():
    root = Path(__file__).resolve().parents[2]
    idx = root / "data" / "index"
    files = {
        "faiss.index":  (idx / "faiss.index").exists(),
        "chunks.json":  (idx / "chunks.json").exists(),   # ← actualizado
        "meta.pkl":     (idx / "meta.pkl").exists(),
        "doc_tokens.pkl": (idx / "doc_tokens.pkl").exists(),
        "catalog.pkl":    (idx / "catalog.pkl").exists(),
    }
    return {
        "OPENAI_MODEL": OPENAI_MODEL,
        "EMBED_MODEL": EMBED_MODEL,
        "ENABLE_QUERY_REWRITE": ENABLE_QUERY_REWRITE,
        "PROMPT_PATH": PROMPT_PATH,
        "index_dir": str(idx),
        "index_files_exist": files,
    }

@app.post("/ask", response_model=AskResponse)
def ask(req: AskRequest):
    print(f"[ASK] q='{req.question}' role='{req.role}' category='{req.category}'")
    try:
        system_prompt = load_prompt(PROMPT_PATH)
    except Exception as e:
        print("[ASK][ERROR] prompt:", e)
        raise HTTPException(status_code=500, detail=f"prompt load failed: {type(e).__name__}: {e}")

    # Variantes: sinónimos + rewriter (si está activo), dedup y límite
    variants = set(expand_synonyms(req.question))
    variants.add(req.question)

    try:
        if ENABLE_QUERY_REWRITE:
            rew = rewrite_queries(
                client=client,
                model=REWRITE_MODEL,
                user_q=req.question,
                role=(req.role or "").lower() or None,
                category=(req.category or "").lower() or None,
            )
            variants.update(rew)
    except Exception as e:
        print("[ASK][WARN] rewriter failed:", e)

    qvars = list(variants)[:5]

    # Retriever
    try:
        retriever = get_retriever(client=client, embed_model=EMBED_MODEL, k=8, search_k=220)
    except Exception as e:
        print("[ASK][ERROR] retriever init:", e)
        raise HTTPException(status_code=500, detail=f"retriever init failed: {type(e).__name__}: {e}")

    # Buscar + fusionar + re-rank
    try:
        seen, merged_hits = set(), []
        per_variant_k = max(4, retriever.k // 2)

        for qv in qvars:
            hits = retriever.search(
                qv,
                role=(req.role or "").lower() or None,
                category=(req.category or "").lower() or None,
            )
            for h in hits[:per_variant_k]:
                ck = h.get("chunk_meta", {}).get("chunk_id")
                if ck and ck not in seen:
                    seen.add(ck)
                    merged_hits.append(h)

        if len(merged_hits) < retriever.k:
            hits = retriever.search(
                req.question,
                role=(req.role or "").lower() or None,
                category=(req.category or "").lower() or None,
            )
            for h in hits:
                ck = h.get("chunk_meta", {}).get("chunk_id")
                if ck and ck not in seen:
                    seen.add(ck)
                    merged_hits.append(h)
                if len(merged_hits) >= retriever.k:
                    break

        merged_hits.sort(key=lambda x: x.get("score", 0.0), reverse=True)
        merged_hits = merged_hits[: retriever.k]
        merged_hits = rerank_with_llm(client, OPENAI_MODEL, req.question, merged_hits, top_m=retriever.k)

        # Log preventivo: verificar que traigan texto
        for h in merged_hits[:2]:
            if not (h.get("chunk_text") or h.get("text")):
                print("[ASK][WARN] hit sin texto:", h.get("idx"), h.get("chunk_meta", {}).get("source"))

        context = build_context(merged_hits)
    except Exception as e:
        print("[ASK][ERROR] retrieval/build_context:", e)
        raise HTTPException(status_code=500, detail=f"retrieval failed: {type(e).__name__}: {e}")

    # Generación con guardrails
    try:
        guardrails = (
            "Usá EXCLUSIVAMENTE el contexto.\n"
            "Si el contexto es insuficiente, pedí UNA aclaración concreta en una sola oración.\n"
            "Si realmente no hay nada útil, respondé: "
            "\"No tengo información suficiente en los documentos para responder eso.\""
            "\n\nContexto:\n" + context
        )
        completion = client.chat.completions.create(
            model=OPENAI_MODEL,
            temperature=0.1,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "system", "content": guardrails},
                {"role": "user", "content": req.question},
            ],
        )
        answer = completion.choices[0].message.content or ""
        return AskResponse(answer=answer)
    except Exception as e:
        print("[ASK][ERROR] LLM:", e)
        raise HTTPException(status_code=500, detail=f"generation failed: {type(e).__name__}: {e}")

from fastapi import BackgroundTasks
import time
import mss
import mss.tools
from pathlib import Path

SAVE_DIR = Path("C:/Users/camila/Desktop/MVP-KORA-main/capt_img_kora")
SAVE_DIR.mkdir(parents=True, exist_ok=True)

def take_screenshots(n: int = 3, delay: int = 5):
    with mss.mss() as sct:
        monitor = sct.monitors[1]  # pantalla principal
        for i in range(n):
            ts = time.strftime("%Y%m%d-%H%M%S")
            filename = SAVE_DIR / f"kora-capture-{ts}-{i+1}.png"
            img = sct.grab(monitor)
            mss.tools.to_png(img.rgb, img.size, output=str(filename))
            time.sleep(delay)

@app.post("/screenshot")
def screenshot(background_tasks: BackgroundTasks):
    background_tasks.add_task(take_screenshots, 3, 5)  # 3 capturas, 5s entre cada una
    return {"status": "ok", "path": str(SAVE_DIR)}
