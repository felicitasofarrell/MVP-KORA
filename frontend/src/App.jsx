import "./App.css";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";

import koraLogo from "./assets/kora.png";
import nubceoLogo from "./assets/nubceo.png";
import background from "./assets/background_a.png";

import Second from "./pages/Second.jsx";
import Third from "./pages/Third.jsx";
import Upload from "./pages/Upload.jsx";
import Storage from "./pages/Storage.jsx";

function Home() {
  const navigate = useNavigate();
  return (
    <div className="container" style={{ backgroundImage: `url(${background})`}} onClick={() => navigate("/second")}>
      <div className="logos-principal">
        <img src={nubceoLogo} alt="Nubceo" className="logos" />
        <span className="x-symbol">&</span>
        <img src={koraLogo} alt="Kora" className="logos" />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/second" element={<Second />} />
        <Route path="/third" element={<Third />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/storage" element={<Storage />} />
      </Routes>
    </BrowserRouter>
  );
}