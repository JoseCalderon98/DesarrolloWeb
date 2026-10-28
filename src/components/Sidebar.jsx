import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getStoredUser } from '../utils/userHelpers';
import { db } from '../firebase';
import { collection, onSnapshot, query } from 'firebase/firestore';

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = getStoredUser();
  const [totalEquipos, setTotalEquipos] = useState(0);

  useEffect(() => {
    const q = query(collection(db, "equipos"));
    const unsub = onSnapshot(q, (snapshot) => {
      let count = 0;
      if (currentUser?.rol === 'Empleado') {
        snapshot.forEach(doc => {
          const data = doc.data();
          const matchEmail = data.asignatario_email && data.asignatario_email.trim().toLowerCase() === currentUser.email.trim().toLowerCase();
          const matchNombre = data.asignatario && data.asignatario.trim().toLowerCase() === currentUser.nombre.trim().toLowerCase();
          if (matchEmail || matchNombre) {
            count++;
          }
        });
      } else {
        count = snapshot.size;
      }
      setTotalEquipos(count);
    });
    return () => unsub();
  }, []);

  const [isEntregaOpen, setIsEntregaOpen] = useState(
    location.pathname === '/entrega-hardware' || 
    location.pathname === '/devoluciones' || 
    location.pathname === '/historial'
  );

  const isActive = (path) => location.pathname === path;

  return (
    <aside className="fixed left-0 top-0 h-full w-72 bg-surface-container-low z-50 flex flex-col justify-between shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
      <div className="flex flex-col flex-1 overflow-y-auto">
        <div className="h-16 px-space-xl flex items-center gap-space-md bg-surface-container-low border-b border-surface-container-highest/30">
          <img
            alt="Logo SGI CASALIMPIA"
            className="h-9 w-9 object-contain shrink-0"
            src="/logo-icon.svg"
          />
          <div className="flex flex-col">
            <span className="font-headline-sm text-headline-sm text-primary leading-none font-bold">SGI CASALIMPIA</span>
            <span className="font-label-sm text-label-sm text-outline tracking-wider uppercase">Activos TI</span>
          </div>
        </div>
        <div className="px-space-xl py-space-sm mt-space-sm">
          <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline">Menú Principal</span>
        </div>
        <nav className="px-space-md space-y-space-xs flex-1">
          {currentUser?.rol !== 'Empleado' && (
            <a
              className={`flex items-center gap-space-md px-space-md py-space-sm rounded-lg transition-colors cursor-pointer ${isActive('/dashboard') ? 'bg-primary text-on-primary font-bold shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'}`}
              onClick={() => navigate('/dashboard')}
            >
              <span className="material-symbols-outlined text-[20px]">grid_view</span>
              <span className="font-body-md text-body-md">Dashboard General</span>
            </a>
          )}
          <a
            className={`flex items-center justify-between px-space-md py-space-sm transition-colors rounded-lg cursor-pointer ${isActive('/inventario') ? 'bg-primary text-on-primary shadow-sm font-bold' : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'}`}
            onClick={() => navigate('/inventario')}
          >
            <div className="flex items-center gap-space-md">
              <span className="material-symbols-outlined text-[20px]">devices_other</span>
              <span className="font-body-md text-body-md">Inventario de Activos</span>
            </div>
            {isActive('/inventario') && (
              <span className="font-code-mono text-code-mono bg-on-primary text-primary px-2 py-0.5 rounded-full font-bold">{totalEquipos}</span>
            )}
          </a>
          
          <div className="pt-space-xs">
            <div 
              className="flex items-center justify-between px-space-md py-space-sm text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface rounded-lg cursor-pointer transition-colors"
              onClick={() => setIsEntregaOpen(!isEntregaOpen)}
            >
              <div className="flex items-center gap-space-md">
                <span className="material-symbols-outlined text-[20px]">assignment_return</span>
                <span className="font-body-md text-body-md font-semibold text-on-surface">Entrega y Recepción</span>
              </div>
              <span className="material-symbols-outlined text-[16px] text-outline">
                {isEntregaOpen ? 'expand_less' : 'expand_more'}
              </span>
            </div>
            {isEntregaOpen && (
              <div className="ml-space-lg pl-space-md space-y-space-xs mt-space-xs border-l-2 border-primary/20">
                {currentUser?.rol !== 'Empleado' && (
                  <a
                    className={`flex items-center gap-space-sm px-space-md py-space-xs rounded-lg transition-colors cursor-pointer ${isActive('/entrega-hardware') ? 'bg-primary-container text-on-primary font-bold' : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'}`}
                    onClick={() => navigate('/entrega-hardware')}
                  >
                    <span className="material-symbols-outlined text-[16px]">post_add</span>
                    <span className="font-body-sm text-body-sm">Nueva Entrega / Acta</span>
                  </a>
                )}
                {currentUser?.rol !== 'Empleado' && (
                  <a
                    className={`flex items-center gap-space-sm px-space-md py-space-xs rounded-lg transition-colors cursor-pointer ${isActive('/devoluciones') ? 'bg-primary-container text-on-primary font-bold' : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'}`}
                    onClick={() => navigate('/devoluciones')}
                  >
                    <span className="material-symbols-outlined text-[16px]">keyboard_return</span>
                    <span className="font-body-sm text-body-sm">Devoluciones</span>
                  </a>
                )}
                {currentUser?.rol !== 'Empleado' && (
                  <a
                    className={`flex items-center gap-space-sm px-space-md py-space-xs rounded-lg transition-colors cursor-pointer ${isActive('/traslados') ? 'bg-primary-container text-on-primary font-bold' : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'}`}
                    onClick={() => navigate('/traslados')}
                  >
                    <span className="material-symbols-outlined text-[16px]">local_shipping</span>
                    <span className="font-body-sm text-body-sm">Traslados Regionales</span>
                  </a>
                )}
                <a
                  className={`flex items-center gap-space-sm px-space-md py-space-xs rounded-lg transition-colors cursor-pointer ${isActive('/historial') ? 'bg-primary-container text-on-primary font-bold' : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'}`}
                  onClick={() => navigate('/historial')}
                >
                  <span className="material-symbols-outlined text-[16px]">history</span>
                  <span className="font-body-sm text-body-sm">Historial</span>
                </a>
              </div>
            )}
          </div>
          
          {currentUser?.rol !== 'Empleado' && (
            <>
              <a
                className={`flex items-center gap-space-md px-space-md py-space-sm rounded-lg transition-colors cursor-pointer mt-space-sm ${isActive('/usuarios-roles') ? 'bg-primary text-on-primary font-bold shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'}`}
                onClick={() => navigate('/usuarios-roles')}
              >
                <span className="material-symbols-outlined text-[20px]">admin_panel_settings</span>
                <span className="font-body-md text-body-md">Gestión de Usuarios y Roles</span>
              </a>
              <a
                className={`flex items-center gap-space-md px-space-md py-space-sm rounded-lg transition-colors cursor-pointer ${isActive('/reportes') ? 'bg-primary text-on-primary font-bold shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'}`}
                onClick={() => navigate('/historial')}
              >
                <span className="material-symbols-outlined text-[20px]">verified_user</span>
                <span className="font-body-md text-body-md">Reportes y Auditoría</span>
              </a>
            </>
          )}
        </nav>
      </div>
      <div className="p-space-lg m-space-md bg-surface-container rounded-xl flex items-center gap-space-md">
        <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-on-primary">
          <span className="material-symbols-outlined text-[18px]">verified</span>
        </div>
        <div className="flex flex-col overflow-hidden">
          <span className="font-label-sm text-label-sm text-primary uppercase font-bold truncate">SGI Conectado</span>
          <span className="font-body-sm text-body-sm text-outline truncate">Auditoría Legal ISO</span>
        </div>
      </div>
    </aside>
  );
}
