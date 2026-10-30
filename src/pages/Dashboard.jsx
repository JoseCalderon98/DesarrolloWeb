import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { 
  getStoredUser, 
  AREAS_CORPORATIVAS, 
  REGIONALES_FILTRO, 
  resolveAssetArea, 
  resolveAssetRegionalId 
} from '../utils/userHelpers';
import { formatCurrencyCOP, getEstimatedPriceByCategory } from '../utils/assetHelpers';
import Sidebar from '../components/Sidebar';

const AREA_ICONS = {
  'Talento Humano / Recursos Humanos': 'diversity_3',
  'Tecnología e Infraestructura (TI)': 'dns',
  'Operaciones y Servicios Generales': 'engineering',
  'Contabilidad y Finanzas': 'account_balance',
  'Comercial y Mercadeo': 'campaign',
  'Compras, Logística y Bodega': 'inventory',
  'Seguridad y Salud en el Trabajo (SST / HSEQ)': 'health_and_safety',
  'Gerencia y Dirección Administrativa': 'corporate_fare'
};

export default function Dashboard() {
  const navigate = useNavigate();
  const currentUser = getStoredUser();

  const [equipos, setEquipos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtro interactivo de Regional en el panel de segmentación por Áreas
  const [selectedRegional, setSelectedRegional] = useState('all');

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

    const unsubUsuarios = onSnapshot(collection(db, "usuarios"), (snapshot) => {
      const list = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      setUsuarios(list);
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
      unsubUsuarios();
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

    const parseEqDate = (eq) => {
      if (eq.createdAt?.seconds) return new Date(eq.createdAt.seconds * 1000);
      if (eq.fecha_registro) {
        const d = new Date(eq.fecha_registro);
        if (!isNaN(d.getTime())) return d;
      }
      return null;
    };

    const altasMes = equipos.filter(eq => {
      const d = parseEqDate(eq);
      return d && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).length;

    const movsMesActual = movimientos.filter(m => {
      const date = new Date(m.fecha?.seconds ? m.fecha.seconds * 1000 : m.fecha_registro || m.fecha);
      return !isNaN(date.getTime()) && date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });

    const entregasMes = movsMesActual.filter(m => m.tipo === 'ENTREGA').length;
    const devolucionesMes = movsMesActual.filter(m => m.tipo === 'DEVOLUCIÓN').length;

    return { total, asignados, disponibles, mantenimiento, bajas, entregasMes, devolucionesMes, altasMes };
  }, [equipos, movimientos]);

  // Segmentación por Regional y por Área / Departamento
  const segmentacionDatos = useMemo(() => {
    // Conteo por cada regional
    const conteoPorRegional = {};
    REGIONALES_FILTRO.forEach(r => {
      conteoPorRegional[r.id] = 0;
    });

    equipos.forEach(eq => {
      const regId = resolveAssetRegionalId(eq);
      conteoPorRegional[regId] = (conteoPorRegional[regId] || 0) + 1;
    });

    // Filtrar equipos por la regional seleccionada
    const equiposEnRegional = selectedRegional === 'all'
      ? equipos
      : equipos.filter(eq => resolveAssetRegionalId(eq) === selectedRegional);

    // Agrupar por las 8 áreas corporativas
    const mapaAreas = {};
    AREAS_CORPORATIVAS.forEach(areaName => {
      mapaAreas[areaName] = {
        area: areaName,
        total: 0,
        asignados: 0,
        disponibles: 0,
        mantenimiento: 0,
        valorTotal: 0
      };
    });

    equiposEnRegional.forEach(eq => {
      const areaResuelta = resolveAssetArea(eq, usuarios);
      const targetArea = mapaAreas[areaResuelta] ? areaResuelta : 'Tecnología e Infraestructura (TI)';
      const bucket = mapaAreas[targetArea];

      bucket.total += 1;
      if (eq.estado === 'ASIGNADO') bucket.asignados += 1;
      else if (eq.estado === 'DISPONIBLE' || !eq.estado) bucket.disponibles += 1;
      else if (eq.estado === 'MANTENIMIENTO') bucket.mantenimiento += 1;

      const valor = Number(eq.valor_declarado) > 0
        ? Number(eq.valor_declarado)
        : getEstimatedPriceByCategory(eq.categoria);
      bucket.valorTotal += valor;
    });

    const listaAreas = Object.values(mapaAreas).sort((a, b) => b.total - a.total);
    const totalEquiposFiltrados = equiposEnRegional.length;

    return {
      conteoPorRegional,
      listaAreas,
      totalEquiposFiltrados
    };
  }, [equipos, usuarios, selectedRegional]);

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
      <div className="pl-0 lg:pl-72 flex flex-col min-h-screen">
        {/* HEADER SUPERIOR RESPONSIVE */}
        <header className="fixed top-0 left-0 lg:left-72 right-0 h-16 bg-surface/90 backdrop-blur-xl z-40 shadow-[0_1px_8px_rgba(0,0,0,0.04)] px-3 sm:px-space-md lg:px-space-xl flex items-center justify-between gap-2 sm:gap-space-lg">
          <div className="flex items-center gap-2 sm:gap-space-lg flex-1 min-w-0">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('toggle-mobile-sidebar'))}
              className="lg:hidden p-2 -ml-1 rounded-lg text-on-surface hover:bg-surface-container shrink-0 cursor-pointer"
              title="Abrir menú"
              aria-label="Abrir menú"
            >
              <span className="material-symbols-outlined text-[24px]">menu</span>
            </button>
            <h1 className="font-headline-sm text-lg sm:text-xl text-primary font-black tracking-tight truncate">Dashboard General</h1>
          </div>
          <div className="flex items-center gap-space-sm sm:gap-space-md shrink-0">
            <div className="flex items-center gap-space-sm sm:gap-space-md pl-space-xs">
              <div className="flex flex-col text-right hidden sm:flex">
                <span className="font-label-md text-label-md text-on-surface font-bold truncate max-w-[150px]">{currentUser?.nombre || 'Funcionario'}</span>
                <span className="font-label-sm text-label-sm text-secondary font-semibold truncate max-w-[150px]">{currentUser?.cargo || currentUser?.rol || 'TI'}</span>
              </div>
              <img alt="Perfil" className="w-8 h-8 rounded-full object-cover ring-2 ring-primary/20" src={currentUser?.avatar || 'https://i.pravatar.cc/150'} />
              <button onClick={handleLogout} className="hover:bg-error-container hover:text-error text-outline p-1.5 rounded-full transition-colors cursor-pointer" title="Cerrar Sesión">
                <span className="material-symbols-outlined text-[20px]">logout</span>
              </button>
            </div>
          </div>
        </header>

        {/* CONTENIDO PRINCIPAL */}
        <main className="flex-1 mt-16 p-3 sm:p-6 lg:p-space-xl overflow-y-auto">
          
          <div className="mb-space-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-headline-sm text-xl sm:text-2xl font-black text-on-surface">Resumen Operativo</h2>
              <p className="text-on-surface-variant text-xs sm:text-sm mt-0.5 sm:mt-1">Monitoreo global del inventario de activos TI, distribución por áreas organizacionales y regionales.</p>
            </div>
            <div className="bg-primary/10 text-primary px-space-md py-space-xs rounded-lg flex items-center gap-space-sm font-bold shadow-sm text-xs sm:text-sm">
              <span className="material-symbols-outlined text-[18px] sm:text-[20px]">calendar_today</span>
              {new Date().toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }).toUpperCase()}
            </div>
          </div>

          {/* TARJETAS DE KPIs (Responsive: 1 col en 360, 2 cols en 768, 4 cols en 1024) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-space-lg mb-space-xl">
            
            {/* Total Activos */}
            <div className="group bg-gradient-to-br from-surface-container-lowest to-surface-container-low p-4 sm:p-space-lg rounded-[20px] sm:rounded-[24px] shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 border border-surface-container-high/50 relative overflow-hidden flex flex-col justify-between">
              <div className="absolute -right-8 -top-8 w-32 h-32 bg-primary/10 rounded-full blur-3xl pointer-events-none group-hover:bg-primary/20 transition-all duration-500"></div>
              <div className="flex justify-between items-start mb-space-md">
                <div className="flex flex-col z-10">
                  <span className="font-label-sm uppercase tracking-widest text-outline font-bold mb-1">Total Activos</span>
                  <span className="font-display-lg text-4xl sm:text-5xl font-black text-on-surface drop-shadow-sm">{kpis.total}</span>
                </div>
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-300">
                  <span className="material-symbols-outlined text-[24px] sm:text-[28px]">devices</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs font-bold text-on-surface-variant mt-2 z-10">
                <span className="text-primary flex items-center gap-1 font-semibold">
                  <span className="material-symbols-outlined text-[15px]">trending_up</span>
                  {kpis.altasMes} altas este mes
                </span>
              </div>
              <div className="w-full bg-surface-container-high h-2 rounded-full mt-2 overflow-hidden shadow-inner">
                <div className="bg-gradient-to-r from-primary to-primary-container h-full rounded-full" style={{ width: '100%' }}></div>
              </div>
            </div>

            {/* Asignados */}
            <div className="group bg-gradient-to-br from-surface-container-lowest to-surface-container-low p-4 sm:p-space-lg rounded-[20px] sm:rounded-[24px] shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 border border-surface-container-high/50 relative overflow-hidden flex flex-col justify-between">
              <div className="absolute -right-8 -top-8 w-32 h-32 bg-secondary/10 rounded-full blur-3xl pointer-events-none group-hover:bg-secondary/20 transition-all duration-500"></div>
              <div className="flex justify-between items-start mb-space-md">
                <div className="flex flex-col z-10">
                  <span className="font-label-sm uppercase tracking-widest text-outline font-bold mb-1">En Custodia</span>
                  <span className="font-display-lg text-4xl sm:text-5xl font-black text-on-surface drop-shadow-sm">{kpis.asignados}</span>
                </div>
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-secondary/20 to-secondary/5 text-secondary flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-300">
                  <span className="material-symbols-outlined text-[24px] sm:text-[28px]">person_check</span>
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
            <div className="group bg-gradient-to-br from-surface-container-lowest to-surface-container-low p-4 sm:p-space-lg rounded-[20px] sm:rounded-[24px] shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 border border-surface-container-high/50 relative overflow-hidden flex flex-col justify-between">
              <div className="absolute -right-8 -top-8 w-32 h-32 bg-success/10 rounded-full blur-3xl pointer-events-none group-hover:bg-success/20 transition-all duration-500"></div>
              <div className="flex justify-between items-start mb-space-md">
                <div className="flex flex-col z-10">
                  <span className="font-label-sm uppercase tracking-widest text-outline font-bold mb-1">Disponibles</span>
                  <span className="font-display-lg text-4xl sm:text-5xl font-black text-on-surface drop-shadow-sm">{kpis.disponibles}</span>
                </div>
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-success/20 to-success/5 text-success flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-300">
                  <span className="material-symbols-outlined text-[24px] sm:text-[28px]">inventory_2</span>
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
            <div className="group bg-gradient-to-br from-surface-container-lowest to-surface-container-low p-4 sm:p-space-lg rounded-[20px] sm:rounded-[24px] shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 border border-error/20 relative overflow-hidden flex flex-col justify-between">
              <div className="absolute -right-8 -top-8 w-32 h-32 bg-error/10 rounded-full blur-3xl pointer-events-none group-hover:bg-error/20 transition-all duration-500"></div>
              <div className="flex justify-between items-start mb-space-md">
                <div className="flex flex-col z-10">
                  <span className="font-label-sm uppercase tracking-widest text-error/80 font-bold mb-1">En Taller</span>
                  <span className="font-display-lg text-4xl sm:text-5xl font-black text-error drop-shadow-sm">{kpis.mantenimiento}</span>
                </div>
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-error/20 to-error/5 text-error flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-300">
                  <span className="material-symbols-outlined text-[24px] sm:text-[28px]">build</span>
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

          {/* ======================================================================== */}
          {/* PANEL DE SEGMENTACIÓN POR ÁREA / DEPARTAMENTO Y SEDE REGIONAL           */}
          {/* ======================================================================== */}
          <div className="bg-surface-container-lowest p-4 sm:p-space-xl rounded-[20px] sm:rounded-[24px] shadow-sm border border-surface-container-high/40 mb-space-xl relative overflow-hidden">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-space-md border-b border-surface-container-high/40 mb-space-lg">
              <div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary bg-primary/10 p-2 rounded-lg">domain</span>
                  <h3 className="font-headline-sm text-lg sm:text-xl font-black text-on-surface">
                    Equipos Cargados por Área / Departamento y Regional
                  </h3>
                </div>
                <p className="text-xs sm:text-sm text-on-surface-variant mt-1">
                  Control segmentado de hardware asignado y disponible por dependencia corporativa. Haz clic en una regional para filtrar o en un área para ver sus equipos en el inventario.
                </p>
              </div>

              {/* Píldoras de Filtro por Regional */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setSelectedRegional('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    selectedRegional === 'all'
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">public</span>
                  <span>Todas las Regionales ({equipos.length})</span>
                </button>
                {REGIONALES_FILTRO.map((reg) => {
                  const count = segmentacionDatos.conteoPorRegional[reg.id] || 0;
                  const active = selectedRegional === reg.id;
                  return (
                    <button
                      key={reg.id}
                      type="button"
                      onClick={() => setSelectedRegional(active ? 'all' : reg.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                        active
                          ? 'bg-secondary text-on-secondary shadow-sm ring-2 ring-secondary/30'
                          : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                      }`}
                    >
                      <span>{reg.shortLabel}</span>
                      <span className={`px-1.5 py-0.2 rounded-full font-mono text-[10px] ${active ? 'bg-white/20 text-white' : 'bg-surface-container-high text-primary'}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Grid de las 8 Áreas Corporativas */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-space-md">
              {segmentacionDatos.listaAreas.map((item) => {
                const pct = segmentacionDatos.totalEquiposFiltrados > 0
                  ? Math.round((item.total / segmentacionDatos.totalEquiposFiltrados) * 100)
                  : 0;
                const iconName = AREA_ICONS[item.area] || 'apartment';

                return (
                  <div
                    key={item.area}
                    onClick={() => {
                      const params = new URLSearchParams();
                      params.set('area', item.area);
                      if (selectedRegional !== 'all') params.set('regional', selectedRegional);
                      navigate(`/inventario?${params.toString()}`);
                    }}
                    className="group p-space-md rounded-2xl bg-surface-container-low/60 hover:bg-surface-container border border-surface-container-high/50 hover:border-primary/40 transition-all cursor-pointer flex flex-col justify-between shadow-xs hover:shadow-md"
                    title="Ver equipos de esta área en el Inventario"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-on-primary transition-colors">
                            <span className="material-symbols-outlined text-[20px]">{iconName}</span>
                          </div>
                          <span className="font-label-md font-bold text-on-surface text-xs sm:text-sm leading-tight line-clamp-2">
                            {item.area}
                          </span>
                        </div>
                        <span className="font-display-lg text-2xl font-black text-primary font-mono shrink-0">
                          {item.total}
                        </span>
                      </div>

                      {/* Barra de participación */}
                      <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden my-2">
                        <div
                          className="h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 pt-2 border-t border-surface-container-high/40 text-[11px]">
                      <div className="flex items-center justify-between text-outline">
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-secondary"></span>
                          En custodia: <strong className="text-on-surface">{item.asignados}</strong>
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-success"></span>
                          Stock: <strong className="text-on-surface">{item.disponibles}</strong>
                        </span>
                        <span className="font-mono font-bold text-primary">{pct}%</span>
                      </div>
                      <div className="flex items-center justify-between text-outline pt-0.5">
                        <span>Valor cargado:</span>
                        <span className="font-mono font-bold text-on-surface">{formatCurrencyCOP(item.valorTotal)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
            
            {/* GRÁFICA DE DISTRIBUCIÓN (Responsive: 12 cols en 360/768, 5 cols en 1024) */}
            <div className="lg:col-span-5 bg-surface-container-lowest p-4 sm:p-space-xl rounded-[20px] sm:rounded-[24px] shadow-sm border border-surface-container-high/40 flex flex-col relative overflow-hidden">
              <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>
              <h3 className="font-headline-sm text-lg sm:text-xl font-black text-on-surface flex items-center gap-2 mb-space-lg sm:mb-space-xl z-10">
                <span className="material-symbols-outlined text-primary bg-primary/10 p-2 rounded-lg">pie_chart</span>
                Distribución de Estados
              </h3>
              
              <div className="flex-1 flex flex-col justify-center gap-space-lg sm:gap-space-xl z-10">
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

            {/* ACTIVIDAD RECIENTE (Responsive: 12 cols en 360/768, 7 cols en 1024) */}
            <div className="lg:col-span-7 bg-surface-container-lowest p-4 sm:p-space-xl rounded-[20px] sm:rounded-[24px] shadow-sm border border-surface-container-high/40 flex flex-col relative overflow-hidden">
              <div className="absolute right-0 top-0 w-64 h-64 bg-secondary/5 rounded-full blur-3xl pointer-events-none"></div>
              
              <div className="flex items-center justify-between mb-space-lg z-10 gap-2">
                <h3 className="font-headline-sm text-lg sm:text-xl font-black text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary bg-secondary/10 p-2 rounded-lg">history</span>
                  Timeline de Actividad
                </h3>
                <button onClick={() => navigate('/reportes')} className="px-3 sm:px-4 py-1.5 sm:py-2 bg-primary/10 text-primary text-xs sm:text-sm font-bold rounded-lg hover:bg-primary hover:text-on-primary transition-all shadow-sm flex items-center gap-1 cursor-pointer shrink-0">
                  Ver Todo
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </button>
              </div>

              <div className="flex flex-col gap-0 overflow-y-auto pr-2 sm:pr-4 z-10 relative" style={{ maxHeight: '380px' }}>
                <div className="absolute left-6 top-4 bottom-4 w-0.5 bg-gradient-to-b from-surface-container-high to-transparent"></div>
                {movimientos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-outline">
                    <span className="material-symbols-outlined text-5xl opacity-50 mb-4">search_off</span>
                    <p className="font-bold">Sin actividad reciente</p>
                  </div>
                ) : (
                  movimientos.map((mov) => (
                    <div key={mov.id} className="relative flex items-start gap-space-sm sm:gap-space-md p-space-sm pl-0 group hover:bg-surface-container-low/50 rounded-xl transition-colors ml-1 sm:ml-2 mt-2">
                      <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 text-white font-bold shadow-md z-10 mt-1
                        ${mov.tipo === 'ENTREGA' ? 'bg-gradient-to-br from-secondary to-[#0284c7]' : 
                          mov.tipo === 'DEVOLUCIÓN' || mov.tipo === 'DEVOLUCION' ? 'bg-gradient-to-br from-error to-[#e11d48]' : 
                          'bg-gradient-to-br from-primary to-[#4338ca]'} 
                        group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300`}>
                        <span className="material-symbols-outlined text-[18px] sm:text-[20px]">
                          {mov.tipo === 'ENTREGA' ? 'assignment_ind' : mov.tipo === 'DEVOLUCIÓN' || mov.tipo === 'DEVOLUCION' ? 'keyboard_return' : 'device_hub'}
                        </span>
                      </div>
                      
                      <div className="flex flex-col flex-1 min-w-0 bg-surface-container-lowest p-3 sm:p-space-md rounded-xl border border-surface-container-high/30 shadow-sm group-hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-1 gap-2">
                          <span className="font-black text-on-surface uppercase tracking-wider bg-surface-container-low px-2 py-0.5 rounded text-[10px] sm:text-[11px] truncate">
                            {mov.tipo}
                          </span>
                          <span className="text-[11px] sm:text-xs text-outline font-mono flex items-center gap-1 shrink-0">
                            <span className="material-symbols-outlined text-[13px] sm:text-[14px]">schedule</span>
                            {new Date(mov.fecha).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                        </div>
                        <span className="font-bold text-primary truncate mb-0.5 text-xs sm:text-sm">{mov.placa || mov.acta_numero}</span>
                        <span className="text-xs sm:text-sm text-on-surface-variant line-clamp-2 leading-snug">
                          {mov.descripcion || 'Actualización de estado en el sistema'}
                        </span>
                        <div className="flex items-center gap-2 mt-2 sm:mt-3 pt-2 border-t border-surface-container-high/40">
                          <div className="w-5 h-5 rounded-full bg-surface-container-high flex items-center justify-center text-[10px] font-bold text-on-surface shrink-0">
                            {(mov.responsable || 'S').charAt(0)}
                          </div>
                          <span className="text-[11px] sm:text-xs font-bold text-on-surface-variant truncate">Resp: {mov.responsable || 'Sistema'}</span>
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
