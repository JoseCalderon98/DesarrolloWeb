import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Inventario from './pages/Inventario'
import RegistrarEquipo from './pages/RegistrarEquipo'
import RegistroEntrega from './pages/RegistroEntrega'
import Devoluciones from './pages/Devoluciones'
import Historial from './pages/Historial'
import UsuariosRoles from './pages/UsuariosRoles'
import Traslados from './pages/Traslados'
import './index.css'

function App() {
  return (
    <BrowserRouter>
      <div className="App">
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/inventario" element={<Inventario />} />
          <Route path="/registrar-equipo" element={<RegistrarEquipo />} />
          <Route path="/entrega-hardware" element={<RegistroEntrega />} />
          <Route path="/nueva-entrega" element={<RegistroEntrega />} />
          <Route path="/devoluciones" element={<Devoluciones />} />
          <Route path="/traslados" element={<Traslados />} />
          <Route path="/traslado-hardware" element={<Traslados />} />
          <Route path="/reportes" element={<Historial />} />
          <Route path="/historial" element={<Navigate to="/reportes" replace />} />
          <Route path="/usuarios-roles" element={<UsuariosRoles />} />
          <Route path="/usuarios" element={<UsuariosRoles />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
