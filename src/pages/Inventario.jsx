import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';

export default function Inventario() {
  const [equipos, setEquipos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const navigate = useNavigate();
  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };


  useEffect(() => {
    const q = query(collection(db, "equipos"));
    const unsub = onSnapshot(q, 
      (snapshot) => {
        let list = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() });
        });
        setEquipos(list);
        setLoading(false);
      },
      (err) => {
        console.error("Error Firestore:", err);
        setErrorMsg(err.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const totalEquipos = equipos.length;
  const disponibles = equipos.filter(e => e.estado === 'DISPONIBLE').length;
  const asignados = equipos.filter(e => e.estado === 'ASIGNADO').length;
  const mantenimiento = equipos.filter(e => e.estado === 'MANTENIMIENTO' || e.estado === 'BAJA').length;
  const tasaOperativa = totalEquipos === 0 ? 0 : Math.round(((disponibles + asignados) / totalEquipos) * 100);

  return (
    <div className="bg-background font-body-md text-on-surface antialiased min-h-screen">
      <aside className="fixed left-0 top-0 h-full w-72 bg-surface-container-low z-50 flex flex-col justify-between shadow-[0_1px_8px_rgba(0,0,0,0.04)]"><div className="flex flex-col flex-1 overflow-y-auto"><div className="h-16 px-space-xl flex items-center gap-space-md bg-surface-container-low"><img alt="Logo SGI CASALIMPIA" className="h-8 w-auto object-contain" src="https://lh3.googleusercontent.com/aida/AEtjO1VeTp2XUhWy_4lVUnS_eq24zKPiqAOa8MAt-2aMEz385VkTAcAuDMWkXIYMCipxF3WwQnED5QcovIMWJpZQOxp2WLOHGMUv3FOI6OUkGrGmYDxOoYfXFkHZrYphhgGp8jRZsAZ5a3VMJ7vybCppSvuB3o3WYIazXIIK6lOJutHKbrhX7QfEo-ZBRoIZ6GGX0adrV4meB9nogMZfeePRqWaOdiPFX8LAuibs1jjaUrSDLYH9YTVguEcZwTsn"/><div className="flex flex-col"><span className="font-headline-sm text-headline-sm text-primary leading-none">SGI CASALIMPIA</span><span className="font-label-sm text-label-sm text-outline tracking-wider uppercase">Activos TI</span></div></div><div className="px-space-xl py-space-sm"><span className="font-label-sm text-label-sm uppercase tracking-wider text-outline">Menú Principal</span></div><nav className="px-space-md space-y-space-xs flex-1" data-active-classes="bg-primary-container text-on-primary font-headline-sm rounded-lg"><a className="flex items-center gap-space-md px-space-md py-space-sm text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface rounded-lg transition-colors" data-path="dashboard" href="#"><span className="material-symbols-outlined text-[20px]">grid_view</span><span className="font-body-md text-body-md">Dashboard</span></a><a aria-current="page" className="flex items-center justify-between px-space-md py-space-sm transition-colors bg-primary-container text-on-primary font-headline-sm rounded-lg" data-path="inventario-de-activos" href="#"><div className="flex items-center gap-space-md"><span className="material-symbols-outlined text-[20px]">devices</span><span className="font-body-md text-body-md">Inventario de Activos</span></div><span className="font-code-mono text-code-mono bg-surface-container-highest text-primary font-semibold px-space-sm py-0.5 rounded-full">{totalEquipos}</span></a><div className="pt-space-xs"><div className="flex items-center justify-between px-space-md py-space-sm text-on-surface-variant rounded-lg"><div className="flex items-center gap-space-md"><span className="material-symbols-outlined text-[20px]">assignment_return</span><span className="font-body-md text-body-md font-semibold text-on-surface">Entrega y Recepción</span></div><span className="material-symbols-outlined text-[16px] text-outline">expand_more</span></div><div className="ml-space-lg pl-space-md space-y-space-xs mt-space-xs"><a className="flex items-center gap-space-sm px-space-md py-space-xs text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface rounded-lg transition-colors" data-path="nueva-entrega-acta" href="#"><span className="material-symbols-outlined text-[16px]">post_add</span><span className="font-body-sm text-body-sm">Nueva Entrega / Acta</span></a><a className="flex items-center gap-space-sm px-space-md py-space-xs text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface rounded-lg transition-colors" data-path="devoluciones" href="#"><span className="material-symbols-outlined text-[16px]">keyboard_return</span><span className="font-body-sm text-body-sm">Devoluciones</span></a><a className="flex items-center gap-space-sm px-space-md py-space-xs text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface rounded-lg transition-colors" data-path="historial-entregas" href="#"><span className="material-symbols-outlined text-[16px]">history</span><span className="font-body-sm text-body-sm">Historial</span></a></div></div><a className="flex items-center gap-space-md px-space-md py-space-sm text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface rounded-lg transition-colors" data-path="novedades-y-mantenimiento" href="#"><span className="material-symbols-outlined text-[20px]">build_circle</span><span className="font-body-md text-body-md">Novedades y Mantenimiento</span></a><a className="flex items-center gap-space-md px-space-md py-space-sm text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface rounded-lg transition-colors" data-path="gestion-de-usuarios-y-roles" href="#"><span className="material-symbols-outlined text-[20px]">admin_panel_settings</span><span className="font-body-md text-body-md">Gestión de Usuarios y Roles</span></a><a className="flex items-center gap-space-md px-space-md py-space-sm text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface rounded-lg transition-colors" data-path="reportes-y-auditoria" href="#"><span className="material-symbols-outlined text-[20px]">verified_user</span><span className="font-body-md text-body-md">Reportes y Auditoría</span></a></nav></div><div className="p-space-lg m-space-md bg-surface-container rounded-xl flex items-center gap-space-md"><div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-on-primary"><span className="material-symbols-outlined text-[18px]">verified</span></div><div className="flex flex-col overflow-hidden"><span className="font-label-sm text-label-sm text-primary uppercase font-bold truncate">SGI Conectado</span><span className="font-body-sm text-body-sm text-outline truncate">Auditoría Legal ISO</span></div></div></aside><div className="pl-72 flex flex-col min-h-screen"><header className="fixed top-0 left-72 right-0 h-16 bg-surface/90 backdrop-blur-xl z-40 shadow-[0_1px_8px_rgba(0,0,0,0.04)] px-space-xl flex items-center justify-between gap-space-lg"><div className="flex items-center gap-space-lg flex-1 max-w-2xl"><div className="hidden xl:flex items-center gap-space-xs text-on-surface-variant bg-surface-container px-space-md py-space-xs rounded-full shrink-0"><span className="material-symbols-outlined text-[16px] text-secondary">location_on</span><span className="font-label-sm text-label-sm font-semibold truncate">Sede Principal Av. El Dorado #100-80, Bogotá</span></div><div className="relative w-full max-w-md"><span className="material-symbols-outlined absolute left-space-md top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span><input className="w-full h-9 pl-9 pr-space-md bg-surface-container-lowest text-on-surface rounded-lg font-body-sm text-body-sm placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-primary shadow-[0_1px_2px_0_rgba(15,23,42,0.04)]" placeholder="Buscar activo por serie, placa o modelo..." type="text"/></div></div><div className="flex items-center gap-space-md shrink-0"><button aria-label="Notificaciones" className="relative h-9 w-9 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors" type="button"><span className="material-symbols-outlined text-[20px]">notifications</span><span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-error"></span></button><div className="h-6 w-px bg-surface-container-highest"></div><div className="flex items-center gap-space-md pl-space-xs"><div className="flex flex-col text-right hidden sm:flex"><span className="font-label-md text-label-md text-on-surface">Ing. Alexis Cruz</span><span className="font-label-sm text-label-sm text-secondary font-semibold">Administrador TI</span></div><img alt="Profile" className="w-8 h-8 rounded-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDyAiWOUn9njbbS4sZzxnzDv-_O7nlKMP0d8Uj3JmLf2C_0yjiCZpAy_-U4uCYuUD42dh2KBHFoTT45HDNZZYJ4xGPuondY8OzWlnn7_ZuxW3T5adr-8kHHxYrg8TKac--UfaKWJfhULlk7ZTIvToV2_6HQK6K4NU1fRHrt-A4bVhe1TrF6kp8FaNl7tV6SQ4Q_7jCd97VAYDW2x8agwEazqetgfvCbDatPHJzic_KZM9Czjj8JNoYE6Q"/><button onClick={handleLogout} className="ml-2 hover:bg-error-container hover:text-error text-outline p-1.5 rounded-full transition-colors" title="Cerrar Sessión"><span className="material-symbols-outlined text-[20px]">logout</span></button></div></div></header><main className="relative pt-16 flex-1 w-full px-gutter-lg pb-space-xl bg-background"><div className="flex flex-col w-full">
{/* Top Command & Breadcrumb Context */}
<div className="flex flex-col xl:flex-row xl:items-center justify-between gap-space-lg mb-space-xl">
<div className="flex flex-col gap-space-xs">
<div className="flex items-center gap-space-xs text-outline font-label-sm uppercase tracking-wider">
<span>Gestión de Infraestructura</span>
<span className="material-symbols-outlined text-[14px]">chevron_right</span>
<span className="text-primary font-bold">Módulo Activos TI</span>
<span className="bg-surface-container-high text-primary px-space-xs rounded font-code-mono text-[10px]">CU-08</span>
</div>
<h1 className="font-display-lg text-display-lg text-on-surface tracking-tight">Inventario General de Activos TI</h1>
<p className="font-body-md text-body-md text-on-surface-variant max-w-3xl">
        Consolidado oficial de hardware corporativo, estado técnico, trazabilidad de seriales e historial de custodias de CASALIMPIA S.A. Conforme a especificaciones de control interno y auditoría ISO/IEC 20000.
      </p>
</div>
{/* Quick Actions (RF-02, RF-08) */}
<div className="flex flex-wrap items-center gap-space-sm shrink-0">
<button className="flex items-center gap-space-xs px-space-md h-9 bg-surface-container-lowest text-on-surface rounded-lg font-label-md text-label-md shadow-sm hover:bg-surface-container-high transition-colors" id="btn-import-lot" type="button">
<span className="material-symbols-outlined text-[18px] text-primary">upload_file</span>
<span>Importar Lote (CSV/XLSX)</span>
</button>
<button className="flex items-center gap-space-xs px-space-md h-9 bg-surface-container-lowest text-on-surface rounded-lg font-label-md text-label-md shadow-sm hover:bg-surface-container-high transition-colors" id="btn-export-rep" type="button">
<span className="material-symbols-outlined text-[18px] text-secondary">table_chart</span>
<span>Exportar Reporte (RF-08)</span>
</button>
<button onClick={() => navigate('/registrar-equipo')} className="flex items-center gap-space-xs px-space-lg h-9 bg-primary text-on-primary rounded-lg font-label-md text-label-md shadow-sm hover:bg-primary-container transition-all" id="btn-register-asset" type="button">
<span className="material-symbols-outlined text-[18px]">add_circle</span>
<span>+ Registrar Nuevo Equipo (RF-02)</span>
</button>
</div>
</div>
{/* Hero Visual Accent & KPI Cards Section */}
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-space-md mb-space-xl">
{/* KPI 1: Total Equipos */}
<div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow">
<div className="absolute right-0 top-0 translate-x-3 -translate-y-3 w-24 h-24 bg-primary/5 rounded-full pointer-events-none"></div>
<div className="flex items-center justify-between mb-space-sm">
<span className="font-label-sm text-label-sm uppercase tracking-wider text-outline font-bold">Total Equipos Sistema</span>
<div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary">
<span className="material-symbols-outlined text-[18px]">hub</span>
</div>
</div>
<div className="flex items-baseline gap-space-sm mb-space-xs">
<span className="font-display-lg text-display-lg text-on-surface font-bold">{totalEquipos}</span>
<span className="font-label-sm text-label-sm text-outline font-code-mono">Uds.</span>
</div>
<div className="flex items-center justify-between pt-space-xs">
<div className="flex items-center gap-space-xs font-label-sm text-label-sm text-primary font-semibold">
<span className="material-symbols-outlined text-[14px]">pie_chart</span>
<span>{tasaOperativa}% Tasa Operativa</span>
</div>
<div className="w-16 bg-surface-container-high h-1.5 rounded-full overflow-hidden">
<div className="bg-primary h-full rounded-full" style={{ width: `${tasaOperativa}%` }}></div>
</div>
</div>
</div>
{/* KPI 2: Disponibles Stock */}
<div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow">
<div className="absolute right-0 top-0 translate-x-3 -translate-y-3 w-24 h-24 bg-secondary-container/20 rounded-full pointer-events-none"></div>
<div className="flex items-center justify-between mb-space-sm">
<span className="font-label-sm text-label-sm uppercase tracking-wider text-outline font-bold">Stock Bodega TI</span>
<div className="w-8 h-8 rounded-lg bg-secondary-container/40 flex items-center justify-center text-secondary">
<span className="material-symbols-outlined text-[18px]">inventory_2</span>
</div>
</div>
<div className="flex items-baseline gap-space-sm mb-space-xs">
<span className="font-display-lg text-display-lg text-secondary font-bold">{disponibles}</span>
<span className="font-label-sm text-label-sm text-outline font-code-mono">Disp.</span>
</div>
<div className="flex items-center gap-space-xs font-label-sm text-label-sm text-secondary font-semibold pt-space-xs">
<span className="w-2 h-2 rounded-full bg-secondary"></span>
<span>Listos para entrega inmediata</span>
</div>
</div>
{/* KPI 3: Asignados Activos */}
<div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow">
<div className="absolute right-0 top-0 translate-x-3 -translate-y-3 w-24 h-24 bg-primary-fixed-dim/20 rounded-full pointer-events-none"></div>
<div className="flex items-center justify-between mb-space-sm">
<span className="font-label-sm text-label-sm uppercase tracking-wider text-outline font-bold">Asignados a Personal</span>
<div className="w-8 h-8 rounded-lg bg-primary-fixed/50 flex items-center justify-center text-primary">
<span className="material-symbols-outlined text-[18px]">assignment_ind</span>
</div>
</div>
<div className="flex items-baseline gap-space-sm mb-space-xs">
<span className="font-display-lg text-display-lg text-on-surface font-bold">{asignados}</span>
<span className="font-label-sm text-label-sm text-outline font-code-mono">En uso</span>
</div>
<div className="flex items-center gap-space-xs font-label-sm text-label-sm text-outline font-semibold pt-space-xs">
<span className="material-symbols-outlined text-[14px] text-primary">verified</span>
<span>100% Actas Digitales Firmadas</span>
</div>
</div>
{/* KPI 4: Mantenimiento / Novedad */}
<div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow">
<div className="absolute right-0 top-0 translate-x-3 -translate-y-3 w-24 h-24 bg-error-container/40 rounded-full pointer-events-none"></div>
<div className="flex items-center justify-between mb-space-sm">
<span className="font-label-sm text-label-sm uppercase tracking-wider text-outline font-bold">En Taller / Novedad</span>
<div className="w-8 h-8 rounded-lg bg-error-container flex items-center justify-center text-error">
<span className="material-symbols-outlined text-[18px]">build</span>
</div>
</div>
<div className="flex items-baseline gap-space-sm mb-space-xs">
<span className="font-display-lg text-display-lg text-error font-bold">{mantenimiento}</span>
<span className="font-label-sm text-label-sm text-error font-code-mono">Casos</span>
</div>
<div className="flex items-center gap-space-xs font-label-sm text-label-sm text-error font-semibold pt-space-xs">
<span className="w-2 h-2 rounded-full bg-error animate-ping"></span>
<span>3 Reparaciones Urgentes (SLA &lt; 24h)</span>
</div>
</div>
</div>
{/* Advanced Filtering Toolbar */}
<div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm mb-space-lg flex flex-col gap-space-md">
<div className="grid grid-cols-1 md:grid-cols-12 gap-space-md items-center">
{/* Universal Search Field with Visual Indicator */}
<div className="md:col-span-4 relative">
<label className="block font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-1 font-bold" htmlFor="search-input">Buscador Universal</label>
<div className="relative">
<span className="material-symbols-outlined absolute left-space-md top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
<input className="w-full h-9 pl-9 pr-space-md bg-surface-container-low text-on-surface rounded-lg font-body-sm text-body-sm placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-primary shadow-sm" id="search-input" placeholder="Buscar por Placa, Serial, Marca, Modelo o Asignatario..." type="text"/>
</div>
</div>
{/* Category Filter */}
<div className="md:col-span-2">
<label className="block font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-1 font-bold" htmlFor="filter-category">Categoría</label>
<div className="relative">
<select className="w-full h-9 px-space-md appearance-none bg-surface-container-low text-on-surface rounded-lg font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-primary shadow-sm cursor-pointer pr-8" id="filter-category">
<option value="all">Todas las Categorías</option>
<option value="laptops">Portátiles Corporativos</option>
<option value="desktops">Estaciones de Escritorio</option>
<option value="monitors">Monitores y Displays</option>
<option value="servers">Servidores y Racks</option>
<option value="telephony">Telefonía IP / Cisco</option>
<option value="peripherals">Periféricos y Docks</option>
</select>
<span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-outline text-[16px] pointer-events-none">expand_more</span>
</div>
</div>
{/* State Filter */}
<div className="md:col-span-2">
<label className="block font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-1 font-bold" htmlFor="filter-status">Estado Operativo</label>
<div className="relative">
<select className="w-full h-9 px-space-md appearance-none bg-surface-container-low text-on-surface rounded-lg font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-primary shadow-sm cursor-pointer pr-8" id="filter-status">
<option value="all">Todos los Estados</option>
<option value="disponible">🟢 Disponible (Stock)</option>
<option value="asignado">🔵 Asignado (Acta Vigente)</option>
<option value="mantenimiento">🟡 En Mantenimiento</option>
<option value="revision">🟠 En Revisión Técnica</option>
<option value="baja">🔴 Dado de Baja</option>
</select>
<span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-outline text-[16px] pointer-events-none">expand_more</span>
</div>
</div>
{/* Location / Branch Filter */}
<div className="md:col-span-2">
<label className="block font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-1 font-bold" htmlFor="filter-location">Sede / Ubicación</label>
<div className="relative">
<select className="w-full h-9 px-space-md appearance-none bg-surface-container-low text-on-surface rounded-lg font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-primary shadow-sm cursor-pointer pr-8" id="filter-location">
<option value="all">Todas las Sedes</option>
<option value="bogota">Bogotá - Av. El Dorado</option>
<option value="medellin">Medellín - Poblado</option>
<option value="cali">Cali - Valle del Lili</option>
<option value="barranquilla">Barranquilla - Prado</option>
<option value="bucaramanga">Bucaramanga - Cabecera</option>
</select>
<span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-outline text-[16px] pointer-events-none">expand_more</span>
</div>
</div>
{/* Action Clear & Quick Toggles */}
<div className="md:col-span-2 flex items-end justify-end gap-space-xs pt-5">
<button className="h-9 px-space-md bg-surface-container text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface rounded-lg font-label-sm text-label-sm flex items-center gap-space-xs transition-colors shadow-sm" id="btn-reset-filters" title="Restablecer filtros" type="button">
<span className="material-symbols-outlined text-[16px]">restart_alt</span>
<span>Limpiar</span>
</button>
<button className="h-9 px-space-md bg-primary-fixed text-on-primary-fixed hover:bg-primary-fixed-dim rounded-lg font-label-sm text-label-sm flex items-center gap-space-xs transition-colors shadow-sm font-semibold" id="toggle-critical-filters" type="button">
<span className="material-symbols-outlined text-[16px]">tune</span>
<span>Filtros Críticos</span>
</button>
</div>
</div>
{/* Active Filters & Registry Counter */}
<div className="flex flex-wrap items-center justify-between gap-space-sm pt-space-xs border-t-0">
<div className="flex items-center gap-space-xs flex-wrap text-outline font-label-sm text-label-sm">
<span className="font-bold text-on-surface">Filtros Activos:</span>
<span className="inline-flex items-center gap-1 bg-surface-container-high text-on-surface px-2 py-0.5 rounded-full font-code-mono text-[11px]">
          Sede: Todas
          <span className="material-symbols-outlined text-[12px] cursor-pointer hover:text-error">close</span>
</span>
<span className="inline-flex items-center gap-1 bg-surface-container-high text-on-surface px-2 py-0.5 rounded-full font-code-mono text-[11px]">
          Estado: Activos Operacionales
          <span className="material-symbols-outlined text-[12px] cursor-pointer hover:text-error">close</span>
</span>
</div>
<div className="flex items-center gap-space-md">
<span className="font-code-mono text-code-mono text-outline">
          Mostrando <span className="font-bold text-primary" id="current-visible-count">{totalEquipos}</span> de <span className="font-bold text-on-surface">{totalEquipos}</span> registros indexados
        </span>
</div>
</div>
</div>
{/* Critical Filter Pill Drawer / Sub-bar (collapsible state visual) */}
<div className="mb-space-lg p-space-md bg-surface-container rounded-xl flex flex-wrap items-center justify-between gap-space-md shadow-sm" id="critical-drawer">
<div className="flex items-center gap-space-md flex-wrap">
<span className="flex items-center gap-1 text-primary font-label-sm text-label-sm font-bold uppercase tracking-wider">
<span className="material-symbols-outlined text-[16px]">emergency</span> Segmentos Prioritarios:
      </span>
<button className="px-space-md py-1 rounded-full bg-surface-container-lowest text-on-surface font-label-sm text-label-sm hover:bg-error-container hover:text-on-error-container transition-colors shadow-sm flex items-center gap-1">
<span className="w-1.5 h-1.5 rounded-full bg-error"></span> Con Novedades Pendientes (14)
      </button>
<button className="px-space-md py-1 rounded-full bg-surface-container-lowest text-on-surface font-label-sm text-label-sm hover:bg-secondary-container hover:text-on-secondary-container transition-colors shadow-sm flex items-center gap-1">
<span className="w-1.5 h-1.5 rounded-full bg-secondary"></span> Laptops Disponibles Inmediatas (48)
      </button>
<button className="px-space-md py-1 rounded-full bg-surface-container-lowest text-on-surface font-label-sm text-label-sm hover:bg-surface-container-highest transition-colors shadow-sm flex items-center gap-1">
<span className="w-1.5 h-1.5 rounded-full bg-outline"></span> Garantía por Vencer &lt; 30d (21)
      </button>
</div>
<span className="font-label-sm text-label-sm text-outline italic">Actualizado hace 4 min por Agente SGI</span>
</div>
{/* Main Assets Data Table Section */}
<div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden mb-space-lg">
{/* Table Interactive Frame */}
<div className="overflow-x-auto w-full">
<table className="w-full text-left border-collapse" id="assets-table">
<thead>
<tr className="bg-surface-container-low text-outline font-label-sm text-label-sm uppercase tracking-wider select-none">
<th className="py-space-md px-space-md w-10 text-center">
<input className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer accent-primary" id="select-all-assets" title="Seleccionar todos" type="checkbox"/>
</th>
<th className="py-space-md px-space-md font-bold">Placa / Código</th>
<th className="py-space-md px-space-lg font-bold">Equipo y Especificaciones</th>
<th className="py-space-md px-space-md font-bold">Número Serial</th>
<th className="py-space-md px-space-md font-bold">Categoría</th>
<th className="py-space-md px-space-md font-bold">Estado</th>
<th className="py-space-md px-space-lg font-bold">Asignatario / Ubicación</th>
<th className="py-space-md px-space-md font-bold">Último Movimiento</th>
<th className="py-space-md px-space-md text-right font-bold pr-space-lg">Acciones</th>
</tr>
</thead>
<tbody className="divide-y-0 font-body-sm text-body-sm text-on-surface">
          {errorMsg ? (
            <tr><td colSpan="9" className="text-center py-8 bg-error-container text-on-error-container font-semibold">Error de Firebase: {errorMsg}. (Verifica las reglas de seguridad de Firestore).</td></tr>
          ) : loading ? (
    <tr><td colSpan="9" className="text-center py-8">Cargando inventario desde Firebase...</td></tr>
  ) : equipos.length === 0 ? (
    <tr><td colSpan="9" className="text-center py-8 bg-surface-container-low/30 italic">No hay equipos registrados. Haz clic en "+ Registrar Nuevo Equipo" para inicializar el inventario.</td></tr>
  ) : (
    equipos.map((equipo) => (
      <tr key={equipo.id} className="hover:bg-surface-container transition-colors group">
        <td className="py-space-md px-space-md text-center">
          <input className="asset-checkbox w-4 h-4 rounded text-primary cursor-pointer accent-primary" type="checkbox"/>
        </td>
        <td className="py-space-md px-space-md">
          <div className="flex items-center gap-space-xs">
            <span className="font-code-mono text-code-mono font-bold text-primary bg-surface-container px-space-xs py-0.5 rounded">{equipo.placa}</span>
          </div>
        </td>
        <td className="py-space-md px-space-lg">
          <div className="flex items-center gap-space-md min-w-0">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${equipo.estado === 'MANTENIMIENTO' ? 'bg-error-container text-error' : 'bg-surface-container text-primary'}`}>
              <span className="material-symbols-outlined text-[20px]">devices</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-label-md text-label-md text-on-surface font-bold truncate">{equipo.equipo_nombre}</span>
              <span className="font-body-sm text-body-sm text-outline truncate">{equipo.equipo_specs}</span>
            </div>
          </div>
        </td>
        <td className="py-space-md px-space-md">
          <span className="font-code-mono text-code-mono text-on-surface-variant font-medium select-all">{equipo.serial}</span>
        </td>
        <td className="py-space-md px-space-md">
          <span className="font-body-sm text-body-sm text-on-surface-variant">{equipo.categoria}</span>
        </td>
        <td className="py-space-md px-space-md">
          <span className={`inline-flex items-center gap-1.5 px-space-sm py-0.5 rounded-full font-label-sm text-label-sm font-bold ${
            equipo.estado === 'DISPONIBLE' ? 'bg-secondary-container text-on-secondary-container' :
            equipo.estado === 'MANTENIMIENTO' ? 'bg-error-container text-error' :
            'bg-primary-fixed text-on-primary-fixed'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${equipo.estado === 'DISPONIBLE' ? 'bg-secondary' : equipo.estado === 'MANTENIMIENTO' ? 'bg-error' : 'bg-primary'}`}></span>
            {equipo.estado || 'REGISTRADO'}
          </span>
        </td>
        <td className="py-space-md px-space-lg">
          <div className="flex flex-col">
            <span className={`font-label-md text-label-md ${equipo.estado === 'MANTENIMIENTO' ? 'text-error' : 'text-on-surface font-semibold'}`}>{equipo.asignatario}</span>
            <span className={`font-body-sm text-body-sm ${equipo.estado === 'MANTENIMIENTO' ? 'text-error font-medium' : 'text-outline'}`}>{equipo.ubicacion}</span>
          </div>
        </td>
        <td className="py-space-md px-space-md">
          <div className="flex flex-col">
            <span className="font-code-mono text-code-mono text-on-surface">{equipo.ultimo_movimiento || 'Recién Registrado'}</span>
          </div>
        </td>
        <td className="py-space-md px-space-md text-right pr-space-lg">
          <div className="flex items-center justify-end gap-1 opacity-90 group-hover:opacity-100">
            <button className="p-1.5 rounded-md hover:bg-surface-container-high text-primary transition-colors">
              <span className="material-symbols-outlined text-[18px]">visibility</span>
            </button>
            <button className="p-1.5 rounded-md hover:bg-surface-container-high text-outline transition-colors">
              <span className="material-symbols-outlined text-[18px]">edit</span>
            </button>
          </div>
        </td>
      </tr>
    ))
  )}
</tbody>
</table>
</div>
{/* Table Pagination & Footer Controls */}
<div className="p-space-lg bg-surface-container-low flex flex-col sm:flex-row items-center justify-between gap-space-md">
<div className="flex items-center gap-space-lg text-outline font-body-sm text-body-sm">
<div className="flex items-center gap-space-xs">
<span>Filas por página:</span>
<select className="bg-surface-container-lowest text-on-surface font-semibold rounded-lg px-2 py-1 text-body-sm focus:outline-none focus:ring-1 focus:ring-primary shadow-sm cursor-pointer" id="items-per-page">
<option value="10">10</option>
<option value="25">25</option>
<option value="50">50</option>
<option value="100">100</option>
</select>
</div>
<span className="text-on-surface-variant">Página <strong className="text-on-surface">1</strong> de <strong>149</strong></span>
</div>
{/* Pagination Navigation Buttons */}
<div className="flex items-center gap-space-xs">
<button className="w-8 h-8 rounded-lg bg-surface-container-lowest text-outline hover:bg-surface-container-high hover:text-on-surface flex items-center justify-center transition-colors shadow-sm disabled={true}:opacity-40" disabled={true} type="button">
<span className="material-symbols-outlined text-[18px]">first_page</span>
</button>
<button className="w-8 h-8 rounded-lg bg-surface-container-lowest text-outline hover:bg-surface-container-high hover:text-on-surface flex items-center justify-center transition-colors shadow-sm disabled={true}:opacity-40" disabled={true} type="button">
<span className="material-symbols-outlined text-[18px]">chevron_left</span>
</button>
<span className="w-8 h-8 rounded-lg bg-primary text-on-primary font-bold text-body-sm flex items-center justify-center shadow-sm">1</span>
<button className="w-8 h-8 rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container-high flex items-center justify-center transition-colors text-body-sm shadow-sm" type="button">2</button>
<button className="w-8 h-8 rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container-high flex items-center justify-center transition-colors text-body-sm shadow-sm" type="button">3</button>
<span className="px-1 text-outline">...</span>
<button className="w-8 h-8 rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container-high flex items-center justify-center transition-colors text-body-sm shadow-sm" type="button">149</button>
<button className="w-8 h-8 rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container-high flex items-center justify-center transition-colors shadow-sm" type="button">
<span className="material-symbols-outlined text-[18px]">chevron_right</span>
</button>
<button className="w-8 h-8 rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container-high flex items-center justify-center transition-colors shadow-sm" type="button">
<span className="material-symbols-outlined text-[18px]">last_page</span>
</button>
</div>
</div>
</div>
{/* Operational Audit & Traceability Bar */}
<div className="grid grid-cols-1 md:grid-cols-3 gap-space-md mb-space-sm">
<div className="p-space-md bg-surface-container-lowest rounded-xl shadow-sm flex items-center gap-space-md">
<div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
<span className="material-symbols-outlined text-[20px]">qr_code_scanner</span>
</div>
<div className="flex flex-col">
<span className="font-label-md text-label-md text-on-surface font-bold">Lector de Códigos y Barras</span>
<span className="font-body-sm text-body-sm text-outline">Soporta pistolas Honeywell y Zebra USB/Bluetooth en caliente.</span>
</div>
</div>
<div className="p-space-md bg-surface-container-lowest rounded-xl shadow-sm flex items-center gap-space-md">
<div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary shrink-0">
<span className="material-symbols-outlined text-[20px]">policy</span>
</div>
<div className="flex flex-col">
<span className="font-label-md text-label-md text-on-surface font-bold">Garantías y Legal TI</span>
<span className="font-body-sm text-body-sm text-outline">Placas vinculadas automáticamente con pólizas vigentes CASALIMPIA.</span>
</div>
</div>
<div className="p-space-md bg-surface-container-lowest rounded-xl shadow-sm flex items-center gap-space-md">
<div className="w-10 h-10 rounded-lg bg-primary-fixed flex items-center justify-center text-primary shrink-0">
<span className="material-symbols-outlined text-[20px]">sync</span>
</div>
<div className="flex flex-col">
<span className="font-label-md text-label-md text-on-surface font-bold">Sincronización Active Directory</span>
<span className="font-body-sm text-body-sm text-outline">Última conciliación de usuarios y cargos hace 12 minutos.</span>
</div>
</div>
</div>
{/* Slide-Over Quick Inspection Panel (Hidden by default, triggered by JS) */}
<div className="fixed inset-y-0 right-0 w-full max-w-md bg-surface-container-lowest shadow-2xl z-50 transform translate-x-full transition-transform duration-300 ease-in-out p-space-xl flex flex-col justify-between hidden" id="side-inspection-panel">
<div>
<div className="flex items-center justify-between pb-space-lg">
<div className="flex items-center gap-space-xs">
<span className="material-symbols-outlined text-primary text-[24px]">devices</span>
<span className="font-headline-sm text-headline-sm text-on-surface font-bold">Ficha Rápida de Activo</span>
</div>
<button className="w-8 h-8 rounded-lg hover:bg-surface-container flex items-center justify-center text-outline hover:text-on-surface" id="close-side-panel">
<span className="material-symbols-outlined">close</span>
</button>
</div>
<div className="space-y-space-md">
<div className="p-space-md bg-surface-container rounded-lg">
<span className="font-label-sm text-label-sm text-outline uppercase font-bold">Placa Institucional</span>
<p className="font-display-lg text-display-lg font-bold text-primary font-code-mono mt-1">CL-TI-0892</p>
</div>
<div className="space-y-space-xs">
<label className="font-label-sm text-label-sm text-outline uppercase font-bold">Modelo y Configuración</label>
<p className="font-label-md text-label-md text-on-surface font-semibold">Dell Latitude 5430 Rugged</p>
<p className="font-body-sm text-body-sm text-outline">Procesador Intel Core i7-1265U vPro (10 Núcleos, hasta 4.80 GHz)</p>
<p className="font-body-sm text-body-sm text-outline">Memoria RAM: 16 GB DDR4 3200MHz</p>
<p className="font-body-sm text-body-sm text-outline">Almacenamiento: SSD PCIe M.2 NVMe Clase 40 512 GB</p>
</div>
<div className="space-y-space-xs pt-space-xs">
<label className="font-label-sm text-label-sm text-outline uppercase font-bold">Asignación Actual</label>
<div className="p-space-md bg-surface-container-low rounded-lg flex items-center gap-space-md">
<div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-on-primary font-bold font-label-md">
              SJ
            </div>
<div className="flex flex-col">
<span className="font-label-md text-label-md font-bold text-on-surface">Santiago Jiménez Castro</span>
<span className="font-body-sm text-body-sm text-outline">Coordinador TI de Campo</span>
<span className="font-code-mono text-code-mono text-[11px] text-primary">santiago.jimenez@casalimpia.com.co</span>
</div>
</div>
</div>
<div className="space-y-space-xs pt-space-xs">
<label className="font-label-sm text-label-sm text-outline uppercase font-bold">Historial de Mantenimientos</label>
<ul className="text-body-sm font-body-sm text-on-surface-variant space-y-2">
<li className="flex items-center justify-between py-1 bg-surface-container-lowest rounded px-2">
<span>Mantenimiento Preventivo Q4</span>
<span className="font-code-mono text-outline">15 Nov 2025</span>
</li>
<li className="flex items-center justify-between py-1 bg-surface-container-lowest rounded px-2">
<span>Actualización BIOS y Firmware Dell</span>
<span className="font-code-mono text-outline">03 Ago 2025</span>
</li>
</ul>
</div>
</div>
</div>
<div className="pt-space-lg flex items-center gap-space-md">
<button className="w-full h-10 bg-primary text-on-primary rounded-lg font-label-md text-label-md font-semibold hover:bg-primary-container transition-colors shadow-sm">
        Ver Expediente Completo
      </button>
<button className="w-12 h-10 bg-surface-container rounded-lg flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors" id="btn-print-act" title="Reimprimir Acta">
<span className="material-symbols-outlined text-[20px]">print</span>
</button>
</div>
</div>
</div>
</main><footer className="w-full bg-surface-container-lowest shadow-[0_-1px_4px_rgba(0,0,0,0.02)] py-space-md px-gutter-lg"><div className="w-full flex flex-col sm:flex-row items-center justify-between gap-space-xs text-outline"><span className="font-body-sm text-body-sm">CASALIMPIA S.A - Tecnológico de Antioquia PPI 2026</span><div className="flex items-center gap-space-md font-code-mono text-code-mono text-outline-variant"><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-secondary"></span>Sistema Operativo</span><span>v2.4.0</span></div></div></footer></div>
    </div>
  );
}
