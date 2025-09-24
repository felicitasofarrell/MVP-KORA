// Second.jsx
import "./Second.css";  
import { useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import KoraLogoWhite from "../assets/Logos-Kora-blanco.png";
import SeedImg from "../assets/captura_excel.png";

const cards = [
  { key: "plataformas", title: "Plataformas", cat: "plataformas", desc: "Listado y accesos a las principales plataformas de la empresa." },
  { key: "funciones", title: "Funciones CX", cat: "funciones", desc: "Resumen de las tareas principales del rol de Customer Experience." },
  { key: "ftp", title: "FTP / SFG / STA", cat: "ftp", desc: "Guía rápida para conectar y transferir archivos por FTP, SFG y STA." },
  { key: "plantillas-excel", title: "Plantillas Excel", cat: "plantillas", desc: "Plantillas prearmadas para agilizar reportes y cálculos." },
  { key: "procesadoras", title: "Procesadoras de Pago", cat: "procesadoras", desc: "Información sobre conexiones y gestión con las procesadoras de pago." },
  { key: "dicc", title: "Diccionario Contable", cat: "diccionario", desc: "Glosario con los principales términos contables usados en la empresa." },
  { key: "mails", title: "Plantilla de Mails", cat: "mails", desc: "Ejemplos y modelos de mails listos para enviar a clientes o partners." },
  { key: "otros", title: "Otros", cat: "otros", desc: "Recursos adicionales." },
];

// 🔹 Insight coreografiado que aparecerá en la tercera pantalla
const DEFAULT_SEED =
  "👀 Estuve mirando tu pantalla y veo que estás utilizando Excel.\n" +
  "Sugerencias rápidas (11 columnas: ID, Fecha, Comercio, Email, SKU, Categoria, Cantidad, Precio Unitario, Total, Estado, Medio de Pago):\n" +
  "• En Total usá =G2*H2 (Cantidad*Precio) y aplicá número con 2 decimales.\n" +
  "• Activá Filtros (Datos → Filtro) para revisar por Estado/Medio de Pago.\n" +
  "• Marcá ID duplicados: Inicio → Formato condicional → Valores duplicados.\n" +
  "• Validá listas: Estado {Completado,Pendiente,Rechazado} y Medio de Pago {Tarjeta,Transferencia,Efectivo}.\n" +
  "• Controlá Cantidad > 0 y Precio Unitario ≥ 0 (Validación de datos).\n" +
  "• Verificá Email con \"@\" y estandarizá Fecha en formato AAAA-MM-DD.\n" +
  "¿Querés que lo dejemos armado con validaciones y una hoja \"Errores\"?";

// Normaliza texto
const normalizeText = (text) =>
  text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export default function Second() {
  const navigate = useNavigate();
  const [rol, setRol] = useState("Analista CX");
  const [searchTerm, setSearchTerm] = useState("");

  // Estados para “Seguime”
  const [followActive, setFollowActive] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [phase, setPhase] = useState(null); // 'countdown' | 'return' | null
  const [countdown, setCountdown] = useState(0);
  const [finishedCountdown, setFinishedCountdown] = useState(false);
  const timerRef = useRef(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef();

  // cerrar menú al click afuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredCards = cards.filter((c) =>
    normalizeText(c.title).includes(normalizeText(searchTerm))
  );

  const roles = ["Analista CX", "Soporte", "Ventas"];

  const goToChat = (cat) => {
    const roleParam = rol.toLowerCase().replaceAll(" ", "_");
    const catParam = cat || "all";
    navigate(`/third?role=${encodeURIComponent(roleParam)}&cat=${encodeURIComponent(catParam)}`);
  };

  const goToChatWithSeed = () => {
    const roleParam = rol.toLowerCase().replaceAll(" ", "_");
    const seed = encodeURIComponent(DEFAULT_SEED);
    const seedImg = SeedImg ? encodeURIComponent(SeedImg) : "";
    console.log(seedImg)
    navigate(
      `/third?role=${roleParam}&cat=plantillas&seed=${seed}&hideWelcome=1${
        seedImg ? `&seedImg=${seedImg}` : ""
      }`
    );
  };

  // 🔹 Notificación
  async function notify(title, body) {
    if (!("Notification" in window)) return;
    try {
      if (Notification.permission !== "granted") {
        await Notification.requestPermission();
      }
      if (Notification.permission === "granted") {
        new Notification(title, { body, silent: true });
      }
    } catch {}
  }

  // 🔹 Llama al backend para sacar capturas
  async function triggerBackendScreenshots() {
    try {
      const res = await fetch("http://localhost:8000/screenshot", { method: "POST" });
      const data = await res.json();
      console.log("Capturas disparadas:", data);
    } catch (err) {
      console.error("Error llamando al backend:", err);
    }
  }

  // 🔹 Arranca seguimiento
  function startFollow() {
    setFollowActive(true);
    setFinishedCountdown(false);
    setModalOpen(true);
    setPhase("countdown");
    setCountdown(20); // más tiempo para que el backend saque las capturas

    // 🚀 disparo al backend
    triggerBackendScreenshots();

    timerRef.current = setInterval(() => {
      setCountdown((s) => {
        if (s <= 1) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          setFinishedCountdown(true);
          setPhase("return");
          notify("Kora", "¡Listo! Volvé al navegador para ver las sugerencias.");
        }
        return s - 1;
      });
    }, 1000);
  }

  function stopFollow() {
    if (finishedCountdown) {
      cleanupFollow();
      goToChatWithSeed();
      return;
    }
    cleanupFollow();
  }

  function cleanupFollow() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setFollowActive(false);
    setModalOpen(false);
    setPhase(null);
    setCountdown(0);
    setFinishedCountdown(false);
  }

  function onFollowClick() {
    if (followActive) stopFollow();
    else startFollow();
  }

  return (
    <div className={`sec-root ${modalOpen ? "blurred" : ""}`}>
      {/* Header */}
      <header className="sec-header">
        <div className="brand">
          <img src={KoraLogoWhite} alt="Kora" />
        </div>

        <div className="role-pill" ref={menuRef}>
          <div className="role-selected" onClick={() => setMenuOpen(!menuOpen)}>
            {rol}
          </div>
          {menuOpen && (
            <ul className="role-options">
              {roles.map((r) => (
                <li key={r} onClick={() => { setRol(r); setMenuOpen(false); }}>
                  {r}
                </li>
              ))}
            </ul>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="sec-hero">
        <h1>
          Aprendé todo sobre <span className="accent">{rol}</span> en Nubceo
        </h1>
        <p>Playbooks, procesos y respuestas verificadas en un solo lugar.</p>

        <div className="hero-actions">
          <button className="cta" onClick={() => goToChat("all")}>Chatear</button>
          <button className="cta" onClick={() => navigate("/upload")}>Transferir Conocimiento</button>
          <button className="cta" onClick={() => navigate("/storage")}>Administrar Datos</button>
          <input
            type="text"
            className="search-bar"
            placeholder="Buscar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button
            className={`cta follow-btn ${followActive ? "active" : ""}`}
            onClick={onFollowClick}
            aria-pressed={followActive}
          >
            {followActive ? "Dejá de seguirme" : "Seguime"}
          </button>
        </div>
      </section>

      {/* Grid */}
      <section className="sec-grid">
        {filteredCards.map((c) => (
          <div key={c.key} className="sec-card-flip">
            <div className="sec-card-inner" onClick={() => goToChat(c.cat)}>
              <div className="sec-card-front">
                <div className="sec-card-title">{c.title}</div>
              </div>
              <div className="sec-card-back">
                <div className="sec-card-desc">{c.desc}</div>
              </div>
            </div>
          </div>
        ))}
      </section>

      <footer className="sec-footer">
        <small>v0 • Respuestas con evidencia • Nubceo ✕ Kora</small>
      </footer>

      {/* Modal */}
      {modalOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card">
            {phase === "countdown" && (
              <>
                <h2>Cambiá a otra app</h2>
                <p className="modal-sub">
                  Tenés <strong>20 segundos</strong> para revisar lo que quieras.
                </p>
                <div className="countdown-big">{countdown}</div>
                <p className="modal-hint">Podés cambiar de pestaña o abrir Excel.</p>
                <div className="modal-actions">
                  <button className="btn-cancel" onClick={cleanupFollow}>Cancelar</button>
                </div>
              </>
            )}
            {phase === "return" && (
              <>
                <h2>¡Volvé, te estoy esperando!</h2>
                <p className="modal-sub">Ya capturé el contexto de la demo. Abrí el chat para ver sugerencias.</p>
                <div className="modal-actions">
                  <button className="btn-primary" onClick={() => { cleanupFollow(); goToChatWithSeed(); }}>
                    Mirar sugerencias
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
