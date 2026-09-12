import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Login from './pages/Login'
import Inventario from './pages/Inventario'
import RegistrarEquipo from './pages/RegistrarEquipo'
import './index.css'

function App() {
  return (
    <BrowserRouter>
      <div className="App">
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/inventario" element={<Inventario />} />
        <Route path="/registrar-equipo" element={<RegistrarEquipo />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
