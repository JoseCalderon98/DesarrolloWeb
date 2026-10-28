import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { collection, onSnapshot, query, orderBy, limit, addDoc, doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../firebase';
import { getStoredUser, initialPPIMembers } from '../utils/userHelpers';
import { formatCurrencyCOP, calculateDepreciation } from '../utils/assetHelpers';
import { generateAndPrintActaTraslado } from '../utils/actaPrintService';
import Sidebar from '../components/Sidebar';

const REGIONALES = [
  'Regional Medellin',
  'Regional Bogota',
  'Regional Barranquilla',
  'Regional Pereira'
];

const EMPRESAS_TRANSPORTE = [
  'Envío Interno CASALIMPIA',
  'Coordinadora Mercantil',
  'Servientrega S.A.',
  'Envía Colvanes',
  'Interrapidísimo',
  'Transporte Terrestre Especial'
];

const MOTIVOS_TRASLADO = [
  'Reubicación por Reasignación de Puesto de Trabajo',
  'Envío a Mantenimiento Especializado en Sede Principal',
  'Apertura / Soporte Temporal de Nueva Sede',
  'Transferencia por Cierre / Liquidación de Proyecto',
  'Préstamo Temporal Inter-Sedes',
  'Otro Requerimiento Operativo'
];

export default function Traslados() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentUser = getStoredUser();

  // Redirigir a empleados (Solo TI/Admin tiene permiso de traslado)
  useEffect(() => {
    if (currentUser?.rol === 'Empleado') {
      navigate('/inventario', { replace: true });
    }
  }, [currentUser, navigate]);

  const [equipos, setEquipos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [selectedReceptorUser, setSelectedReceptorUser] = useState(null);
  const [searchUserTerm, setSearchUserTerm] = useState('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const userDropdownRef = useRef(null);
  const [customReceptor, setCustomReceptor] = useState(false);
  const [historialTraslados, setHistorialTraslados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [lastTrasladoData, setLastTrasladoData] = useState(null);

  // Selector y búsqueda de equipo
  const [searchTerm, setSearchTerm] = useState(searchParams.get('placa') || '');
  const [selectedEquipo, setSelectedEquipo] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);

  // Campos del formulario
  const [regionalDestino, setRegionalDestino] = useState('Regional Bogota');
  const [nuevaUbicacion, setNuevaUbicacion] = useState('');
  const [motivo, setMotivo] = useState(MOTIVOS_TRASLADO[0]);
  const [motivoDetalle, setMotivoDetalle] = useState('');
  const [empresaTransporte, setEmpresaTransporte] = useState(EMPRESAS_TRANSPORTE[0]);
  const [guiaTransporte, setGuiaTransporte] = useState('');
  const [funcionarioReceptorNombre, setFuncionarioReceptorNombre] = useState('');
  const [funcionarioReceptorCargo, setFuncionarioReceptorCargo] = useState('Líder de Soporte TI Regional');
  const [funcionarioReceptorEmail, setFuncionarioReceptorEmail] = useState('');
  const [condicionFisica, setCondicionFisica] = useState('10/10 Excelente Estado');
  const [observaciones, setObservaciones] = useState('');

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  // 1. Cargar equipos para autocompletado
  useEffect(() => {
    const q = query(collection(db, 'equipos'));
    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setEquipos(list);
      setLoading(false);

      // Pre-seleccionar si viene por URL
      const paramPlaca = searchParams.get('placa');
      if (paramPlaca) {
        const found = list.find(e => String(e.placa || '').toLowerCase() === paramPlaca.toLowerCase());
        if (found) {
          setSelectedEquipo(found);
          setSearchTerm(found.placa);
          // Ajustar destino por defecto diferente a su origen
          const origen = found.ubicacion || 'Regional Medellin';
          const defaultDest = REGIONALES.find(r => r !== origen) || 'Regional Bogota';
          setRegionalDestino(defaultDest);
        }
      }
    }, (err) => {
      console.error('Error cargando equipos:', err);
      setErrorMsg('No se pudieron sincronizar los equipos de Firestore: ' + err.message);
      setLoading(false);
    });

    return () => unsub();
  }, [searchParams]);

  // 2. Cargar historial reciente de traslados
  useEffect(() => {
    const qTraslados = query(collection(db, 'actas_traslado'), orderBy('createdAt', 'desc'), limit(15));
    const unsubT = onSnapshot(qTraslados, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setHistorialTraslados(list);
    }, (err) => {
      console.warn('Colección actas_traslado aún sin indexar o vacía:', err);
    });

    return () => unsubT();
  }, []);

  // Cerrar dropdown predictivo al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target)) {
        setShowUserDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 3. Cargar usuarios registrados del sistema para receptor
  useEffect(() => {
    const qUsuarios = query(collection(db, 'usuarios'));
    const unsubU = onSnapshot(qUsuarios, (snapshot) => {
      const firestoreList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      const mapByEmail = new Map();
      initialPPIMembers.forEach(u => mapByEmail.set(u.email.toLowerCase(), u));
      firestoreList.forEach(u => {
        if (u.email) {
          mapByEmail.set(u.email.toLowerCase(), { ...mapByEmail.get(u.email.toLowerCase()), ...u });
        }
      });
      const merged = Array.from(mapByEmail.values());
      setUsuarios(merged);

      // Auto-seleccionar funcionario receptor (priorizando los de la regional destino)
      if (merged.length > 0) {
        const cityKey = regionalDestino.replace('Regional', '').trim().toLowerCase();
        const matchRegional = merged.find(u => 
          ((u.sede && u.sede.toLowerCase().includes(cityKey)) ||
           (u.regional && u.regional.toLowerCase().includes(cityKey))) &&
          u.email.toLowerCase() !== (currentUser?.email || '').toLowerCase()
        );
        const found = matchRegional || merged.find(u => u.email.toLowerCase() !== (currentUser?.email || '').toLowerCase()) || merged[0];
        setSelectedReceptorUser(found);
        setSearchUserTerm(found.nombre || '');
        setFuncionarioReceptorNombre(found.nombre || '');
        setFuncionarioReceptorCargo(found.cargo || found.rol || 'Funcionario SGI');
        setFuncionarioReceptorEmail(found.email || '');
      }
    }, (err) => {
      console.warn('Error leyendo usuarios de Firestore, usando usuarios institucionales:', err);
      setUsuarios(initialPPIMembers);
      const cityKey = regionalDestino.replace('Regional', '').trim().toLowerCase();
      const matchRegional = initialPPIMembers.find(u => 
        ((u.sede && u.sede.toLowerCase().includes(cityKey)) ||
         (u.regional && u.regional.toLowerCase().includes(cityKey))) &&
        u.email.toLowerCase() !== (currentUser?.email || '').toLowerCase()
      );
      const found = matchRegional || initialPPIMembers.find(u => u.email.toLowerCase() !== (currentUser?.email || '').toLowerCase()) || initialPPIMembers[0];
      setSelectedReceptorUser(found);
      setSearchUserTerm(found.nombre || '');
      setFuncionarioReceptorNombre(found.nombre || '');
      setFuncionarioReceptorCargo(found.cargo || found.rol || 'Funcionario SGI');
      setFuncionarioReceptorEmail(found.email || '');
    });

    return () => unsubU();
  }, [currentUser?.email, regionalDestino]);

  const handleSelectReceptor = (userOrSpecial) => {
    if (userOrSpecial === 'CUSTOM') {
      setCustomReceptor(true);
      setSelectedReceptorUser(null);
      setSearchUserTerm('');
      setFuncionarioReceptorNombre('');
      setFuncionarioReceptorCargo('Líder de Soporte TI Regional');
      setFuncionarioReceptorEmail('');
      setShowUserDropdown(false);
      return;
    }
    setCustomReceptor(false);
    const user = (typeof userOrSpecial === 'object' && userOrSpecial !== null)
      ? userOrSpecial
      : usuarios.find(u => (u.id && u.id === userOrSpecial) || u.email === userOrSpecial);

    if (user) {
      setSelectedReceptorUser(user);
      setSearchUserTerm(user.nombre || '');
      setFuncionarioReceptorNombre(user.nombre || '');
      setFuncionarioReceptorCargo(user.cargo || user.rol || 'Funcionario SGI');
      setFuncionarioReceptorEmail(user.email || '');
      setShowUserDropdown(false);
    }
  };

  // Manejar cambio de regional destino y auto-vincular receptor si hay usuario en esa sede
  const handleRegionalDestinoChange = (newDestino) => {
    setRegionalDestino(newDestino);
    if (!customReceptor && usuarios.length > 0) {
      const cityKey = newDestino.replace('Regional', '').trim().toLowerCase();
      const match = usuarios.find(u => 
        ((u.sede && u.sede.toLowerCase().includes(cityKey)) ||
         (u.regional && u.regional.toLowerCase().includes(cityKey))) &&
        u.email.toLowerCase() !== (currentUser?.email || '').toLowerCase()
      );
      if (match) {
        handleSelectReceptor(match);
      }
    }
  };

  // Filtrado reactivo de usuarios a medida que se escribe
  const filteredUsuariosSearch = useMemo(() => {
    const q = searchUserTerm.toLowerCase().trim();
    if (!q) {
      const cityKey = regionalDestino.replace('Regional', '').trim().toLowerCase();
      return [...usuarios].sort((a, b) => {
        const aMatch = (a.sede && a.sede.toLowerCase().includes(cityKey)) || (a.regional && a.regional.toLowerCase().includes(cityKey)) ? -1 : 1;
        const bMatch = (b.sede && b.sede.toLowerCase().includes(cityKey)) || (b.regional && b.regional.toLowerCase().includes(cityKey)) ? -1 : 1;
        return aMatch - bMatch;
      }).slice(0, 6);
    }
    return usuarios.filter(u =>
      String(u.nombre || '').toLowerCase().includes(q) ||
      String(u.email || '').toLowerCase().includes(q) ||
      String(u.cargo || '').toLowerCase().includes(q) ||
      String(u.cedula || '').toLowerCase().includes(q) ||
      String(u.sede || '').toLowerCase().includes(q) ||
      String(u.rol || '').toLowerCase().includes(q)
    ).slice(0, 8);
  }, [usuarios, searchUserTerm, regionalDestino]);

  // Filtrado reactivo de activos para el autocompletado
  const filteredEquiposSearch = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const q = searchTerm.toLowerCase().trim();
    return equipos.filter(e => 
      String(e.placa || '').toLowerCase().includes(q) ||
      String(e.serial || '').toLowerCase().includes(q) ||
      String(e.equipo_nombre || '').toLowerCase().includes(q)
    ).slice(0, 8);
  }, [equipos, searchTerm]);

  // Manejar selección de un activo
  const handleSelectEquipo = (equipo) => {
    setSelectedEquipo(equipo);
    setSearchTerm(equipo.placa);
    setShowDropdown(false);
    
    // Auto-ajustar destino para que no sea igual al origen
    const origen = equipo.ubicacion || 'Regional Medellin';
    let targetDestino = regionalDestino;
    if (regionalDestino === origen) {
      targetDestino = REGIONALES.find(r => r !== origen) || 'Regional Bogota';
      setRegionalDestino(targetDestino);
    }

    if (!customReceptor && usuarios.length > 0) {
      const cityKey = targetDestino.replace('Regional', '').trim().toLowerCase();
      const match = usuarios.find(u => 
        ((u.sede && u.sede.toLowerCase().includes(cityKey)) ||
         (u.regional && u.regional.toLowerCase().includes(cityKey))) &&
        u.email.toLowerCase() !== (currentUser?.email || '').toLowerCase()
      );
      if (match) {
        setSelectedReceptorUser(match);
        setFuncionarioReceptorNombre(match.nombre || '');
        setFuncionarioReceptorCargo(match.cargo || match.rol || 'Funcionario SGI');
        setFuncionarioReceptorEmail(match.email || '');
      }
    }
  };

  const regionalOrigen = selectedEquipo?.ubicacion || 'Regional Medellin';

  // Validación y envío del traslado
  const handleSubmitTraslado = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!selectedEquipo) {
      setErrorMsg('Debes seleccionar un activo tecnológico para realizar el traslado.');
      return;
    }

    if (regionalOrigen === regionalDestino) {
      setErrorMsg(`La Regional Destino no puede ser igual a la Regional de Origen actual (${regionalOrigen}).`);
      return;
    }

    const receptorNombre = customReceptor ? funcionarioReceptorNombre.trim() : (selectedReceptorUser?.nombre || searchUserTerm.trim());
    const receptorCargo = customReceptor ? funcionarioReceptorCargo.trim() : (selectedReceptorUser?.cargo || selectedReceptorUser?.rol || 'Funcionario SGI');
    const receptorEmail = customReceptor ? funcionarioReceptorEmail.trim() : (selectedReceptorUser?.email || '');

    if (!receptorNombre) {
      setErrorMsg('Por favor busca y selecciona un funcionario receptor registrado en el sistema.');
      return;
    }

    setIsSubmitting(true);

    try {
      const now = new Date();
      const fechaTexto = now.toLocaleString('es-CO');
      const timestampIso = now.toISOString();
      const correlativo = String(Date.now()).slice(-5);
      const actaNumero = `TRS-${now.getFullYear()}-${correlativo}`;
      const certHash = `TRS-CERT-${correlativo}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      const dep = calculateDepreciation(selectedEquipo);

      const payloadTraslado = {
        acta_numero: actaNumero,
        fecha: fechaTexto,
        timestamp: timestampIso,
        equipo_id: selectedEquipo.id,
        placa: selectedEquipo.placa || 'N/A',
        equipo_nombre: selectedEquipo.equipo_nombre || 'Equipo TI',
        serial: selectedEquipo.serial || 'N/A',
        categoria: selectedEquipo.categoria || 'Portátiles Corporativos',
        equipo_specs: selectedEquipo.equipo_specs || 'Configuración estándar',
        valor_declarado: dep.valorDeclarado,
        valor_residual: dep.valorResidual,
        regional_origen: regionalOrigen,
        regional_destino: regionalDestino,
        nueva_ubicacion: nuevaUbicacion.trim() || `Bodega Central TI (${regionalDestino})`,
        motivo: motivo + (motivoDetalle ? ` - ${motivoDetalle}` : ''),
        empresa_transporte: empresaTransporte,
        guia_transporte: guiaTransporte.trim() || 'Despacho Interno Directo',
        condicion_fisica: condicionFisica,
        observaciones: observaciones.trim() || 'Activo verificado y embalado para traslado inter-regional.',
        despachado_por: {
          id: currentUser?.id || 'N/A',
          nombre: currentUser?.nombre || 'Administrador TI',
          cargo: currentUser?.cargo || currentUser?.rol || 'Administrador TI',
          email: currentUser?.email || 'ti@casalimpia.com.co'
        },
        recibido_por: {
          id: selectedReceptorUser?.id || 'N/A',
          nombre: receptorNombre,
          cargo: receptorCargo,
          email: receptorEmail || 'regional@casalimpia.com.co',
          cedula: selectedReceptorUser?.cedula || '---',
          rol: selectedReceptorUser?.rol || 'Empleado'
        },
        cert_hash: certHash,
        createdAt: serverTimestamp()
      };

      // 1. Guardar en colección 'actas_traslado'
      const docRef = await addDoc(collection(db, 'actas_traslado'), payloadTraslado);

      // 2. Registrar en la trazabilidad global 'movimientos'
      await addDoc(collection(db, 'movimientos'), {
        tipo: 'TRASLADO',
        acta_numero: actaNumero,
        acta_id: docRef.id,
        fecha: serverTimestamp(),
        fecha_registro: timestampIso,
        fecha_registro_texto: fechaTexto,
        equipo_id: selectedEquipo.id,
        placa: selectedEquipo.placa,
        equipo_nombre: selectedEquipo.equipo_nombre,
        serial: selectedEquipo.serial,
        origen: regionalOrigen,
        destino: regionalDestino,
        responsable: currentUser?.nombre || 'Administrador TI',
        colaborador_nombre: `Recepción: ${receptorNombre} (${regionalDestino})`,
        descripcion: `Traslado Inter-Regional: ${regionalOrigen} ➔ ${regionalDestino} • Guía: ${payloadTraslado.guia_transporte}`,
        cert_hash: certHash,
        rawDoc: payloadTraslado
      });

      // 3. Actualizar la ubicación física y el último movimiento en la colección 'equipos'
      const assetDocRef = doc(db, 'equipos', selectedEquipo.id);
      await updateDoc(assetDocRef, {
        ubicacion: regionalDestino,
        ultimo_movimiento: `Traslado: ${regionalOrigen} ➔ ${regionalDestino} (${actaNumero})`,
        ultima_remision_traslado: actaNumero,
        updatedAt: serverTimestamp(),
        historial_movimientos: arrayUnion({
          fecha: timestampIso,
          tipo: 'TRASLADO',
          descripcion: `Traslado de ${regionalOrigen} hacia ${regionalDestino}. Guía: ${payloadTraslado.guia_transporte}. Receptor: ${receptorNombre} (${receptorCargo})`,
          responsable: currentUser?.nombre || 'Administrador TI'
        })
      });

      setLastTrasladoData(payloadTraslado);
      setSuccessMsg(`¡Traslado exitoso! Se ha generado la Remisión Oficial ${actaNumero} y actualizado la ubicación del activo a ${regionalDestino}.`);
      
      // Limpiar formulario para nuevo traslado
      setSelectedEquipo(null);
      setSearchTerm('');
      setNuevaUbicacion('');
      setMotivoDetalle('');
      setGuiaTransporte('');
      setFuncionarioReceptorNombre('');
      setFuncionarioReceptorEmail('');
      setObservaciones('');
      setIsSubmitting(false);

    } catch (err) {
      console.error('Error al procesar traslado:', err);
      setErrorMsg('Error al registrar el traslado en Firestore: ' + err.message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-background font-body-md text-on-surface antialiased min-h-screen">
      <Sidebar />

      <div className="pl-0 lg:pl-72 flex flex-col min-h-screen">
        
        {/* HEADER SUPERIOR */}
        <header className="fixed top-0 left-0 lg:left-72 right-0 h-16 bg-surface/90 backdrop-blur-xl z-40 shadow-[0_1px_8px_rgba(0,0,0,0.04)] px-3 sm:px-space-md lg:px-space-xl flex items-center justify-between gap-2 sm:gap-space-lg">
          <div className="flex items-center gap-2 sm:gap-space-md flex-1 min-w-0">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('toggle-mobile-sidebar'))}
              className="lg:hidden p-2 -ml-1 rounded-lg text-on-surface hover:bg-surface-container shrink-0 cursor-pointer"
              title="Abrir menú"
              aria-label="Abrir menú"
            >
              <span className="material-symbols-outlined text-[24px]">menu</span>
            </button>
            <span className="material-symbols-outlined text-primary text-[28px]">local_shipping</span>
            <div className="flex flex-col">
              <h1 className="font-headline-sm text-lg text-primary font-black tracking-tight">
                Traslado de Equipos entre Regionales
              </h1>
              <span className="text-[11px] text-outline uppercase font-bold tracking-wider hidden sm:block">
                Control Logístico Inter-Sedes • Formato Oficial TI-FO-06
              </span>
            </div>
          </div>

          <div className="flex items-center gap-space-md shrink-0">
            <button
              onClick={() => navigate('/historial')}
              className="h-9 px-space-md flex items-center gap-space-xs rounded-lg text-primary bg-primary/10 hover:bg-primary/20 transition-colors font-label-sm font-bold shadow-xs cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">verified_user</span>
              <span>Ver Auditoría de Traslados</span>
            </button>
            <div className="h-6 w-px bg-surface-container-highest"></div>
            <div className="flex items-center gap-space-md pl-space-xs">
              <div className="flex flex-col text-right hidden sm:flex">
                <span className="font-label-md text-on-surface font-bold">{currentUser?.nombre || 'Administrador TI'}</span>
                <span className="font-label-sm text-secondary font-semibold">{currentUser?.cargo || currentUser?.rol || 'Gestor de Activos'}</span>
              </div>
              <img alt="Perfil" className="w-8 h-8 rounded-full object-cover ring-2 ring-primary/20 shadow-sm" src={currentUser?.avatar || 'https://i.pravatar.cc/150'} />
              <button onClick={handleLogout} className="hover:bg-error-container hover:text-error text-outline p-1.5 rounded-full transition-colors cursor-pointer" title="Cerrar Sesión">
                <span className="material-symbols-outlined text-[20px]">logout</span>
              </button>
            </div>
          </div>
        </header>

        {/* CONTENIDO PRINCIPAL */}
        <main className="flex-1 mt-16 p-3 sm:p-6 lg:p-space-xl overflow-y-auto">
          <div className="max-w-5xl mx-auto flex flex-col gap-space-lg">
            
            {/* MENSAJES DE NOTIFICACIÓN */}
            {errorMsg && (
              <div className="p-space-md bg-error-container text-on-error-container rounded-xl flex items-center justify-between shadow-sm animate-fadeIn">
                <div className="flex items-center gap-space-sm">
                  <span className="material-symbols-outlined text-[24px]">error</span>
                  <span className="font-body-sm font-semibold">{errorMsg}</span>
                </div>
                <button onClick={() => setErrorMsg('')} className="p-1 hover:bg-surface/20 rounded-md">
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            )}

            {successMsg && (
              <div className="p-space-lg bg-success/10 border border-success/30 text-success rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-space-md shadow-sm animate-fadeIn">
                <div className="flex items-center gap-space-sm">
                  <span className="material-symbols-outlined text-[28px] text-success">check_circle</span>
                  <div>
                    <h3 className="font-bold text-label-md text-success">Operación Registrada en Firebase</h3>
                    <p className="font-body-sm text-on-surface">{successMsg}</p>
                  </div>
                </div>
                {lastTrasladoData && (
                  <button
                    onClick={() => generateAndPrintActaTraslado(lastTrasladoData)}
                    className="h-10 px-space-lg bg-success text-on-primary font-bold rounded-lg flex items-center gap-space-xs hover:bg-success/90 shadow-md transition-all shrink-0 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[20px]">print</span>
                    <span>Imprimir Remisión Oficial</span>
                  </button>
                )}
              </div>
            )}

            <form onSubmit={handleSubmitTraslado} className="flex flex-col gap-space-lg">

              {/* PASO 1: SELECCIÓN DEL ACTIVO TECNOLÓGICO */}
              <div className="bg-surface-container-lowest p-space-lg rounded-2xl shadow-sm border border-surface-container-high/50">
                <div className="flex items-center justify-between pb-space-sm mb-space-md border-b border-surface-container-highest">
                  <div className="flex items-center gap-space-sm">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">1</div>
                    <h2 className="font-headline-sm text-lg font-bold text-on-surface">Selección del Activo a Trasladar</h2>
                  </div>
                  <span className="text-outline text-label-sm font-semibold">Paso 1 de 3</span>
                </div>

                <div className="relative mb-space-md">
                  <label className="font-label-sm text-outline font-bold block mb-1">
                    Buscar Equipo por Placa, Serial o Modelo *
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">search</span>
                    <input
                      type="text"
                      className="w-full h-11 pl-10 pr-10 bg-surface-container-low text-on-surface rounded-xl font-body-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary shadow-xs uppercase"
                      placeholder="Escribe la placa institucional (Ej: CL-TI-10002) o serial..."
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setShowDropdown(true);
                      }}
                      onFocus={() => setShowDropdown(true)}
                    />
                    {searchTerm && (
                      <button 
                        type="button" 
                        onClick={() => { setSearchTerm(''); setSelectedEquipo(null); }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface"
                      >
                        <span className="material-symbols-outlined text-[18px]">close</span>
                      </button>
                    )}
                  </div>

                  {/* Dropdown de Resultados Autocompletados */}
                  {showDropdown && filteredEquiposSearch.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-surface-container-lowest rounded-xl shadow-xl border border-surface-container-high/60 z-30 max-h-60 overflow-y-auto">
                      {filteredEquiposSearch.map((eq) => (
                        <div
                          key={eq.id}
                          onClick={() => handleSelectEquipo(eq)}
                          className="p-3 hover:bg-surface-container-low cursor-pointer border-b border-surface-container-high/20 flex items-center justify-between transition-colors"
                        >
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="font-label-md font-bold text-primary">{eq.placa}</span>
                              <span className="font-body-sm font-semibold text-on-surface">{eq.equipo_nombre}</span>
                            </div>
                            <span className="text-xs text-outline font-code-mono">SN: {eq.serial || 'Sin Serial'} • {eq.categoria}</span>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-xs font-bold px-2 py-0.5 rounded bg-surface-container text-on-surface">
                              {eq.ubicacion || 'Sin regional'}
                            </span>
                            <span className={`text-[10px] font-bold ${eq.estado === 'DISPONIBLE' ? 'text-success' : 'text-primary'}`}>
                              {eq.estado}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Tarjeta de Resumen del Activo Seleccionado */}
                {selectedEquipo ? (
                  <div className="p-space-md bg-surface-container-low rounded-xl border border-primary/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-space-md">
                    <div className="flex items-start gap-space-md">
                      <div className="w-12 h-12 rounded-xl bg-primary text-on-primary flex items-center justify-center shrink-0 shadow-sm">
                        <span className="material-symbols-outlined text-[26px]">laptop_mac</span>
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-space-sm flex-wrap">
                          <span className="font-headline-sm text-base font-black text-primary">{selectedEquipo.placa}</span>
                          <span className="font-body-md font-bold text-on-surface">{selectedEquipo.equipo_nombre}</span>
                          <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-surface-container text-on-surface font-code-mono">
                            SN: {selectedEquipo.serial}
                          </span>
                        </div>
                        <p className="text-body-sm text-outline mt-0.5">{selectedEquipo.equipo_specs || 'Configuración estándar'}</p>
                        <div className="flex items-center gap-space-md mt-1 text-xs">
                          <span className="text-on-surface-variant font-semibold">
                            Custodio actual: <strong>{selectedEquipo.asignatario || 'Bodega Central TI'}</strong>
                          </span>
                          <span className="text-on-surface-variant font-semibold">
                            Valor Declarado: <strong>{formatCurrencyCOP(calculateDepreciation(selectedEquipo).valorDeclarado)}</strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-start md:items-end bg-surface-container-lowest px-4 py-2 rounded-lg border border-surface-container-high/50 shrink-0">
                      <span className="text-[10px] uppercase font-bold text-outline">Regional Origen Actual</span>
                      <span className="text-base font-black text-primary flex items-center gap-1">
                        <span className="material-symbols-outlined text-[18px]">location_on</span>
                        {regionalOrigen}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-space-lg border-2 border-dashed border-surface-container-highest rounded-xl text-center text-outline font-body-sm">
                    Selecciona un activo arriba para iniciar el protocolo de traslado.
                  </div>
                )}
              </div>

              {/* PASO 2: RUTA, DESTINO Y LOGÍSTICA */}
              <div className="bg-surface-container-lowest p-space-lg rounded-2xl shadow-sm border border-surface-container-high/50">
                <div className="flex items-center justify-between pb-space-sm mb-space-md border-b border-surface-container-highest">
                  <div className="flex items-center gap-space-sm">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">2</div>
                    <h2 className="font-headline-sm text-lg font-bold text-on-surface">Ruta de Traslado y Logística de Despacho</h2>
                  </div>
                  <span className="text-outline text-label-sm font-semibold">Paso 2 de 3</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-space-lg">
                  {/* Selector de Regional Destino */}
                  <div className="flex flex-col gap-1">
                    <label className="font-label-sm text-outline font-bold">
                      Regional Destino *
                    </label>
                    <div className="relative">
                      <select
                        value={regionalDestino}
                        onChange={(e) => handleRegionalDestinoChange(e.target.value)}
                        className="w-full h-11 px-3 bg-surface-container-low text-on-surface font-bold rounded-lg font-body-sm focus:outline-none focus:ring-2 focus:ring-primary shadow-xs cursor-pointer pr-8"
                      >
                        {REGIONALES.map((reg) => (
                          <option 
                            key={reg} 
                            value={reg} 
                            disabled={selectedEquipo && reg === regionalOrigen}
                          >
                            {reg} {selectedEquipo && reg === regionalOrigen ? '(Sede Actual Origen)' : ''}
                          </option>
                        ))}
                      </select>
                      <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline text-[18px] pointer-events-none">expand_more</span>
                    </div>
                    {selectedEquipo && regionalDestino === regionalOrigen && (
                      <span className="text-xs text-error font-semibold">La sede destino debe ser diferente al origen.</span>
                    )}
                  </div>

                  {/* Ubicación física específica en destino */}
                  <div className="flex flex-col gap-1">
                    <label className="font-label-sm text-outline font-bold">
                      Ubicación Específica en Sede Destino
                    </label>
                    <input
                      type="text"
                      className="w-full h-11 px-3 bg-surface-container-low text-on-surface rounded-lg font-body-sm focus:outline-none focus:ring-2 focus:ring-primary shadow-xs"
                      placeholder="Ej. Bodega Central TI - Rack 2 / Piso 3 Oficina 302"
                      value={nuevaUbicacion}
                      onChange={(e) => setNuevaUbicacion(e.target.value)}
                    />
                  </div>

                  {/* Motivo del Traslado */}
                  <div className="flex flex-col gap-1">
                    <label className="font-label-sm text-outline font-bold">
                      Motivo Institucional del Traslado *
                    </label>
                    <div className="relative">
                      <select
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                        className="w-full h-11 px-3 bg-surface-container-low text-on-surface rounded-lg font-body-sm focus:outline-none focus:ring-2 focus:ring-primary shadow-xs cursor-pointer pr-8"
                      >
                        {MOTIVOS_TRASLADO.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                      <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline text-[18px] pointer-events-none">expand_more</span>
                    </div>
                  </div>

                  {/* Detalle complementario del motivo */}
                  <div className="flex flex-col gap-1">
                    <label className="font-label-sm text-outline font-bold">
                      Detalle Adicional del Motivo (Opcional)
                    </label>
                    <input
                      type="text"
                      className="w-full h-11 px-3 bg-surface-container-low text-on-surface rounded-lg font-body-sm focus:outline-none focus:ring-2 focus:ring-primary shadow-xs"
                      placeholder="Ej. Aprobado por Gerencia Operativa / Ticket #48921"
                      value={motivoDetalle}
                      onChange={(e) => setMotivoDetalle(e.target.value)}
                    />
                  </div>

                  {/* Empresa de Transporte */}
                  <div className="flex flex-col gap-1">
                    <label className="font-label-sm text-outline font-bold">
                      Empresa de Transporte / Courier *
                    </label>
                    <div className="relative">
                      <select
                        value={empresaTransporte}
                        onChange={(e) => setEmpresaTransporte(e.target.value)}
                        className="w-full h-11 px-3 bg-surface-container-low text-on-surface rounded-lg font-body-sm focus:outline-none focus:ring-2 focus:ring-primary shadow-xs cursor-pointer pr-8"
                      >
                        {EMPRESAS_TRANSPORTE.map((emp) => (
                          <option key={emp} value={emp}>{emp}</option>
                        ))}
                      </select>
                      <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline text-[18px] pointer-events-none">expand_more</span>
                    </div>
                  </div>

                  {/* Número de Guía */}
                  <div className="flex flex-col gap-1">
                    <label className="font-label-sm text-outline font-bold">
                      Número de Guía de Transporte *
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full h-11 px-3 bg-surface-container-low text-on-surface rounded-lg font-body-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary shadow-xs uppercase font-code-mono"
                      placeholder="Ej. GUIA-9923847"
                      value={guiaTransporte}
                      onChange={(e) => setGuiaTransporte(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* PASO 3: RESPONSABLES Y CONDICIÓN TÉCNICA */}
              <div className="bg-surface-container-lowest p-space-lg rounded-2xl shadow-sm border border-surface-container-high/50">
                <div className="flex items-center justify-between pb-space-sm mb-space-md border-b border-surface-container-highest">
                  <div className="flex items-center gap-space-sm">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">3</div>
                    <h2 className="font-headline-sm text-lg font-bold text-on-surface">Responsables y Condición Técnica de Salida</h2>
                  </div>
                  <span className="text-outline text-label-sm font-semibold">Paso 3 de 3</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md mb-space-md">
                  {/* Funcionario que despacha (Origen) */}
                  <div className="p-3 bg-surface-container-low rounded-xl flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-outline uppercase block mb-1">Despachado en Origen ({regionalOrigen})</span>
                      <strong className="text-on-surface font-label-md block">{currentUser?.nombre || 'Administrador TI'}</strong>
                      <span className="text-xs text-outline block">{currentUser?.cargo || 'Responsable TI Sede'}</span>
                      <span className="text-[11px] text-primary font-code-mono">{currentUser?.email}</span>
                    </div>
                    <span className="text-[10px] font-bold text-success mt-2 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">verified</span>
                      Sesión Autenticada
                    </span>
                  </div>

                  {/* Funcionario que recibe (Destino) */}
                  <div className="flex flex-col gap-2 md:col-span-2" ref={userDropdownRef}>
                    <div className="flex items-center justify-between">
                      <label className="font-label-sm text-outline font-bold flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-primary">person_search</span>
                        Funcionario Responsable de Recepción en Destino ({regionalDestino}) *
                      </label>
                      <span className="text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px]">how_to_reg</span>
                        Búsqueda en tiempo real
                      </span>
                    </div>

                    {/* Buscador Predictivo con Autocompletado */}
                    {!customReceptor && (
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-primary text-[20px] pointer-events-none">
                          search
                        </span>
                        <input
                          type="text"
                          className="w-full h-11 pl-10 pr-10 bg-surface-container-low text-on-surface rounded-xl font-body-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary shadow-xs border border-outline-variant/30 transition-all placeholder:text-outline"
                          placeholder="Escribe el nombre, correo institucional o cargo del funcionario..."
                          value={searchUserTerm}
                          onChange={(e) => {
                            setSearchUserTerm(e.target.value);
                            setShowUserDropdown(true);
                          }}
                          onFocus={() => setShowUserDropdown(true)}
                        />
                        {searchUserTerm && (
                          <button
                            type="button"
                            onClick={() => {
                              setSearchUserTerm('');
                              setSelectedReceptorUser(null);
                              setFuncionarioReceptorNombre('');
                              setShowUserDropdown(true);
                            }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface p-1 rounded-full transition-colors"
                            title="Borrar y buscar otro usuario"
                          >
                            <span className="material-symbols-outlined text-[18px]">close</span>
                          </button>
                        )}

                        {/* Dropdown Predictivo Flotante */}
                        {showUserDropdown && (
                          <div className="absolute left-0 right-0 top-full mt-1.5 bg-surface-container-lowest rounded-xl shadow-2xl border border-surface-container-high/80 z-40 max-h-64 overflow-y-auto divide-y divide-surface-container-high/30 animate-fadeIn">
                            <div className="p-2 bg-surface-container-low/60 text-[10px] font-bold text-outline uppercase tracking-wider flex items-center justify-between">
                              <span>Usuarios sugeridos ({filteredUsuariosSearch.length})</span>
                              <button
                                type="button"
                                onClick={() => setShowUserDropdown(false)}
                                className="text-outline hover:text-primary"
                              >
                                <span className="material-symbols-outlined text-[14px]">close</span>
                              </button>
                            </div>

                            {filteredUsuariosSearch.map((u) => {
                              const isRegionalMatch = (u.sede && u.sede.toLowerCase().includes(regionalDestino.replace('Regional', '').trim().toLowerCase())) ||
                                                      (u.regional && u.regional.toLowerCase().includes(regionalDestino.replace('Regional', '').trim().toLowerCase()));

                              return (
                                <div
                                  key={u.id || u.email}
                                  onClick={() => handleSelectReceptor(u)}
                                  className={`p-2.5 hover:bg-surface-container-low cursor-pointer flex items-center justify-between gap-3 transition-colors ${
                                    selectedReceptorUser?.email === u.email ? 'bg-primary/10' : ''
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    {u.avatar ? (
                                      <img
                                        src={u.avatar}
                                        alt={u.nombre}
                                        className="w-8 h-8 rounded-full object-cover shrink-0 ring-1 ring-outline/20"
                                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                      />
                                    ) : (
                                      <div className="w-8 h-8 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                                        {u.nombre?.charAt(0) || 'U'}
                                      </div>
                                    )}
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-label-md font-bold text-on-surface text-sm truncate">{u.nombre}</span>
                                        <span className="text-[10px] bg-primary/10 text-primary font-bold px-1.5 py-0.2 rounded">
                                          {u.rol || 'Funcionario'}
                                        </span>
                                      </div>
                                      <span className="text-xs text-outline block truncate">
                                        {u.cargo || 'Funcionario SGI'} {u.sede ? `• ${u.sede}` : ''}
                                      </span>
                                      <span className="text-[11px] text-primary/80 font-code-mono block truncate">{u.email}</span>
                                    </div>
                                  </div>

                                  <div className="flex flex-col items-end shrink-0">
                                    {isRegionalMatch && (
                                      <span className="text-[9px] font-bold text-success bg-success/10 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 mb-1">
                                        <span className="material-symbols-outlined text-[11px]">location_on</span>
                                        {regionalDestino.replace('Regional', '').trim()}
                                      </span>
                                    )}
                                    {u.cedula && (
                                      <span className="text-[10px] text-outline font-code-mono">C.C. {u.cedula}</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}

                            {filteredUsuariosSearch.length === 0 && (
                              <div className="p-4 text-center">
                                <p className="text-xs text-outline font-semibold mb-2">
                                  No se encontró ningún usuario que coincida con "{searchUserTerm}".
                                </p>
                                <button
                                  type="button"
                                  onClick={() => handleSelectReceptor('CUSTOM')}
                                  className="text-xs text-primary font-bold hover:underline flex items-center justify-center gap-1 mx-auto"
                                >
                                  <span className="material-symbols-outlined text-[15px]">edit_note</span>
                                  Registrar como receptor manual/externo
                                </button>
                              </div>
                            )}

                            {/* Opción rápida al final del dropdown */}
                            <div
                              onClick={() => handleSelectReceptor('CUSTOM')}
                              className="p-2 bg-surface-container-low/40 hover:bg-amber-500/10 cursor-pointer flex items-center justify-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400 transition-colors"
                            >
                              <span className="material-symbols-outlined text-[15px]">person_add</span>
                              ¿El receptor no está registrado? Ingresar manualmente
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tarjeta Visual del Receptor Seleccionado */}
                    {!customReceptor && selectedReceptorUser && (
                      <div className="p-3 bg-surface-container-low/80 border border-primary/20 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                        <div className="flex items-center gap-3 min-w-0">
                          {selectedReceptorUser.avatar ? (
                            <img
                              src={selectedReceptorUser.avatar}
                              alt={selectedReceptorUser.nombre}
                              className="w-10 h-10 rounded-full object-cover ring-2 ring-primary/30 shrink-0"
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0">
                              {selectedReceptorUser.nombre?.charAt(0) || 'U'}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <strong className="text-on-surface font-label-md block truncate">
                                {selectedReceptorUser.nombre}
                              </strong>
                              <span className="text-[10px] bg-primary/15 text-primary font-bold px-1.5 py-0.5 rounded">
                                {selectedReceptorUser.rol || 'Funcionario'}
                              </span>
                            </div>
                            <span className="text-xs text-outline block truncate">
                              {selectedReceptorUser.cargo || 'Funcionario SGI'} {selectedReceptorUser.sede ? `• ${selectedReceptorUser.sede}` : ''}
                            </span>
                            <span className="text-[11px] text-primary font-code-mono block truncate">
                              {selectedReceptorUser.email}
                            </span>
                          </div>
                        </div>

                        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-outline-variant/20 shrink-0 gap-1">
                          <span className="text-[10px] font-bold text-success flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">verified_user</span>
                            Registrado en Sistema
                          </span>
                          {selectedReceptorUser.cedula && (
                            <span className="text-[10px] text-outline font-code-mono block">
                              C.C. {selectedReceptorUser.cedula}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setShowUserDropdown(true);
                            }}
                            className="text-[11px] text-primary font-bold hover:underline flex items-center gap-0.5 mt-0.5"
                          >
                            <span className="material-symbols-outlined text-[13px]">swap_horiz</span>
                            Cambiar
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Modo manual alternativo si eligen CUSTOM */}
                    {customReceptor && (
                      <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[16px]">edit_note</span>
                            Ingreso manual de funcionario receptor
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              if (usuarios.length > 0) handleSelectReceptor(usuarios[0]);
                            }}
                            className="text-[11px] text-primary hover:underline font-bold"
                          >
                            Volver a buscar usuario registrado
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
                          <input
                            type="text"
                            required
                            className="w-full h-10 px-3 bg-surface text-on-surface rounded-lg font-body-sm focus:outline-none focus:ring-2 focus:ring-primary shadow-xs border border-outline-variant/40"
                            placeholder="Nombre completo del receptor *"
                            value={funcionarioReceptorNombre}
                            onChange={(e) => setFuncionarioReceptorNombre(e.target.value)}
                          />
                          <input
                            type="text"
                            className="w-full h-10 px-3 bg-surface text-on-surface rounded-lg font-body-sm focus:outline-none focus:ring-2 focus:ring-primary shadow-xs border border-outline-variant/40"
                            placeholder="Cargo (Ej. Líder Regional TI)"
                            value={funcionarioReceptorCargo}
                            onChange={(e) => setFuncionarioReceptorCargo(e.target.value)}
                          />
                        </div>
                        <input
                          type="email"
                          required
                          className="w-full h-10 px-3 bg-surface text-on-surface rounded-lg font-body-sm focus:outline-none focus:ring-2 focus:ring-primary shadow-xs border border-outline-variant/40"
                          placeholder="Correo institucional (@casalimpia.com.co) *"
                          value={funcionarioReceptorEmail}
                          onChange={(e) => setFuncionarioReceptorEmail(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
                  {/* Calificación Física */}
                  <div className="flex flex-col gap-1">
                    <label className="font-label-sm text-outline font-bold">
                      Calificación y Estado Físico del Equipo al Salir
                    </label>
                    <div className="relative">
                      <select
                        value={condicionFisica}
                        onChange={(e) => setCondicionFisica(e.target.value)}
                        className="w-full h-11 px-3 bg-surface-container-low text-on-surface rounded-lg font-body-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary shadow-xs cursor-pointer pr-8"
                      >
                        <option value="10/10 Excelente Estado">🟢 10/10 Excelente Estado (Sin rayones ni golpes)</option>
                        <option value="8/10 Bueno (Desgaste Normal)">🟡 8/10 Bueno (Desgaste normal operativo)</option>
                        <option value="6/10 Regular (Rayones / Golpes Leves)">🟠 6/10 Regular (Detalles estéticos leves)</option>
                        <option value="4/10 Dañado (Requiere Reparación en Destino)">🔴 4/10 Dañado (Falla de hardware - Taller)</option>
                      </select>
                      <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline text-[18px] pointer-events-none">expand_more</span>
                    </div>
                  </div>

                  {/* Observaciones de embalaje */}
                  <div className="flex flex-col gap-1">
                    <label className="font-label-sm text-outline font-bold">
                      Observaciones de Embalaje y Accesorios
                    </label>
                    <input
                      type="text"
                      className="w-full h-11 px-3 bg-surface-container-low text-on-surface rounded-lg font-body-sm focus:outline-none focus:ring-2 focus:ring-primary shadow-xs"
                      placeholder="Ej. Incluye cargador original 65W y maletín en caja sellada"
                      value={observaciones}
                      onChange={(e) => setObservaciones(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* BOTÓN DE ACCIÓN / EMISIÓN */}
              <div className="flex items-center justify-end gap-space-md pt-space-xs">
                <button
                  type="button"
                  onClick={() => navigate('/inventario')}
                  className="px-space-lg h-11 text-outline hover:text-on-surface font-label-md font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !selectedEquipo || (selectedEquipo && regionalDestino === regionalOrigen)}
                  className="h-11 px-space-xl bg-primary text-on-primary font-bold rounded-xl shadow-md hover:bg-primary-container hover:text-on-primary-container transition-all flex items-center gap-space-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-[20px]">sync</span>
                      <span>Registrando Traslado en Firestore...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[20px]">local_shipping</span>
                      <span>Confirmar y Emitir Remisión Oficial</span>
                    </>
                  )}
                </button>
              </div>

            </form>

            {/* TABLA DE TRASLADOS RECIENTES */}
            <div className="mt-space-xl bg-surface-container-lowest p-space-lg rounded-2xl shadow-sm border border-surface-container-high/50">
              <div className="flex items-center justify-between pb-space-sm mb-space-md border-b border-surface-container-highest">
                <div className="flex items-center gap-space-sm">
                  <span className="material-symbols-outlined text-primary text-[22px]">history</span>
                  <h2 className="font-headline-sm text-lg font-bold text-on-surface">Historial Reciente de Traslados Inter-Regionales</h2>
                </div>
                <span className="text-outline text-label-sm font-semibold">{historialTraslados.length} traslados recientes</span>
              </div>

              {historialTraslados.length === 0 ? (
                <div className="p-8 text-center text-outline font-body-sm">
                  Aún no se han registrado remisiones de traslados inter-regionales.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-body-sm">
                    <thead>
                      <tr className="bg-surface-container-low text-outline font-label-sm text-label-sm uppercase select-none">
                        <th className="py-2.5 px-3 font-bold">Remisión</th>
                        <th className="py-2.5 px-3 font-bold">Fecha</th>
                        <th className="py-2.5 px-3 font-bold">Placa TI</th>
                        <th className="py-2.5 px-3 font-bold">Equipo</th>
                        <th className="py-2.5 px-3 font-bold">Ruta (Origen ➔ Destino)</th>
                        <th className="py-2.5 px-3 font-bold">Guía / Courier</th>
                        <th className="py-2.5 px-3 font-bold">Receptor</th>
                        <th className="py-2.5 px-3 text-right font-bold pr-4">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-container-high/30">
                      {historialTraslados.map((item) => (
                        <tr key={item.id} className="hover:bg-surface-container-low transition-colors">
                          <td className="py-2.5 px-3 font-code-mono text-xs font-bold text-primary">
                            {item.acta_numero || 'S/N'}
                          </td>
                          <td className="py-2.5 px-3 text-xs text-outline">
                            {item.fecha || 'Reciente'}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-on-surface">
                            {item.placa}
                          </td>
                          <td className="py-2.5 px-3 text-xs text-on-surface">
                            {item.equipo_nombre}
                          </td>
                          <td className="py-2.5 px-3 text-xs">
                            <span className="inline-flex items-center gap-1 font-semibold">
                              <span className="text-primary font-bold">{item.regional_origen?.replace('Regional ', '')}</span>
                              <span className="material-symbols-outlined text-[14px] text-outline">arrow_forward</span>
                              <span className="text-success font-bold">{item.regional_destino?.replace('Regional ', '')}</span>
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-xs font-code-mono text-on-surface-variant">
                            {item.guia_transporte || 'Directo'}
                          </td>
                          <td className="py-2.5 px-3 text-xs text-on-surface">
                            {item.recibido_por?.nombre || 'Custodio'}
                          </td>
                          <td className="py-2.5 px-3 text-right pr-4">
                            <button
                              onClick={() => generateAndPrintActaTraslado(item)}
                              className="p-1.5 rounded-lg text-primary hover:bg-primary/10 transition-colors inline-flex items-center gap-1 font-bold text-xs cursor-pointer"
                              title="Reimprimir Remisión Oficial de Traslado"
                            >
                              <span className="material-symbols-outlined text-[16px]">print</span>
                              <span>PDF</span>
                            </button>
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
      </div>
    </div>
  );
}
