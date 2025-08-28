from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="KORA MVP - Nubceo CX")

# Configuración CORS (para que el frontend pueda llamar al backend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # luego podés restringir al dominio del frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok"}
