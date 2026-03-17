// Third.jsx
import { useMemo, useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./Third.css";
import Koraverticalblanco from "../assets/kora_blanco_vertical.png";

const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

const CATEGORIES = [
  { key: null, label: "Todas" },
  { key: "plataformas", label: "Plataformas" },
  { key: "funciones", label: "Funciones CX" },
  { key: "ftp", label: "FTP / SFG / STA" },
  { key: "plantillas", label: "Plantillas Excel" },
  { key: "procesadoras", label: "Procesadoras de Pago" },
  { key: "diccionario", label: "Dicc Contable" },
  { key: "mails", label: "Plantilla de Mails" },
  { key: "otros", label: "Otros" },
];

const WELCOME_MSG = {
  role: "assistant",
  text:
    "👋 Soy KORA para Analista CX. Puedo ayudarte con procesos, plantillas y plataformas.\n" +
    "Elegí una categoría a la izquierda o escribime tu pregunta.",
};

// 👉 Helper para formatear markdown a HTML simple
function formatText(text) {
  if (!text) return "";
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>") // **negrita** → <strong>
    .replace(/^- /gm, "• ");                          // - item → • item
}

export default function Third() {
  const navigate = useNavigate();
  const location = useLocation();

  const urlParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const selectedRole = useMemo(() => {
    return (urlParams.get("role") || "analista_cx").toLowerCase();
  }, [urlParams]);

  const initialCat = useMemo(() => {
    const c = urlParams.get("cat");
    return !c || c === "all" ? null : c;
  }, [urlParams]);

  const seed = useMemo(() => urlParams.get("seed") || "", [urlParams]);
  const seedImg = useMemo(() => urlParams.get("seedImg") || "", [urlParams]);
  const hideWelcome = useMemo(() => urlParams.get("hideWelcome") === "1", [urlParams]);

  const [selectedCategory, setSelectedCategory] = useState(initialCat);
  const [messagesByCat, setMessagesByCat] = useState(() => {
    const key = initialCat ?? null;
    if (seed) {
      const first = hideWelcome ? [] : [WELCOME_MSG];
      return {
        [key]: [
          ...first,
          { role: "assistant", text: seed, ...(seedImg ? { image: seedImg } : {}) },
        ],
      };
    }
    return { [key]: [WELCOME_MSG] };
  });

  const messagesRef = useRef(null);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const key = selectedCategory ?? null;
    setMessagesByCat((prev) => {
      if (prev.hasOwnProperty(key)) return prev;
      return { ...prev, [key]: [WELCOME_MSG] };
    });
  }, [selectedCategory]);

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messagesByCat, selectedCategory, loading]);

  function addMessageToCategory(cat, msg) {
    const key = cat ?? null;
    setMessagesByCat((prev) => {
      const existing = prev[key] || [WELCOME_MSG];
      return { ...prev, [key]: [...existing, msg] };
    });
  }

  async function sendMessage() {
    const query = q.trim();
    if (!query || loading) return;
    setErr("");

    addMessageToCategory(selectedCategory, { role: "user", text: query });
    setQ("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: query,
          role: selectedRole || "analista_cx",
          category: selectedCategory || null,
        }),
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(`HTTP ${res.status} – ${t}`);
      }

      const data = await res.json();
      addMessageToCategory(selectedCategory, {
        role: "assistant",
        text: data.answer,
      });
    } catch (e) {
      console.error(e);
      setErr("No pude conectarme con el servidor. ¿El backend está en :8000?");
      addMessageToCategory(selectedCategory, {
        role: "assistant",
        text: "⚠️ Ocurrió un error al procesar tu consulta. Probá de nuevo en unos segundos.",
      });
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="third-container">
      {/* Header */}
      <div className="primer-fila">
        <button className="back-btn-third" onClick={() => navigate("/second")}>
          ← Volver
        </button>
        <div className="logo-third">
          <img src={Koraverticalblanco} alt="KORA" className="logo-img-third" />
        </div>
        <div className="role-chip">Rol: {selectedRole}</div>
      </div>

      {/* Sidebar categorías */}
      <aside className="sidebar">
        <div className="sidebar-title">Categorías</div>
        {CATEGORIES.map((c) => (
          <button
            key={c.key ?? "all"}
            className={`side-pill ${(c.key || null) === (selectedCategory || null) ? "active" : ""}`}
            onClick={() => setSelectedCategory(c.key)}
          >
            {c.label}
          </button>
        ))}
      </aside>

      {/* Chat */}
      <main className="chat-pane">
        <div className="messages" ref={messagesRef}>
          {(messagesByCat[selectedCategory ?? null] || []).map((m, i) => (
            <div key={i} className={`msg ${m.role}`}>
              {m.text && (
                <div dangerouslySetInnerHTML={{ __html: formatText(m.text) }} />
              )}
              {m.image && (
                <img src={m.image} alt="Seed" className="seed-img" />
              )}
            </div>
          ))}
          {loading && <div className="msg assistant">Pensando…</div>}
        </div>

        {err && <div className="error">{err}</div>}

        <div className="composer">
          <textarea
            className="input"
            placeholder="Escribí tu pregunta…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
          />
          <button className="send" onClick={sendMessage} disabled={loading}>
            Enviar
          </button>
        </div>
      </main>
    </div>
  );
}
