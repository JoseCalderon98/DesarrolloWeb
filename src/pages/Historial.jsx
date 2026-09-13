import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../firebase';
import { getStoredUser } from '../utils/userHelpers';
import { generateAndPrintActa } from '../utils/actaPrintService';

export default function Historial() {
  const navigate = useNavigate();
  const currentUser = getStoredUser();

  // Estados de datos Firestore
  const [actasEntrega, setActasEntrega] = useState([]);
  const [actasDevolucion, setActasDevolucion] = useState([]);
  const [movimientosGenerales, setMovimientosGenerales] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados de Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTipo, setFilterTipo] = useState('all');
  const [filterPeriodo, setFilterPeriodo] = useState('all');

  // Modal de Detalle de Acta
  const [selectedMovimiento, setSelectedMovimiento] = useState(null);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  // ----------------------------------------------------
  // SUSCRIPCIONES EN TIEMPO REAL A FIRESTORE
  // ----------------------------------------------------
  useEffect(() => {
    // 1. Actas de Entrega
    const unsubEntrega = onSnapshot(query(collection(db, "actas_entrega")), (snapshot) => {
      const list = [];
      snapshot.forEach(d => list.push({ id: d.id, ...d.data() }));
      setActasEntrega(list);
    });

    // 2. Actas de Devolución
    const unsubDevolucion = onSnapshot(query(collection(db, "actas_devolucion")), (snapshot) => {
      const list = [];
      snapshot.forEach(d => list.push({ id: d.id, ...d.data() }));
      setActasDevolucion(list);
    });

    // 3. Movimientos Generales
    const unsubMovimientos = onSnapshot(query(collection(db, "movimientos")), (snapshot) => {
      const list = [];
      snapshot.forEach(d => list.push({ id: d.id, ...d.data() }));
      setMovimientosGenerales(list);
    });

    // 4. Equipos (para complementar altas del sistema)
    const unsubEquipos = onSnapshot(query(collection(db, "equipos")), (snapshot) => {
      const list = [];
      snapshot.forEach(d => list.push({ id: d.id, ...d.data() }));
      setEquipos(list);
      setLoading(false);
    });

    return () => {
      unsubEntrega();
      unsubDevolucion();
      unsubMovimientos();
      unsubEquipos();
    };
  }, []);

  // ----------------------------------------------------
  // UNIFICACIÓN Y NORMALIZACIÓN DE TODOS LOS MOVIMIENTOS
  // ----------------------------------------------------
  const allMovements = useMemo(() => {
    const combined = [];

    // A. Normalizar Entregas
    actasEntrega.forEach(acta => {
      const seconds = acta.createdAt?.seconds || 0;
      combined.push({
        id: `ENT_${acta.id}`,
        tipo: 'ENTREGA',
        badgeColor: 'bg-primary text-on-primary',
        icon: 'post_add',
        acta_numero: acta.acta_numero || 'Sin Acta',
        fecha: acta.fecha || 'Fecha no registrada',
        timestamp: seconds,
        placa: acta.placa || '---',
        equipo_nombre: acta.equipo_nombre || 'Hardware TI',
        serial: acta.serial || '---',
        colaborador: typeof acta.colaborador === 'object' ? acta.colaborador?.nombre : acta.colaborador,
        colaborador_cc: typeof acta.colaborador === 'object' ? acta.colaborador?.cedula : '',
        colaborador_sede: typeof acta.colaborador === 'object' ? acta.colaborador?.sede : '',
        responsable_ti: typeof acta.entregado_por === 'object' ? acta.entregado_por?.nombre : acta.entregado_por,
        detalles: `Asignación y Custodia Legal (${(acta.accesorios || []).length} accesorios)`,
        cert_hash: acta.cert_hash || '---',
        rawDoc: acta
      });
    });

    // B. Normalizar Devoluciones
    actasDevolucion.forEach(dev => {
      const seconds = dev.createdAt?.seconds || 0;
      combined.push({
        id: `DEV_${dev.id}`,
        tipo: 'DEVOLUCION',
        badgeColor: 'bg-secondary text-on-secondary',
        icon: 'keyboard_return',
        acta_numero: dev.acta_numero || 'Sin Acta',
        fecha: dev.fecha || 'Fecha no registrada',
        timestamp: seconds,
        placa: dev.placa || '---',
        equipo_nombre: dev.equipo_nombre || 'Hardware TI',
        serial: dev.serial || '---',
        colaborador: dev.entregado_por_colaborador?.nombre || 'Colaborador',
        colaborador_cc: dev.entregado_por_colaborador?.cedula || '',
        colaborador_sede: dev.entregado_por_colaborador?.sede || '',
        responsable_ti: dev.recibido_por_ti?.nombre || 'Técnico TI',
        detalles: `Reintegro a ${dev.nuevo_estado || 'DISPONIBLE'} • Estado: ${dev.condicion_fisica || 'OK'}`,
        cert_hash: dev.cert_hash || '---',
        rawDoc: dev
      });
    });

    // C. Si existen registros en 'movimientos' que no sean ni entrega ni devolución (ej. mantenimientos o traslados)
    movimientosGenerales.forEach(mov => {
      if (mov.tipo !== 'ENTREGA' && mov.tipo !== 'DEVOLUCION') {
        const seconds = mov.createdAt?.seconds || 0;
        combined.push({
          id: `MOV_${mov.id}`,
          tipo: mov.tipo || 'MOVIMIENTO',
          badgeColor: 'bg-surface-container-highest text-on-surface',
          icon: 'swap_horiz',
          acta_numero: mov.acta_numero || 'MOV-REG',
          fecha: mov.fecha || 'Fecha no registrada',
          timestamp: seconds,
          placa: mov.placa || '---',
          equipo_nombre: mov.equipo_nombre || 'Hardware',
          serial: mov.serial || '---',
          colaborador: mov.origen || 'General',
          responsable_ti: mov.responsable_ti || 'SGI TI',
          detalles: mov.detalles || 'Movimiento de inventario',
          cert_hash: mov.cert_hash || '---',
          rawDoc: mov
        });
      }
    });

    // D. Registrar Altas de Equipos si no hay actas para dar visibilidad
    equipos.forEach(eq => {
      const seconds = eq.createdAt?.seconds || 0;
      combined.push({
        id: `ALTA_${eq.id}`,
        tipo: 'ALTA_SISTEMA',
        badgeColor: 'bg-primary-fixed text-on-primary-fixed',
        icon: 'add_circle',
        acta_numero: 'ALTA-INICIAL',
        fecha: eq.ultimo_movimiento?.includes('Alta') ? 'Ingreso Inicial' : 'Registro BD',
        timestamp: seconds,
        placa: eq.placa || '---',
        equipo_nombre: eq.equipo_nombre || 'Hardware',
        serial: eq.serial || '---',
        colaborador: eq.asignatario || 'Bodega Centralizada TI',
        responsable_ti: 'Administrador TI Casalimpia',
        detalles: `Alta en Catálogo TI • Categoría: ${eq.categoria || 'Hardware'} • Estado: ${eq.estado}`,
        cert_hash: `SYS-${eq.placa}`,
        rawDoc: eq
      });
    });

    // Ordenar de más reciente a más antiguo
    combined.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    return combined;
  }, [actasEntrega, actasDevolucion, movimientosGenerales, equipos]);

  // ----------------------------------------------------
  // FILTRADO DINÁMICO
  // ----------------------------------------------------
  const filteredMovements = useMemo(() => {
    return allMovements.filter(item => {
      // Filtro por texto
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchPlaca = (item.placa || '').toLowerCase().includes(q);
        const matchSerial = (item.serial || '').toLowerCase().includes(q);
        const matchNombre = (item.equipo_nombre || '').toLowerCase().includes(q);
        const matchColaborador = (item.colaborador || '').toLowerCase().includes(q);
        const matchActa = (item.acta_numero || '').toLowerCase().includes(q);
        const matchHash = (item.cert_hash || '').toLowerCase().includes(q);
        if (!matchPlaca && !matchSerial && !matchNombre && !matchColaborador && !matchActa && !matchHash) {
          return false;
        }
      }

      // Filtro por Tipo
      if (filterTipo !== 'all') {
        if (item.tipo !== filterTipo) return false;
      }

      return true;
    });
  }, [allMovements, searchQuery, filterTipo]);

  // KPIs
  const totalMovimientos = allMovements.length;
  const totalEntregas = actasEntrega.length;
  const totalDevoluciones = actasDevolucion.length;
  const totalEquiposActivos = equipos.length;

  // Exportar Historial a CSV
  const handleExportCSV = () => {
    if (filteredMovements.length === 0) {
      alert("No hay movimientos para exportar.");
      return;
    }

    const headers = ['Tipo', 'Acta N°', 'Fecha', 'Placa TI', 'Equipo', 'Serial', 'Colaborador Custodio', 'Responsable TI', 'Detalles', 'Hash Legal'];
    const rows = filteredMovements.map(m => [
      m.tipo,
      m.acta_numero,
      m.fecha,
      m.placa,
      m.equipo_nombre,
      m.serial,
      m.colaborador,
      m.responsable_ti,
      m.detalles,
      m.cert_hash
    ]);

    const escape = (str) => {
      const s = String(str ?? '');
      return `"${s.replace(/"/g, '""')}"`;
    };

    const csvContent = [
      headers.map(escape).join(','),
      ...rows.map(r => r.map(escape).join(','))
    ].join('\r\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `historial_trazabilidad_casalimpia_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-background font-body-md text-on-surface antialiased min-h-screen">
      
      {/* ASIDE / SIDEBAR OFICIAL SGI */}
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

          <div className="px-space-xl py-space-sm">
            <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline">Menú Principal</span>
          </div>

          <nav className="px-space-md space-y-space-xs flex-1">
            <a 
              className="flex items-center gap-space-md px-space-md py-space-sm text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface rounded-lg transition-colors cursor-pointer"
              onClick={() => navigate('/inventario')}
            >
              <span className="material-symbols-outlined text-[20px]">grid_view</span>
              <span className="font-body-md text-body-md">Dashboard General</span>
            </a>

            <a 
              className="flex items-center justify-between px-space-md py-space-sm text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface rounded-lg transition-colors cursor-pointer"
              onClick={() => navigate('/inventario')}
            >
              <div className="flex items-center gap-space-md">
                <span className="material-symbols-outlined text-[20px]">devices</span>
                <span className="font-body-md text-body-md">Inventario de Activos</span>
              </div>
              <span className="font-code-mono text-code-mono bg-surface-container-highest text-primary font-semibold px-space-sm py-0.5 rounded-full text-xs">
                {totalEquiposActivos}
              </span>
            </a>

            {/* Submenú Entrega y Custodia */}
            <div className="pt-space-xs">
              <div className="flex items-center justify-between px-space-md py-space-sm text-on-surface rounded-lg font-semibold">
                <div className="flex items-center gap-space-md">
                  <span className="material-symbols-outlined text-[20px] text-primary">assignment_return</span>
                  <span className="font-body-md text-body-md">Entrega y Custodia</span>
                </div>
                <span className="material-symbols-outlined text-[16px] text-outline">expand_more</span>
              </div>
              <div className="ml-space-lg pl-space-md space-y-space-xs mt-space-xs border-l-2 border-primary/20">
                <a 
                  className="flex items-center gap-space-sm px-space-md py-space-xs text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface rounded-lg transition-colors cursor-pointer" 
                  onClick={() => navigate('/entrega-hardware')}
                >
                  <span className="material-symbols-outlined text-[16px]">post_add</span>
                  <span className="font-body-sm text-body-sm">Nueva Entrega (RF-04)</span>
                </a>
                <a 
                  className="flex items-center gap-space-sm px-space-md py-space-xs text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface rounded-lg transition-colors cursor-pointer"
                  onClick={() => navigate('/devoluciones')}
                >
                  <span className="material-symbols-outlined text-[16px]">keyboard_return</span>
                  <span className="font-body-sm text-body-sm">Devoluciones (Reintegro)</span>
                </a>
                <a 
                  className="flex items-center gap-space-sm px-space-md py-space-xs transition-colors bg-primary-container text-on-primary font-headline-sm rounded-lg cursor-pointer"
                  onClick={() => {}}
                >
                  <span className="material-symbols-outlined text-[16px]">history</span>
                  <span className="font-body-sm text-body-sm font-bold">Historial y Auditoría</span>
                </a>
              </div>
            </div>

            <a 
              className="flex items-center justify-between px-space-md py-space-sm text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface rounded-lg transition-colors cursor-pointer"
              onClick={() => navigate('/usuarios-roles')}
            >
              <div className="flex items-center gap-space-md">
                <span className="material-symbols-outlined text-[20px]">manage_accounts</span>
                <span className="font-body-md text-body-md">Usuarios y Roles</span>
              </div>
            </a>
          </nav>
        </div>

        <div className="p-space-lg m-space-md bg-surface-container rounded-xl flex items-center gap-space-md border border-surface-container-highest/40">
          <div className="h-9 w-9 rounded-lg bg-secondary text-on-secondary flex items-center justify-center shrink-0 shadow-sm">
            <span className="material-symbols-outlined text-[20px]">verified_user</span>
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="font-label-sm text-label-sm text-primary uppercase font-bold truncate">Auditoría ISO 27001</span>
            <span className="font-body-sm text-body-sm text-outline truncate">
              {totalMovimientos} Registros Indexados
            </span>
          </div>
        </div>
      </aside>

      {/* CONTENIDO PRINCIPAL */}
      <div className="pl-72 flex flex-col min-h-screen">
        
        {/* HEADER SUPERIOR */}
        <header className="fixed top-0 left-72 right-0 h-16 bg-surface/90 backdrop-blur-xl z-40 shadow-[0_1px_8px_rgba(0,0,0,0.04)] px-space-xl flex items-center justify-between gap-space-lg">
          <div className="flex items-center gap-space-lg flex-1 max-w-2xl">
            <div className="hidden xl:flex items-center gap-space-xs text-on-surface-variant bg-surface-container px-space-md py-space-xs rounded-full shrink-0">
              <span className="material-symbols-outlined text-[16px] text-secondary">domain</span>
              <span className="font-label-sm text-label-sm font-semibold truncate">
                {currentUser?.sede || 'Sede Principal Casalimpia S.A. • Libro Mayor de Custodia'}
              </span>
            </div>

            <div className="relative w-full max-w-md">
              <span className="material-symbols-outlined absolute left-space-md top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
              <input 
                className="w-full h-9 pl-9 pr-space-md bg-surface-container-lowest text-on-surface rounded-lg font-body-sm text-body-sm placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-primary shadow-xs" 
                placeholder="Buscar por placa, serie, custodio o acta..." 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-space-md shrink-0">
            <button 
              onClick={handleExportCSV}
              className="h-9 px-space-md flex items-center gap-space-xs rounded-lg text-primary bg-primary/10 hover:bg-primary/20 transition-colors cursor-pointer font-label-sm text-label-sm font-bold shadow-xs"
              title="Descargar reporte en Excel (CSV)"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              <span>Exportar CSV</span>
            </button>

            <div className="h-6 w-px bg-surface-container-highest"></div>

            <div className="flex items-center gap-space-md pl-space-xs">
              <div className="flex flex-col text-right hidden sm:flex">
                <span className="font-label-md text-label-md text-on-surface font-bold">
                  {currentUser?.nombre || 'Funcionario SGI'}
                </span>
                <span className="font-label-sm text-label-sm text-secondary font-semibold">
                  {currentUser?.cargo || currentUser?.rol || 'Auditor TI'}
                </span>
              </div>
              <img 
                alt="Foto Perfil" 
                className="w-8 h-8 rounded-full object-cover ring-2 ring-primary/20 shadow-sm" 
                src={currentUser?.avatar || 'https://lh3.googleusercontent.com/aida-public/AB6AXuDyAiWOUn9njbbS4sZzxnzDv-_O7nlKMP0d8Uj3JmLf2C_0yjiCZpAy_-U4uCYuUD42dh2KBHFoTT45HDNZZYJ4xGPuondY8OzWlnn7_ZuxW3T5adr-8kHHxYrg8TKac--UfaKWJfhULlk7ZTIvToV2_6HQK6K4NU1fRHrt-A4bVhe1TrF6kp8FaNl7tV6SQ4Q_7jCd97VAYDW2x8agwEazqetgfvCbDatPHJzic_KZM9Czjj8JNoYE6Q'}
              />
              <button 
                onClick={handleLogout} 
                className="hover:bg-error-container hover:text-error text-outline p-1.5 rounded-full transition-colors cursor-pointer" 
                title="Cerrar Sesión"
              >
                <span className="material-symbols-outlined text-[20px]">logout</span>
              </button>
            </div>
          </div>
        </header>

        {/* CONTENIDO DEL HISTORIAL */}
        <main className="relative pt-16 flex-1 w-full px-gutter-lg pb-space-xl bg-background">
          <div className="flex flex-col w-full pt-4">
            
            {/* Cabecera del Módulo */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md mb-space-lg">
              <div className="flex flex-col gap-space-xs">
                <div className="flex items-center gap-space-xs text-on-surface-variant font-label-sm text-label-sm">
                  <span className="text-secondary font-semibold">SGI CASALIMPIA S.A.</span>
                  <span>/</span>
                  <span>Auditoría y Control Interno</span>
                  <span>/</span>
                  <span className="font-code-mono text-primary font-semibold">RF-07 • RF-08</span>
                </div>
                <h1 className="font-headline-lg text-headline-lg text-primary font-bold tracking-tight">
                  Historial de Movimientos y Auditoría de Activos
                </h1>
                <p className="font-body-sm text-body-sm text-on-surface-variant max-w-3xl">
                  Registro cronológico unificado de todas las salidas, reintegros, altas y mantenimientos de hardware tecnológico. Conforme a las normas ISO/IEC 20000 y 27001 para CASALIMPIA S.A.
                </p>
              </div>

              <div className="flex items-center gap-space-sm shrink-0">
                <button 
                  onClick={() => navigate('/entrega-hardware')}
                  className="px-space-md py-2 bg-primary text-on-primary rounded-lg font-label-sm text-label-sm font-bold flex items-center gap-1.5 hover:bg-primary-container transition-all shadow-sm cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">post_add</span>
                  Nueva Entrega
                </button>
                <button 
                  onClick={() => navigate('/devoluciones')}
                  className="px-space-md py-2 bg-secondary text-on-secondary rounded-lg font-label-sm text-label-sm font-bold flex items-center gap-1.5 hover:opacity-95 transition-all shadow-sm cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">keyboard_return</span>
                  Nueva Devolución
                </button>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md mb-space-lg">
              <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm border border-surface-container-high/40 flex items-center gap-space-md">
                <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[26px]">receipt_long</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-label-sm text-xs text-outline uppercase font-semibold">Total Movimientos</span>
                  <span className="font-headline-lg text-headline-lg font-black text-primary">{totalMovimientos}</span>
                  <span className="text-[11px] text-outline">En Base de Datos</span>
                </div>
              </div>

              <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm border border-surface-container-high/40 flex items-center gap-space-md">
                <div className="w-12 h-12 rounded-xl bg-secondary/15 text-secondary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[26px]">post_add</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-label-sm text-xs text-outline uppercase font-semibold">Entregas Legalizadas</span>
                  <span className="font-headline-lg text-headline-lg font-black text-secondary">{totalEntregas}</span>
                  <span className="text-[11px] text-outline">Actas TI-FO-04</span>
                </div>
              </div>

              <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm border border-surface-container-high/40 flex items-center gap-space-md">
                <div className="w-12 h-12 rounded-xl bg-primary-fixed text-on-primary-fixed flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[26px]">keyboard_return</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-label-sm text-xs text-outline uppercase font-semibold">Reintegros Procesados</span>
                  <span className="font-headline-lg text-headline-lg font-black text-primary">{totalDevoluciones}</span>
                  <span className="text-[11px] text-outline">Actas TI-FO-05</span>
                </div>
              </div>

              <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm border border-surface-container-high/40 flex items-center gap-space-md">
                <div className="w-12 h-12 rounded-xl bg-surface-container-highest text-on-surface flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[26px]">devices</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-label-sm text-xs text-outline uppercase font-semibold">Activos en Catálogo</span>
                  <span className="font-headline-lg text-headline-lg font-black text-on-surface">{totalEquiposActivos}</span>
                  <span className="text-[11px] text-outline">Inventario General</span>
                </div>
              </div>
            </div>

            {/* Barra de Filtros de Historial */}
            <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm border border-surface-container-high/30 mb-space-lg flex flex-col md:flex-row items-stretch md:items-center justify-between gap-space-md">
              <div className="flex items-center gap-space-sm flex-wrap">
                <span className="font-label-sm text-label-sm text-outline font-bold uppercase tracking-wider mr-1">Filtrar:</span>
                
                <button 
                  onClick={() => setFilterTipo('all')}
                  className={`px-3 py-1.5 rounded-lg font-label-sm text-xs font-bold transition-all cursor-pointer ${filterTipo === 'all' ? 'bg-primary text-on-primary shadow-xs' : 'bg-surface-container-low text-on-surface hover:bg-surface-container'}`}
                >
                  Todos ({allMovements.length})
                </button>

                <button 
                  onClick={() => setFilterTipo('ENTREGA')}
                  className={`px-3 py-1.5 rounded-lg font-label-sm text-xs font-bold transition-all cursor-pointer ${filterTipo === 'ENTREGA' ? 'bg-primary text-on-primary shadow-xs' : 'bg-surface-container-low text-on-surface hover:bg-surface-container'}`}
                >
                  Entregas TI-FO-04 ({totalEntregas})
                </button>

                <button 
                  onClick={() => setFilterTipo('DEVOLUCION')}
                  className={`px-3 py-1.5 rounded-lg font-label-sm text-xs font-bold transition-all cursor-pointer ${filterTipo === 'DEVOLUCION' ? 'bg-secondary text-on-secondary shadow-xs' : 'bg-surface-container-low text-on-surface hover:bg-surface-container'}`}
                >
                  Devoluciones TI-FO-05 ({totalDevoluciones})
                </button>

                <button 
                  onClick={() => setFilterTipo('ALTA_SISTEMA')}
                  className={`px-3 py-1.5 rounded-lg font-label-sm text-xs font-bold transition-all cursor-pointer ${filterTipo === 'ALTA_SISTEMA' ? 'bg-primary text-on-primary shadow-xs' : 'bg-surface-container-low text-on-surface hover:bg-surface-container'}`}
                >
                  Altas de Hardware
                </button>
              </div>

              <div className="flex items-center gap-space-sm">
                <span className="font-label-sm text-xs text-outline">Mostrando <strong>{filteredMovements.length}</strong> movimientos</span>
              </div>
            </div>

            {/* TABLA PRINCIPAL DEL HISTORIAL */}
            <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-surface-container-high/30 overflow-hidden">
              {loading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3 text-outline">
                  <span className="material-symbols-outlined text-[40px] animate-spin text-primary">sync</span>
                  <span className="font-body-md">Indexando movimientos desde Firestore...</span>
                </div>
              ) : filteredMovements.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3 text-outline">
                  <span className="material-symbols-outlined text-[48px]">history_toggle_off</span>
                  <span className="font-headline-sm text-body-lg font-bold">No se encontraron movimientos registrados</span>
                  <span className="font-body-sm text-body-sm">Prueba ajustando los términos de búsqueda o realiza una entrega en el sistema.</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-surface-container-low border-b border-surface-container-high text-outline font-label-sm text-xs uppercase tracking-wider">
                        <th className="py-3 px-4">Tipo Movimiento</th>
                        <th className="py-3 px-4">Acta / Documento</th>
                        <th className="py-3 px-4">Hardware (Placa / Serie)</th>
                        <th className="py-3 px-4">Colaborador Involucrado</th>
                        <th className="py-3 px-4">Responsable TI</th>
                        <th className="py-3 px-4">Fecha y Detalles</th>
                        <th className="py-3 px-4 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-container-high/30 text-body-sm">
                      {filteredMovements.map((item) => (
                        <tr key={item.id} className="hover:bg-surface-container-low/60 transition-colors">
                          
                          {/* Tipo */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-label-sm text-xs font-bold ${item.badgeColor}`}>
                              <span className="material-symbols-outlined text-[15px]">{item.icon}</span>
                              {item.tipo}
                            </span>
                          </td>

                          {/* Acta */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="font-code-mono font-bold text-primary">{item.acta_numero}</span>
                              <span className="font-code-mono text-[10px] text-outline truncate max-w-[120px]">{item.cert_hash}</span>
                            </div>
                          </td>

                          {/* Hardware */}
                          <td className="py-3.5 px-4">
                            <div className="flex flex-col">
                              <span className="font-bold text-on-surface">{item.equipo_nombre}</span>
                              <div className="flex items-center gap-2 font-code-mono text-xs text-outline">
                                <span className="font-bold text-primary">{item.placa}</span>
                                <span>•</span>
                                <span>SN: {item.serial}</span>
                              </div>
                            </div>
                          </td>

                          {/* Colaborador */}
                          <td className="py-3.5 px-4">
                            <div className="flex flex-col">
                              <span className="font-semibold text-on-surface">{item.colaborador}</span>
                              {item.colaborador_cc && (
                                <span className="text-xs text-outline font-code-mono">C.C. {item.colaborador_cc}</span>
                              )}
                            </div>
                          </td>

                          {/* Responsable TI */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="font-body-sm text-on-surface-variant font-medium">{item.responsable_ti}</span>
                          </td>

                          {/* Fecha y Detalles */}
                          <td className="py-3.5 px-4">
                            <div className="flex flex-col max-w-xs">
                              <span className="font-semibold text-xs text-primary">{item.fecha}</span>
                              <span className="text-xs text-outline truncate">{item.detalles}</span>
                            </div>
                          </td>

                          {/* Acciones */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              <button 
                                onClick={() => setSelectedMovimiento(item)}
                                className="px-2.5 py-1 bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-lg font-label-sm text-xs font-semibold transition-all cursor-pointer shadow-xs flex items-center gap-1"
                                title="Ver detalles y certificado"
                              >
                                <span className="material-symbols-outlined text-[14px]">visibility</span>
                                Ver Detalle
                              </button>
                              {(item.tipo === 'ENTREGA' || item.tipo === 'DEVOLUCION') && (
                                <button 
                                  onClick={() => generateAndPrintActa(item.rawDoc || item, item.tipo)}
                                  className="px-2.5 py-1 bg-primary hover:bg-primary-container text-on-primary rounded-lg font-label-sm text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center gap-1"
                                  title="Generar e imprimir Acta Oficial (PDF)"
                                >
                                  <span className="material-symbols-outlined text-[14px]">print</span>
                                  Acta PDF
                                </button>
                              )}
                            </div>
                          </td>

                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        </main>

        {/* FOOTER */}
        <footer className="w-full bg-surface-container-lowest shadow-[0_-1px_4px_rgba(0,0,0,0.02)] py-space-md px-gutter-lg border-t border-surface-container-high/30">
          <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-space-xs text-outline">
            <span className="font-body-sm text-body-sm">CASALIMPIA S.A. - Trazabilidad y Gestión TI ISO/IEC 27001</span>
            <div className="flex items-center gap-space-md font-code-mono text-code-mono text-outline-variant">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-secondary"></span>
                Auditoría Activa
              </span>
              <span>v2.5.0</span>
            </div>
          </div>
        </footer>
      </div>

      {/* ======================================================== */}
      {/* MODAL: VISOR DE ACTA / CERTIFICADO DE AUDITORÍA           */}
      {/* ======================================================== */}
      {selectedMovimiento && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-surface-container-high/50">
            
            {/* Header Modal */}
            <div className="px-6 py-4 bg-primary text-on-primary flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[24px]">verified</span>
                <div>
                  <h3 className="font-headline-sm text-headline-sm font-bold">
                    Certificado de Trazabilidad Oficial
                  </h3>
                  <span className="text-xs font-code-mono opacity-80">
                    Acta N°: {selectedMovimiento.acta_numero} • {selectedMovimiento.tipo}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setSelectedMovimiento(null)}
                className="hover:bg-primary-container p-1.5 rounded-full transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Cuerpo del Certificado */}
            <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-space-md">
              
              <div className="bg-surface-container-low p-4 rounded-xl flex items-center justify-between border border-surface-container-high/40">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-primary text-on-primary flex items-center justify-center font-bold text-headline-sm">
                    CL
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-primary">CASALIMPIA S.A. • NIT: 860.038.324-1</span>
                    <span className="text-xs text-outline">Sistema de Gestión de Activos Informáticos (SGI-TI)</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-code-mono font-bold text-secondary text-sm">{selectedMovimiento.cert_hash}</span>
                  <span className="block text-xs text-outline">{selectedMovimiento.fecha}</span>
                </div>
              </div>

              {/* Ficha de Detalles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
                
                <div className="bg-surface-container-low p-3 rounded-lg flex flex-col gap-1">
                  <span className="font-label-sm text-xs text-outline uppercase font-semibold">Activo de Hardware</span>
                  <span className="font-bold text-on-surface">{selectedMovimiento.equipo_nombre}</span>
                  <span className="font-code-mono text-xs text-primary font-bold">Placa: {selectedMovimiento.placa}</span>
                  <span className="font-code-mono text-xs text-outline">Serie: {selectedMovimiento.serial}</span>
                </div>

                <div className="bg-surface-container-low p-3 rounded-lg flex flex-col gap-1">
                  <span className="font-label-sm text-xs text-outline uppercase font-semibold">
                    {selectedMovimiento.tipo === 'DEVOLUCION' ? 'Colaborador que Reintegra' : 'Asignatario Receptor'}
                  </span>
                  <span className="font-bold text-on-surface">{selectedMovimiento.colaborador}</span>
                  {selectedMovimiento.colaborador_cc && (
                    <span className="font-code-mono text-xs text-secondary font-semibold">C.C. {selectedMovimiento.colaborador_cc}</span>
                  )}
                  <span className="text-xs text-outline">Responsable TI: {selectedMovimiento.responsable_ti}</span>
                </div>

              </div>

              {/* Firma en caso de estar registrada */}
              {(selectedMovimiento.rawDoc?.firma_receptor_img || selectedMovimiento.rawDoc?.firma_colaborador_img) && (
                <div className="bg-surface-container-low p-4 rounded-xl flex flex-col items-center justify-center gap-2 border border-surface-container-high/40">
                  <span className="font-label-sm text-xs text-outline uppercase font-bold">Firma Digital Capturada en Dispositivo</span>
                  <img 
                    src={selectedMovimiento.rawDoc?.firma_receptor_img || selectedMovimiento.rawDoc?.firma_colaborador_img} 
                    alt="Firma Digital" 
                    className="h-20 object-contain bg-surface-container-lowest p-2 rounded shadow-inner"
                  />
                  <span className="text-xs text-outline font-code-mono">Validada y almacenada en base de datos Firestore</span>
                </div>
              )}

              {/* Cláusula Legal */}
              <div className="p-3 bg-surface-container-low rounded-lg text-xs text-outline leading-relaxed border-l-4 border-primary">
                Este certificado da fe de la trazabilidad del activo según la Ley 527 de 1999 y los lineamientos de auditoría interna de CASALIMPIA S.A.
              </div>

            </div>

            {/* Footer Modal */}
            <div className="px-6 py-3 bg-surface-container-low border-t border-surface-container-high/40 flex items-center justify-between">
              {(selectedMovimiento.tipo === 'ENTREGA' || selectedMovimiento.tipo === 'DEVOLUCION') ? (
                <button 
                  onClick={() => generateAndPrintActa(selectedMovimiento.rawDoc || selectedMovimiento, selectedMovimiento.tipo)} 
                  className="px-space-md py-1.5 bg-primary text-on-primary hover:bg-primary-container rounded-lg font-label-sm text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
                >
                  <span className="material-symbols-outlined text-[16px]">print</span>
                  Descargar / Imprimir Acta Oficial ({selectedMovimiento.tipo === 'ENTREGA' ? 'TI-FO-04' : 'TI-FO-05'})
                </button>
              ) : (
                <div className="text-xs text-outline italic">Movimiento de registro interno de catálogo</div>
              )}
              
              <button 
                onClick={() => setSelectedMovimiento(null)}
                className="px-space-md py-1.5 bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-lg font-label-sm text-label-sm font-bold cursor-pointer transition-colors"
              >
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
