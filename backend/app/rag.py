from __future__ import annotations

import os, json, pickle
from pathlib import Path
from typing import List, Dict, Optional, Tuple

import faiss
import numpy as np
from openai import OpenAI

ROOT = Path(__file__).resolve().parents[2]
INDEX_DIR   = ROOT / "data" / "index"
FAISS_PATH  = INDEX_DIR / "faiss.index"
CHUNKS_JSON = INDEX_DIR / "chunks.json"
META_PKL    = INDEX_DIR / "meta.pkl"
DOCTOK_PKL  = INDEX_DIR / "doc_tokens.pkl"
CATALOG_PKL = INDEX_DIR / "catalog.pkl"

def _cosine_search(index: faiss.Index, qvec: np.ndarray, topk: int = 100) -> Tuple[np.ndarray, np.ndarray]:
    q = qvec.reshape(1, -1)
    scores, ids = index.search(q, topk)
    return scores[0], ids[0]

class Retriever:
    def __init__(self, client: OpenAI, embed_model: str, k: int = 8, search_k: int = 220):
        self.client = client
        self.embed_model = embed_model
        self.k = k
        self.search_k = search_k

        if not FAISS_PATH.exists():
            raise RuntimeError(f"No se encontró el índice FAISS: {FAISS_PATH}")
        if not CHUNKS_JSON.exists():
            raise RuntimeError(f"No se encontró chunks.json: {CHUNKS_JSON}")

        self.index  = faiss.read_index(str(FAISS_PATH))
        self.chunks = json.loads(CHUNKS_JSON.read_text(encoding="utf-8"))

        with open(META_PKL, "rb") as f:
            self.meta = pickle.load(f)
        with open(DOCTOK_PKL, "rb") as f:
            self.doc_tokens = pickle.load(f)
        with open(CATALOG_PKL, "rb") as f:
            self.catalog = pickle.load(f)

        self._embed_cache: Dict[str, np.ndarray] = {}

    def _embed(self, text: str) -> np.ndarray:
        if text in self._embed_cache:
            return self._embed_cache[text]
        resp = self.client.embeddings.create(model=self.embed_model, input=[text])
        vec = np.array(resp.data[0].embedding, dtype="float32")
        self._embed_cache[text] = vec
        return vec

    def _candidate_doc_ids(self, query: str, role: Optional[str], category: Optional[str]) -> Optional[set]:
        role = (role or "").strip().lower() or None
        category = (category or "").strip().lower() or None

        role_filtered = {d for d, c in self.catalog.items() if (role is None or c["role"] == role)}
        cat_filtered  = {d for d, c in self.catalog.items() if (category is None or c["category"] == category)}
        filtered = role_filtered & cat_filtered

        toks = {t for t in query.lower().split() if len(t) >= 3}
        if not toks:
            return filtered if filtered else None

        scored = []
        base_iter = filtered if filtered else self.doc_tokens.keys()
        for doc_id in base_iter:
            inter = len(toks & self.doc_tokens.get(doc_id, set()))
            if inter > 0:
                scored.append((inter, doc_id))
        scored.sort(reverse=True, key=lambda x: x[0])
        cand = {d for _, d in scored[:50]}
        if not cand:
            return filtered if filtered else None
        return cand if not filtered else (cand & filtered)

    def search(self, query: str, role: Optional[str] = None, category: Optional[str] = None) -> List[Dict]:
        qvec = self._embed(query)
        scores, ids = _cosine_search(self.index, qvec, topk=self.search_k)
        cand_doc_ids = self._candidate_doc_ids(query, role, category)

        results: List[Dict] = []
        for s, idx in zip(scores, ids):
            if idx < 0:
                continue
            m = self.meta[idx]
            if cand_doc_ids is not None and m["doc_id"] not in cand_doc_ids:
                continue
            results.append({
                "idx": int(idx),
                "score": float(s),
                "chunk_text": self.chunks[idx],   # ← siempre esta key
                "chunk_meta": m,
            })

        results.sort(key=lambda x: x["score"], reverse=True)
        return results[: self.k]

def get_retriever(client: OpenAI, embed_model: str, k: int = 8, search_k: int = 400) -> Retriever:
    # Singleton simple
    global _RETRIEVER_SINGLETON, _RETRIEVER_CFG
    try:
        _RETRIEVER_SINGLETON
        _RETRIEVER_CFG
    except NameError:
        _RETRIEVER_SINGLETON = None
        _RETRIEVER_CFG = ("", 0, 0)
    cfg = (embed_model, k, search_k)
    if _RETRIEVER_SINGLETON is None or cfg != _RETRIEVER_CFG:
        _RETRIEVER_SINGLETON = Retriever(client=client, embed_model=embed_model, k=k, search_k=search_k)
        _RETRIEVER_CFG = cfg
    return _RETRIEVER_SINGLETON

def _extract_text(hit: Dict) -> str:
    return (hit.get("chunk_text") or hit.get("text") or hit.get("content") or "").strip()

def build_context(hits: List[Dict], max_chars: int = 3500) -> str:
    if not hits:
        return ""
    parts, total = [], 0
    for h in hits:
        t = _extract_text(h)
        if not t:
            continue
        head = f"[{h.get('chunk_meta',{}).get('role','-')}/{h.get('chunk_meta',{}).get('category','-')}] {h.get('chunk_meta',{}).get('source','')}"
        cand = f"{head}\n{t}\n"
        if total + len(cand) > max_chars and total > 0:
            break
        parts.append(cand)
        total += len(cand)
    return "\n---\n".join(parts)