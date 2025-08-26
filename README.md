\# KORA MVP – Nubceo (Analista CX)



Asistente tipo \*\*chat\*\* para responder preguntas operativas del puesto \*\*Analista CX (Customer Experience)\*\* en Nubceo usando RAG + LLM de OpenAI.



---



\## 📂 Estructura

\- `frontend/` – Next.js (UI del chat).

\- `backend/` – FastAPI (endpoints `/ask`, `/ingest`, `/health`).

\- `data/` – fuentes internas:

&nbsp; - `raw/` → documentos originales.

&nbsp; - `normalized/` → convertidos a YAML (`kora\_doc`).

&nbsp; - `index/` → vector store (FAISS/pgvector).

\- `docs/` – alcance, fuera de alcance, decisiones de diseño.

\- `design/` – archivos/links de Figma.

\- `scripts/` – utilidades (chunking, ingest, evaluación).



---



\## 🚀 Cómo correr el proyecto



\### Frontend (Next.js)

```bash

cd frontend

npm install

npm run dev



