import { useNavigate } from "react-router-dom";
import './Third.css'
import { useState } from "react"; 
import Koravertical from '../assets/Koravertical.png';

export default function Third() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  return (
    <div className="third-container">
      <div className="primer-fila">
        <button className="back-btn-third" onClick={() => navigate("/second")}>
          ← Volver
        </button>
        <div className="logo-third">
                <img src={Koravertical} alt="Koravertical" className="logo-img-third" />
        </div>
      </div>
      <div className="container-izq">
         <aside className="sidebar">
          <div className="sidebar-title">Plataformas</div>
          <button className="side-pill active">Opción 1</button>
          <button className="side-pill">Opción 2</button>
          <button className="side-pill">Opción 3</button>
          <button className="side-pill">Opción 4</button>
          <button className="side-pill">Opción 5</button>
          <button className="side-pill">Opción 6</button>
        </aside>
      </div>
      <div className="container-der">
        <h1>Hola Magui</h1>
        <div className="search-bar">
          <input
            className="search-input"
            type="text"
            placeholder="Escribí tu pregunta…"
          />
          <button className="search-btn">Seguime</button>
        </div>
      </div>
    </div>
  );
}
