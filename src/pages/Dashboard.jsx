import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { getStoredUser } from '../utils/userHelpers';
import Sidebar from '../components/Sidebar';

export default function Dashboard() {
  const navigate = useNavigate();
  const currentUser = getStoredUser();

  const [equipos, setEquipos] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  useEffect(() => {
    const unsubEquipos = onSnapshot(collection(db, "equipos"), (snapshot) => {
      const list = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      setEquipos(list);
    });

    const qMovs = query(collection(db, "movimientos"), orderBy("fecha", "desc"), limit(10));
    const unsubMovs = onSnapshot(qMovs, (snapshot) => {
      const list = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      setMovimientos(list);
      setLoading(false);
    });

    return () => {
      unsubEquipos();
      unsubMovs();
    };
  }, []);

  // KPIs Calculados
  const kpis = useMemo(() => {
    const total = equipos.length;
    const asignados = equipos.filter(e => e.estado === 'ASIGNADO').length;
    const disponibles = equipos.filter(e => e.estado === 'DISPONIBLE' || !e.estado).length;
    const mantenimiento = equipos.filter(e => e.estado === 'MANTENIMIENTO').length;
    const bajas = equipos.filter(e => e.estado === 'BAJA').length;

    // Calcular mes actual
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const movsMesActual = movimientos.filter(m => {
      const date = new Date(m.fecha);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });

    const entregasMes = movsMesActual.filter(m => m.tipo === 'ENTREGA').length;
    const devolucionesMes = movsMesActual.filter(m => m.tipo === 'DEVOLUCIÓN').length;

    return { total, asignados, disponibles, mantenimiento, bajas, entregasMes, devolucionesMes };
  }, [equipos, movimientos]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-space-sm text-primary">
          <span className="material-symbols-outlined animate-spin text-[32px]">sync</span>
          <span className="font-headline-sm font-bold text-lg">Cargando Dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background font-body-md text-on-surface antialiased min-h-screen">
      <Sidebar />
      <div className="pl-72 flex flex-col min-h-screen">
        {/* HEADER SUPERIOR */}
        <header className="fixed top-0 left-72 right-0 h-16 bg-surface/90 backdrop-blur-xl z-40 shadow-[0_1px_8px_rgba(0,0,0,0.04)] px-space-xl flex items-center justify-between gap-space-lg">
          <div className="flex items-center gap-space-lg flex-1">
            <h1 className="font-headline-sm text-xl text-primary font-black tracking-tight">Dashboard General</h1>
          </div>
          <div className="flex items-center gap-space-md shrink-0">
            <div className="flex items-center gap-space-md pl-space-xs">
              <div className="flex flex-col text-right hidden sm:flex">
                <span className="font-label-md text-label-md text-on-surface font-bold">{currentUser?.nombre || 'Funcionario'}</span>
                <span className="font-label-sm text-label-sm text-secondary font-semibold">{currentUser?.cargo || currentUser?.rol || 'TI'}</span>
              </div>
              <img alt="Perfil" className="w-8 h-8 rounded-full object-cover ring-2 ring-primary/20" src={currentUser?.avatar || 'https://i.pravatar.cc/150'} />
              <button onClick={handleLogout} className="hover:bg-error-container hover:text-error text-outline p-1.5 rounded-full transition-colors cursor-pointer" title="Cerrar Sesión">
                <span className="material-symbols-outlined text-[20px]">logout</span>
              </button>
            </div>
          </div>
        </header>

        {/* CONTENIDO PRINCIPAL */}
        <main className="flex-1 mt-16 p-space-xl overflow-y-auto">
          
          <div className="mb-space-lg flex items-center justify-between">
            <div>
              <h2 className="font-headline-sm text-2xl font-black text-on-surface">Resumen Operativo</h2>
              <p className="text-on-surface-variant text-sm mt-1">Monitoreo global del inventario de activos TI y flujo de custodia.</p>
            </div>
            <div className="bg-primary/10 text-primary px-space-md py-space-xs rounded-lg flex items-center gap-space-sm font-bold shadow-sm">
              <span className="material-symbols-outlined text-[20px]">calendar_today</span>
              {new Date().toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }).toUpperCase()}
            </div>
          </div>

          {/* TARJETAS DE KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-space-lg mb-space-xl">
            
            {/* Total Activos */}
            <div className="group bg-gradient-to-br from-surface-container-lowest to-surface-container-low p-space-lg rounded-[24px] shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 border border-surface-container-high/50 relative overflow-hidden flex flex-col justify-between">
              <div className="absolute -right-8 -top-8 w-32 h-32 bg-primary/10 rounded-full blur-3xl pointer-events-none group-hover:bg-primary/20 transition-all duration-500"></div>
              <div className="flex justify-between items-start mb-space-md">
                <div className="flex flex-col z-10">
                  <span className="font-label-sm uppercase tracking-widest text-outline font-bold mb-1">Total Activos</span>
                  <span className="font-display-lg text-5xl font-black text-on-surface drop-shadow-sm">{kpis.total}</span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-300">
                  <span className="material-symbols-outlined text-[28px]">devices</span>
                </div>
              </div>
              <div className="w-full bg-surface-container-high h-2 rounded-full mt-4 overflow-hidden shadow-inner">
                <div className="bg-gradient-to-r from-primary to-primary-container h-full rounded-full" style={{ width: '100%' }}></div>
              </div>
            </div>

            {/* Asignados */}
            <div className="group bg-gradient-to-br from-surface-container-lowest to-surface-container-low p-space-lg rounded-[24px] shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 border border-surface-container-high/50 relative overflow-hidden flex flex-col justify-between">
              <div className="absolute -right-8 -top-8 w-32 h-32 bg-secondary/10 rounded-full blur-3xl pointer-events-none group-hover:bg-secondary/20 transition-all duration-500"></div>
              <div className="flex justify-between items-start mb-space-md">
                <div className="flex flex-col z-10">
                  <span className="font-label-sm uppercase tracking-widest text-outline font-bold mb-1">En Custodia</span>
                  <span className="font-display-lg text-5xl font-black text-on-surface drop-shadow-sm">{kpis.asignados}</span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-secondary/20 to-secondary/5 text-secondary flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-300">
                  <span className="material-symbols-outlined text-[28px]">person_check</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs font-bold text-on-surface-variant mt-2 z-10">
                <span>{(kpis.asignados / (kpis.total || 1) * 100).toFixed(1)}% del total</span>
              </div>
              <div className="w-full bg-surface-container-high h-2 rounded-full mt-2 overflow-hidden shadow-inner">
                <div className="bg-gradient-to-r from-secondary to-[#60a5fa] h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${(kpis.asignados / (kpis.total || 1)) * 100}%` }}></div>
              </div>
            </div>

            {/* Disponibles */}
            <div className="group bg-gradient-to-br from-surface-container-lowest to-surface-container-low p-space-lg rounded-[24px] shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 border border-surface-container-high/50 relative overflow-hidden flex flex-col justify-between">
              <div className="absolute -right-8 -top-8 w-32 h-32 bg-success/10 rounded-full blur-3xl pointer-events-none group-hover:bg-success/20 transition-all duration-500"></div>
              <div className="flex justify-between items-start mb-space-md">
                <div className="flex flex-col z-10">
                  <span className="font-label-sm uppercase tracking-widest text-outline font-bold mb-1">Disponibles</span>
                  <span className="font-display-lg text-5xl font-black text-on-surface drop-shadow-sm">{kpis.disponibles}</span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-success/20 to-success/5 text-success flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-300">
                  <span className="material-symbols-outlined text-[28px]">inventory_2</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs font-bold text-on-surface-variant mt-2 z-10">
                <span>Listos para entrega</span>
              </div>
              <div className="w-full bg-surface-container-high h-2 rounded-full mt-2 overflow-hidden shadow-inner">
                <div className="bg-gradient-to-r from-success to-[#34d399] h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${(kpis.disponibles / (kpis.total || 1)) * 100}%` }}></div>
              </div>
            </div>

            {/* Mantenimiento */}
            <div className="group bg-gradient-to-br from-surface-container-lowest to-surface-container-low p-space-lg rounded-[24px] shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 border border-error/20 relative overflow-hidden flex flex-col justify-between">
              <div className="absolute -right-8 -top-8 w-32 h-32 bg-error/10 rounded-full blur-3xl pointer-events-none group-hover:bg-error/20 transition-all duration-500"></div>
              <div className="flex justify-between items-start mb-space-md">
                <div className="flex flex-col z-10">
                  <span className="font-label-sm uppercase tracking-widest text-error/80 font-bold mb-1">En Taller</span>
                  <span className="font-display-lg text-5xl font-black text-error drop-shadow-sm">{kpis.mantenimiento}</span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-error/20 to-error/5 text-error flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-300">
                  <span className="material-symbols-outlined text-[28px]">build</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs font-bold text-error/70 mt-2 z-10">
                <span>Atención técnica req.</span>
              </div>
              <div className="w-full bg-error/10 h-2 rounded-full mt-2 overflow-hidden shadow-inner">
                <div className="bg-gradient-to-r from-error to-[#fb7185] h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${(kpis.mantenimiento / (kpis.total || 1)) * 100}%` }}></div>
              </div>
            </div>

          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg">
            
            {/* GRÁFICA DE DISTRIBUCIÓN (Premium) */}
            <div className="xl:col-span-5 bg-surface-container-lowest p-space-xl rounded-[24px] shadow-sm border border-surface-container-high/40 flex flex-col relative overflow-hidden">
              <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>
              <h3 className="font-headline-sm text-xl font-black text-on-surface flex items-center gap-2 mb-space-xl z-10">
                <span className="material-symbols-outlined text-primary bg-primary/10 p-2 rounded-lg">pie_chart</span>
                Distribución de Estados
              </h3>
              
              <div className="flex-1 flex flex-col justify-center gap-space-xl z-10">
                <div className="group flex flex-col gap-2 cursor-default">
                  <div className="flex justify-between items-end">
                    <div className="flex items-center gap-2 font-bold text-sm">
                      <div className="w-3 h-3 rounded-full bg-secondary shadow-[0_0_8px_rgba(56,189,248,0.6)]"></div>
                      ASIGNADO
                    </div>
                    <div className="font-mono text-lg font-black text-secondary">{kpis.asignados}</div>
                  </div>
                  <div className="w-full h-3 bg-surface-container-high rounded-full overflow-hidden shadow-inner">
                    <div className="h-full bg-gradient-to-r from-secondary to-[#60a5fa] rounded-full group-hover:brightness-110 transition-all duration-500 ease-out" style={{width: `${(kpis.asignados / (kpis.total || 1)) * 100}%`}}></div>
                  </div>
                </div>

                <div className="group flex flex-col gap-2 cursor-default">
                  <div className="flex justify-between items-end">
                    <div className="flex items-center gap-2 font-bold text-sm">
                      <div className="w-3 h-3 rounded-full bg-success shadow-[0_0_8px_rgba(74,222,128,0.6)]"></div>
                      DISPONIBLE
                    </div>
                    <div className="font-mono text-lg font-black text-success">{kpis.disponibles}</div>
                  </div>
                  <div className="w-full h-3 bg-surface-container-high rounded-full overflow-hidden shadow-inner">
                    <div className="h-full bg-gradient-to-r from-success to-[#34d399] rounded-full group-hover:brightness-110 transition-all duration-500 ease-out" style={{width: `${(kpis.disponibles / (kpis.total || 1)) * 100}%`}}></div>
                  </div>
                </div>

                <div className="group flex flex-col gap-2 cursor-default">
                  <div className="flex justify-between items-end">
                    <div className="flex items-center gap-2 font-bold text-sm">
                      <div className="w-3 h-3 rounded-full bg-error shadow-[0_0_8px_rgba(248,113,113,0.6)]"></div>
                      MANTENIMIENTO
                    </div>
                    <div className="font-mono text-lg font-black text-error">{kpis.mantenimiento}</div>
                  </div>
                  <div className="w-full h-3 bg-surface-container-high rounded-full overflow-hidden shadow-inner">
                    <div className="h-full bg-gradient-to-r from-error to-[#fb7185] rounded-full group-hover:brightness-110 transition-all duration-500 ease-out" style={{width: `${(kpis.mantenimiento / (kpis.total || 1)) * 100}%`}}></div>
                  </div>
                </div>

                <div className="group flex flex-col gap-2 cursor-default">
                  <div className="flex justify-between items-end">
                    <div className="flex items-center gap-2 font-bold text-sm">
                      <div className="w-3 h-3 rounded-full bg-outline shadow-[0_0_8px_rgba(156,163,175,0.6)]"></div>
                      BAJA
                    </div>
                    <div className="font-mono text-lg font-black text-outline">{kpis.bajas}</div>
                  </div>
                  <div className="w-full h-3 bg-surface-container-high rounded-full overflow-hidden shadow-inner">
                    <div className="h-full bg-gradient-to-r from-outline to-[#d1d5db] rounded-full group-hover:brightness-110 transition-all duration-500 ease-out" style={{width: `${(kpis.bajas / (kpis.total || 1)) * 100}%`}}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* ACTIVIDAD RECIENTE (TIMELINE PREMIUM) */}
            <div className="xl:col-span-7 bg-surface-container-lowest p-space-xl rounded-[24px] shadow-sm border border-surface-container-high/40 flex flex-col relative overflow-hidden">
              <div className="absolute right-0 top-0 w-64 h-64 bg-secondary/5 rounded-full blur-3xl pointer-events-none"></div>
              
              <div className="flex items-center justify-between mb-space-lg z-10">
                <h3 className="font-headline-sm text-xl font-black text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary bg-secondary/10 p-2 rounded-lg">history</span>
                  Timeline de Actividad
                </h3>
                <button onClick={() => navigate('/historial')} className="px-4 py-2 bg-primary/10 text-primary text-sm font-bold rounded-lg hover:bg-primary hover:text-on-primary transition-all shadow-sm flex items-center gap-1 cursor-pointer">
                  Ver Todo
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </button>
              </div>

              <div className="flex flex-col gap-0 overflow-y-auto pr-4 z-10 relative" style={{ maxHeight: '380px' }}>
                <div className="absolute left-6 top-4 bottom-4 w-0.5 bg-gradient-to-b from-surface-container-high to-transparent"></div>
                {movimientos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-outline">
                    <span className="material-symbols-outlined text-5xl opacity-50 mb-4">search_off</span>
                    <p className="font-bold">Sin actividad reciente</p>
                  </div>
                ) : (
                  movimientos.map((mov, i) => (
                    <div key={mov.id} className="relative flex items-start gap-space-md p-space-sm pl-0 group hover:bg-surface-container-low/50 rounded-xl transition-colors ml-2 mt-2">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white font-bold shadow-md z-10 mt-1
                        ${mov.tipo === 'ENTREGA' ? 'bg-gradient-to-br from-secondary to-[#0284c7]' : 
                          mov.tipo === 'DEVOLUCIÓN' || mov.tipo === 'DEVOLUCION' ? 'bg-gradient-to-br from-error to-[#e11d48]' : 
                          'bg-gradient-to-br from-primary to-[#4338ca]'} 
                        group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300`}>
                        <span className="material-symbols-outlined text-[20px]">
                          {mov.tipo === 'ENTREGA' ? 'assignment_ind' : mov.tipo === 'DEVOLUCIÓN' || mov.tipo === 'DEVOLUCION' ? 'keyboard_return' : 'device_hub'}
                        </span>
                      </div>
                      
                      <div className="flex flex-col flex-1 min-w-0 bg-surface-container-lowest p-space-md rounded-xl border border-surface-container-high/30 shadow-sm group-hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-black text-on-surface text-sm uppercase tracking-wider bg-surface-container-low px-2 py-0.5 rounded text-[11px]">
                            {mov.tipo}
                          </span>
                          <span className="text-xs text-outline font-mono flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">schedule</span>
                            {new Date(mov.fecha).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                        </div>
                        <span className="font-bold text-primary truncate mb-0.5">{mov.placa || mov.acta_numero}</span>
                        <span className="text-sm text-on-surface-variant line-clamp-2 leading-snug">
                          {mov.descripcion || 'Actualización de estado en el sistema'}
                        </span>
                        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-surface-container-high/40">
                          <div className="w-5 h-5 rounded-full bg-surface-container-high flex items-center justify-center text-[10px] font-bold text-on-surface">
                            {(mov.responsable || 'S').charAt(0)}
                          </div>
                          <span className="text-xs font-bold text-on-surface-variant">Resp: {mov.responsable || 'Sistema'}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

            </div>
          </div>

        </main>
      </div>
    </div>
  );
}
