# 🚀 KORA MVP – Nubceo (Analista CX)

Este repositorio contiene el **MVP del proyecto KORA**, que incluye:

- **Frontend**: React + Vite (interfaz tipo chat).
- **Backend**: FastAPI (API con endpoints `/ask`, `/ingest`, `/health`).
- **Objetivo**: Crear un asistente interno para el puesto **Analista CX** en Nubceo, que responde preguntas basadas en documentación interna usando RAG + OpenAI.

---

## 📂 Estructura

```
MVP-KORA/
├── backend/         → API con FastAPI
│   ├── app/         → código principal (main.py, routers, services)
│   ├── requirements.txt
│   └── .venv/       → entorno virtual (ignorado en Git)
│
├── frontend/        → interfaz React + Vite
│   ├── src/
│   ├── public/
│   ├── package.json
│   ├── vite.config.js
│   └── README.md    → instrucciones específicas del frontend
│
├── docs/            → documentación (alcance, decisiones de diseño)
├── data/            → raw docs, normalized YAML, índices FAISS
├── scripts/         → scripts de normalización, chunking, indexado
├── .gitignore
└── README.md        → este archivo
```

---

## 🖥️ Frontend (React + Vite)

### Requisitos
- Node.js (v20 recomendado)
- npm (incluido con Node)

### Instalación
```bash
cd frontend
npm install
```

### Correr en desarrollo
```bash
npm run dev
```
La aplicación estará disponible en:  
👉 [http://localhost:5173](http://localhost:5173)

### Build de producción
```bash
npm run build
npm run preview
```

---

## ⚙️ Backend (FastAPI)

### Requisitos
- Python 3.10+
- pip

### Instalación
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate   # En Windows
pip install -r requirements.txt
```

### Ejecutar servidor
```bash
uvicorn app.main:app --reload --port 8000
```

El backend corre en 👉 [http://127.0.0.1:8000](http://127.0.0.1:8000)  
Endpoints disponibles:
- `/health` → estado del servidor
- `/ask` → consulta al modelo
- `/ingest` → reindexar datos

---

## ✨ Créditos
Proyecto desarrollado como **MVP de KORA** (onboarding inteligente para empresas).  
Incluye frontend en React + Vite y backend en FastAPI con RAG sobre OpenAI.



################### GCS#####################

# Firebase, correr en el frontend
npm install firebase

