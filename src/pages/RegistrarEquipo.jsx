import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, limit, onSnapshot, writeBatch, doc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { getStoredUser } from '../utils/userHelpers';
import Sidebar from '../components/Sidebar';
import { exportToCSV } from '../utils/assetHelpers';

const LAST_HARDWARE_KEY = 'rf02_last_hardware_payload';
const REGIONES_UBICACION = ['Regional Medellin', 'Regional Bogota', 'Regional Barranquilla', 'Regional Pereira'];

const normalizeHeader = (value = '') => value
  .toString()
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '_');

const detectDelimiter = (line) => {
  const commaCount = (line.match(/,/g) || []).length;
  const tabCount = (line.match(/\t/g) || []).length;
  const semicolonCount = (line.match(/;/g) || []).length;

  if (tabCount >= commaCount && tabCount >= semicolonCount) {
    return '\t';
  }
  if (semicolonCount > commaCount) {
    return ';';
  }
  return ',';
};

const splitDelimitedLine = (line, delimiter) => {
  const cols = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === delimiter && !inQuotes) {
      cols.push(current.trim());
      current = '';
      continue;
    }

    current += ch;
  }

  cols.push(current.trim());
  return cols;
};

const parseTemplateCSV = (text) => {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
  if (lines.length < 2) {
    return [];
  }

  const cleanHeaderLine = lines[0].replace(/^\uFEFF/, '');
  const delimiter = detectDelimiter(cleanHeaderLine);
  const headers = splitDelimitedLine(cleanHeaderLine, delimiter).map(normalizeHeader);
  const findIndex = (aliases) => headers.findIndex((header) => aliases.includes(header));

  const idxPlaca = findIndex(['placa']);
  const idxEquipo = findIndex(['equipo', 'equipo_nombre']);
  const idxSpecs = findIndex(['especificaciones', 'equipo_specs']);
  const idxSerial = findIndex(['serial']);
  const idxCategoria = findIndex(['categoria']);
  const idxEstado = findIndex(['estado']);
  const idxUbicacion = findIndex(['ubicacion']);

  const requiredIndexes = [idxPlaca, idxEquipo, idxSpecs, idxSerial];
  if (requiredIndexes.some((idx) => idx === -1)) {
    return [];
  }

  const parsed = [];

  for (let i = 1; i < lines.length; i++) {
    const row = splitDelimitedLine(lines[i], delimiter);

    const placa = (row[idxPlaca] || '').trim();
    const equipo_nombre = (row[idxEquipo] || '').trim();
    const equipo_specs = (row[idxSpecs] || '').trim();
    const serial = (row[idxSerial] || '').trim();
    const categoria = (row[idxCategoria] || 'Laptops Corporativas').trim();
    const estado = (row[idxEstado] || 'DISPONIBLE').trim().toUpperCase();
    const ubicacion = (row[idxUbicacion] || 'Regional Medellin').trim();

    if (!placa || !equipo_nombre || !equipo_specs || !serial) {
      continue;
    }

    parsed.push({
      placa,
      equipo_nombre,
      equipo_specs,
      serial,
      categoria,
      estado,
      ubicacion,
      asignatario: 'Bodega Centralizada TI',
      ultimo_movimiento: 'Importacion Lote RF-02'
    });
  }

  return parsed;
};

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
  const [successMsg, setSuccessMsg] = useState('');
  const [historyItems, setHistoryItems] = useState([]);
  const [isImporting, setIsImporting] = useState(false);

  // States
  const [placa, setPlaca] = useState('');
  const [equipoNombre, setEquipoNombre] = useState('');
  const [equipoSpecs, setEquipoSpecs] = useState('');
  const [serial, setSerial] = useState('');
  const [categoria, setCategoria] = useState('Laptops Corporativas');
  const [estado, setEstado] = useState('DISPONIBLE');
  const [ubicacion, setUbicacion] = useState('Regional Medellin');

  const runBatchedImport = async (assets) => {
    const chunkSize = 400;

    for (let i = 0; i < assets.length; i += chunkSize) {
      const chunk = assets.slice(i, i + chunkSize);
      const batch = writeBatch(db);

      chunk.forEach((asset) => {
        const ref = doc(collection(db, 'equipos'));
        batch.set(ref, {
          ...asset,
          registrado_por: {
            id: currentUser?.id || 'N/A',
            nombre: currentUser?.nombre || 'Administrador TI',
            email: currentUser?.email || 'N/A'
          },
          createdAt: serverTimestamp()
        });
      });

      await batch.commit();
    }
  };

  const handleTemplateDownload = () => {
    const csvTemplate = [
      'Placa,Equipo,Especificaciones,Serial,Categoria,Estado,Ubicacion',
      'CL-TI-2001,Lenovo ThinkPad T14s Gen 3,"Intel Core i7 12th Gen - 16GB RAM DDR4 - SSD 512GB NVMe",5CD23489LX,Laptops Corporativas,DISPONIBLE,Regional Medellin'
    ].join('\r\n');

    const blob = new Blob(['\uFEFF' + csvTemplate], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'plantilla_registro_equipos_rf02.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportReport = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'equipos'));
      const rows = snapshot.docs.map((item) => {
        const data = item.data();
        return {
          placa: data.placa || '',
          serial: data.serial || '',
          equipo_nombre: data.equipo_nombre || '',
          equipo_specs: data.equipo_specs || '',
          categoria: data.categoria || '',
          estado: data.estado || '',
          ubicacion: data.ubicacion || '',
          asignatario: data.asignatario || '',
          ultimo_movimiento: data.ultimo_movimiento || '',
          registrado_por: data.registrado_por?.nombre || ''
        };
      });

      if (rows.length === 0) {
        setErrorMsg('No hay equipos para exportar.');
        return;
      }

      exportToCSV(rows, 'reporte_activos_rf08.csv');
    } catch (error) {
      setErrorMsg('Error exportando reporte: ' + error.message);
    }
  };

  const handleImportTemplate = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');

    try {
      setIsImporting(true);
      const fileText = await file.text();
      const parsedAssets = parseTemplateCSV(fileText).map((asset) => ({
        ...asset,
        ubicacion: REGIONES_UBICACION.includes(asset.ubicacion) ? asset.ubicacion : 'Regional Medellin'
      }));

      if (parsedAssets.length === 0) {
        setErrorMsg('La plantilla no tiene filas validas. Verifica columnas y datos requeridos.');
        return;
      }

      await runBatchedImport(parsedAssets);
      setSuccessMsg(`Importacion exitosa: ${parsedAssets.length} equipos registrados desde plantilla.`);
    } catch (error) {
      setErrorMsg('Error importando plantilla: ' + error.message);
    } finally {
      event.target.value = '';
      setIsImporting(false);
    }
  };

  useEffect(() => {
    const lastPayload = localStorage.getItem(LAST_HARDWARE_KEY);
    if (!lastPayload) {
      return;
    }

    try {
      const parsed = JSON.parse(lastPayload);
      if (parsed?.equipoNombre) {
        setEquipoNombre(parsed.equipoNombre);
      }
      if (parsed?.equipoSpecs) {
        setEquipoSpecs(parsed.equipoSpecs);
      }
    } catch (error) {
      console.warn('No se pudo recuperar el ultimo hardware usado en RF-02', error);
    }
  }, []);

  useEffect(() => {
    const equiposRef = collection(db, 'equipos');
    const equiposQuery = query(equiposRef, orderBy('createdAt', 'desc'), limit(20));

    const unsubscribe = onSnapshot(equiposQuery, (snapshot) => {
      const items = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));
      setHistoryItems(items);
    }, (error) => {
      console.error('Error cargando historial de registros RF-02:', error);
    });

    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await addDoc(collection(db, 'equipos'), {
        placa,
        equipo_nombre: equipoNombre,
        equipo_specs: equipoSpecs,
        serial,
        categoria,
        estado,
        asignatario: 'Bodega Centralizada TI',
        ubicacion,
        ultimo_movimiento: 'Alta Sistema RF-02',
        registrado_por: {
          id: currentUser?.id || 'N/A',
          nombre: currentUser?.nombre || 'Administrador TI',
          email: currentUser?.email || 'N/A'
        },
        createdAt: serverTimestamp()
      });

      localStorage.setItem(LAST_HARDWARE_KEY, JSON.stringify({
        equipoNombre,
        equipoSpecs
      }));

      setPlaca('');
      setSerial('');
      setEstado('DISPONIBLE');
      setUbicacion('Regional Medellin');
      setSuccessMsg('Equipo registrado correctamente. Puedes continuar con el siguiente registro en lote.');
      setLoading(false);
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

              <div className="flex flex-wrap items-center gap-space-sm shrink-0">
                <input
                  id="rf02-import-template-input"
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleImportTemplate}
                  disabled={isImporting}
                />
                <button
                  type="button"
                  onClick={() => document.getElementById('rf02-import-template-input')?.click()}
                  className="flex items-center gap-space-xs px-space-md h-9 bg-surface-container-lowest text-on-surface rounded-lg font-label-md text-label-md shadow-sm hover:bg-surface-container-high transition-colors"
                  disabled={isImporting}
                >
                  <span className="material-symbols-outlined text-[18px] text-primary">upload_file</span>
                  <span>{isImporting ? 'Importando...' : 'Importar Lote (CSV)'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportReport}
                  className="flex items-center gap-space-xs px-space-md h-9 bg-surface-container-lowest text-on-surface rounded-lg font-label-md text-label-md shadow-sm hover:bg-surface-container-high transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px] text-secondary">table_chart</span>
                  <span>Exportar Reporte (RF-08)</span>
                </button>
                <button
                  type="button"
                  onClick={handleTemplateDownload}
                  className="flex items-center gap-space-xs px-space-md h-9 bg-primary text-on-primary rounded-lg font-label-md text-label-md shadow-sm hover:bg-primary-container hover:text-on-primary-container transition-all"
                >
                  <span className="material-symbols-outlined text-[18px]">download</span>
                  <span>Descargar Plantilla (Excel CSV)</span>
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="bg-error-container text-on-error-container p-space-md rounded-lg mb-space-lg flex items-center gap-space-md shadow-sm">
                <span className="material-symbols-outlined">warning</span>
                <span className="font-body-md">{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="bg-primary-container text-on-primary-container p-space-md rounded-lg mb-space-lg flex items-center gap-space-md shadow-sm">
                <span className="material-symbols-outlined">check_circle</span>
                <span className="font-body-md">{successMsg}</span>
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
                    <label className="font-label-sm text-label-sm uppercase text-outline font-bold">Ubicación Física</label>
                    <div className="relative">
                      <select value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} className="w-full h-11 px-space-md appearance-none bg-surface-container-low text-on-surface rounded-lg font-body-sm focus:outline-none focus:ring-1 focus:ring-primary shadow-sm cursor-pointer pr-8">
                        {REGIONES_UBICACION.map((region) => (
                          <option key={region} value={region}>{region}</option>
                        ))}
                      </select>
                      <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline text-[18px] pointer-events-none">expand_more</span>
                    </div>
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

            <section className="mt-space-xl bg-surface-container-lowest p-space-lg rounded-xl shadow-sm">
              <div className="flex items-center gap-space-sm mb-space-md pb-space-sm border-b border-surface-container-highest">
                <span className="material-symbols-outlined text-primary text-[20px]">history</span>
                <h2 className="font-headline-sm text-body-lg text-primary font-bold">Historial reciente de registros RF-02</h2>
              </div>

              {historyItems.length === 0 ? (
                <p className="text-on-surface-variant font-body-sm">Aun no hay registros para mostrar.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left border-separate border-spacing-y-2">
                    <thead>
                      <tr className="text-outline text-label-sm uppercase">
                        <th className="py-2 px-3">Placa</th>
                        <th className="py-2 px-3">Serial</th>
                        <th className="py-2 px-3">Modelo</th>
                        <th className="py-2 px-3">Estado</th>
                        <th className="py-2 px-3">Ubicacion</th>
                        <th className="py-2 px-3">Registrado por</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyItems.map((item) => (
                        <tr key={item.id} className="bg-surface-container-low rounded-lg text-on-surface">
                          <td className="py-2 px-3 font-label-sm">{item.placa || 'N/A'}</td>
                          <td className="py-2 px-3 font-body-sm">{item.serial || 'N/A'}</td>
                          <td className="py-2 px-3 font-body-sm">{item.equipo_nombre || 'N/A'}</td>
                          <td className="py-2 px-3 font-body-sm">{item.estado || 'N/A'}</td>
                          <td className="py-2 px-3 font-body-sm">{item.ubicacion || 'N/A'}</td>
                          <td className="py-2 px-3 font-body-sm">{item.registrado_por?.nombre || 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

          </div>
        </main>
      </div>
    </div>
  );
}
