import './App.css'
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom'

import koraLogo from './assets/kora.png'
import nubceoLogo from './assets/nubceo.png'

import Second from './pages/Second.jsx'
import Third from './pages/Third.jsx';

function Home() {
  const navigate = useNavigate()

  function handleClick() {
    navigate("/second") 
  }

  return (
    <div className="container" onClick={handleClick}>
      <div className="logos-principal">
        <img src={nubceoLogo} alt="Nubceo" className="logos" />
        <span className="x-symbol">X</span>
        <img src={koraLogo} alt="Kora" className="logos" />
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/second" element={<Second />} />
        <Route path="/third" element={<Third />} />
      </Routes>
    </BrowserRouter>
  )
}
