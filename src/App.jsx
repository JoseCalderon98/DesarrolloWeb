import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Login from './pages/Login'
import Inventario from './pages/Inventario'
import RegistrarEquipo from './pages/RegistrarEquipo'
import RegistroEntrega from './pages/RegistroEntrega'
import Devoluciones from './pages/Devoluciones'
import Historial from './pages/Historial'
import UsuariosRoles from './pages/UsuariosRoles'
import './index.css'

function App() {
  return (
    <BrowserRouter>
      <div className="App">
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/inventario" element={<Inventario />} />
          <Route path="/registrar-equipo" element={<RegistrarEquipo />} />
          <Route path="/entrega-hardware" element={<RegistroEntrega />} />
          <Route path="/nueva-entrega" element={<RegistroEntrega />} />
          <Route path="/devoluciones" element={<Devoluciones />} />
          <Route path="/historial" element={<Historial />} />
          <Route path="/usuarios-roles" element={<UsuariosRoles />} />
          <Route path="/usuarios" element={<UsuariosRoles />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
