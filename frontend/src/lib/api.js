const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

export async function ask(question) {
  const res = await fetch(`${API_BASE}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`API error ${res.status}: ${msg}`);
  }
  return res.json(); // { answer: string, citations?: string[] }
}

export async function ingest() {
  const res = await fetch(`${API_BASE}/ingest`, { method: "POST" });
  if (!res.ok) throw new Error("No se pudo reindexar");
  return res.json();
}

export async function health() {
  const res = await fetch(`${API_BASE}/health`);
  return res.json();
}