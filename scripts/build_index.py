# scripts/build_index.py
import os, re, json, pickle, argparse, io, shutil, zipfile, tempfile
from pathlib import Path
from typing import List, Dict, Tuple
import numpy as np
from typing import List, Dict, Tuple, Optional

# ── Extras nuevas ──────────────────────────────────────────────────────────────
import pypandoc
from PIL import Image

try:
    import pytesseract
except Exception:
    pytesseract = None

try:
    from pdf2image import convert_from_path
except Exception:
    convert_from_path = None

try:
    from pypdf import PdfReader
except Exception:
    PdfReader = None

import faiss
from dotenv import load_dotenv
from openai import OpenAI


# ── Utils ─────────────────────────────────────────────────────────────────────
def log(msg: str):
    print(f"[build_index] {msg}")

def normalize_md(s: str) -> str:
    s = s.replace("\u00a0", " ")
    # Compactar espacios, mantener estructura Markdown
    s = re.sub(r"[ \t]+", " ", s)
    # Limpiar saltos redundantes, pero respetar bloques
    s = re.sub(r"\n{4,}", "\n\n\n", s).strip()
    return s

def chunk_markdown(text: str, max_chars=1200, overlap=200) -> List[str]:
    """
    Chunking sensible a Markdown: intenta cortar por encabezados, si no por párrafos,
    y aplica solapamiento en los límites.
    """
    # Primero, split por encabezados h1-h3
    blocks = re.split(r"(?m)^(#{1,3}\s.+)$", text)
    # Reconstruir como pares [header, body]
    rebuilt = []
    i = 0
    while i < len(blocks):
        if re.match(r"(?m)^#{1,3}\s", blocks[i] or ""):
            header = blocks[i]
            body = blocks[i + 1] if i + 1 < len(blocks) else ""
            rebuilt.append((header, body))
            i += 2
        else:
            # contenido sin encabezado inicial
            rebuilt.append(("", blocks[i]))
            i += 1

    chunks = []
    buf = ""
    def flush():
        nonlocal buf
        b = buf.strip()
        if b:
            chunks.append(b)
        buf = ""

    for header, body in rebuilt:
        piece = (header + "\n" + body).strip()
        if not piece:
            continue
        if len(buf) + len(piece) + 1 <= max_chars:
            buf = (buf + "\n\n" + piece).strip()
        else:
            if buf:
                flush()
            # iniciar nuevo con solapamiento del tail
            if overlap and len(piece) > max_chars:
                # si el bloque es gigantesco, partir por párrafos
                paras = [p for p in piece.split("\n\n") if p.strip()]
                temp = ""
                for p in paras:
                    if len(temp) + len(p) + 2 <= max_chars:
                        temp = (temp + "\n\n" + p).strip()
                    else:
                        if temp:
                            chunks.append(temp)
                        tail = temp[-overlap:] if overlap and len(temp) > overlap else ""
                        temp = (tail + "\n\n" + p).strip()
                if temp:
                    chunks.append(temp)
                buf = ""
            else:
                tail = buf[-overlap:] if overlap and len(buf) > overlap else ""
                buf = (tail + "\n\n" + piece).strip()

    if buf:
        chunks.append(buf)
    return chunks


# ── Conversión a Markdown ─────────────────────────────────────────────────────
def set_tesseract_cmd_from_env():
    # Permite definir ruta a binario Tesseract (Windows)
    # Ej .env: TESSERACT_CMD="C:\Program Files\Tesseract-OCR\tesseract.exe"
    cmd = os.getenv("TESSERACT_CMD", "").strip()
    if cmd and pytesseract:
        # Quitar comillas si vinieron desde .env
        if (cmd.startswith('"') and cmd.endswith('"')) or (cmd.startswith("'") and cmd.endswith("'")):
            cmd = cmd[1:-1]
        pytesseract.pytesseract.tesseract_cmd = cmd
        if not Path(cmd).exists():
            log(f"⚠️  TESSERACT_CMD apunta a un ejecutable inexistente: {cmd}")
        else:
            log(f"Tesseract OK en: {cmd}")


def ocr_image_to_text(img: Image.Image, lang_hint: str = None) -> str:
    if pytesseract is None:
        log("⚠️  pytesseract no importado; sin OCR.")
        return ""
    lang = lang_hint or os.getenv("OCR_LANG", "spa+eng")
    try:
        txt = pytesseract.image_to_string(img, lang=lang)
        return (txt or "").strip()
    except Exception as e:
        log(f"⚠️  Error OCR con lang='{lang}': {e}")
        # Sugerencia: reintentar solo con 'eng' por si 'spa' no está instalado
        try:
            txt = pytesseract.image_to_string(img, lang="eng")
            log("↪️  Reintenté OCR con 'eng' y siguió.")
            return (txt or "").strip()
        except Exception as e2:
            log(f"⚠️  OCR también falló con 'eng': {e2}")
            return ""


def extract_docx_images_to(temp_dir: Path, docx_path: Path) -> List[Path]:
    """
    Extrae /word/media/* del docx a temp_dir / 'media_docx'.
    """
    out_dir = temp_dir / "media_docx"
    out_dir.mkdir(exist_ok=True, parents=True)
    try:
        with zipfile.ZipFile(docx_path, 'r') as z:
            for name in z.namelist():
                if name.startswith("word/media/") and not name.endswith("/"):
                    dest = out_dir / Path(name).name
                    with z.open(name) as src, open(dest, "wb") as dst:
                        shutil.copyfileobj(src, dst)
    except Exception:
        pass
    return list(out_dir.glob("*"))
def safe_markdown_img(alt: str, rel_path: Path) -> str:
    rel = str(rel_path).replace("\\", "/")
    return f"![{alt}]({rel})"

def rewrite_and_collect_images(
    md_text: str,
    md_out: Path,
    media_dir: Path,
    moved_files_existing: Dict[str, Path],  # ← recibe lo ya movido (desde *_media_tmp y/o word/media)
) -> Tuple[str, Dict[str, Path]]:
    """
    - Reescribe <img src="..."> y ![alt](...) a sintaxis Markdown con rutas relativas.
    - Si el src es absoluto y el archivo existe, lo copia a media_dir.
    - Usa 'moved_files_existing' para mapear basenames ya movidos (evita placeholders).
    - Devuelve (md_text_reescrito, moved_files_total).
    """
    moved_files: Dict[str, Path] = dict(moved_files_existing)  # base con lo ya movido

    def move_if_exists(src_path: str) -> Optional[Path]:
        try:
            p = Path(src_path)
            if p.is_file():
                dst = media_dir / p.name
                if not dst.exists():
                    shutil.copy2(p, dst)
                moved_files[p.name] = dst
                return dst
        except Exception:
            return None
        return None

    # --- <img ...> ---
    def html_img_repl(m):
        src = m.group(1).strip().strip("<>").replace("\\", "/")
        alt = (m.group(2) or "Imagen").strip()
        base = os.path.basename(src)
        dst: Optional[Path] = None

        # 1) si ya lo movimos antes
        if base in moved_files:
            dst = moved_files[base]
        else:
            # 2) ruta absoluta → intentar copiar
            if os.path.isabs(src):
                dst = move_if_exists(src)
            else:
                # 3) relativa → probar al lado del MD
                candidate = (md_out.parent / src)
                if candidate.is_file():
                    dst = candidate
                else:
                    # 4) o en media_dir por basename
                    candidate2 = (media_dir / base)
                    if candidate2.is_file():
                        dst = candidate2

        if dst is None:
            # Placeholder (no rompe) si NO existe el archivo en ningún lado
            return f"{safe_markdown_img(alt, Path('#'))}\n\n> ⚠️ Imagen **{base}** no disponible."
        else:
            moved_files[base] = dst  # aseguralo en el dict
            rel = os.path.relpath(dst, md_out.parent).replace("\\", "/")
            return safe_markdown_img(alt, Path(rel))

    md_text = re.sub(
        r'<img[^>]*\ssrc="([^"]+)"[^>]*?(?:alt="([^"]*)")?[^>]*>',
        html_img_repl,
        md_text,
        flags=re.IGNORECASE
    )

    # --- ![alt](...) ---
    def md_img_repl(m):
        alt = (m.group(1) or "Imagen").strip()
        src = m.group(2).strip().strip("<>").replace("\\", "/")
        base = os.path.basename(src)
        dst: Optional[Path] = None

        if base in moved_files:
            dst = moved_files[base]
        else:
            if os.path.isabs(src):
                dst = move_if_exists(src)
            else:
                candidate = (md_out.parent / src)
                if candidate.is_file():
                    dst = candidate
                else:
                    candidate2 = (media_dir / base)
                    if candidate2.is_file():
                        dst = candidate2

        if dst is None:
            return f"{safe_markdown_img(alt, Path('#'))}\n\n> ⚠️ Imagen **{base}** no disponible."
        else:
            moved_files[base] = dst
            rel = os.path.relpath(dst, md_out.parent).replace("\\", "/")
            return safe_markdown_img(alt, Path(rel))

    md_text = re.sub(r'!\[([^\]]*)\]\(([^)]+)\)', md_img_repl, md_text)

    return md_text, moved_files

def convert_docx_to_markdown(docx_path: Path, md_out: Path, media_dir: Path) -> str:
    """
    DOCX -> MD con pypandoc, asegura:
    - mover media exportada a media_dir,
    - capturar imágenes absolutas (<img src="C:\...">) copiándolas a media_dir,
    - reescribir rutas a relativas,
    - correr OCR sobre lo que quedó en media_dir.
    """
    media_dir.mkdir(parents=True, exist_ok=True)

    # 1) Convertir con Pandoc a MD, extrayendo media a temp
    temp_media_root = md_out.parent / f"{md_out.stem}_media_tmp"
    if temp_media_root.exists():
        shutil.rmtree(temp_media_root)
    temp_media_root.mkdir(exist_ok=True, parents=True)

    try:
        md_text = pypandoc.convert_file(
            str(docx_path),
            "gfm",
            extra_args=["--wrap=none", f"--extract-media={temp_media_root}"]
        )
    except Exception as e:
        log(f"pypandoc DOCX fallo ({docx_path.name}): {e}")
        md_text = ""

    # 2) Mover media exportada por Pandoc a media_dir
    moved_files: Dict[str, Path] = {}
    if temp_media_root.exists():
        for root, _, files in os.walk(temp_media_root):
            for fn in files:
                src = Path(root) / fn
                dst = media_dir / fn
                try:
                    if not dst.exists():
                        shutil.move(str(src), str(dst))
                    moved_files[fn] = dst
                except Exception as e:
                    log(f"⚠️  No pude mover imagen {fn}: {e}")
        shutil.rmtree(temp_media_root, ignore_errors=True)

    # 3) Fallback: extraer imágenes crudas del DOCX (word/media/*) y sumarlas si faltan
    with tempfile.TemporaryDirectory() as td:
        extracted = extract_docx_images_to(Path(td), docx_path)
        for p in extracted:
            dst = media_dir / p.name
            if not dst.exists():
                try:
                    shutil.copy2(p, dst)
                    moved_files[p.name] = dst
                except Exception as e:
                    log(f"⚠️  No pude copiar imagen extraída {p.name}: {e}")

    # 4) Reescribir rutas (HTML y Markdown) usando lo ya movido para evitar placeholders
    if md_text:
        md_text, extra_moved = rewrite_and_collect_images(md_text, md_out, media_dir, moved_files)
        moved_files.update({k: v for k, v in extra_moved.items() if k not in moved_files})


    # 5) OCR de imágenes reales (solo lo que está en media_dir)
    ocr_blocks = []
    for img_path in sorted(media_dir.glob("*")):
        if not img_path.exists():
            continue
        try:
            with Image.open(img_path) as im:
                txt = ocr_image_to_text(im)
        except Exception:
            txt = ""
        if txt:
            rel = os.path.relpath(img_path, md_out.parent).replace("\\", "/")
            ocr_txt = txt.replace("\n", "\n> ")
            ocr_blocks.append(f"![Imagen]({rel})\n\n> **OCR:**\n>\n> {ocr_txt}\n")

    # 6) Añadir bloque OCR
    if ocr_blocks:
        md_text = (md_text or "").rstrip() + "\n\n---\n\n### OCR de imágenes\n\n" + "\n\n".join(ocr_blocks)

    # 7) Normalizar y guardar
    md_text = normalize_md(md_text or "")
    md_out.write_text(md_text, encoding="utf-8")
    return md_text

def convert_pdf_to_markdown(pdf_path: Path, md_out: Path, media_dir: Path) -> str:
    """
    Convierte PDF -> MD. 
    1) Intenta con pypandoc (texto embebido).
    2) Si el PDF no tiene suficiente texto, hace fallback a OCR con pdf2image + pytesseract.
    """
    media_dir.mkdir(parents=True, exist_ok=True)

    # Heurística rápida: ¿el PDF ya tiene texto?
    non_ocr_text = quick_pdf_text(pdf_path)
    has_text = len(non_ocr_text) >= 200

    md_text = ""
    if has_text:
        try:
            temp_media_root = md_out.parent / f"{md_out.stem}_media_tmp"
            if temp_media_root.exists():
                shutil.rmtree(temp_media_root)
            temp_media_root.mkdir(exist_ok=True, parents=True)

            md_text = pypandoc.convert_file(
                str(pdf_path),
                "gfm",
                extra_args=["--wrap=none", f"--extract-media={temp_media_root}"]
            )

            # mover media exportada a media_dir
            if temp_media_root.exists():
                for root, _, files in os.walk(temp_media_root):
                    for fn in files:
                        src = Path(root) / fn
                        dst = media_dir / fn
                        if not dst.exists():
                            shutil.move(str(src), str(dst))
                shutil.rmtree(temp_media_root, ignore_errors=True)
        except Exception as e:
            log(f"pypandoc PDF fallo ({pdf_path.name}): {e}")
            md_text = ""

    # Fallback OCR si no hubo texto
    if not md_text or len(md_text) < 200:
        if convert_from_path is None or pytesseract is None:
            log("⚠️  No hay pdf2image o pytesseract: no puedo hacer OCR de PDF.")
        else:
            pages: List[Image.Image] = convert_from_path(str(pdf_path), dpi=200)
            ocr_sections = []
            for i, im in enumerate(pages, start=1):
                txt = ocr_image_to_text(im)
                page_img_path = media_dir / f"{pdf_path.stem}_page_{i:03d}.png"
                try:
                    im.save(page_img_path)
                except Exception:
                    pass
                rel = os.path.relpath(page_img_path, md_out.parent).replace("\\", "/")
                ocr_sections.append(f"## Página {i}\n\n![Página {i}]({rel})\n\n{txt}\n")
            md_text = "\n\n".join(ocr_sections)

    md_text = normalize_md(md_text or non_ocr_text)
    md_out.write_text(md_text, encoding="utf-8")
    return md_text

def quick_pdf_text(pdf_path: Path) -> str:
    """Texto rápido con pypdf (sin OCR) para medir 'cuánto texto hay'."""
    if PdfReader is None:
        return ""
    try:
        r = PdfReader(str(pdf_path))
        parts = []
        for pg in r.pages:
            try:
                parts.append(pg.extract_text() or "")
            except Exception:
                parts.append("")
        return "\n".join(parts).strip()
    except Exception:
        return ""

# ── Tokenización/metadata ─────────────────────────────────────────────────────
def tokenize_title(name: str) -> set:
    base = name.lower()
    base = re.sub(r"[^a-z0-9áéíóúüñ ]+", " ", base)
    toks = [t for t in base.split() if len(t) >= 3]
    return set(toks)

def infer_tags(path: Path, raw_root: Path) -> Tuple[str, str]:
    try:
        rel = path.relative_to(raw_root)
        parts = rel.parts
        role = parts[0] if len(parts) >= 2 else "default"
        category = parts[1] if len(parts) >= 3 else "general"
    except Exception:
        role, category = "default", "general"
    return role.lower(), category.lower()


# ── Embeddings ────────────────────────────────────────────────────────────────
def embed_batch(client: OpenAI, model: str, texts: List[str]) -> np.ndarray:
    resp = client.embeddings.create(model=model, input=texts)
    vecs = [np.array(d.embedding, dtype="float32") for d in resp.data]
    return np.vstack(vecs)


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--max-chars", type=int, default=1200)
    parser.add_argument("--overlap", type=int, default=200)
    args = parser.parse_args()

    ROOT = Path(__file__).resolve().parents[1]
    RAW_DIR = ROOT / "data" / "raw"
    MD_DIR = ROOT / "data" / "markdown"     # <— ahora guardamos .md acá
    INDEX_DIR = ROOT / "data" / "index"
    MD_DIR.mkdir(parents=True, exist_ok=True)
    INDEX_DIR.mkdir(parents=True, exist_ok=True)

    log(f"ROOT      = {ROOT}")
    log(f"RAW_DIR   = {RAW_DIR}")
    log(f"MD_DIR    = {MD_DIR}")
    log(f"INDEX_DIR = {INDEX_DIR}")

    # Env + OpenAI
    load_dotenv(ROOT / "backend" / ".env")
    load_dotenv(ROOT / ".env")
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY no está configurada (.env)")
    embed_model = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
    client = OpenAI(api_key=api_key)
    log(f"EMBED_MODEL = {embed_model}")

    # Tesseract path (opcional)
    set_tesseract_cmd_from_env()

    # Renombrar .dpcx -> .docx si existieran (recursivo)
    for p in RAW_DIR.rglob("*.dpcx"):
        newp = p.with_suffix(".docx")
        log(f"Renombrando {p.name} -> {newp.name}")
        p.rename(newp)

    # Recolectar DOCX y PDF
    files = sorted(list(RAW_DIR.rglob("*.docx")) + list(RAW_DIR.rglob("*.pdf")))
    log(f"Encontrados {len(files)} archivos en raw (recursivo)")
    if not files:
        log("No se encontraron documentos en data/raw. Nada para indexar.")
        return

    all_chunks: List[str] = []
    meta: List[Dict] = []
    doc_tokens: Dict[str, set] = {}
    catalog: Dict[str, Dict] = {}

    for path in files:
        role, category = infer_tags(path, RAW_DIR)
        relpath = str(path.relative_to(RAW_DIR))
        filename = path.name
        doc_id = f"{role}/{category}/{filename}"

        log(f"Procesando: {relpath}  (role={role}, cat={category})")

        # Dónde saldrá el .md y sus medios
        md_out_dir = MD_DIR / role / category
        md_out_dir.mkdir(parents=True, exist_ok=True)
        md_out_path = md_out_dir / f"{path.stem}.md"
        media_dir = md_out_dir / f"{path.stem}_media"
        media_dir.mkdir(parents=True, exist_ok=True)

        # Convertir a Markdown (con OCR si hace falta)
        try:
            if path.suffix.lower() == ".docx":
                md_text = convert_docx_to_markdown(path, md_out_path, media_dir)
            else:
                md_text = convert_pdf_to_markdown(path, md_out_path, media_dir)
        except Exception as e:
            log(f"❌ Error convirtiendo {filename} a MD: {e}")
            continue

        # Chunking
        chunks = chunk_markdown(md_text, max_chars=args.max_chars, overlap=args.overlap)
        log(f"  -> {len(chunks)} chunks")

        for i, ch in enumerate(chunks):
            all_chunks.append(ch)
            meta.append({
                "source": filename,
                "chunk_id": f"{Path(filename).stem}_{i:04d}",
                "relpath": relpath,
                "doc_id": doc_id,
                "role": role,
                "category": category,
                "format": "markdown",
                "md_path": str(md_out_path.relative_to(MD_DIR)),
            })

        # Índice invertido liviano
        doc_tokens[doc_id] = (
            tokenize_title(filename) |
            tokenize_title(role) |
            tokenize_title(category)
        )

        # Catálogo
        catalog[doc_id] = {
            "role": role,
            "category": category,
            "filename": filename,
            "relpath": relpath,
            "format": "markdown",
            "md_path": str(md_out_path.relative_to(MD_DIR)),
        }

    if not all_chunks:
        log("No se generaron chunks. ¿Los archivos tienen texto?")
        return

    # Embeddings + FAISS
    log(f"Creando embeddings para {len(all_chunks)} chunks…")
    X = embed_batch(client, embed_model, all_chunks)
    d = X.shape[1]
    index = faiss.IndexFlatIP(d)  # Inner Product (vectores normalizados)
    index.add(X)

    # Guardado
    faiss.write_index(index, str(INDEX_DIR / "faiss.index"))
    (INDEX_DIR / "chunks.json").write_text(json.dumps(all_chunks, ensure_ascii=False), encoding="utf-8")
    with open(INDEX_DIR / "meta.pkl", "wb") as f:
        pickle.dump(meta, f)
    with open(INDEX_DIR / "doc_tokens.pkl", "wb") as f:
        pickle.dump(doc_tokens, f)
    with open(INDEX_DIR / "catalog.pkl", "wb") as f:
        pickle.dump(catalog, f)

    log("OK ✅ Índice y metadatos guardados en data/index:")
    log("   - faiss.index")
    log("   - chunks.json")
    log("   - meta.pkl")
    log("   - doc_tokens.pkl")
    log("   - catalog.pkl")
    log("MDs disponibles en data/markdown/.")


if __name__ == "__main__":
    main()
