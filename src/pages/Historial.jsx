import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../firebase';
import { getStoredUser } from '../utils/userHelpers';
import { formatCurrencyCOP, calculateDepreciation } from '../utils/assetHelpers';
import { generateAndPrintActa, generateAndPrintActaTraslado } from '../utils/actaPrintService';
import Sidebar from '../components/Sidebar';

export default function Historial() {
  const navigate = useNavigate();
  const currentUser = getStoredUser();

  // Pestaña activa: 'AUDITORIA' | 'DEPRECIACION' | 'DANADOS' | 'TRASLADOS'
  const [activeTab, setActiveTab] = useState('AUDITORIA');

  const [actasEntrega, setActasEntrega] = useState([]);
  const [actasDevolucion, setActasDevolucion] = useState([]);
  const [actasTraslado, setActasTraslado] = useState([]);
  const [movimientosGenerales, setMovimientosGenerales] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  // Filtros Avanzados (Pestaña Auditoría)
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTipo, setFilterTipo] = useState('all');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  // Filtros Pestaña Depreciación
  const [depSearchQuery, setDepSearchQuery] = useState('');
  const [depCategoryFilter, setDepCategoryFilter] = useState('all');

  // Filtros Pestaña Dañados
  const [danadosSearchQuery, setDanadosSearchQuery] = useState('');

  // Filtros Pestaña Traslados
  const [trasladosSearchQuery, setTrasladosSearchQuery] = useState('');
  const [filtroRegionalDestino, setFiltroRegionalDestino] = useState('all');

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
    const qEntrega = query(collection(db, "actas_entrega"));
    const qDevolucion = query(collection(db, "actas_devolucion"));
    const qTraslado = query(collection(db, "actas_traslado"));
    const qMov = query(collection(db, "movimientos"));
    const qEquipos = query(collection(db, "equipos"));

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

    const unsubT = onSnapshot(qTraslado, (s) => setActasTraslado(s.docs.map(d => ({ id: d.id, ...d.data() }))), (err) => {
      console.warn("Colección actas_traslado vacía o aún sin indexar:", err);
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

    return () => { unsubE(); unsubD(); unsubT(); unsubM(); unsubEq(); };
  }, [currentUser?.email, currentUser?.rol]);

  // Helper para manejar fechas
  const parseDate = (fechaRaw) => {
    if (!fechaRaw) return new Date().toISOString();
    if (typeof fechaRaw.toDate === 'function') return fechaRaw.toDate().toISOString();
    if (fechaRaw.seconds) return new Date(fechaRaw.seconds * 1000).toISOString();
    if (fechaRaw instanceof Date) return fechaRaw.toISOString();
    
    const asDate = new Date(fechaRaw);
    if (!isNaN(asDate.getTime())) return asDate.toISOString();
    
    if (typeof fechaRaw === 'string' && fechaRaw.includes('/')) {
      const parts = fechaRaw.split(',')[0].split('/');
      if (parts.length === 3) {
        return new Date(`${parts[2]}-${parts[1]}-${parts[0]}T12:00:00Z`).toISOString();
      }
    }
    
    return new Date().toISOString();
  };

  // Movimientos Consolidados de Auditoría
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
        detalles: `Alta de activo institucional. Valor: ${formatCurrencyCOP(eq.valor_declarado || 3500000)}`,
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
        detalles: `Reintegro: ${acta.motivo || 'Devolución'} • Físico: ${acta.condicion_fisica || 'N/A'}`,
        rawDoc: acta,
        cert_hash: (typeof acta.acta_numero === 'string' && acta.acta_numero.includes('-')) ? `DEV-CERT-${acta.acta_numero.split('-')[2] || 'X'}` : 'N/A'
      });
    });

    actasTraslado.forEach(acta => {
      combined.push({
        _id: acta.id,
        tipo: 'TRASLADO',
        acta_numero: acta.acta_numero || 'S/N',
        fecha: parseDate(acta.createdAt || acta.timestamp || acta.fecha),
        placa: acta.placa || 'N/A',
        equipo_nombre: acta.equipo_nombre || 'N/A',
        serial: acta.serial || 'N/A',
        colaborador: `${acta.regional_origen?.replace('Regional ', '') || 'Origen'} ➔ ${acta.regional_destino?.replace('Regional ', '') || 'Destino'} (${acta.recibido_por?.nombre || 'Receptor'})`,
        responsable_ti: acta.despachado_por?.nombre || 'TI Despacho',
        detalles: `Traslado: ${acta.motivo || 'Reubicación'}. Guía: ${acta.guia_transporte || 'N/A'}`,
        rawDoc: acta,
        cert_hash: acta.cert_hash || 'N/A'
      });
    });

    movimientosGenerales.forEach(mov => {
      let tipoMov = mov.tipo || 'SISTEMA';
      if (mov.descripcion && String(mov.descripcion).toLowerCase().includes('elimin')) {
        tipoMov = 'ELIMINACIÓN';
      }

      if (['ENTREGA', 'DEVOLUCIÓN', 'DEVOLUCION', 'TRASLADO'].includes(tipoMov)) return;

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
  }, [equipos, actasEntrega, actasDevolucion, actasTraslado, movimientosGenerales]);

  // Filtrado y Ordenación Auditoría
  const filteredAndSortedMovements = useMemo(() => {
    let result = allMovements.filter(item => {
      if (currentUser?.rol === 'Empleado') {
        if (!['ENTREGA', 'DEVOLUCIÓN', 'NOVEDAD'].includes(item.tipo)) return false;
        const matchEmail = item.rawDoc?.colaborador?.email === currentUser.email || 
                           item.rawDoc?.entregado_por_colaborador?.email === currentUser.email ||
                           item.rawDoc?.asignatario_email === currentUser.email;
        const matchName = String(item.colaborador || '').trim().toLowerCase() === String(currentUser.nombre || '').trim().toLowerCase();
        if (!matchEmail && !matchName) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        if (![item.placa, item.serial, item.equipo_nombre, item.colaborador, item.acta_numero, item.cert_hash].some(val => String(val || '').toLowerCase().includes(q))) {
          return false;
        }
      }

      if (filterTipo !== 'all' && item.tipo !== filterTipo) return false;

      const itemDate = new Date(item.fecha).getTime();
      if (fechaDesde && itemDate < new Date(fechaDesde).getTime()) return false;
      if (fechaHasta && itemDate > new Date(fechaHasta).getTime() + 86400000) return false;

      return true;
    });

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
  }, [allMovements, searchQuery, filterTipo, fechaDesde, fechaHasta, sortConfig, currentUser]);

  const totalPages = Math.ceil(filteredAndSortedMovements.length / itemsPerPage);
  const currentMovements = filteredAndSortedMovements.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // 1. MÉTRICAS DE AUDITORÍA GENERAL
  const metricasAuditoria = useMemo(() => {
    const total = filteredAndSortedMovements.length;
    const altas = filteredAndSortedMovements.filter(m => m.tipo === 'ALTA').length;
    const entregas = filteredAndSortedMovements.filter(m => m.tipo === 'ENTREGA').length;
    const devoluciones = filteredAndSortedMovements.filter(m => m.tipo === 'DEVOLUCIÓN').length;
    const traslados = filteredAndSortedMovements.filter(m => m.tipo === 'TRASLADO').length;
    return { total, altas, entregas, devoluciones, traslados };
  }, [filteredAndSortedMovements]);

  // 2. MOTOR Y MÉTRICAS DE DEPRECIACIÓN CONTABLE
  const equiposConDepreciacion = useMemo(() => {
    return equipos.map(eq => {
      const dep = calculateDepreciation(eq);
      return {
        ...eq,
        dep
      };
    });
  }, [equipos]);

  const metricasDepreciacion = useMemo(() => {
    let totalCapex = 0;
    let totalDepreciacion = 0;
    let totalValorResidual = 0;
    let equiposTotalmenteDepreciados = 0;

    equiposConDepreciacion.forEach(item => {
      totalCapex += item.dep.valorDeclarado;
      totalDepreciacion += item.dep.depreciacionAcumulada;
      totalValorResidual += item.dep.valorResidual;
      if (item.dep.estaDepreciadoTotalmente) {
        equiposTotalmenteDepreciados++;
      }
    });

    const porcentajeGlobal = totalCapex > 0 ? +((totalDepreciacion / totalCapex) * 100).toFixed(1) : 0;

    return {
      totalCapex,
      totalDepreciacion,
      totalValorResidual,
      equiposTotalmenteDepreciados,
      porcentajeGlobal
    };
  }, [equiposConDepreciacion]);

  const filteredEquiposDepreciacion = useMemo(() => {
    return equiposConDepreciacion.filter(eq => {
      if (depCategoryFilter !== 'all') {
        const cat = String(eq.categoria || '').toLowerCase();
        if (!cat.includes(depCategoryFilter.toLowerCase())) return false;
      }
      if (depSearchQuery.trim()) {
        const q = depSearchQuery.toLowerCase().trim();
        return [eq.placa, eq.serial, eq.equipo_nombre, eq.ubicacion].some(v => String(v || '').toLowerCase().includes(q));
      }
      return true;
    });
  }, [equiposConDepreciacion, depSearchQuery, depCategoryFilter]);

  // 3. MOTOR Y MÉTRICAS DE EQUIPOS DAÑADOS Y BAJAS
  const equiposDanados = useMemo(() => {
    return equiposConDepreciacion.filter(eq => {
      const estado = String(eq.estado || '').toUpperCase();
      const condicion = String(eq.condicion_fisica || '').toLowerCase();
      const ultimoMov = String(eq.ultimo_movimiento || '').toLowerCase();

      const esDanado = estado === 'BAJA' || 
                       estado === 'MANTENIMIENTO' || 
                       condicion.includes('dañado') || 
                       condicion.includes('reparación') ||
                       condicion.includes('reparacion') ||
                       ultimoMov.includes('dañado') ||
                       ultimoMov.includes('novedad');

      if (!esDanado) return false;

      if (danadosSearchQuery.trim()) {
        const q = danadosSearchQuery.toLowerCase().trim();
        return [eq.placa, eq.serial, eq.equipo_nombre, eq.ubicacion, eq.asignatario, eq.condicion_fisica, eq.ultimo_movimiento].some(v => String(v || '').toLowerCase().includes(q));
      }

      return true;
    });
  }, [equiposConDepreciacion, danadosSearchQuery]);

  const metricasDanados = useMemo(() => {
    const totalDanados = equiposDanados.length;
    let costoTotalPerdida = 0;
    let enTaller = 0;
    let bajasDefinitivas = 0;

    equiposDanados.forEach(e => {
      costoTotalPerdida += e.dep.valorDeclarado;
      if (e.estado === 'MANTENIMIENTO') enTaller++;
      if (e.estado === 'BAJA') bajasDefinitivas++;
    });

    const tasaFalla = equipos.length > 0 ? +((totalDanados / equipos.length) * 100).toFixed(1) : 0;

    return { totalDanados, costoTotalPerdida, enTaller, bajasDefinitivas, tasaFalla };
  }, [equiposDanados, equipos]);

  // 4. MÉTRICAS Y FILTRADO DE TRASLADOS
  const filteredTraslados = useMemo(() => {
    return actasTraslado.filter(t => {
      if (filtroRegionalDestino !== 'all' && t.regional_destino !== filtroRegionalDestino) return false;
      if (trasladosSearchQuery.trim()) {
        const q = trasladosSearchQuery.toLowerCase().trim();
        return [t.acta_numero, t.placa, t.serial, t.equipo_nombre, t.regional_origen, t.regional_destino, t.guia_transporte, t.recibido_por?.nombre].some(v => String(v || '').toLowerCase().includes(q));
      }
      return true;
    });
  }, [actasTraslado, filtroRegionalDestino, trasladosSearchQuery]);

  const metricasTraslados = useMemo(() => {
    const total = actasTraslado.length;
    const porDestino = {};
    const porOrigen = {};

    actasTraslado.forEach(t => {
      const dest = t.regional_destino || 'Desconocido';
      const orig = t.regional_origen || 'Desconocido';
      porDestino[dest] = (porDestino[dest] || 0) + 1;
      porOrigen[orig] = (porOrigen[orig] || 0) + 1;
    });

    const topDestino = Object.entries(porDestino).sort((a, b) => b[1] - a[1])[0] || ['N/A', 0];
    const topOrigen = Object.entries(porOrigen).sort((a, b) => b[1] - a[1])[0] || ['N/A', 0];

    return { total, topDestino, topOrigen };
  }, [actasTraslado]);

  // EXPORTACIONES CSV
  const handleExportAuditoriaCSV = () => {
    if (filteredAndSortedMovements.length === 0) return alert("No hay datos para exportar.");
    const headers = ['Tipo', 'Acta N°', 'Fecha', 'Placa TI', 'Equipo', 'Serial', 'Custodio / Destino', 'Responsable TI', 'Detalles', 'Hash Legal'];
    const rows = filteredAndSortedMovements.map(m => [
      m.tipo, m.acta_numero, m.fecha, m.placa, m.equipo_nombre, m.serial, m.colaborador, m.responsable_ti, m.detalles, m.cert_hash
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Auditoria_Movimientos_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportDepreciacionCSV = () => {
    if (filteredEquiposDepreciacion.length === 0) return alert("No hay equipos para exportar.");
    const headers = ['Placa', 'Equipo', 'Categoria', 'Ubicacion', 'Estado', 'Valor Declarado (COP)', 'Vida Util (Meses)', 'Meses de Uso', '% Depreciado', 'Depreciacion Acumulada (COP)', 'Valor Residual en Libros (COP)', 'Fecha de Registro'];
    const rows = filteredEquiposDepreciacion.map(e => [
      e.placa, e.equipo_nombre, e.categoria, e.ubicacion, e.estado, e.dep.valorDeclarado, e.dep.vidaUtilMeses, e.dep.mesesUso, `${e.dep.porcentajeDepreciado}%`, e.dep.depreciacionAcumulada, e.dep.valorResidual, e.fecha_registro_texto || e.fecha_registro || 'N/A'
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Reporte_Depreciacion_Activos_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportDanadosCSV = () => {
    if (equiposDanados.length === 0) return alert("No hay registros de equipos dañados para exportar.");
    const headers = ['Placa', 'Equipo', 'Serial', 'Ubicacion', 'Estado Actual', 'Condicion Fisica', 'Ultimo Movimiento', 'Valor Comercial (COP)', 'Custodio Asignado'];
    const rows = equiposDanados.map(e => [
      e.placa, e.equipo_nombre, e.serial, e.ubicacion, e.estado, e.condicion_fisica || 'Dañado', e.ultimo_movimiento || 'N/A', e.dep.valorDeclarado, e.asignatario || 'Bodega TI'
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Reporte_Equipos_Danados_Bajas_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportTrasladosCSV = () => {
    if (filteredTraslados.length === 0) return alert("No hay traslados para exportar.");
    const headers = ['N° Remision', 'Fecha', 'Placa', 'Equipo', 'Serial', 'Regional Origen', 'Regional Destino', 'Nueva Ubicacion', 'Empresa Transporte', 'Guia', 'Motivo', 'Despachado Por', 'Recibido Por', 'Hash'];
    const rows = filteredTraslados.map(t => [
      t.acta_numero, t.fecha, t.placa, t.equipo_nombre, t.serial, t.regional_origen, t.regional_destino, t.nueva_ubicacion, t.empresa_transporte, t.guia_transporte, t.motivo, t.despachado_por?.nombre, t.recibido_por?.nombre, t.cert_hash
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Reporte_Traslados_InterRegionales_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-space-sm text-primary">
          <span className="material-symbols-outlined animate-spin text-[32px]">sync</span>
          <span className="font-headline-sm font-bold text-lg">Sincronizando Reportes y Auditoría SGI...</span>
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
          <div className="flex items-center gap-space-md flex-1">
            <span className="material-symbols-outlined text-primary text-[28px]">verified_user</span>
            <div className="flex flex-col">
              <h1 className="font-headline-sm text-xl text-primary font-black tracking-tight">Reportes y Auditoría SGI</h1>
              <span className="text-[11px] text-outline uppercase font-bold tracking-wider">
                Módulo Legal ISO 20000 & 27001 • Balance Financiero y Logístico
              </span>
            </div>
          </div>

          <div className="flex items-center gap-space-md shrink-0">
            {activeTab === 'AUDITORIA' && (
              <button onClick={handleExportAuditoriaCSV} className="h-9 px-space-md flex items-center gap-space-xs rounded-lg text-primary bg-primary/10 hover:bg-primary/20 transition-colors font-label-sm font-bold shadow-xs cursor-pointer">
                <span className="material-symbols-outlined text-[18px]">download</span>
                <span>Exportar CSV</span>
              </button>
            )}
            {activeTab === 'DEPRECIACION' && (
              <button onClick={handleExportDepreciacionCSV} className="h-9 px-space-md flex items-center gap-space-xs rounded-lg text-primary bg-primary/10 hover:bg-primary/20 transition-colors font-label-sm font-bold shadow-xs cursor-pointer">
                <span className="material-symbols-outlined text-[18px]">download</span>
                <span>Exportar Balance CSV</span>
              </button>
            )}
            {activeTab === 'DANADOS' && (
              <button onClick={handleExportDanadosCSV} className="h-9 px-space-md flex items-center gap-space-xs rounded-lg text-error bg-error/10 hover:bg-error/20 transition-colors font-label-sm font-bold shadow-xs cursor-pointer">
                <span className="material-symbols-outlined text-[18px]">download</span>
                <span>Exportar Daños CSV</span>
              </button>
            )}
            {activeTab === 'TRASLADOS' && (
              <button onClick={handleExportTrasladosCSV} className="h-9 px-space-md flex items-center gap-space-xs rounded-lg text-secondary bg-secondary/10 hover:bg-secondary/20 transition-colors font-label-sm font-bold shadow-xs cursor-pointer">
                <span className="material-symbols-outlined text-[18px]">download</span>
                <span>Exportar Traslados CSV</span>
              </button>
            )}

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
          
          {/* BARRA DE NAVEGACIÓN POR PESTAÑAS */}
          <div className="flex items-center gap-2 mb-space-lg bg-surface-container-low p-1.5 rounded-xl border border-surface-container-high/40 overflow-x-auto">
            <button
              onClick={() => setActiveTab('AUDITORIA')}
              className={`flex items-center gap-2 px-space-lg py-2.5 rounded-lg font-label-md font-bold text-sm transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'AUDITORIA' 
                  ? 'bg-primary text-on-primary shadow-sm' 
                  : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">receipt_long</span>
              <span>Auditoría de Movimientos</span>
            </button>

            <button
              onClick={() => setActiveTab('DEPRECIACION')}
              className={`flex items-center gap-2 px-space-lg py-2.5 rounded-lg font-label-md font-bold text-sm transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'DEPRECIACION' 
                  ? 'bg-primary text-on-primary shadow-sm' 
                  : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">trending_down</span>
              <span>Métricas de Depreciación (NIIF)</span>
            </button>

            <button
              onClick={() => setActiveTab('DANADOS')}
              className={`flex items-center gap-2 px-space-lg py-2.5 rounded-lg font-label-md font-bold text-sm transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'DANADOS' 
                  ? 'bg-error text-on-error shadow-sm' 
                  : 'text-on-surface-variant hover:bg-error-container/30 hover:text-error'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">build_circle</span>
              <span>Equipos Dañados y Bajas ({metricasDanados.totalDanados})</span>
            </button>

            <button
              onClick={() => setActiveTab('TRASLADOS')}
              className={`flex items-center gap-2 px-space-lg py-2.5 rounded-lg font-label-md font-bold text-sm transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'TRASLADOS' 
                  ? 'bg-secondary text-on-secondary shadow-sm' 
                  : 'text-on-surface-variant hover:bg-secondary-container/30 hover:text-secondary'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">local_shipping</span>
              <span>Reporte de Traslados ({metricasTraslados.total})</span>
            </button>
          </div>

          {/* ========================================================================= */}
          {/* PESTAÑA 1: AUDITORÍA DE MOVIMIENTOS GENERALES                            */}
          {/* ========================================================================= */}
          {activeTab === 'AUDITORIA' && (
            <>
              {/* Tarjetas de Métricas de Auditoría */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-space-md mb-space-lg">
                <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-xs border border-surface-container-high/40 flex items-center justify-between">
                  <div>
                    <span className="font-label-sm text-outline uppercase font-bold text-[11px] block">Registros</span>
                    <span className="font-display-lg text-2xl font-bold text-on-surface">{metricasAuditoria.total}</span>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-[22px]">analytics</span>
                  </div>
                </div>

                <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-xs border border-surface-container-high/40 flex items-center justify-between">
                  <div>
                    <span className="font-label-sm text-outline uppercase font-bold text-[11px] block">Altas</span>
                    <span className="font-display-lg text-2xl font-bold text-success">{metricasAuditoria.altas}</span>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center text-success">
                    <span className="material-symbols-outlined text-[22px]">add_circle</span>
                  </div>
                </div>

                <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-xs border border-surface-container-high/40 flex items-center justify-between">
                  <div>
                    <span className="font-label-sm text-outline uppercase font-bold text-[11px] block">Entregas</span>
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

                <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-xs border border-surface-container-high/40 flex items-center justify-between col-span-2 md:col-span-1">
                  <div>
                    <span className="font-label-sm text-outline uppercase font-bold text-[11px] block">Traslados</span>
                    <span className="font-display-lg text-2xl font-bold text-primary">{metricasAuditoria.traslados}</span>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-[22px]">local_shipping</span>
                  </div>
                </div>
              </div>

              {/* Panel de Filtros Avanzados */}
              <div className="bg-surface-container-lowest p-space-lg rounded-2xl shadow-sm border border-surface-container-high/40 mb-space-lg">
                <div className="flex items-center gap-space-sm mb-space-md">
                  <span className="material-symbols-outlined text-primary text-[24px]">tune</span>
                  <h2 className="font-headline-sm text-lg font-bold text-on-surface">Filtros de Trazabilidad</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-space-md">
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
                      <option value="TRASLADO">Traslados Regionales</option>
                      <option value="ALTA">Altas de Inventario</option>
                      <option value="BAJA">Bajas Definitivas</option>
                    </select>
                  </div>

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

              {/* Tabla de Auditoría */}
              <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-surface-container-high/40 overflow-hidden mb-space-lg">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse font-body-sm">
                    <thead>
                      <tr className="bg-surface-container-low text-outline font-label-sm uppercase select-none border-b border-surface-container-high/40">
                        <th className="py-3 px-4 font-bold cursor-pointer hover:text-on-surface" onClick={() => setSortConfig({ key: 'tipo', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}>Tipo Operación</th>
                        <th className="py-3 px-4 font-bold">Acta / Documento</th>
                        <th className="py-3 px-4 font-bold cursor-pointer hover:text-on-surface" onClick={() => setSortConfig({ key: 'fecha', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}>Fecha y Hora Legal</th>
                        <th className="py-3 px-4 font-bold">Placa TI</th>
                        <th className="py-3 px-4 font-bold">Hardware y Serial</th>
                        <th className="py-3 px-4 font-bold">Custodio / Ruta</th>
                        <th className="py-3 px-4 font-bold">Responsable TI</th>
                        <th className="py-3 px-4 font-bold">Detalles</th>
                        <th className="py-3 px-4 text-right pr-4 font-bold">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-container-high/30">
                      {currentMovements.length === 0 ? (
                        <tr>
                          <td colSpan="9" className="py-12 text-center text-outline">
                            No se encontraron registros que coincidan con los filtros aplicados.
                          </td>
                        </tr>
                      ) : (
                        currentMovements.map((item) => (
                          <tr key={item._id} className="hover:bg-surface-container-low transition-colors">
                            <td className="py-3 px-4 font-bold">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                                item.tipo === 'ENTREGA' ? 'bg-secondary/15 text-secondary' :
                                item.tipo === 'DEVOLUCIÓN' ? 'bg-error/15 text-error' :
                                item.tipo === 'TRASLADO' ? 'bg-primary/15 text-primary' :
                                item.tipo === 'ALTA' ? 'bg-success/15 text-success' : 'bg-surface-container text-on-surface'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                  item.tipo === 'ENTREGA' ? 'bg-secondary' :
                                  item.tipo === 'DEVOLUCIÓN' ? 'bg-error' :
                                  item.tipo === 'TRASLADO' ? 'bg-primary' :
                                  item.tipo === 'ALTA' ? 'bg-success' : 'bg-outline'
                                }`}></span>
                                {item.tipo}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-code-mono text-xs font-bold text-primary">
                              {item.acta_numero}
                            </td>
                            <td className="py-3 px-4 text-xs text-outline">
                              {new Date(item.fecha).toLocaleString('es-CO')}
                            </td>
                            <td className="py-3 px-4 font-bold text-on-surface font-code-mono">
                              {item.placa}
                            </td>
                            <td className="py-3 px-4 text-xs">
                              <span className="font-semibold block text-on-surface">{item.equipo_nombre}</span>
                              <span className="text-outline font-code-mono">{item.serial}</span>
                            </td>
                            <td className="py-3 px-4 text-xs font-semibold text-on-surface">
                              {item.colaborador}
                            </td>
                            <td className="py-3 px-4 text-xs text-outline">
                              {item.responsable_ti}
                            </td>
                            <td className="py-3 px-4 text-xs text-on-surface-variant max-w-xs truncate" title={item.detalles}>
                              {item.detalles}
                            </td>
                            <td className="py-3 px-4 text-right pr-4">
                              <button
                                onClick={() => setSelectedMovimiento(item)}
                                className="p-1.5 rounded-lg text-primary hover:bg-primary/10 transition-colors inline-flex items-center gap-1 font-bold text-xs cursor-pointer"
                                title="Ver Ficha de Detalle"
                              >
                                <span className="material-symbols-outlined text-[16px]">visibility</span>
                                <span>Detalle</span>
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Paginación */}
                {totalPages > 1 && (
                  <div className="p-space-md bg-surface-container-low flex items-center justify-between border-t border-surface-container-high/40">
                    <span className="text-xs text-outline">
                      Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong> ({filteredAndSortedMovements.length} registros)
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 rounded bg-surface-container text-xs font-bold disabled:opacity-40"
                      >
                        Anterior
                      </button>
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 rounded bg-surface-container text-xs font-bold disabled:opacity-40"
                      >
                        Siguiente
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ========================================================================= */}
          {/* PESTAÑA 2: MÉTRICAS FINANCIERAS Y DEPRECIACIÓN CONTABLE                  */}
          {/* ========================================================================= */}
          {activeTab === 'DEPRECIACION' && (
            <div className="flex flex-col gap-space-lg">
              
              {/* Tarjetas KPI Financieras */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
                <div className="bg-surface-container-lowest p-space-lg rounded-2xl shadow-sm border border-surface-container-high/40 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-outline uppercase font-bold text-xs">Valor Total de Flota (CAPEX)</span>
                    <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <span className="material-symbols-outlined text-[20px]">account_balance</span>
                    </div>
                  </div>
                  <span className="font-display-lg text-2xl font-black text-primary">
                    {formatCurrencyCOP(metricasDepreciacion.totalCapex)}
                  </span>
                  <span className="text-xs text-outline mt-1">{equipos.length} equipos activos valorizados</span>
                </div>

                <div className="bg-surface-container-lowest p-space-lg rounded-2xl shadow-sm border border-surface-container-high/40 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-outline uppercase font-bold text-xs">Depreciación Acumulada</span>
                    <div className="w-9 h-9 rounded-lg bg-error/10 text-error flex items-center justify-center">
                      <span className="material-symbols-outlined text-[20px]">trending_down</span>
                    </div>
                  </div>
                  <span className="font-display-lg text-2xl font-black text-error">
                    {formatCurrencyCOP(metricasDepreciacion.totalDepreciacion)}
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                      <div className="bg-error h-full rounded-full" style={{ width: `${metricasDepreciacion.porcentajeGlobal}%` }}></div>
                    </div>
                    <span className="text-xs font-bold text-error">{metricasDepreciacion.porcentajeGlobal}%</span>
                  </div>
                </div>

                <div className="bg-surface-container-lowest p-space-lg rounded-2xl shadow-sm border border-surface-container-high/40 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-outline uppercase font-bold text-xs">Valor Residual en Libros</span>
                    <div className="w-9 h-9 rounded-lg bg-success/10 text-success flex items-center justify-center">
                      <span className="material-symbols-outlined text-[20px]">savings</span>
                    </div>
                  </div>
                  <span className="font-display-lg text-2xl font-black text-success">
                    {formatCurrencyCOP(metricasDepreciacion.totalValorResidual)}
                  </span>
                  <span className="text-xs text-outline mt-1">Patrimonio tecnológico neto productivo</span>
                </div>

                <div className="bg-surface-container-lowest p-space-lg rounded-2xl shadow-sm border border-surface-container-high/40 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-outline uppercase font-bold text-xs">Depreciados 100%</span>
                    <div className="w-9 h-9 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center">
                      <span className="material-symbols-outlined text-[20px]">done_all</span>
                    </div>
                  </div>
                  <span className="font-display-lg text-2xl font-black text-secondary">
                    {metricasDepreciacion.equiposTotalmenteDepreciados} <span className="text-sm font-normal text-outline">equipos</span>
                  </span>
                  <span className="text-xs text-outline mt-1">Vida útil cumplida (Candidatos a renovación)</span>
                </div>
              </div>

              {/* Filtros de la tabla de Depreciación */}
              <div className="bg-surface-container-lowest p-space-md rounded-2xl shadow-sm border border-surface-container-high/40 flex flex-col md:flex-row items-center justify-between gap-space-md">
                <div className="flex items-center gap-2 w-full md:w-auto flex-1">
                  <div className="relative w-full max-w-md">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
                    <input
                      type="text"
                      className="w-full h-10 pl-9 pr-3 bg-surface-container-low text-on-surface rounded-lg font-body-sm focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
                      placeholder="Filtrar por placa, modelo o regional..."
                      value={depSearchQuery}
                      onChange={(e) => setDepSearchQuery(e.target.value)}
                    />
                  </div>
                  <select
                    className="h-10 px-3 bg-surface-container-low text-on-surface rounded-lg font-body-sm focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer shadow-xs"
                    value={depCategoryFilter}
                    onChange={(e) => setDepCategoryFilter(e.target.value)}
                  >
                    <option value="all">Todas las Categorías</option>
                    <option value="laptop">Portátiles / Laptops</option>
                    <option value="escritorio">Estaciones de Escritorio</option>
                    <option value="servidor">Servidores y Racks</option>
                    <option value="monitor">Monitores</option>
                  </select>
                </div>
                <div className="text-xs text-outline font-semibold">
                  Norma NIIF: Depreciación en línea recta a 36 meses (3 años)
                </div>
              </div>

              {/* Tabla de Depreciación Contable */}
              <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-surface-container-high/40 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-body-sm">
                    <thead>
                      <tr className="bg-surface-container-low text-outline font-label-sm uppercase select-none border-b border-surface-container-high/40">
                        <th className="py-3 px-4 font-bold">Placa TI</th>
                        <th className="py-3 px-4 font-bold">Activo Tecnológico</th>
                        <th className="py-3 px-4 font-bold">Ubicación</th>
                        <th className="py-3 px-4 font-bold">Antigüedad (Meses)</th>
                        <th className="py-3 px-4 font-bold">Valor Adquisición (COP)</th>
                        <th className="py-3 px-4 font-bold w-48">% Depreciado</th>
                        <th className="py-3 px-4 font-bold text-error">Depreciación Acumulada</th>
                        <th className="py-3 px-4 font-bold text-success text-right pr-4">Valor Residual en Libros</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-container-high/30">
                      {filteredEquiposDepreciacion.length === 0 ? (
                        <tr>
                          <td colSpan="8" className="py-12 text-center text-outline">
                            No hay activos que coincidan con la búsqueda.
                          </td>
                        </tr>
                      ) : (
                        filteredEquiposDepreciacion.map((item) => (
                          <tr key={item.id} className="hover:bg-surface-container-low transition-colors">
                            <td className="py-3 px-4 font-bold font-code-mono text-primary">
                              {item.placa}
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-semibold block text-on-surface">{item.equipo_nombre}</span>
                              <span className="text-xs text-outline">{item.categoria}</span>
                            </td>
                            <td className="py-3 px-4 text-xs font-semibold text-on-surface">
                              {item.ubicacion || 'Regional Medellin'}
                            </td>
                            <td className="py-3 px-4 text-xs font-code-mono">
                              <strong>{item.dep.mesesUso}</strong> / {item.dep.vidaUtilMeses}m
                            </td>
                            <td className="py-3 px-4 font-bold text-on-surface">
                              {formatCurrencyCOP(item.dep.valorDeclarado)}
                              {item.dep.isEstimated && (
                                <span className="block text-[10px] text-outline italic">Est. de referencia</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full transition-all ${
                                      item.dep.porcentajeDepreciado >= 100 ? 'bg-error' : item.dep.porcentajeDepreciado > 60 ? 'bg-amber-500' : 'bg-success'
                                    }`} 
                                    style={{ width: `${item.dep.porcentajeDepreciado}%` }}
                                  ></div>
                                </div>
                                <span className="font-code-mono text-xs font-bold min-w-10 text-right">
                                  {item.dep.porcentajeDepreciado}%
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-4 font-bold text-error font-code-mono">
                              -{formatCurrencyCOP(item.dep.depreciacionAcumulada)}
                            </td>
                            <td className="py-3 px-4 font-bold text-success font-code-mono text-right pr-4">
                              {formatCurrencyCOP(item.dep.valorResidual)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* PESTAÑA 3: EQUIPOS DAÑADOS, EN TALLER Y BAJAS                            */}
          {/* ========================================================================= */}
          {activeTab === 'DANADOS' && (
            <div className="flex flex-col gap-space-lg">
              
              {/* Tarjetas KPI Dañados */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
                <div className="bg-surface-container-lowest p-space-lg rounded-2xl shadow-sm border border-surface-container-high/40 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-outline uppercase font-bold text-xs">Equipos Averiados / Dañados</span>
                    <div className="w-9 h-9 rounded-lg bg-error/10 text-error flex items-center justify-center">
                      <span className="material-symbols-outlined text-[20px]">report_problem</span>
                    </div>
                  </div>
                  <span className="font-display-lg text-2xl font-black text-error">
                    {metricasDanados.totalDanados}
                  </span>
                  <span className="text-xs text-outline mt-1">Tasa de avería de la flota: {metricasDanados.tasaFalla}%</span>
                </div>

                <div className="bg-surface-container-lowest p-space-lg rounded-2xl shadow-sm border border-surface-container-high/40 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-outline uppercase font-bold text-xs">Costo Económico Comprometido</span>
                    <div className="w-9 h-9 rounded-lg bg-error/10 text-error flex items-center justify-center">
                      <span className="material-symbols-outlined text-[20px]">price_change</span>
                    </div>
                  </div>
                  <span className="font-display-lg text-2xl font-black text-error">
                    {formatCurrencyCOP(metricasDanados.costoTotalPerdida)}
                  </span>
                  <span className="text-xs text-outline mt-1">Valor declarado de equipos inoperativos</span>
                </div>

                <div className="bg-surface-container-lowest p-space-lg rounded-2xl shadow-sm border border-surface-container-high/40 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-outline uppercase font-bold text-xs">En Laboratorio / Taller TI</span>
                    <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[20px]">build</span>
                    </div>
                  </div>
                  <span className="font-display-lg text-2xl font-black text-amber-600">
                    {metricasDanados.enTaller} <span className="text-sm font-normal text-outline">activos</span>
                  </span>
                  <span className="text-xs text-outline mt-1">En proceso de diagnóstico o garantía</span>
                </div>

                <div className="bg-surface-container-lowest p-space-lg rounded-2xl shadow-sm border border-surface-container-high/40 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-outline uppercase font-bold text-xs">Bajas Definitivas</span>
                    <div className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-outline">
                      <span className="material-symbols-outlined text-[20px]">delete_forever</span>
                    </div>
                  </div>
                  <span className="font-display-lg text-2xl font-black text-on-surface">
                    {metricasDanados.bajasDefinitivas} <span className="text-sm font-normal text-outline">equipos</span>
                  </span>
                  <span className="text-xs text-outline mt-1">Retirados del ciclo productivo</span>
                </div>
              </div>

              {/* Filtro de Dañados */}
              <div className="bg-surface-container-lowest p-space-md rounded-2xl shadow-sm border border-surface-container-high/40 flex items-center justify-between gap-space-md">
                <div className="relative w-full max-w-md">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
                  <input
                    type="text"
                    className="w-full h-10 pl-9 pr-3 bg-surface-container-low text-on-surface rounded-lg font-body-sm focus:outline-none focus:ring-2 focus:ring-primary shadow-xs"
                    placeholder="Buscar equipo dañado por placa, serial o custodio..."
                    value={danadosSearchQuery}
                    onChange={(e) => setDanadosSearchQuery(e.target.value)}
                  />
                </div>
                <span className="text-xs text-outline font-semibold">
                  Mostrando {equiposDanados.length} equipos con reporte de daño o baja
                </span>
              </div>

              {/* Tabla de Equipos Dañados */}
              <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-surface-container-high/40 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-body-sm">
                    <thead>
                      <tr className="bg-surface-container-low text-outline font-label-sm uppercase select-none border-b border-surface-container-high/40">
                        <th className="py-3 px-4 font-bold">Placa TI</th>
                        <th className="py-3 px-4 font-bold">Hardware</th>
                        <th className="py-3 px-4 font-bold">Serial</th>
                        <th className="py-3 px-4 font-bold">Estado Actual</th>
                        <th className="py-3 px-4 font-bold">Condición Reportada</th>
                        <th className="py-3 px-4 font-bold">Sede / Ubicación</th>
                        <th className="py-3 px-4 font-bold">Último Movimiento / Causa</th>
                        <th className="py-3 px-4 font-bold text-right pr-4">Valor Comercial</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-container-high/30">
                      {equiposDanados.length === 0 ? (
                        <tr>
                          <td colSpan="8" className="py-12 text-center text-outline">
                            ¡Excelente! No hay equipos con reporte de daño o baja en el sistema.
                          </td>
                        </tr>
                      ) : (
                        equiposDanados.map((item) => (
                          <tr key={item.id} className="hover:bg-surface-container-low transition-colors">
                            <td className="py-3 px-4 font-bold font-code-mono text-error">
                              {item.placa}
                            </td>
                            <td className="py-3 px-4 font-semibold text-on-surface">
                              {item.equipo_nombre}
                            </td>
                            <td className="py-3 px-4 text-xs font-code-mono text-outline">
                              {item.serial}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                item.estado === 'MANTENIMIENTO' ? 'bg-amber-500/15 text-amber-700' : 'bg-error/15 text-error'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${item.estado === 'MANTENIMIENTO' ? 'bg-amber-500' : 'bg-error'}`}></span>
                                {item.estado}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-xs font-bold text-error">
                              {item.condicion_fisica || 'Reportado Dañado'}
                            </td>
                            <td className="py-3 px-4 text-xs font-semibold text-on-surface">
                              {item.ubicacion}
                            </td>
                            <td className="py-3 px-4 text-xs text-on-surface-variant max-w-xs truncate" title={item.ultimo_movimiento}>
                              {item.ultimo_movimiento}
                            </td>
                            <td className="py-3 px-4 font-bold font-code-mono text-right pr-4 text-on-surface">
                              {formatCurrencyCOP(item.dep.valorDeclarado)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* PESTAÑA 4: REPORTE DE TRASLADOS INTER-REGIONALES                         */}
          {/* ========================================================================= */}
          {activeTab === 'TRASLADOS' && (
            <div className="flex flex-col gap-space-lg">
              
              {/* Tarjetas KPI Traslados */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
                <div className="bg-surface-container-lowest p-space-lg rounded-2xl shadow-sm border border-surface-container-high/40 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-outline uppercase font-bold text-xs">Total Remisiones de Traslado</span>
                    <div className="w-9 h-9 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center">
                      <span className="material-symbols-outlined text-[20px]">local_shipping</span>
                    </div>
                  </div>
                  <span className="font-display-lg text-2xl font-black text-secondary">
                    {metricasTraslados.total}
                  </span>
                  <span className="text-xs text-outline mt-1">Movimientos inter-sedes registrados</span>
                </div>

                <div className="bg-surface-container-lowest p-space-lg rounded-2xl shadow-sm border border-surface-container-high/40 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-outline uppercase font-bold text-xs">Mayor Sede Despachadora</span>
                    <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <span className="material-symbols-outlined text-[20px]">flight_takeoff</span>
                    </div>
                  </div>
                  <span className="font-display-lg text-lg font-black text-primary truncate">
                    {metricasTraslados.topOrigen[0]?.replace('Regional ', '')}
                  </span>
                  <span className="text-xs text-outline mt-1">{metricasTraslados.topOrigen[1]} despachos realizados</span>
                </div>

                <div className="bg-surface-container-lowest p-space-lg rounded-2xl shadow-sm border border-surface-container-high/40 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-outline uppercase font-bold text-xs">Mayor Sede Receptora</span>
                    <div className="w-9 h-9 rounded-lg bg-success/10 text-success flex items-center justify-center">
                      <span className="material-symbols-outlined text-[20px]">flight_land</span>
                    </div>
                  </div>
                  <span className="font-display-lg text-lg font-black text-success truncate">
                    {metricasTraslados.topDestino[0]?.replace('Regional ', '')}
                  </span>
                  <span className="text-xs text-outline mt-1">{metricasTraslados.topDestino[1]} transferencias recibidas</span>
                </div>

                <div className="bg-surface-container-lowest p-space-lg rounded-2xl shadow-sm border border-surface-container-high/40 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-outline uppercase font-bold text-xs">Gestión Logística</span>
                    <div className="w-9 h-9 rounded-lg bg-primary-container flex items-center justify-center text-on-primary-container">
                      <span className="material-symbols-outlined text-[20px]">add_circle</span>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate('/traslados')}
                    className="w-full h-9 bg-primary text-on-primary font-bold rounded-lg text-xs flex items-center justify-center gap-1 hover:bg-primary-container transition-colors shadow-sm cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">local_shipping</span>
                    <span>Realizar Nuevo Traslado</span>
                  </button>
                  <span className="text-[10px] text-outline text-center mt-1">Formato Oficial TI-FO-06</span>
                </div>
              </div>

              {/* Filtros de Traslados */}
              <div className="bg-surface-container-lowest p-space-md rounded-2xl shadow-sm border border-surface-container-high/40 flex flex-col sm:flex-row items-center justify-between gap-space-md">
                <div className="flex items-center gap-2 w-full sm:w-auto flex-1">
                  <div className="relative w-full max-w-md">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
                    <input
                      type="text"
                      className="w-full h-10 pl-9 pr-3 bg-surface-container-low text-on-surface rounded-lg font-body-sm focus:outline-none focus:ring-2 focus:ring-primary shadow-xs"
                      placeholder="Buscar por remisión, placa, transportadora o guía..."
                      value={trasladosSearchQuery}
                      onChange={(e) => setTrasladosSearchQuery(e.target.value)}
                    />
                  </div>
                  <select
                    className="h-10 px-3 bg-surface-container-low text-on-surface rounded-lg font-body-sm focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer shadow-xs"
                    value={filtroRegionalDestino}
                    onChange={(e) => setFiltroRegionalDestino(e.target.value)}
                  >
                    <option value="all">Todas las Sedes Destino</option>
                    <option value="Regional Medellin">Regional Medellín</option>
                    <option value="Regional Bogota">Regional Bogotá</option>
                    <option value="Regional Barranquilla">Regional Barranquilla</option>
                    <option value="Regional Pereira">Regional Pereira</option>
                  </select>
                </div>
                <span className="text-xs text-outline font-semibold">
                  Mostrando {filteredTraslados.length} remisiones de traslado
                </span>
              </div>

              {/* Tabla de Traslados */}
              <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-surface-container-high/40 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-body-sm">
                    <thead>
                      <tr className="bg-surface-container-low text-outline font-label-sm uppercase select-none border-b border-surface-container-high/40">
                        <th className="py-3 px-4 font-bold">N° Remisión</th>
                        <th className="py-3 px-4 font-bold">Fecha</th>
                        <th className="py-3 px-4 font-bold">Placa TI</th>
                        <th className="py-3 px-4 font-bold">Hardware Trasladado</th>
                        <th className="py-3 px-4 font-bold">Ruta (Origen ➔ Destino)</th>
                        <th className="py-3 px-4 font-bold">Transporte y N° Guía</th>
                        <th className="py-3 px-4 font-bold">Receptor Responsable</th>
                        <th className="py-3 px-4 text-right pr-4 font-bold">Documento Oficial</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-container-high/30">
                      {filteredTraslados.length === 0 ? (
                        <tr>
                          <td colSpan="8" className="py-12 text-center text-outline">
                            No hay traslados registrados con los filtros actuales.
                          </td>
                        </tr>
                      ) : (
                        filteredTraslados.map((item) => (
                          <tr key={item.id} className="hover:bg-surface-container-low transition-colors">
                            <td className="py-3 px-4 font-bold font-code-mono text-primary">
                              {item.acta_numero}
                            </td>
                            <td className="py-3 px-4 text-xs text-outline">
                              {item.fecha || 'Reciente'}
                            </td>
                            <td className="py-3 px-4 font-bold text-on-surface font-code-mono">
                              {item.placa}
                            </td>
                            <td className="py-3 px-4 text-xs">
                              <span className="font-semibold block text-on-surface">{item.equipo_nombre}</span>
                              <span className="text-outline font-code-mono">SN: {item.serial}</span>
                            </td>
                            <td className="py-3 px-4 text-xs">
                              <span className="inline-flex items-center gap-1 font-semibold">
                                <span className="text-primary font-bold">{item.regional_origen?.replace('Regional ', '')}</span>
                                <span className="material-symbols-outlined text-[14px] text-outline">arrow_forward</span>
                                <span className="text-success font-bold">{item.regional_destino?.replace('Regional ', '')}</span>
                              </span>
                            </td>
                            <td className="py-3 px-4 text-xs">
                              <span className="font-semibold block text-on-surface">{item.empresa_transporte}</span>
                              <span className="font-code-mono text-outline font-bold">{item.guia_transporte}</span>
                            </td>
                            <td className="py-3 px-4 text-xs text-on-surface">
                              <strong>{item.recibido_por?.nombre}</strong>
                              <span className="block text-outline text-[11px]">{item.recibido_por?.cargo}</span>
                            </td>
                            <td className="py-3 px-4 text-right pr-4">
                              <button
                                onClick={() => generateAndPrintActaTraslado(item)}
                                className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors inline-flex items-center gap-1 font-bold text-xs cursor-pointer"
                                title="Reimprimir Remisión Oficial de Traslado"
                              >
                                <span className="material-symbols-outlined text-[16px]">print</span>
                                <span>Remisión PDF</span>
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* MODAL DE DETALLE DEL REGISTRO DE AUDITORÍA */}
      {selectedMovimiento && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-space-md">
          <div className="bg-surface-container-lowest w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className={`p-space-md flex items-center justify-between text-white
              ${selectedMovimiento.tipo === 'ENTREGA' ? 'bg-secondary' : 
                selectedMovimiento.tipo === 'DEVOLUCIÓN' ? 'bg-error' : 
                selectedMovimiento.tipo === 'TRASLADO' ? 'bg-primary' : 'bg-primary'}`}>
              <div className="flex items-center gap-space-sm">
                <span className="material-symbols-outlined text-[24px]">receipt_long</span>
                <span className="font-headline-sm text-lg font-bold">Detalle del Registro de Auditoría</span>
              </div>
              <button onClick={() => setSelectedMovimiento(null)} className="p-1 hover:bg-white/20 rounded-full transition-colors cursor-pointer">
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
                  <strong>Custodio / Destino:</strong> {selectedMovimiento.colaborador} <br/>
                  <strong>Responsable TI:</strong> {selectedMovimiento.responsable_ti}
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
              <button onClick={() => setSelectedMovimiento(null)} className="px-space-md py-2 font-bold text-on-surface-variant hover:bg-surface-container-high rounded-lg transition-colors cursor-pointer">
                Cerrar
              </button>
              {(selectedMovimiento.tipo === 'ENTREGA' || selectedMovimiento.tipo === 'DEVOLUCIÓN') && selectedMovimiento.rawDoc?.acta_numero && (
                <button 
                  onClick={() => generateAndPrintActa(selectedMovimiento.rawDoc, selectedMovimiento.tipo)}
                  className="px-space-md py-2 font-bold bg-primary text-on-primary rounded-lg shadow-sm hover:bg-primary-container transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">print</span>
                  Reimprimir Acta
                </button>
              )}
              {selectedMovimiento.tipo === 'TRASLADO' && (
                <button 
                  onClick={() => generateAndPrintActaTraslado(selectedMovimiento.rawDoc)}
                  className="px-space-md py-2 font-bold bg-primary text-on-primary rounded-lg shadow-sm hover:bg-primary-container transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">print</span>
                  Reimprimir Remisión Oficial
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
