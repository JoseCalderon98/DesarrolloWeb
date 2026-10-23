import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../firebase';
import { getStoredUser } from '../utils/userHelpers';
import { generateAndPrintActa } from '../utils/actaPrintService';
import Sidebar from '../components/Sidebar';

export default function Historial() {
  const navigate = useNavigate();
  const currentUser = getStoredUser();

  const [actasEntrega, setActasEntrega] = useState([]);
  const [actasDevolucion, setActasDevolucion] = useState([]);
  const [movimientosGenerales, setMovimientosGenerales] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  // Filtros Avanzados
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTipo, setFilterTipo] = useState('all');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  // Paginación y Ordenación
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const [sortConfig, setSortConfig] = useState({ key: 'fecha', direction: 'desc' });

  // Modal de Detalle
  const [selectedMovimiento, setSelectedMovimiento] = useState(null);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  useEffect(() => {
    let qEntrega = query(collection(db, "actas_entrega"));
    let qDevolucion = query(collection(db, "actas_devolucion"));
    let qMov = query(collection(db, "movimientos"));
    let qEquipos = query(collection(db, "equipos"));

    // Obtenemos todos los registros (el filtrado para Empleados se hace en memoria para mayor robustez)

    const unsubE = onSnapshot(qEntrega, (s) => setActasEntrega(s.docs.map(d => ({ id: d.id, ...d.data() }))), (err) => {
      console.error(err);
      setErrorMsg(err.message);
      setLoading(false);
    });
    const unsubD = onSnapshot(qDevolucion, (s) => setActasDevolucion(s.docs.map(d => ({ id: d.id, ...d.data() }))), (err) => {
      console.error(err);
      setErrorMsg(err.message);
      setLoading(false);
    });
    const unsubM = onSnapshot(qMov, (s) => setMovimientosGenerales(s.docs.map(d => ({ id: d.id, ...d.data() }))), (err) => {
      console.error(err);
      setErrorMsg(err.message);
      setLoading(false);
    });
    const unsubEq = onSnapshot(qEquipos, (s) => {
      setEquipos(s.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      console.error(err);
      setErrorMsg(err.message);
      setLoading(false);
    });

    return () => { unsubE(); unsubD(); unsubM(); unsubEq(); };
  }, [currentUser?.email, currentUser?.rol]);

  // Helper para manejar fechas (Strings ISO, Firestore Timestamps o Date objects)
  const parseDate = (fechaRaw) => {
    if (!fechaRaw) return new Date().toISOString();
    if (typeof fechaRaw.toDate === 'function') return fechaRaw.toDate().toISOString();
    if (fechaRaw.seconds) return new Date(fechaRaw.seconds * 1000).toISOString();
    if (fechaRaw instanceof Date) return fechaRaw.toISOString();
    
    // Si es un string de fecha localizado como "10/10/2026", new Date() va a fallar ("Invalid Date").
    const asDate = new Date(fechaRaw);
    if (!isNaN(asDate.getTime())) return asDate.toISOString();
    
    // Intentar extraer "DD/MM/YYYY" de manera super básica
    if (typeof fechaRaw === 'string' && fechaRaw.includes('/')) {
      const parts = fechaRaw.split(',')[0].split('/');
      if (parts.length === 3) {
        // Asume formato DD/MM/YYYY
        return new Date(`${parts[2]}-${parts[1]}-${parts[0]}T12:00:00Z`).toISOString();
      }
    }
    
    return new Date().toISOString(); // Fallback final
  };

  const allMovements = useMemo(() => {
    const combined = [];
    
    equipos.forEach(eq => {
      combined.push({
        _id: `alta-${eq.id}`,
        tipo: 'ALTA',
        acta_numero: 'N/A',
        fecha: parseDate(eq.fecha_registro || eq.createdAt),
        placa: eq.placa || 'N/A',
        equipo_nombre: eq.equipo_nombre || 'N/A',
        serial: eq.serial || 'N/A',
        colaborador: eq.asignatario || eq.ubicacion || 'Bodega',
        responsable_ti: eq.registrado_por?.nombre || 'Administrador TI',
        detalles: 'Alta inicial de activo institucional (RF-02)',
        rawDoc: eq,
        cert_hash: 'N/A'
      });
    });

    actasEntrega.forEach(acta => {
      combined.push({
        _id: acta.id,
        tipo: 'ENTREGA',
        acta_numero: acta.acta_numero || 'S/N',
        fecha: parseDate(acta.createdAt || acta.fecha),
        placa: acta.placa || 'N/A',
        equipo_nombre: acta.equipo_nombre || 'N/A',
        serial: acta.serial || 'N/A',
        colaborador: acta.colaborador?.nombre || 'Desconocido',
        responsable_ti: acta.entregado_por?.nombre || acta.entregado_por_ti?.nombre || 'TI',
        detalles: `Entrega de equipo. Estado: ${acta.estado_equipo || 'N/A'}`,
        rawDoc: acta,
        cert_hash: (typeof acta.acta_numero === 'string' && acta.acta_numero.includes('-')) ? `ENT-CERT-${acta.acta_numero.split('-')[2] || 'X'}` : 'N/A'
      });
    });

    actasDevolucion.forEach(acta => {
      combined.push({
        _id: acta.id,
        tipo: 'DEVOLUCIÓN',
        acta_numero: acta.acta_numero || 'S/N',
        fecha: parseDate(acta.createdAt || acta.fecha),
        placa: acta.placa || 'N/A',
        equipo_nombre: acta.equipo_nombre || 'N/A',
        serial: acta.serial || 'N/A',
        colaborador: acta.entregado_por_colaborador?.nombre || 'Desconocido',
        responsable_ti: acta.recibido_por_ti?.nombre || 'TI',
        detalles: acta.observaciones || 'Reintegro de equipo',
        rawDoc: acta,
        cert_hash: (typeof acta.acta_numero === 'string' && acta.acta_numero.includes('-')) ? `DEV-CERT-${acta.acta_numero.split('-')[2] || 'X'}` : 'N/A'
      });
    });

    movimientosGenerales.forEach(mov => {
      // Evitar considerar eliminaciones (si existieran como movimiento) como entregas
      let tipoMov = mov.tipo || 'SISTEMA';
      if (mov.descripcion && String(mov.descripcion).toLowerCase().includes('elimin')) {
        tipoMov = 'ELIMINACIÓN';
      }

      // Omitir ENTREGA y DEVOLUCIÓN ya que se procesan desde las colecciones de actas directamente
      if (tipoMov === 'ENTREGA' || tipoMov === 'DEVOLUCIÓN' || tipoMov === 'DEVOLUCION') return;

      combined.push({
        _id: mov.id,
        tipo: tipoMov,
        acta_numero: 'N/A',
        fecha: parseDate(mov.fecha_registro || mov.createdAt || mov.fecha),
        placa: mov.placa || 'N/A',
        equipo_nombre: mov.equipo_nombre || 'N/A',
        serial: mov.serial || 'N/A',
        colaborador: mov.colaborador_nombre || mov.asignatario || 'N/A',
        responsable_ti: mov.responsable || 'Sistema',
        detalles: mov.descripcion || 'Actualización de registro',
        rawDoc: mov,
        cert_hash: 'N/A'
      });
    });

    return combined;
  }, [equipos, actasEntrega, actasDevolucion, movimientosGenerales]);

  // Filtrado y Ordenación
  const filteredAndSortedMovements = useMemo(() => {
    let result = allMovements.filter(item => {
      // Filtrado RBAC para Empleado
      if (currentUser?.rol === 'Empleado') {
        // Solo permitir ENTREGA, DEVOLUCIÓN y NOVEDAD
        if (!['ENTREGA', 'DEVOLUCIÓN', 'NOVEDAD'].includes(item.tipo)) {
          return false;
        }

        const matchEmail = item.rawDoc?.colaborador?.email === currentUser.email || 
                           item.rawDoc?.entregado_por_colaborador?.email === currentUser.email ||
                           item.rawDoc?.asignatario_email === currentUser.email;
        const matchName = String(item.colaborador || '').trim().toLowerCase() === String(currentUser.nombre || '').trim().toLowerCase();
        
        if (!matchEmail && !matchName) return false;
      }

      // Búsqueda Textual
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        if (![item.placa, item.serial, item.equipo_nombre, item.colaborador, item.acta_numero, item.cert_hash].some(val => String(val || '').toLowerCase().includes(q))) {
          return false;
        }
      }

      // Tipo de Movimiento
      if (filterTipo !== 'all' && item.tipo !== filterTipo) return false;

      // Rango de Fechas
      const itemDate = new Date(item.fecha).getTime();
      if (fechaDesde && itemDate < new Date(fechaDesde).getTime()) return false;
      if (fechaHasta && itemDate > new Date(fechaHasta).getTime() + 86400000) return false; // Incluir todo el día

      return true;
    });

    // Ordenación
    result.sort((a, b) => {
      let valA = a[sortConfig.key];
      let valB = b[sortConfig.key];
      
      if (sortConfig.key === 'fecha') {
        valA = new Date(valA).getTime() || 0;
        valB = new Date(valB).getTime() || 0;
      } else {
        valA = String(valA || '').toLowerCase();
        valB = String(valB || '').toLowerCase();
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [allMovements, searchQuery, filterTipo, fechaDesde, fechaHasta, sortConfig]);

  // Paginación
  const totalPages = Math.ceil(filteredAndSortedMovements.length / itemsPerPage);
  const currentMovements = filteredAndSortedMovements.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Métricas de auditoría calculadas
  const metricasAuditoria = useMemo(() => {
    const total = filteredAndSortedMovements.length;
    const altas = filteredAndSortedMovements.filter(m => m.tipo === 'ALTA').length;
    const entregas = filteredAndSortedMovements.filter(m => m.tipo === 'ENTREGA').length;
    const devoluciones = filteredAndSortedMovements.filter(m => m.tipo === 'DEVOLUCIÓN').length;
    return { total, altas, entregas, devoluciones };
  }, [filteredAndSortedMovements]);

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const handleExportCSV = () => {
    if (filteredAndSortedMovements.length === 0) return alert("No hay datos para exportar.");
    const headers = ['Tipo', 'Acta N°', 'Fecha', 'Placa TI', 'Equipo', 'Serial', 'Colaborador Custodio', 'Responsable TI', 'Detalles', 'Hash Legal'];
    const rows = filteredAndSortedMovements.map(m => [
      m.tipo, m.acta_numero, m.fecha, m.placa, m.equipo_nombre, m.serial, m.colaborador, m.responsable_ti, m.detalles, m.cert_hash
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Historial_Auditoria_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-space-sm text-primary">
          <span className="material-symbols-outlined animate-spin text-[32px]">sync</span>
          <span className="font-headline-sm font-bold text-lg">Sincronizando Historial...</span>
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
            <h1 className="font-headline-sm text-xl text-primary font-black tracking-tight">Historial de Auditoría</h1>
          </div>
          <div className="flex items-center gap-space-md shrink-0">
            <button onClick={handleExportCSV} className="h-9 px-space-md flex items-center gap-space-xs rounded-lg text-primary bg-primary/10 hover:bg-primary/20 transition-colors font-label-sm font-bold shadow-xs">
              <span className="material-symbols-outlined text-[18px]">download</span>
              <span>Exportar CSV</span>
            </button>
            <div className="h-6 w-px bg-surface-container-highest"></div>
            <div className="flex items-center gap-space-md pl-space-xs">
              <div className="flex flex-col text-right hidden sm:flex">
                <span className="font-label-md text-on-surface font-bold">{currentUser?.nombre || 'Funcionario SGI'}</span>
                <span className="font-label-sm text-secondary font-semibold">{currentUser?.cargo || currentUser?.rol || 'Auditor TI'}</span>
              </div>
              <img alt="Perfil" className="w-8 h-8 rounded-full object-cover ring-2 ring-primary/20 shadow-sm" src={currentUser?.avatar || 'https://i.pravatar.cc/150'} />
              <button onClick={handleLogout} className="hover:bg-error-container hover:text-error text-outline p-1.5 rounded-full transition-colors cursor-pointer" title="Cerrar Sesión">
                <span className="material-symbols-outlined text-[20px]">logout</span>
              </button>
            </div>
          </div>
        </header>

        {/* CONTENIDO PRINCIPAL */}
        <main className="flex-1 mt-16 p-space-xl overflow-y-auto">
          
          {/* TARJETAS DE MÉTRICAS DE AUDITORÍA */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-space-md mb-space-lg">
            <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-xs border border-surface-container-high/40 flex items-center justify-between">
              <div>
                <span className="font-label-sm text-outline uppercase font-bold text-[11px] block">Registros Filtrados</span>
                <span className="font-display-lg text-2xl font-bold text-on-surface">{metricasAuditoria.total}</span>
              </div>
              <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[22px]">analytics</span>
              </div>
            </div>

            <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-xs border border-surface-container-high/40 flex items-center justify-between">
              <div>
                <span className="font-label-sm text-outline uppercase font-bold text-[11px] block">Altas de Hardware</span>
                <span className="font-display-lg text-2xl font-bold text-success">{metricasAuditoria.altas}</span>
              </div>
              <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center text-success">
                <span className="material-symbols-outlined text-[22px]">add_circle</span>
              </div>
            </div>

            <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-xs border border-surface-container-high/40 flex items-center justify-between">
              <div>
                <span className="font-label-sm text-outline uppercase font-bold text-[11px] block">Entregas / Actas</span>
                <span className="font-display-lg text-2xl font-bold text-secondary">{metricasAuditoria.entregas}</span>
              </div>
              <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary">
                <span className="material-symbols-outlined text-[22px]">assignment_turned_in</span>
              </div>
            </div>

            <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-xs border border-surface-container-high/40 flex items-center justify-between">
              <div>
                <span className="font-label-sm text-outline uppercase font-bold text-[11px] block">Devoluciones</span>
                <span className="font-display-lg text-2xl font-bold text-error">{metricasAuditoria.devoluciones}</span>
              </div>
              <div className="w-10 h-10 rounded-lg bg-error/10 flex items-center justify-center text-error">
                <span className="material-symbols-outlined text-[22px]">keyboard_return</span>
              </div>
            </div>
          </div>

          {/* PANEL DE FILTROS AVANZADOS */}
          <div className="bg-surface-container-lowest p-space-lg rounded-2xl shadow-sm border border-surface-container-high/40 mb-space-lg">
            <div className="flex items-center gap-space-sm mb-space-md">
              <span className="material-symbols-outlined text-primary text-[24px]">tune</span>
              <h2 className="font-headline-sm text-lg font-bold text-on-surface">Filtros Avanzados</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-space-md">
              {/* Búsqueda Global */}
              <div className="flex flex-col gap-1 md:col-span-2">
                <label className="font-label-sm text-outline font-bold">Buscar Registro</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
                  <input 
                    className="w-full h-10 pl-9 pr-3 bg-surface-container-low text-on-surface rounded-lg font-body-sm focus:outline-none focus:ring-2 focus:ring-primary shadow-xs" 
                    placeholder="Placa, acta, custodio o serial..." 
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              {/* Tipo de Movimiento */}
              <div className="flex flex-col gap-1">
                <label className="font-label-sm text-outline font-bold">Tipo de Operación</label>
                <select 
                  className="w-full h-10 px-3 bg-surface-container-low text-on-surface rounded-lg font-body-sm focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer shadow-xs"
                  value={filterTipo}
                  onChange={(e) => { setFilterTipo(e.target.value); setCurrentPage(1); }}
                >
                  <option value="all">Todas las operaciones</option>
                  <option value="ENTREGA">Entregas (Asignación)</option>
                  <option value="DEVOLUCIÓN">Devoluciones (Reintegro)</option>
                  <option value="ALTA">Altas de Inventario</option>
                  <option value="BAJA">Bajas Definitivas</option>
                </select>
              </div>

              {/* Rango de Fechas */}
              <div className="flex flex-col gap-1">
                <label className="font-label-sm text-outline font-bold">Rango de Fechas</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="date" 
                    className="w-full h-10 px-2 bg-surface-container-low text-on-surface rounded-lg font-body-sm focus:outline-none focus:ring-2 focus:ring-primary shadow-xs"
                    value={fechaDesde}
                    onChange={(e) => { setFechaDesde(e.target.value); setCurrentPage(1); }}
                  />
                  <span className="text-outline">-</span>
                  <input 
                    type="date" 
                    className="w-full h-10 px-2 bg-surface-container-low text-on-surface rounded-lg font-body-sm focus:outline-none focus:ring-2 focus:ring-primary shadow-xs"
                    value={fechaHasta}
                    onChange={(e) => { setFechaHasta(e.target.value); setCurrentPage(1); }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* TABLA DE RESULTADOS */}
          <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-surface-container-high/40 overflow-hidden flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-surface-container-low border-b border-surface-container-high/40 text-label-sm font-bold text-outline">
                  <tr>
                    <th className="px-space-md py-space-sm cursor-pointer hover:bg-surface-container transition-colors" onClick={() => requestSort('fecha')}>
                      <div className="flex items-center gap-1">Fecha {sortConfig.key === 'fecha' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</div>
                    </th>
                    <th className="px-space-md py-space-sm cursor-pointer hover:bg-surface-container transition-colors" onClick={() => requestSort('tipo')}>
                      <div className="flex items-center gap-1">Tipo {sortConfig.key === 'tipo' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</div>
                    </th>
                    <th className="px-space-md py-space-sm">Equipo / Placa</th>
                    <th className="px-space-md py-space-sm cursor-pointer hover:bg-surface-container transition-colors" onClick={() => requestSort('colaborador')}>
                      <div className="flex items-center gap-1">Ubicación / Custodio {sortConfig.key === 'colaborador' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</div>
                    </th>
                    <th className="px-space-md py-space-sm hidden lg:table-cell">Responsable TI</th>
                    <th className="px-space-md py-space-sm text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-high/20">
                  {errorMsg ? (
                    <tr>
                      <td colSpan="6" className="px-space-md py-12 text-center bg-error-container text-on-error-container">
                        <span className="material-symbols-outlined text-[48px] mb-2 opacity-80 text-error">lock</span>
                        <p className="font-bold text-lg">Error de Permisos en Firestore</p>
                        <p className="font-body-sm max-w-md mx-auto mt-2">{errorMsg}</p>
                        <p className="text-xs mt-2 opacity-80">Por favor, inicia sesión con un usuario validado por Firebase Auth o actualiza las Reglas de Firestore.</p>
                      </td>
                    </tr>
                  ) : currentMovements.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-space-md py-12 text-center text-outline">
                        <span className="material-symbols-outlined text-[48px] mb-2 opacity-50">search_off</span>
                        <p className="font-body-md">No se encontraron registros para los filtros aplicados.</p>
                      </td>
                    </tr>
                  ) : (
                    currentMovements.map(mov => (
                      <tr key={mov._id} className="hover:bg-surface-container-low/50 transition-colors group">
                        <td className="px-space-md py-space-sm font-mono text-xs text-on-surface-variant">
                          {new Date(mov.fecha).toLocaleString('es-CO')}
                        </td>
                        <td className="px-space-md py-space-sm">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border
                            ${mov.tipo === 'ENTREGA' ? 'bg-secondary/10 text-secondary border-secondary/20' : 
                              mov.tipo === 'DEVOLUCIÓN' ? 'bg-error/10 text-error border-error/20' : 
                              mov.tipo === 'ALTA' ? 'bg-success/10 text-success border-success/20' : 
                              'bg-primary/10 text-primary border-primary/20'}`}>
                            <span className="w-1.5 h-1.5 rounded-full currentColor bg-current"></span>
                            {String(mov.tipo)}
                          </span>
                        </td>
                        <td className="px-space-md py-space-sm">
                          <div className="flex flex-col">
                            <span className="font-bold text-sm text-on-surface truncate max-w-[200px]">{String(mov.equipo_nombre)}</span>
                            <span className="text-xs text-outline font-mono">{String(mov.placa)}</span>
                          </div>
                        </td>
                        <td className="px-space-md py-space-sm text-sm text-on-surface-variant truncate max-w-[150px]">
                          {String(mov.colaborador)}
                        </td>
                        <td className="px-space-md py-space-sm hidden lg:table-cell text-sm text-outline">
                          {String(mov.responsable_ti)}
                        </td>
                        <td className="px-space-md py-space-sm text-right">
                          <button 
                            onClick={() => setSelectedMovimiento(mov)}
                            className="p-1.5 text-primary hover:bg-primary/10 rounded-md transition-colors cursor-pointer"
                            title="Ver Trazabilidad Completa"
                          >
                            <span className="material-symbols-outlined text-[20px]">visibility</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            {/* PAGINACIÓN */}
            {totalPages > 1 && (
              <div className="bg-surface-container-low border-t border-surface-container-high/40 p-space-sm flex items-center justify-between px-space-md">
                <span className="text-sm text-outline font-semibold">
                  Mostrando {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredAndSortedMovements.length)} de {filteredAndSortedMovements.length} registros
                </span>
                <div className="flex items-center gap-1">
                  <button 
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(c => c - 1)}
                    className="p-1 text-on-surface-variant hover:bg-surface-container hover:text-on-surface disabled:opacity-30 disabled:cursor-not-allowed rounded"
                  >
                    <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-8 h-8 flex items-center justify-center rounded text-sm font-bold transition-colors
                        ${currentPage === page ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container'}`}
                    >
                      {page}
                    </button>
                  ))}
                  <button 
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(c => c + 1)}
                    className="p-1 text-on-surface-variant hover:bg-surface-container hover:text-on-surface disabled:opacity-30 disabled:cursor-not-allowed rounded"
                  >
                    <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                  </button>
                </div>
              </div>
            )}
          </div>

        </main>
      </div>

      {/* MODAL DE DETALLE / LÍNEA DE TIEMPO RÁPIDA */}
      {selectedMovimiento && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/40 backdrop-blur-sm p-space-md animate-fade-in">
          <div className="bg-surface-container-lowest w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className={`p-space-md flex items-center justify-between text-white
              ${selectedMovimiento.tipo === 'ENTREGA' ? 'bg-secondary' : 
                selectedMovimiento.tipo === 'DEVOLUCIÓN' ? 'bg-error' : 'bg-primary'}`}>
              <div className="flex items-center gap-space-sm">
                <span className="material-symbols-outlined text-[24px]">receipt_long</span>
                <span className="font-headline-sm text-lg font-bold">Detalle del Registro</span>
              </div>
              <button onClick={() => setSelectedMovimiento(null)} className="p-1 hover:bg-white/20 rounded-full transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="p-space-xl flex flex-col gap-space-lg">
              
              <div className="grid grid-cols-2 gap-space-md bg-surface-container-low p-space-md rounded-xl border border-surface-container-high/40">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-outline uppercase tracking-wider">Acta / Documento</span>
                  <span className="font-mono font-bold text-primary text-lg">{selectedMovimiento.acta_numero}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-outline uppercase tracking-wider">Fecha y Hora Legal</span>
                  <span className="font-mono text-on-surface font-semibold">{new Date(selectedMovimiento.fecha).toLocaleString('es-CO')}</span>
                </div>
                <div className="flex flex-col col-span-2">
                  <span className="text-xs font-bold text-outline uppercase tracking-wider">Hash de Auditoría ISO</span>
                  <span className="font-mono text-xs text-secondary bg-secondary/10 px-2 py-1 rounded inline-block mt-1">{selectedMovimiento.cert_hash}</span>
                </div>
              </div>

              <div className="flex flex-col gap-2 relative pl-8 border-l-2 border-surface-container-highest">
                <div className="absolute w-4 h-4 rounded-full bg-primary -left-[9px] top-1 ring-4 ring-surface-container-lowest"></div>
                <h3 className="font-bold text-on-surface">Especificación del Hardware</h3>
                <p className="text-sm text-on-surface-variant">
                  <strong className="text-on-surface">{selectedMovimiento.equipo_nombre}</strong> <br/>
                  Placa: {selectedMovimiento.placa} | Serial: {selectedMovimiento.serial}
                </p>
              </div>

              <div className="flex flex-col gap-2 relative pl-8 border-l-2 border-surface-container-highest">
                <div className="absolute w-4 h-4 rounded-full bg-secondary -left-[9px] top-1 ring-4 ring-surface-container-lowest"></div>
                <h3 className="font-bold text-on-surface">Actores de Custodia / Ubicación</h3>
                <p className="text-sm text-on-surface-variant">
                  <strong>Custodio / Sede:</strong> {selectedMovimiento.colaborador} <br/>
                  <strong>Técnico TI:</strong> {selectedMovimiento.responsable_ti}
                </p>
              </div>

              <div className="flex flex-col gap-2 relative pl-8 border-l-2 border-transparent">
                <div className="absolute w-4 h-4 rounded-full bg-error -left-[9px] top-1 ring-4 ring-surface-container-lowest"></div>
                <h3 className="font-bold text-on-surface">Observaciones y Estado</h3>
                <p className="text-sm text-on-surface-variant bg-surface-container-low p-2 rounded italic">
                  "{selectedMovimiento.detalles}"
                </p>
              </div>

            </div>

            <div className="p-space-md border-t border-surface-container-high/40 bg-surface-container flex justify-end gap-space-sm">
              <button onClick={() => setSelectedMovimiento(null)} className="px-space-md py-2 font-bold text-on-surface-variant hover:bg-surface-container-high rounded-lg transition-colors">
                Cerrar
              </button>
              {(selectedMovimiento.tipo === 'ENTREGA' || selectedMovimiento.tipo === 'DEVOLUCIÓN') && selectedMovimiento.rawDoc.acta_numero && (
                <button 
                  onClick={() => generateAndPrintActa(selectedMovimiento.rawDoc, selectedMovimiento.tipo)}
                  className="px-space-md py-2 font-bold bg-primary text-on-primary rounded-lg shadow-sm hover:bg-primary-container transition-colors flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[18px]">print</span>
                  Reimprimir Acta
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
