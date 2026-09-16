import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  onSnapshot,
  query,
  doc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { exportToCSV, parseCSV, initialDemoAssets } from '../utils/assetHelpers';
import { getStoredUser } from '../utils/userHelpers';

export default function Inventario() {
  const currentUser = getStoredUser();
  const [equipos, setEquipos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const navigate = useNavigate();

  // Estados de Búsqueda y Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterLocation, setFilterLocation] = useState('all');

  // Selección múltiple
  const [selectedIds, setSelectedIds] = useState([]);

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Modales y Paneles
  const [selectedAssetForDetail, setSelectedAssetForDetail] = useState(null);
  const [assetToEdit, setAssetToEdit] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFileContent, setImportFileContent] = useState('');
  const [parsedImportAssets, setParsedImportAssets] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  // 1. Suscripción en tiempo real a la colección 'equipos'
  useEffect(() => {
    const q = query(collection(db, "equipos"));
    const unsub = onSnapshot(q,
      (snapshot) => {
        let list = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() });
        });
        setEquipos(list);
        setLoading(false);
        setErrorMsg(null);
      },
      (err) => {
        console.error("Error Firestore:", err);
        setErrorMsg(err.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // 2. Cálculos de KPIs dinámicos
  const totalEquipos = equipos.length;
  const disponibles = equipos.filter(e => e.estado === 'DISPONIBLE').length;
  const asignados = equipos.filter(e => e.estado === 'ASIGNADO').length;
  const mantenimiento = equipos.filter(e => e.estado === 'MANTENIMIENTO' || e.estado === 'REVISION').length;
  const bajas = equipos.filter(e => e.estado === 'BAJA').length;
  const tasaOperativa = totalEquipos === 0 ? 0 : Math.round(((disponibles + asignados) / totalEquipos) * 100);

  // Segmentos prioritarios dinámicos
  const laptopsDisponiblesCount = equipos.filter(e =>
    (e.categoria || '').toLowerCase().includes('laptop') ||
    (e.categoria || '').toLowerCase().includes('portátil')
  ).filter(e => e.estado === 'DISPONIBLE').length;

  // 3. Filtrado dinámico de la tabla
  const filteredEquipos = useMemo(() => {
    return equipos.filter((item) => {
      // Filtrar visualización para Empleados (solo ven lo suyo)
      if (currentUser?.rol === 'Empleado') {
        const asigEmail = (item.asignatario_email || '').toLowerCase();
        const asigNom = (item.asignatario || '').trim().toLowerCase();
        const miEmail = (currentUser?.email || '').toLowerCase();
        const miNom = (currentUser?.nombre || '').trim().toLowerCase();
        if (asigEmail !== miEmail && asigNom !== miNom) {
          return false;
        }
      }

      // Filtro de texto
      if (searchQuery.trim()) {
        const queryLower = searchQuery.toLowerCase().trim();
        const matchPlaca = (item.placa || '').toLowerCase().includes(queryLower);
        const matchSerial = (item.serial || '').toLowerCase().includes(queryLower);
        const matchNombre = (item.equipo_nombre || '').toLowerCase().includes(queryLower);
        const matchSpecs = (item.equipo_specs || '').toLowerCase().includes(queryLower);
        const matchAsignatario = (item.asignatario || '').toLowerCase().includes(queryLower);
        const matchUbicacion = (item.ubicacion || '').toLowerCase().includes(queryLower);

        if (!matchPlaca && !matchSerial && !matchNombre && !matchSpecs && !matchAsignatario && !matchUbicacion) {
          return false;
        }
      }

      // Filtro por categoría
      if (filterCategory !== 'all') {
        const itemCat = (item.categoria || '').toLowerCase();
        if (filterCategory === 'laptops' && !itemCat.includes('laptop') && !itemCat.includes('portátil')) return false;
        if (filterCategory === 'desktops' && !itemCat.includes('escritorio') && !itemCat.includes('desktop')) return false;
        if (filterCategory === 'monitors' && !itemCat.includes('monitor') && !itemCat.includes('display')) return false;
        if (filterCategory === 'servers' && !itemCat.includes('servidor') && !itemCat.includes('server')) return false;
        if (filterCategory === 'telephony' && !itemCat.includes('telef') && !itemCat.includes('cisco')) return false;
        if (filterCategory === 'peripherals' && !itemCat.includes('periférico') && !itemCat.includes('dock')) return false;
      }

      // Filtro por estado
      if (filterStatus !== 'all') {
        if (item.estado !== filterStatus) return false;
      }

      // Filtro por ubicación / sede
      if (filterLocation !== 'all') {
        const itemLoc = `${item.ubicacion || ''} ${item.sede || ''}`.toLowerCase();
        if (!itemLoc.includes(filterLocation.toLowerCase())) return false;
      }

      return true;
    });
  }, [equipos, searchQuery, filterCategory, filterStatus, filterLocation]);

  // 4. Paginación
  const totalPages = Math.max(1, Math.ceil(filteredEquipos.length / itemsPerPage));
  const paginatedEquipos = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredEquipos.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredEquipos, currentPage, itemsPerPage]);

  // Asegurar página válida al cambiar filtros
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  // Handlers de Filtros
  const handleResetFilters = () => {
    setSearchQuery('');
    setFilterCategory('all');
    setFilterStatus('all');
    setFilterLocation('all');
    setCurrentPage(1);
  };

  // Handlers de Selección Múltiple
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const pageIds = paginatedEquipos.map(eq => eq.id);
      setSelectedIds(Array.from(new Set([...selectedIds, ...pageIds])));
    } else {
      const pageIds = new Set(paginatedEquipos.map(eq => eq.id));
      setSelectedIds(selectedIds.filter(id => !pageIds.has(id)));
    }
  };

  const handleToggleSelectOne = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(item => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  // Eliminar un solo equipo
  const handleDeleteOne = async (equipo) => {
    if (window.confirm(`¿Estás seguro de que deseas eliminar permanentemente el equipo con placa ${equipo.placa}?`)) {
      try {
        await deleteDoc(doc(db, "equipos", equipo.id));
        setSelectedIds(prev => prev.filter(id => id !== equipo.id));
        setSuccessMsg(`Equipo ${equipo.placa} eliminado exitosamente.`);
        setTimeout(() => setSuccessMsg(null), 3000);
      } catch (err) {
        alert("Error al eliminar: " + err.message);
      }
    }
  };

  // Eliminar seleccionados en lote
  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    if (window.confirm(`¿Deseas eliminar permanentemente los ${selectedIds.length} equipos seleccionados?`)) {
      try {
        setIsProcessing(true);
        const batch = writeBatch(db);
        selectedIds.forEach(id => {
          batch.delete(doc(db, "equipos", id));
        });
        await batch.commit();
        setSelectedIds([]);
        setSuccessMsg(`Se eliminaron ${selectedIds.length} equipos.`);
        setTimeout(() => setSuccessMsg(null), 3000);
      } catch (err) {
        alert("Error en eliminación por lote: " + err.message);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  // Guardar edición
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!assetToEdit) return;
    try {
      setIsProcessing(true);
      const assetRef = doc(db, "equipos", assetToEdit.id);
      await updateDoc(assetRef, {
        placa: assetToEdit.placa || '',
        equipo_nombre: assetToEdit.equipo_nombre || '',
        equipo_specs: assetToEdit.equipo_specs || '',
        serial: assetToEdit.serial || '',
        categoria: assetToEdit.categoria || 'Laptops Corporativas',
        estado: assetToEdit.estado || 'DISPONIBLE',
        asignatario: assetToEdit.asignatario || 'Bodega Centralizada TI',
        ubicacion: assetToEdit.ubicacion || 'Bogotá - Av. El Dorado',
        ultimo_movimiento: `Modificado ${new Date().toLocaleDateString()}`
      });
      setAssetToEdit(null);
      setSuccessMsg("Equipo actualizado correctamente.");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      alert("Error al actualizar equipo: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Cargar datos semilla si la BD está vacía
  const handleSeedDemoData = async () => {
    try {
      setIsProcessing(true);
      const batch = writeBatch(db);
      initialDemoAssets.forEach((asset) => {
        const newDocRef = doc(collection(db, "equipos"));
        batch.set(newDocRef, {
          ...asset,
          createdAt: serverTimestamp()
        });
      });
      await batch.commit();
      setSuccessMsg("Datos de prueba de CASALIMPIA cargados exitosamente.");
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err) {
      alert("Error al inicializar datos: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Procesar archivo CSV
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      setImportFileContent(text);
      const parsed = parseCSV(text);
      setParsedImportAssets(parsed);
    };
    reader.readAsText(file);
  };

  // Confirmar importación por lote
  const handleConfirmImport = async () => {
    if (parsedImportAssets.length === 0) {
      alert("No se encontraron registros válidos para importar.");
      return;
    }
    try {
      setIsProcessing(true);
      const batch = writeBatch(db);
      parsedImportAssets.forEach((asset) => {
        const newDocRef = doc(collection(db, "equipos"));
        batch.set(newDocRef, {
          ...asset,
          createdAt: serverTimestamp()
        });
      });
      await batch.commit();
      setShowImportModal(false);
      setParsedImportAssets([]);
      setImportFileContent('');
      setSuccessMsg(`Se importaron ${parsedImportAssets.length} equipos con éxito.`);
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err) {
      alert("Error al importar lote: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const isAllOnPageSelected = paginatedEquipos.length > 0 && paginatedEquipos.every(eq => selectedIds.includes(eq.id));

  return (
    <div className="bg-background font-body-md text-on-surface antialiased min-h-screen">

      {/* Feedback Toast */}
      {successMsg && (
        <div className="fixed bottom-5 right-5 z-50 bg-primary text-on-primary px-space-lg py-space-sm rounded-xl shadow-xl flex items-center gap-space-sm animate-bounce">
          <span className="material-symbols-outlined text-[20px]">check_circle</span>
          <span className="font-label-md">{successMsg}</span>
        </div>
      )}

      {/* ASIDE / SIDEBAR */}
      <aside className="fixed left-0 top-0 h-full w-72 bg-surface-container-low z-50 flex flex-col justify-between shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="flex flex-col flex-1 overflow-y-auto">
          <div className="h-16 px-space-xl flex items-center gap-space-md bg-surface-container-low">
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
              onClick={() => handleResetFilters()}
            >
              <span className="material-symbols-outlined text-[20px]">grid_view</span>
              <span className="font-body-md text-body-md">Dashboard</span>
            </a>
            <a
              aria-current="page"
              className="flex items-center justify-between px-space-md py-space-sm transition-colors bg-primary-container text-on-primary font-headline-sm rounded-lg cursor-pointer"
              onClick={() => handleResetFilters()}
            >
              <div className="flex items-center gap-space-md">
                <span className="material-symbols-outlined text-[20px]">devices</span>
                <span className="font-body-md text-body-md">Inventario de Activos</span>
              </div>
              <span className="font-code-mono text-code-mono bg-surface-container-highest text-primary font-semibold px-space-sm py-0.5 rounded-full">
                {totalEquipos}
              </span>
            </a>
            <div className="pt-space-xs">
              <div className="flex items-center justify-between px-space-md py-space-sm text-on-surface-variant rounded-lg">
                <div className="flex items-center gap-space-md">
                  <span className="material-symbols-outlined text-[20px]">assignment_return</span>
                  <span className="font-body-md text-body-md font-semibold text-on-surface">Entrega y Recepción</span>
                </div>
                <span className="material-symbols-outlined text-[16px] text-outline">expand_more</span>
              </div>
              <div className="ml-space-lg pl-space-md space-y-space-xs mt-space-xs">
                <a
                  className="flex items-center gap-space-sm px-space-md py-space-xs text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface rounded-lg transition-colors cursor-pointer"
                  onClick={() => navigate('/entrega-hardware')}
                >
                  <span className="material-symbols-outlined text-[16px]">post_add</span>
                  <span className="font-body-sm text-body-sm">Nueva Entrega / Acta</span>
                </a>
                <a
                  className="flex items-center gap-space-sm px-space-md py-space-xs text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface rounded-lg transition-colors cursor-pointer"
                  onClick={() => navigate('/devoluciones')}
                >
                  <span className="material-symbols-outlined text-[16px]">keyboard_return</span>
                  <span className="font-body-sm text-body-sm">Devoluciones</span>
                </a>
                <a
                  className="flex items-center gap-space-sm px-space-md py-space-xs text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface rounded-lg transition-colors cursor-pointer"
                  onClick={() => navigate('/historial')}
                >
                  <span className="material-symbols-outlined text-[16px]">history</span>
                  <span className="font-body-sm text-body-sm">Historial</span>
                </a>
              </div>
            </div>
            <a
              className="flex items-center gap-space-md px-space-md py-space-sm text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface rounded-lg transition-colors cursor-pointer"
              onClick={() => setFilterStatus('MANTENIMIENTO')}
            >
              <span className="material-symbols-outlined text-[20px]">build_circle</span>
              <span className="font-body-md text-body-md">Novedades y Mantenimiento</span>
            </a>
            <a
              className="flex items-center gap-space-md px-space-md py-space-sm text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface rounded-lg transition-colors cursor-pointer"
              onClick={() => navigate('/usuarios-roles')}
            >
              <span className="material-symbols-outlined text-[20px]">admin_panel_settings</span>
              <span className="font-body-md text-body-md">Gestión de Usuarios y Roles</span>
            </a>
            <a
              className="flex items-center gap-space-md px-space-md py-space-sm text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface rounded-lg transition-colors cursor-pointer"
              onClick={() => exportToCSV(filteredEquipos.length > 0 ? filteredEquipos : equipos, 'auditoria_iso20000_casalimpia.csv')}
            >
              <span className="material-symbols-outlined text-[20px]">verified_user</span>
              <span className="font-body-md text-body-md">Reportes y Auditoría</span>
            </a>
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

      {/* CONTENIDO PRINCIPAL */}
      <div className="pl-72 flex flex-col min-h-screen">

        {/* HEADER SUPERIOR */}
        <header className="fixed top-0 left-72 right-0 h-16 bg-surface/90 backdrop-blur-xl z-40 shadow-[0_1px_8px_rgba(0,0,0,0.04)] px-space-xl flex items-center justify-between gap-space-lg">
          <div className="flex items-center gap-space-lg flex-1 max-w-2xl">
            <div className="hidden xl:flex items-center gap-space-xs text-on-surface-variant bg-surface-container px-space-md py-space-xs rounded-full shrink-0">
              <span className="material-symbols-outlined text-[16px] text-secondary">location_on</span>
              <span className="font-label-sm text-label-sm font-semibold truncate">Sede Principal Av. El Dorado #100-80, Bogotá</span>
            </div>
            <div className="relative w-full max-w-md">
              <span className="material-symbols-outlined absolute left-space-md top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
              <input
                className="w-full h-9 pl-9 pr-space-md bg-surface-container-lowest text-on-surface rounded-lg font-body-sm text-body-sm placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-primary shadow-[0_1px_2px_0_rgba(15,23,42,0.04)]"
                placeholder="Buscar activo por serie, placa o modelo..."
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-space-md shrink-0">
            <button
              aria-label="Notificaciones"
              className="relative h-9 w-9 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
              type="button"
              onClick={() => alert(`Sistema Operativo: ${mantenimiento} equipos en novedad o revisión técnica.`)}
            >
              <span className="material-symbols-outlined text-[20px]">notifications</span>
              {mantenimiento > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-error"></span>
              )}
            </button>
            <div className="h-6 w-px bg-surface-container-highest"></div>
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
                className="ml-2 hover:bg-error-container hover:text-error text-outline p-1.5 rounded-full transition-colors"
                title="Cerrar Sesión"
              >
                <span className="material-symbols-outlined text-[20px]">logout</span>
              </button>
            </div>
          </div>
        </header>

        {/* CUERPO DEL INVENTARIO */}
        <main className="relative pt-16 flex-1 w-full px-gutter-lg pb-space-xl bg-background">
          <div className="flex flex-col w-full">

            {/* Contexto superior y Título */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-space-lg mb-space-xl pt-4">
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

              {/* Botones de Acción Rápida */}
              <div className="flex flex-wrap items-center gap-space-sm shrink-0">
                <button
                  onClick={() => setShowImportModal(true)}
                  className="flex items-center gap-space-xs px-space-md h-9 bg-surface-container-lowest text-on-surface rounded-lg font-label-md text-label-md shadow-sm hover:bg-surface-container-high transition-colors cursor-pointer"
                  id="btn-import-lot"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[18px] text-primary">upload_file</span>
                  <span>Importar Lote (CSV/XLSX)</span>
                </button>
                <button
                  onClick={() => exportToCSV(filteredEquipos.length > 0 ? filteredEquipos : equipos, 'reporte_activos_rf08.csv')}
                  className="flex items-center gap-space-xs px-space-md h-9 bg-surface-container-lowest text-on-surface rounded-lg font-label-md text-label-md shadow-sm hover:bg-surface-container-high transition-colors cursor-pointer"
                  id="btn-export-rep"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[18px] text-secondary">table_chart</span>
                  <span>Exportar Reporte (RF-08)</span>
                </button>
                <button
                  onClick={() => navigate('/registrar-equipo')}
                  className="flex items-center gap-space-xs px-space-lg h-9 bg-primary text-on-primary rounded-lg font-label-md text-label-md shadow-sm hover:bg-primary-container transition-all cursor-pointer"
                  id="btn-register-asset"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[18px]">add_circle</span>
                  <span>+ Registrar Nuevo Equipo (RF-02)</span>
                </button>
              </div>
            </div>

            {/* SECCIÓN DE TARJETAS KPI (Dinámicas) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-space-md mb-space-xl">

              {/* KPI 1: Total Equipos */}
              <div
                onClick={() => handleResetFilters()}
                className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow cursor-pointer"
              >
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
                    <div className="bg-primary h-full rounded-full transition-all duration-500" style={{ width: `${tasaOperativa}%` }}></div>
                  </div>
                </div>
              </div>

              {/* KPI 2: Disponibles Stock */}
              <div
                onClick={() => setFilterStatus(filterStatus === 'DISPONIBLE' ? 'all' : 'DISPONIBLE')}
                className={`bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow cursor-pointer ${filterStatus === 'DISPONIBLE' ? 'ring-2 ring-secondary' : ''}`}
              >
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

              {/* KPI 3: Asignados a Personal */}
              <div
                onClick={() => setFilterStatus(filterStatus === 'ASIGNADO' ? 'all' : 'ASIGNADO')}
                className={`bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow cursor-pointer ${filterStatus === 'ASIGNADO' ? 'ring-2 ring-primary' : ''}`}
              >
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
                  <span>Actas Digitales Vinculadas</span>
                </div>
              </div>

              {/* KPI 4: Mantenimiento / Novedad */}
              <div
                onClick={() => setFilterStatus(filterStatus === 'MANTENIMIENTO' ? 'all' : 'MANTENIMIENTO')}
                className={`bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow cursor-pointer ${filterStatus === 'MANTENIMIENTO' ? 'ring-2 ring-error' : ''}`}
              >
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
                  {mantenimiento > 0 && <span className="w-2 h-2 rounded-full bg-error animate-ping"></span>}
                  <span>Atención prioritaria SLA TI</span>
                </div>
              </div>
            </div>

            {/* BARRA DE BÚSQUEDA Y FILTROS AVANZADOS */}
            <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm mb-space-lg flex flex-col gap-space-md">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-space-md items-center">

                {/* Buscador Universal */}
                <div className="md:col-span-4 relative">
                  <label className="block font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-1 font-bold" htmlFor="search-input">
                    Buscador Universal
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-space-md top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
                    <input
                      className="w-full h-9 pl-9 pr-space-md bg-surface-container-low text-on-surface rounded-lg font-body-sm text-body-sm placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
                      id="search-input"
                      placeholder="Buscar por Placa, Serial, Marca, Modelo o Asignatario..."
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>

                {/* Filtro por Categoría */}
                <div className="md:col-span-2">
                  <label className="block font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-1 font-bold" htmlFor="filter-category">
                    Categoría
                  </label>
                  <div className="relative">
                    <select
                      className="w-full h-9 px-space-md appearance-none bg-surface-container-low text-on-surface rounded-lg font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-primary shadow-sm cursor-pointer pr-8"
                      id="filter-category"
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                    >
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

                {/* Filtro por Estado */}
                <div className="md:col-span-2">
                  <label className="block font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-1 font-bold" htmlFor="filter-status">
                    Estado Operativo
                  </label>
                  <div className="relative">
                    <select
                      className="w-full h-9 px-space-md appearance-none bg-surface-container-low text-on-surface rounded-lg font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-primary shadow-sm cursor-pointer pr-8"
                      id="filter-status"
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                    >
                      <option value="all">Todos los Estados</option>
                      <option value="DISPONIBLE">🟢 Disponible (Stock)</option>
                      <option value="ASIGNADO">🔵 Asignado (Acta Vigente)</option>
                      <option value="MANTENIMIENTO">🟡 En Mantenimiento</option>
                      <option value="REVISION">🟠 En Revisión Técnica</option>
                      <option value="BAJA">🔴 Dado de Baja</option>
                    </select>
                    <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-outline text-[16px] pointer-events-none">expand_more</span>
                  </div>
                </div>

                {/* Filtro por Sede */}
                <div className="md:col-span-2">
                  <label className="block font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-1 font-bold" htmlFor="filter-location">
                    Sede / Ubicación
                  </label>
                  <div className="relative">
                    <select
                      className="w-full h-9 px-space-md appearance-none bg-surface-container-low text-on-surface rounded-lg font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-primary shadow-sm cursor-pointer pr-8"
                      id="filter-location"
                      value={filterLocation}
                      onChange={(e) => setFilterLocation(e.target.value)}
                    >
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

                {/* Botón Limpiar y Toggles */}
                <div className="md:col-span-2 flex items-end justify-end gap-space-xs pt-5">
                  <button
                    onClick={handleResetFilters}
                    className="h-9 px-space-md bg-surface-container text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface rounded-lg font-label-sm text-label-sm flex items-center gap-space-xs transition-colors shadow-sm cursor-pointer"
                    id="btn-reset-filters"
                    title="Restablecer filtros"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                    <span>Limpiar</span>
                  </button>
                  <button
                    onClick={() => {
                      if (filterStatus === 'MANTENIMIENTO') {
                        setFilterStatus('all');
                      } else {
                        setFilterStatus('MANTENIMIENTO');
                      }
                    }}
                    className={`h-9 px-space-md rounded-lg font-label-sm text-label-sm flex items-center gap-space-xs transition-colors shadow-sm font-semibold cursor-pointer ${filterStatus === 'MANTENIMIENTO' ? 'bg-error text-on-error' : 'bg-primary-fixed text-on-primary-fixed hover:bg-primary-fixed-dim'
                      }`}
                    id="toggle-critical-filters"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[16px]">tune</span>
                    <span>Filtros Críticos</span>
                  </button>
                </div>
              </div>

              {/* Filtros Activos y Contador Dinámico */}
              <div className="flex flex-wrap items-center justify-between gap-space-sm pt-space-xs border-t border-surface-container-high/40">
                <div className="flex items-center gap-space-xs flex-wrap text-outline font-label-sm text-label-sm">
                  <span className="font-bold text-on-surface">Filtros Activos:</span>

                  {searchQuery && (
                    <span className="inline-flex items-center gap-1 bg-surface-container-high text-on-surface px-2 py-0.5 rounded-full font-code-mono text-[11px]">
                      Texto: "{searchQuery}"
                      <span onClick={() => setSearchQuery('')} className="material-symbols-outlined text-[12px] cursor-pointer hover:text-error">close</span>
                    </span>
                  )}

                  {filterCategory !== 'all' && (
                    <span className="inline-flex items-center gap-1 bg-surface-container-high text-on-surface px-2 py-0.5 rounded-full font-code-mono text-[11px]">
                      Categoría: {filterCategory}
                      <span onClick={() => setFilterCategory('all')} className="material-symbols-outlined text-[12px] cursor-pointer hover:text-error">close</span>
                    </span>
                  )}

                  {filterStatus !== 'all' && (
                    <span className="inline-flex items-center gap-1 bg-surface-container-high text-on-surface px-2 py-0.5 rounded-full font-code-mono text-[11px]">
                      Estado: {filterStatus}
                      <span onClick={() => setFilterStatus('all')} className="material-symbols-outlined text-[12px] cursor-pointer hover:text-error">close</span>
                    </span>
                  )}

                  {filterLocation !== 'all' && (
                    <span className="inline-flex items-center gap-1 bg-surface-container-high text-on-surface px-2 py-0.5 rounded-full font-code-mono text-[11px]">
                      Sede: {filterLocation}
                      <span onClick={() => setFilterLocation('all')} className="material-symbols-outlined text-[12px] cursor-pointer hover:text-error">close</span>
                    </span>
                  )}

                  {searchQuery === '' && filterCategory === 'all' && filterStatus === 'all' && filterLocation === 'all' && (
                    <span className="text-outline text-[12px] italic">Ningún filtro activo (Mostrando todos los registros)</span>
                  )}
                </div>

                <div className="flex items-center gap-space-md">
                  <span className="font-code-mono text-code-mono text-outline">
                    Mostrando <span className="font-bold text-primary" id="current-visible-count">{filteredEquipos.length}</span> de <span className="font-bold text-on-surface">{totalEquipos}</span> registros indexados
                  </span>
                </div>
              </div>
            </div>

            {/* SEGMENTOS PRIORITARIOS (Interactivos con Firestore) */}
            <div className="mb-space-lg p-space-md bg-surface-container rounded-xl flex flex-wrap items-center justify-between gap-space-md shadow-sm" id="critical-drawer">
              <div className="flex items-center gap-space-md flex-wrap">
                <span className="flex items-center gap-1 text-primary font-label-sm text-label-sm font-bold uppercase tracking-wider">
                  <span className="material-symbols-outlined text-[16px]">emergency</span> Segmentos Prioritarios:
                </span>

                <button
                  onClick={() => setFilterStatus(filterStatus === 'MANTENIMIENTO' ? 'all' : 'MANTENIMIENTO')}
                  className={`px-space-md py-1 rounded-full text-on-surface font-label-sm text-label-sm transition-colors shadow-sm flex items-center gap-1 cursor-pointer ${filterStatus === 'MANTENIMIENTO' ? 'bg-error-container text-on-error-container font-bold ring-1 ring-error' : 'bg-surface-container-lowest hover:bg-error-container'
                    }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-error"></span>
                  Con Novedades Pendientes ({mantenimiento})
                </button>

                <button
                  onClick={() => {
                    setFilterCategory('laptops');
                    setFilterStatus('DISPONIBLE');
                  }}
                  className="px-space-md py-1 rounded-full bg-surface-container-lowest text-on-surface font-label-sm text-label-sm hover:bg-secondary-container hover:text-on-secondary-container transition-colors shadow-sm flex items-center gap-1 cursor-pointer"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                  Laptops Disponibles Inmediatas ({laptopsDisponiblesCount})
                </button>

                <button
                  onClick={() => setFilterStatus('BAJA')}
                  className="px-space-md py-1 rounded-full bg-surface-container-lowest text-on-surface font-label-sm text-label-sm hover:bg-surface-container-highest transition-colors shadow-sm flex items-center gap-1 cursor-pointer"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-outline"></span>
                  Equipos Dados de Baja ({bajas})
                </button>
              </div>
              <span className="font-label-sm text-label-sm text-outline italic">Sincronizado en tiempo real con Firestore</span>
            </div>

            {/* BARRA DE ACCIÓN POR LOTE (Si hay seleccionados) */}
            {selectedIds.length > 0 && (
              <div className="mb-space-md p-space-md bg-primary-container text-on-primary rounded-xl flex items-center justify-between shadow-md animate-fadeIn">
                <div className="flex items-center gap-space-md">
                  <span className="material-symbols-outlined text-[20px]">check_box</span>
                  <span className="font-label-md font-bold">{selectedIds.length} equipos seleccionados</span>
                </div>
                <div className="flex items-center gap-space-sm">
                  <button
                    onClick={() => setSelectedIds([])}
                    className="px-space-md py-1 bg-surface/20 hover:bg-surface/30 rounded-lg text-label-sm transition-colors cursor-pointer"
                  >
                    Desmarcar todos
                  </button>
                  <button
                    onClick={handleBatchDelete}
                    disabled={isProcessing}
                    className="px-space-md py-1 bg-error hover:bg-error/90 text-on-error font-bold rounded-lg text-label-sm transition-colors flex items-center gap-1 shadow-sm cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                    Eliminar seleccionados
                  </button>
                </div>
              </div>
            )}

            {/* TABLA PRINCIPAL DE ACTIVOS */}
            <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden mb-space-lg">
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left border-collapse" id="assets-table">
                  <thead>
                    <tr className="bg-surface-container-low text-outline font-label-sm text-label-sm uppercase tracking-wider select-none">
                      <th className="py-space-md px-space-md w-10 text-center">
                        <input
                          className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer accent-primary"
                          id="select-all-assets"
                          title="Seleccionar todos en esta página"
                          type="checkbox"
                          checked={isAllOnPageSelected}
                          onChange={handleSelectAll}
                        />
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
                      <tr>
                        <td colSpan="9" className="text-center py-12 bg-error-container text-on-error-container">
                          <div className="flex flex-col items-center gap-2 max-w-lg mx-auto">
                            <span className="material-symbols-outlined text-[32px] text-error">lock</span>
                            <p className="font-bold text-label-lg">Error de Permisos en Firestore</p>
                            <p className="font-body-sm">{errorMsg}</p>
                            <span className="text-[12px] opacity-80">Recuerda habilitar <code>allow read, write: if true;</code> en las Reglas de Firebase Console.</span>
                          </div>
                        </td>
                      </tr>
                    ) : loading ? (
                      <tr>
                        <td colSpan="9" className="text-center py-16">
                          <div className="flex flex-col items-center justify-center gap-3">
                            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-outline font-semibold">Cargando inventario desde Firebase...</span>
                          </div>
                        </td>
                      </tr>
                    ) : equipos.length === 0 ? (
                      <tr>
                        <td colSpan="9" className="text-center py-16 bg-surface-container-low/30">
                          <div className="flex flex-col items-center justify-center gap-3 max-w-md mx-auto">
                            <span className="material-symbols-outlined text-[48px] text-outline">devices_off</span>
                            <p className="font-bold text-label-lg text-on-surface">No hay equipos registrados en la base de datos</p>
                            <p className="text-outline text-body-sm">
                              Puedes registrar tu primer equipo individualmente o cargar los datos de prueba iniciales para validar el sistema.
                            </p>
                            <div className="flex items-center gap-3 mt-2">
                              <button
                                onClick={handleSeedDemoData}
                                disabled={isProcessing}
                                className="px-space-lg py-2 bg-secondary text-on-secondary rounded-lg font-label-md font-semibold hover:bg-secondary/90 transition-colors flex items-center gap-1 shadow-sm cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                                Cargar 5 Activos Demo CASALIMPIA
                              </button>
                              <button
                                onClick={() => navigate('/registrar-equipo')}
                                className="px-space-lg py-2 bg-primary text-on-primary rounded-lg font-label-md font-semibold hover:bg-primary-container transition-colors flex items-center gap-1 shadow-sm cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[18px]">add</span>
                                Registrar Manualmente
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : filteredEquipos.length === 0 ? (
                      <tr>
                        <td colSpan="9" className="text-center py-12 bg-surface-container-low/20">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <span className="material-symbols-outlined text-[36px] text-outline">search_off</span>
                            <p className="font-bold text-on-surface">No se encontraron equipos con los filtros aplicados</p>
                            <button
                              onClick={handleResetFilters}
                              className="text-primary hover:underline font-label-sm mt-1 cursor-pointer"
                            >
                              Restablecer todos los filtros
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      paginatedEquipos.map((equipo) => {
                        const isSelected = selectedIds.includes(equipo.id);
                        return (
                          <tr key={equipo.id} className={`hover:bg-surface-container transition-colors group ${isSelected ? 'bg-primary-container/10' : ''}`}>
                            <td className="py-space-md px-space-md text-center">
                              <input
                                className="asset-checkbox w-4 h-4 rounded text-primary cursor-pointer accent-primary"
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleSelectOne(equipo.id)}
                              />
                            </td>
                            <td className="py-space-md px-space-md">
                              <div className="flex items-center gap-space-xs">
                                <span className="font-code-mono text-code-mono font-bold text-primary bg-surface-container px-space-xs py-0.5 rounded">
                                  {equipo.placa}
                                </span>
                              </div>
                            </td>
                            <td className="py-space-md px-space-lg">
                              <div className="flex items-center gap-space-md min-w-0">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${equipo.estado === 'MANTENIMIENTO' || equipo.estado === 'REVISION' ? 'bg-error-container text-error' : 'bg-surface-container text-primary'
                                  }`}>
                                  <span className="material-symbols-outlined text-[20px]">devices</span>
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="font-label-md text-label-md text-on-surface font-bold truncate">
                                    {equipo.equipo_nombre}
                                  </span>
                                  <span className="font-body-sm text-body-sm text-outline truncate max-w-xs">
                                    {equipo.equipo_specs}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="py-space-md px-space-md">
                              <span className="font-code-mono text-code-mono text-on-surface-variant font-medium select-all">
                                {equipo.serial}
                              </span>
                            </td>
                            <td className="py-space-md px-space-md">
                              <span className="font-body-sm text-body-sm text-on-surface-variant">
                                {equipo.categoria}
                              </span>
                            </td>
                            <td className="py-space-md px-space-md">
                              <span className={`inline-flex items-center gap-1.5 px-space-sm py-0.5 rounded-full font-label-sm text-label-sm font-bold ${equipo.estado === 'DISPONIBLE' ? 'bg-secondary-container text-on-secondary-container' :
                                  equipo.estado === 'MANTENIMIENTO' || equipo.estado === 'REVISION' ? 'bg-error-container text-error' :
                                    equipo.estado === 'BAJA' ? 'bg-surface-container-highest text-outline' :
                                      'bg-primary-fixed text-on-primary-fixed'
                                }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${equipo.estado === 'DISPONIBLE' ? 'bg-secondary' :
                                    equipo.estado === 'MANTENIMIENTO' || equipo.estado === 'REVISION' ? 'bg-error' :
                                      equipo.estado === 'BAJA' ? 'bg-outline' :
                                        'bg-primary'
                                  }`}></span>
                                {equipo.estado || 'DISPONIBLE'}
                              </span>
                            </td>
                            <td className="py-space-md px-space-lg">
                              <div className="flex flex-col">
                                <span className={`font-label-md text-label-md ${equipo.estado === 'MANTENIMIENTO' ? 'text-error' : 'text-on-surface font-semibold'
                                  }`}>
                                  {equipo.asignatario || 'Sin asignar'}
                                </span>
                                <span className={`font-body-sm text-body-sm ${equipo.estado === 'MANTENIMIENTO' ? 'text-error font-medium' : 'text-outline'
                                  }`}>
                                  {equipo.ubicacion || 'Bodega Principal'}
                                </span>
                              </div>
                            </td>
                            <td className="py-space-md px-space-md">
                              <div className="flex flex-col">
                                <span className="font-code-mono text-code-mono text-on-surface">
                                  {equipo.ultimo_movimiento || 'Alta Sistema'}
                                </span>
                              </div>
                            </td>
                            <td className="py-space-md px-space-md text-right pr-space-lg">
                              <div className="flex items-center justify-end gap-1 opacity-90 group-hover:opacity-100">
                                {/* Botón Ver Detalle */}
                                <button
                                  onClick={() => setSelectedAssetForDetail(equipo)}
                                  className="p-1.5 rounded-md hover:bg-surface-container-high text-primary transition-colors cursor-pointer"
                                  title="Ver ficha rápida"
                                >
                                  <span className="material-symbols-outlined text-[18px]">visibility</span>
                                </button>
                                {/* Botón Editar */}
                                <button
                                  onClick={() => setAssetToEdit(equipo)}
                                  className="p-1.5 rounded-md hover:bg-surface-container-high text-outline hover:text-on-surface transition-colors cursor-pointer"
                                  title="Editar activo"
                                >
                                  <span className="material-symbols-outlined text-[18px]">edit</span>
                                </button>
                                {/* Botón Eliminar */}
                                <button
                                  onClick={() => handleDeleteOne(equipo)}
                                  className="p-1.5 rounded-md hover:bg-error-container text-outline hover:text-error transition-colors cursor-pointer"
                                  title="Eliminar activo"
                                >
                                  <span className="material-symbols-outlined text-[18px]">delete</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* PAGINACIÓN DINÁMICA */}
              <div className="p-space-lg bg-surface-container-low flex flex-col sm:flex-row items-center justify-between gap-space-md border-t border-surface-container">
                <div className="flex items-center gap-space-lg text-outline font-body-sm text-body-sm">
                  <div className="flex items-center gap-space-xs">
                    <span>Filas por página:</span>
                    <select
                      className="bg-surface-container-lowest text-on-surface font-semibold rounded-lg px-2 py-1 text-body-sm focus:outline-none focus:ring-1 focus:ring-primary shadow-sm cursor-pointer"
                      id="items-per-page"
                      value={itemsPerPage}
                      onChange={(e) => {
                        setItemsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                    </select>
                  </div>
                  <span className="text-on-surface-variant">
                    Página <strong className="text-on-surface">{currentPage}</strong> de <strong>{totalPages}</strong>
                  </span>
                </div>

                {/* Botones de Navegación de Página */}
                <div className="flex items-center gap-space-xs">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="w-8 h-8 rounded-lg bg-surface-container-lowest text-outline hover:bg-surface-container-high hover:text-on-surface flex items-center justify-center transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    title="Primera página"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[18px]">first_page</span>
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="w-8 h-8 rounded-lg bg-surface-container-lowest text-outline hover:bg-surface-container-high hover:text-on-surface flex items-center justify-center transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    title="Página anterior"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                  </button>

                  <span className="w-8 h-8 rounded-lg bg-primary text-on-primary font-bold text-body-sm flex items-center justify-center shadow-sm">
                    {currentPage}
                  </span>

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="w-8 h-8 rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container-high flex items-center justify-center transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    title="Página siguiente"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="w-8 h-8 rounded-lg bg-surface-container-lowest text-outline hover:bg-surface-container-high hover:text-on-surface flex items-center justify-center transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    title="Última página"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[18px]">last_page</span>
                  </button>
                </div>
              </div>
            </div>

            {/* BARRA OPERACIONAL INFERIOR */}
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
                  <span className="font-label-md text-label-md text-on-surface font-bold">Sincronización Cloud Firestore</span>
                  <span className="font-body-sm text-body-sm text-outline">Transmisión de datos cifrada y sincronizada en tiempo real.</span>
                </div>
              </div>
            </div>

          </div>
        </main>

        {/* FOOTER */}
        <footer className="w-full bg-surface-container-lowest shadow-[0_-1px_4px_rgba(0,0,0,0.02)] py-space-md px-gutter-lg">
          <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-space-xs text-outline">
            <span className="font-body-sm text-body-sm">CASALIMPIA S.A - Tecnológico de Antioquia PPI 2026</span>
            <div className="flex items-center gap-space-md font-code-mono text-code-mono text-outline-variant">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-secondary"></span>
                Base de Datos Firestore Conectada
              </span>
              <span>v2.5.0</span>
            </div>
          </div>
        </footer>
      </div>

      {/* PANEL LATERAL SLIDE-OVER: FICHA RÁPIDA DE ACTIVO (Dinámico) */}
      {selectedAssetForDetail && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            onClick={() => setSelectedAssetForDetail(null)}
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
          ></div>

          <div className="relative w-full max-w-md bg-surface-container-lowest shadow-2xl z-10 p-space-xl flex flex-col justify-between overflow-y-auto animate-slideLeft">
            <div>
              <div className="flex items-center justify-between pb-space-lg border-b border-surface-container">
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-primary text-[24px]">devices</span>
                  <span className="font-headline-sm text-headline-sm text-on-surface font-bold">Ficha Rápida de Activo</span>
                </div>
                <button
                  onClick={() => setSelectedAssetForDetail(null)}
                  className="w-8 h-8 rounded-lg hover:bg-surface-container flex items-center justify-center text-outline hover:text-on-surface transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="space-y-space-md pt-space-lg">
                <div className="p-space-md bg-surface-container rounded-lg">
                  <span className="font-label-sm text-label-sm text-outline uppercase font-bold">Placa Institucional</span>
                  <p className="font-display-lg text-display-lg font-bold text-primary font-code-mono mt-1">
                    {selectedAssetForDetail.placa}
                  </p>
                </div>

                <div className="space-y-space-xs">
                  <label className="font-label-sm text-label-sm text-outline uppercase font-bold">Modelo y Configuración</label>
                  <p className="font-label-md text-label-md text-on-surface font-semibold">
                    {selectedAssetForDetail.equipo_nombre}
                  </p>
                  <p className="font-body-sm text-body-sm text-outline">
                    {selectedAssetForDetail.equipo_specs || 'Sin especificaciones detalladas'}
                  </p>
                  <div className="pt-1">
                    <span className="font-label-sm text-outline uppercase font-bold">Serial: </span>
                    <span className="font-code-mono text-body-sm font-semibold">{selectedAssetForDetail.serial}</span>
                  </div>
                  <div>
                    <span className="font-label-sm text-outline uppercase font-bold">Categoría: </span>
                    <span className="text-body-sm">{selectedAssetForDetail.categoria}</span>
                  </div>
                </div>

                <div className="space-y-space-xs pt-space-xs">
                  <label className="font-label-sm text-label-sm text-outline uppercase font-bold">Asignación y Ubicación Actual</label>
                  <div className="p-space-md bg-surface-container-low rounded-lg flex items-center gap-space-md">
                    <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-on-primary font-bold font-label-md">
                      {(selectedAssetForDetail.asignatario || 'CL').substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-label-md text-label-md font-bold text-on-surface">
                        {selectedAssetForDetail.asignatario || 'Bodega Centralizada TI'}
                      </span>
                      <span className="font-body-sm text-body-sm text-outline">
                        {selectedAssetForDetail.ubicacion || 'Sede Principal Bogotá'}
                      </span>
                      <span className="font-code-mono text-code-mono text-[11px] text-primary">
                        Estado: {selectedAssetForDetail.estado}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-space-xs pt-space-xs">
                  <label className="font-label-sm text-label-sm text-outline uppercase font-bold">Trazabilidad Operativa</label>
                  <ul className="text-body-sm font-body-sm text-on-surface-variant space-y-2">
                    <li className="flex items-center justify-between py-2 bg-surface-container-low rounded-lg px-3">
                      <span>Último Movimiento</span>
                      <span className="font-code-mono text-primary font-semibold">
                        {selectedAssetForDetail.ultimo_movimiento || 'Alta Sistema RF-02'}
                      </span>
                    </li>
                    <li className="flex items-center justify-between py-2 bg-surface-container-low rounded-lg px-3">
                      <span>Auditoría Legal ISO</span>
                      <span className="font-code-mono text-secondary font-semibold">Vigente 2026</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="pt-space-lg flex items-center gap-space-md border-t border-surface-container mt-4">
              <button
                onClick={() => {
                  setAssetToEdit(selectedAssetForDetail);
                  setSelectedAssetForDetail(null);
                }}
                className="w-full h-10 bg-primary text-on-primary rounded-lg font-label-md text-label-md font-semibold hover:bg-primary-container transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">edit</span>
                Editar este Activo
              </button>
              <button
                onClick={() => exportToCSV([selectedAssetForDetail], `acta_${selectedAssetForDetail.placa}.csv`)}
                className="w-12 h-10 bg-surface-container rounded-lg flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
                title="Descargar Ficha / Acta CSV"
              >
                <span className="material-symbols-outlined text-[20px]">print</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PARA EDITAR EQUIPO */}
      {assetToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setAssetToEdit(null)}
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
          ></div>
          <div className="relative w-full max-w-lg bg-surface-container-lowest rounded-2xl shadow-2xl p-6 z-10 overflow-hidden">
            <div className="flex items-center justify-between pb-4 border-b border-surface-container mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[24px]">edit_note</span>
                <h2 className="font-headline-sm font-bold text-on-surface">Editar Activo TI</h2>
              </div>
              <button
                onClick={() => setAssetToEdit(null)}
                className="p-1 rounded-lg hover:bg-surface-container text-outline hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-label-sm font-bold text-outline uppercase mb-1">Placa / Código</label>
                  <input
                    type="text"
                    required
                    className="w-full h-9 px-3 bg-surface-container-low rounded-lg font-code-mono text-body-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    value={assetToEdit.placa || ''}
                    onChange={(e) => setAssetToEdit({ ...assetToEdit, placa: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-label-sm font-bold text-outline uppercase mb-1">Número Serial</label>
                  <input
                    type="text"
                    required
                    className="w-full h-9 px-3 bg-surface-container-low rounded-lg font-code-mono text-body-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    value={assetToEdit.serial || ''}
                    onChange={(e) => setAssetToEdit({ ...assetToEdit, serial: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-label-sm font-bold text-outline uppercase mb-1">Nombre / Modelo de Equipo</label>
                <input
                  type="text"
                  required
                  className="w-full h-9 px-3 bg-surface-container-low rounded-lg text-body-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  value={assetToEdit.equipo_nombre || ''}
                  onChange={(e) => setAssetToEdit({ ...assetToEdit, equipo_nombre: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-label-sm font-bold text-outline uppercase mb-1">Especificaciones Técnicas</label>
                <textarea
                  rows={2}
                  className="w-full p-2 bg-surface-container-low rounded-lg text-body-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  value={assetToEdit.equipo_specs || ''}
                  onChange={(e) => setAssetToEdit({ ...assetToEdit, equipo_specs: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-label-sm font-bold text-outline uppercase mb-1">Categoría</label>
                  <select
                    className="w-full h-9 px-3 bg-surface-container-low rounded-lg text-body-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    value={assetToEdit.categoria || 'Laptops Corporativas'}
                    onChange={(e) => setAssetToEdit({ ...assetToEdit, categoria: e.target.value })}
                  >
                    <option value="Laptops Corporativas">Laptops Corporativas</option>
                    <option value="Estaciones de Escritorio">Estaciones de Escritorio</option>
                    <option value="Monitores y Displays">Monitores y Displays</option>
                    <option value="Servidores y Racks">Servidores y Racks</option>
                    <option value="Telefonía IP">Telefonía IP</option>
                    <option value="Periféricos y Docks">Periféricos y Docks</option>
                  </select>
                </div>
                <div>
                  <label className="block text-label-sm font-bold text-outline uppercase mb-1">Estado</label>
                  <select
                    className="w-full h-9 px-3 bg-surface-container-low rounded-lg text-body-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    value={assetToEdit.estado || 'DISPONIBLE'}
                    onChange={(e) => setAssetToEdit({ ...assetToEdit, estado: e.target.value })}
                  >
                    <option value="DISPONIBLE">DISPONIBLE</option>
                    <option value="ASIGNADO">ASIGNADO</option>
                    <option value="MANTENIMIENTO">MANTENIMIENTO</option>
                    <option value="REVISION">REVISION</option>
                    <option value="BAJA">BAJA</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-label-sm font-bold text-outline uppercase mb-1">Asignatario</label>
                  <input
                    type="text"
                    className="w-full h-9 px-3 bg-surface-container-low rounded-lg text-body-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    value={assetToEdit.asignatario || ''}
                    onChange={(e) => setAssetToEdit({ ...assetToEdit, asignatario: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-label-sm font-bold text-outline uppercase mb-1">Ubicación / Sede</label>
                  <input
                    type="text"
                    className="w-full h-9 px-3 bg-surface-container-low rounded-lg text-body-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    value={assetToEdit.ubicacion || ''}
                    onChange={(e) => setAssetToEdit({ ...assetToEdit, ubicacion: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-container">
                <button
                  type="button"
                  onClick={() => setAssetToEdit(null)}
                  className="px-4 py-2 rounded-lg bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors font-label-md cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-5 py-2 rounded-lg bg-primary text-on-primary font-bold hover:bg-primary-container transition-colors shadow-md flex items-center gap-2 cursor-pointer"
                >
                  {isProcessing ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PARA IMPORTAR LOTE (CSV) */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setShowImportModal(false)}
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
          ></div>
          <div className="relative w-full max-w-xl bg-surface-container-lowest rounded-2xl shadow-2xl p-6 z-10">
            <div className="flex items-center justify-between pb-4 border-b border-surface-container mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[24px]">upload_file</span>
                <h2 className="font-headline-sm font-bold text-on-surface">Importar Lote de Activos (CSV)</h2>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="p-1 rounded-lg hover:bg-surface-container text-outline hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-body-sm text-outline">
                Selecciona un archivo <strong>.csv</strong> con las columnas:
                <code className="text-primary text-[11px] block mt-1 bg-surface-container p-1 rounded font-code-mono">
                  Placa, Equipo, Especificaciones, Serial, Categoría, Estado, Asignatario, Ubicación
                </code>
              </p>

              <div className="border-2 border-dashed border-surface-container-highest rounded-xl p-6 text-center hover:bg-surface-container-low transition-colors">
                <input
                  type="file"
                  accept=".csv,.txt"
                  id="csv-file-input"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <label htmlFor="csv-file-input" className="cursor-pointer flex flex-col items-center gap-2">
                  <span className="material-symbols-outlined text-[36px] text-primary">cloud_upload</span>
                  <span className="font-label-md font-bold text-on-surface">Haz clic aquí para seleccionar tu archivo CSV</span>
                  <span className="text-body-sm text-outline">o arrastra y suelta tu archivo aquí</span>
                </label>
              </div>

              {parsedImportAssets.length > 0 && (
                <div className="p-3 bg-surface-container rounded-lg">
                  <span className="font-label-md font-bold text-primary flex items-center gap-1">
                    <span className="material-symbols-outlined text-[18px]">verified</span>
                    {parsedImportAssets.length} registros listos para ingresar a Firestore
                  </span>
                  <div className="max-h-36 overflow-y-auto mt-2 space-y-1 text-[12px] font-code-mono">
                    {parsedImportAssets.slice(0, 4).map((item, idx) => (
                      <div key={idx} className="p-1 bg-surface-container-lowest rounded flex justify-between">
                        <span>{item.placa} - {item.equipo_nombre}</span>
                        <span className="text-outline">{item.serial}</span>
                      </div>
                    ))}
                    {parsedImportAssets.length > 4 && (
                      <p className="text-center text-outline text-[11px] pt-1">... y {parsedImportAssets.length - 4} equipos más</p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-container">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 rounded-lg bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors font-label-md cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={parsedImportAssets.length === 0 || isProcessing}
                  onClick={handleConfirmImport}
                  className="px-5 py-2 rounded-lg bg-primary text-on-primary font-bold hover:bg-primary-container transition-colors shadow-md disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
                >
                  {isProcessing ? 'Importando...' : `Confirmar e Importar (${parsedImportAssets.length})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
