import './Second.css'
import { useNavigate } from 'react-router-dom'
import { useState } from "react"; 
import Koravertical from '../assets/Koravertical.png';

export default function Second() {
  const navigate = useNavigate()
  const [opcion, setOpcion] = useState("Analista CX");

  return (
    <div className="second-container">
      
      <div className="logo">
        <img src={Koravertical} alt="Koravertical" className="logo-img" />
      </div>
      <div className="top-select-wrap">
        <select
          className="top-select"
          value={opcion}
          onChange={(e) => setOpcion(e.target.value)}
        >
          <option>Analista CX</option>
          <option>Soporte</option>
          <option>Ventas</option>
        </select>
      </div>
      <div className="btn-container">
        <div className="btn-uno pill" onClick={() => navigate('/Third')}>Plataformas</div>
        <div className="btn-dos pill">Funciones CX</div>
        <div className="btn-tres pill">FTP/ SFG/ STA</div>
        <div className="btn-cuatro pill">Plantillas Excel</div>
        <div className="btn-cinco pill">Procesadoras de Pago</div>
        <div className="btn-seis pill">Dicc Contable</div>
        <div className="btn-siete pill">Plantilla de Mails</div>
        <div className="btn-ocho pill">Otros</div>
      </div>
    </div>
  )
}