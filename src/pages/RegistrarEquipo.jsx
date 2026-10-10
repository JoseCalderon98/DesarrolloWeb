import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { getStoredUser } from '../utils/userHelpers';
import Sidebar from '../components/Sidebar';

export default function RegistrarEquipo() {
  const navigate = useNavigate();
  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const currentUser = getStoredUser();
  useEffect(() => {
    const user = getStoredUser();
    if (user?.rol === 'Empleado') {
      navigate('/inventario', { replace: true });
    }
  }, [navigate]);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // States
  const [placa, setPlaca] = useState('');
  const [equipoNombre, setEquipoNombre] = useState('');
  const [equipoSpecs, setEquipoSpecs] = useState('');
  const [serial, setSerial] = useState('');
  const [categoria, setCategoria] = useState('Laptops Corporativas');
  const [estado, setEstado] = useState('DISPONIBLE');
  const [asignatario, setAsignatario] = useState('Bodega Centralizada TI');
  const [ubicacion, setUbicacion] = useState('Rack A1 - Principal');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      await addDoc(collection(db, 'equipos'), {
        placa,
        equipo_nombre: equipoNombre,
        equipo_specs: equipoSpecs,
        serial,
        categoria,
        estado,
        asignatario,
        ubicacion,
        ultimo_movimiento: 'Alta Sistema RF-02',
        registrado_por: {
          id: currentUser?.id || 'N/A',
          nombre: currentUser?.nombre || 'Administrador TI',
          email: currentUser?.email || 'N/A'
        },
        createdAt: serverTimestamp()
      });
      // Navegar directo al inventario tras el éxito
      navigate('/inventario');
    } catch (err) {
      setErrorMsg('Error al comunicar con Firebase: ' + err.message);
      setLoading(false);
    }
  };

  return (
    <div className="bg-background font-body-md text-on-surface antialiased min-h-screen">
      {/* Sidebar - Mantenido para consistencia UI */}
      <Sidebar />

      <div className="pl-72 flex flex-col min-h-screen">
        <header className="fixed top-0 left-72 right-0 h-16 bg-surface/90 backdrop-blur-xl z-40 shadow-[0_1px_8px_rgba(0,0,0,0.04)] px-space-xl flex items-center justify-between gap-space-lg">
          <div className="flex items-center gap-space-lg flex-1 max-w-2xl">
            <div className="hidden xl:flex items-center gap-space-xs text-on-surface-variant bg-surface-container px-space-md py-space-xs rounded-full shrink-0">
              <span className="material-symbols-outlined text-[16px] text-secondary">location_on</span>
              <span className="font-label-sm text-label-sm font-semibold truncate">{currentUser?.sede || 'Sede Principal Av. El Dorado #100-80, Bogotá'}</span>
            </div>
          </div>
          <div className="flex items-center gap-space-md shrink-0">
            <div className="flex items-center gap-space-md pl-space-xs">
              <div className="flex flex-col text-right hidden sm:flex">
                <span className="font-label-md text-label-md text-on-surface font-bold">
                  {currentUser?.nombre || 'Funcionario SGI'}
                </span>
                <span className="font-label-sm text-label-sm text-secondary font-semibold">
                  {currentUser?.cargo || currentUser?.rol || 'Administrador TI'}
                </span>
              </div>
              <img
                alt="Profile"
                className="w-8 h-8 rounded-full object-cover ring-2 ring-primary/20 shadow-sm"
                src={currentUser?.avatar || "https://lh3.googleusercontent.com/aida-public/AB6AXuDyAiWOUn9njbbS4sZzxnzDv-_O7nlKMP0d8Uj3JmLf2C_0yjiCZpAy_-U4uCYuUD42dh2KBHFoTT45HDNZZYJ4xGPuondY8OzWlnn7_ZuxW3T5adr-8kHHxYrg8TKac--UfaKWJfhULlk7ZTIvToV2_6HQK6K4NU1fRHrt-A4bVhe1TrF6kp8FaNl7tV6SQ4Q_7jCd97VAYDW2x8agwEazqetgfvCbDatPHJzic_KZM9Czjj8JNoYE6Q"}
              />
              <button 
                onClick={handleLogout} 
                className="ml-2 hover:bg-error-container hover:text-error text-outline p-1.5 rounded-full transition-colors cursor-pointer" 
                title="Cerrar Sesión"
              >
                <span className="material-symbols-outlined text-[20px]">logout</span>
              </button>
            </div>
          </div>
        </header>

        <main className="relative pt-16 flex-1 w-full px-gutter-lg pb-space-xl bg-background">
          <div className="flex flex-col w-full max-w-4xl max-w-5xl mx-auto pt-space-lg">
            
            {/* Header / Titulo */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-space-lg mb-space-xl">
              <div className="flex flex-col gap-space-xs">
                <div className="flex items-center gap-space-xs text-outline font-label-sm uppercase tracking-wider">
                  <span>Gestión de Infraestructura</span>
                  <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                  <span className="text-primary font-bold">Módulo Activos TI</span>
                  <span className="bg-surface-container-high text-primary px-space-xs rounded font-code-mono text-[10px]">RF-02</span>
                </div>
                <h1 className="font-display-lg text-display-lg text-on-surface tracking-tight">Registro de Hardware (RF-02)</h1>
                <p className="font-body-md text-body-md text-on-surface-variant max-w-3xl">
                  Formulario dinámico de ingreso al stock institucional, generando alta contable e indexando trazabilidad a la norma ISO/IEC 20000.
                </p>
              </div>
            </div>

            {errorMsg && (
              <div className="bg-error-container text-on-error-container p-space-md rounded-lg mb-space-lg flex items-center gap-space-md shadow-sm">
                <span className="material-symbols-outlined">warning</span>
                <span className="font-body-md">{errorMsg}</span>
              </div>
            )}

            {/* Application Form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-space-lg">
              
              {/* Bloque: Identificación de Activo */}
              <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm">
                <div className="flex items-center gap-space-sm mb-space-md pb-space-sm border-b border-surface-container-highest">
                  <span className="material-symbols-outlined text-primary text-[20px]">qr_code_2</span>
                  <h2 className="font-headline-sm text-body-lg text-primary font-bold">Bloque A: Identificación Técnica</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-space-lg">
                  <div className="flex flex-col gap-space-xs">
                    <label className="font-label-sm text-label-sm uppercase text-outline font-bold">Placa / Código Institucional</label>
                    <input required minLength={4} value={placa} onChange={(e) => setPlaca(e.target.value)} placeholder="Ej. CL-TI-9999" type="text" className="w-full h-11 px-space-md bg-surface-container-low text-on-surface rounded-lg font-body-sm focus:outline-none focus:ring-1 focus:ring-primary shadow-sm uppercase"/>
                  </div>
                  <div className="flex flex-col gap-space-xs">
                    <label className="font-label-sm text-label-sm uppercase text-outline font-bold">Número de Serie (SN)</label>
                    <input required value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="Ej. 5CD23489LX" type="text" className="w-full h-11 px-space-md bg-surface-container-low text-on-surface rounded-lg font-body-sm focus:outline-none focus:ring-1 focus:ring-primary shadow-sm uppercase"/>
                  </div>
                  
                  <div className="flex flex-col gap-space-xs">
                    <label className="font-label-sm text-label-sm uppercase text-outline font-bold">Modelo / Nombre de Equipo</label>
                    <input required value={equipoNombre} onChange={(e) => setEquipoNombre(e.target.value)} placeholder="Ej. Lenovo ThinkPad T14s Gen 3" type="text" className="w-full h-11 px-space-md bg-surface-container-low text-on-surface rounded-lg font-body-sm focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"/>
                  </div>
                  <div className="flex flex-col gap-space-xs">
                    <label className="font-label-sm text-label-sm uppercase text-outline font-bold">Categoría Operativa</label>
                    <div className="relative">
                      <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="w-full h-11 px-space-md appearance-none bg-surface-container-low text-on-surface rounded-lg font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-primary shadow-sm cursor-pointer pr-8">
                        <option value="Laptops Corporativas">Portátiles Corporativos</option>
                        <option value="Estaciones de Trabajo">Estaciones de Escritorio / SFF</option>
                        <option value="Monitores y Displays">Monitores y Displays</option>
                        <option value="Servidores e Infraestructura">Servidores e Infraestructura</option>
                        <option value="Periféricos y Docks">Periféricos y Docks</option>
                      </select>
                      <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline text-[18px] pointer-events-none">expand_more</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-space-xs md:col-span-2">
                    <label className="font-label-sm text-label-sm uppercase text-outline font-bold">Especificaciones Resumidas (Hardware Specs)</label>
                    <textarea required value={equipoSpecs} onChange={(e) => setEquipoSpecs(e.target.value)} placeholder="Ej. Procesador Intel Core i7 12th Gen • 16GB RAM DDR4 • SSD 512GB NVMe" rows={2} className="w-full p-space-md bg-surface-container-low text-on-surface rounded-lg font-body-sm focus:outline-none focus:ring-1 focus:ring-primary shadow-sm resize-none" />
                  </div>
                </div>
              </div>

              {/* Bloque: Asignación y Ubicación */}
              <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm">
                <div className="flex items-center gap-space-sm mb-space-md pb-space-sm border-b border-surface-container-highest">
                  <span className="material-symbols-outlined text-primary text-[20px]">transfer_within_a_station</span>
                  <h2 className="font-headline-sm text-body-lg text-primary font-bold">Bloque B: Etiquetado de Estado y Ubicación</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-lg">
                  <div className="flex flex-col gap-space-xs">
                    <label className="font-label-sm text-label-sm uppercase text-outline font-bold">Estado Actual</label>
                    <div className="relative">
                      <select value={estado} onChange={(e) => setEstado(e.target.value)} className="w-full h-11 px-space-md appearance-none bg-surface-container-low text-on-surface rounded-lg font-body-sm font-semibold focus:outline-none focus:ring-1 focus:ring-primary shadow-sm cursor-pointer pr-8">
                        <option value="DISPONIBLE">🟢 Disponible</option>
                        <option value="ASIGNADO">🔵 Asignado</option>
                        <option value="MANTENIMIENTO">🟡 Mantenimiento</option>
                        <option value="BAJA">🔴 Baja Definitiva</option>
                      </select>
                      <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline text-[18px] pointer-events-none">expand_more</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-space-xs">
                    <label className="font-label-sm text-label-sm uppercase text-outline font-bold">Asignatario u Ocupante</label>
                    <input required value={asignatario} onChange={(e) => setAsignatario(e.target.value)} type="text" className="w-full h-11 px-space-md bg-surface-container-low text-on-surface rounded-lg font-body-sm focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"/>
                  </div>
                  
                  <div className="flex flex-col gap-space-xs">
                    <label className="font-label-sm text-label-sm uppercase text-outline font-bold">Ubicación Física</label>
                    <input required value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} type="text" className="w-full h-11 px-space-md bg-surface-container-low text-on-surface rounded-lg font-body-sm focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"/>
                  </div>
                </div>
              </div>

              {/* Botones de Accion */}
              <div className="bg-surface-container p-space-md rounded-xl flex items-center justify-end gap-space-sm mt-space-sm shadow-sm border border-surface-container-highest">
                <button type="button" onClick={() => navigate('/inventario')} className="px-space-md h-11 text-outline hover:text-error rounded-lg font-label-md transition-colors" disabled={loading}>
                  Descartar Registro
                </button>
                <button type="submit" disabled={loading} className="flex items-center gap-space-xs px-space-xl h-11 bg-primary text-on-primary rounded-lg font-label-md text-label-md shadow-md hover:bg-primary-container hover:text-on-primary-container transition-all">
                  {loading ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>
                      <span className="uppercase tracking-wide">Validando en Firebase...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">save</span>
                      <span className="uppercase tracking-wide">Inyectar Alta de Protocolo (RF-02)</span>
                    </>
                  )}
                </button>
              </div>

            </form>

          </div>
        </main>
      </div>
    </div>
  );
}
