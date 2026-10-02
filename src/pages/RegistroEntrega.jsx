import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  collection, 
  onSnapshot, 
  query, 
  doc, 
  updateDoc, 
  addDoc, 
  writeBatch,
  serverTimestamp,
  orderBy,
  arrayUnion
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../firebase';
import { getStoredUser } from '../utils/userHelpers';
import { initialDemoAssets } from '../utils/assetHelpers';
import { generateAndPrintActa } from '../utils/actaPrintService';

const normalizeText = (text) => text ? String(text).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";
export default function RegistroEntrega() {
  const navigate = useNavigate();
  const storedSession = getStoredUser();

  // 1. Estados de Colecciones Firestore
  const [usuariosDisponibles, setUsuariosDisponibles] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [historialActas, setHistorialActas] = useState([]);
  
  const [loadingUsuarios, setLoadingUsuarios] = useState(true);
  const [loadingEquipos, setLoadingEquipos] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSeedingEquipos, setIsSeedingEquipos] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [createdActaModal, setCreatedActaModal] = useState(null);

  // 2. Selección de Actores desde Firestore
  const [selectedColaboradorId, setSelectedColaboradorId] = useState('');
  const [selectedDelivererId, setSelectedDelivererId] = useState('');
  const [colaboradorSearch, setColaboradorSearch] = useState('');

  // 3. Selección de Hardware desde Firestore
  const [selectedEquipoId, setSelectedEquipoId] = useState('');
  const [verSoloDisponibles, setVerSoloDisponibles] = useState(true);
  const [equipoSearch, setEquipoSearch] = useState('');
  const [showColaboradorDocs, setShowColaboradorDocs] = useState(false);
  const [showEquipoDocs, setShowEquipoDocs] = useState(false);

  // 4. Parámetros del Acta TI-FO-04
  const [actaNumero, setActaNumero] = useState(
    () => `ACT-${new Date().getFullYear()}-0${Math.floor(100 + Math.random() * 900)}`
  );
  const [fechaActa, setFechaActa] = useState(() => {
    return new Intl.DateTimeFormat('es-CO', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(new Date());
  });

  // 5. Verificación Técnica de Mesa
  const [qaChecklist, setQaChecklist] = useState({
    cargadorOriginal: true,
    saludBateria: true,
    pruebaEncendido: true
  });

  // 6. Accesorios físicos entregados
  const [accesorios, setAccesorios] = useState({
    maletin: true,
    mouse: true,
    cargador: true,
    guaya: true,
    diadema: true,
    hub: false
  });
  const [accesorioExtra, setAccesorioExtra] = useState('');

  // 7. Observaciones Técnicas
  const [observaciones, setObservaciones] = useState(
    'Equipo configurado bajo estándar institucional Casalimpia S.A., con imagen corporativa corporativa Windows 11 Pro, antivirus corporativo Endpoint y aplicativos de gestión SIC/ERP validados.'
  );

  // 8. Modal de Historial de Actas Legalizadas
  const [showHistorialModal, setShowHistorialModal] = useState(false);
  const [actaEnDetalle, setActaEnDetalle] = useState(null);
  
  const [showActaModal, setShowActaModal] = useState(false);



  // 9. Canvas de Firma Digital
  const canvasRef = useRef(null);
  const [hasSignature, setHasSignature] = useState(false);
  const isDrawing = useRef(false);

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

  // A. Suscripción a Usuarios registrados en Firestore
  useEffect(() => {
    if (storedSession?.rol === 'Empleado') {
      navigate('/inventario', { replace: true });
      return;
    }
    const qUsers = query(collection(db, "usuarios"));
    const unsubUsers = onSnapshot(qUsers, (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setUsuariosDisponibles(list);
      setLoadingUsuarios(false);

      if (list.length > 0) {
        // Seleccionar por defecto el colaborador receptor removido a petición del usuario.

        // Seleccionar por defecto el funcionario TI que entrega (preferencia sesión o Administrador / Soporte)
        if (!selectedDelivererId || !list.some(u => u.id === selectedDelivererId)) {
          const matchSession = list.find(u => u.email === storedSession?.email);
          const defaultDeliverer = matchSession || list.find(u => u.rol === 'Administrador' || u.rol === 'Soporte TI') || list[0];
          setSelectedDelivererId(defaultDeliverer.id);
        }
      }
    }, (err) => {
      console.error("Error Firestore Usuarios:", err);
      setLoadingUsuarios(false);
    });

    return () => unsubUsers();
  }, []);

  // B. Suscripción a Equipos registrados en Firestore
  useEffect(() => {
    const qEquipos = query(collection(db, "equipos"));
    const unsubEquipos = onSnapshot(qEquipos, (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setEquipos(list);
      setLoadingEquipos(false);

      // Filtros opcionales si se desean guardar en memoria, pero no pre-seleccionamos ninguno.
    }, (err) => {
      console.error("Error Firestore Equipos:", err);
      setLoadingEquipos(false);
    });

    return () => unsubEquipos();
  }, []);

  // C. Suscripción a Actas de Entrega Legalizadas en Firestore
  useEffect(() => {
    const qActas = query(collection(db, "actas_entrega"));
    const unsubActas = onSnapshot(qActas, (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      // Ordenar por fecha descendente
      list.sort((a, b) => {
        const tA = a.createdAt?.seconds || 0;
        const tB = b.createdAt?.seconds || 0;
        return tB - tA;
      });
      setHistorialActas(list);
    }, (err) => {
      console.error("Error Firestore Actas:", err);
    });

    return () => unsubActas();
  }, []);

  // ----------------------------------------------------
  // DERIVACIONES DINÁMICAS (100% DESDE FIRESTORE)
  // ----------------------------------------------------
  const colaborador = usuariosDisponibles.find(u => u.id === selectedColaboradorId) || {
    id: '',
    nombre: loadingUsuarios ? 'Cargando usuarios...' : 'Seleccione un colaborador',
    cedula: '---',
    cargo: 'Funcionario',
    area: 'General',
    sede: 'Sede Principal',
    email: '---',
    avatar: 'https://i.pravatar.cc/150'
  };

  const deliverer = usuariosDisponibles.find(u => u.id === selectedDelivererId) || {
    id: '',
    nombre: storedSession?.nombre || 'Funcionario TI',
    cargo: storedSession?.cargo || 'Administrador TI',
    sede: storedSession?.sede || 'Sede Bogotá',
    email: storedSession?.email || ''
  };

  const equiposDisponibles = equipos.filter(e => e.estado === 'DISPONIBLE' || !e.estado);
  const equiposVisibles = verSoloDisponibles ? equiposDisponibles : equipos;
  
  const currentEquipo = equipos.find(e => e.id === selectedEquipoId) || {
    id: '',
    placa: 'Sin equipo',
    equipo_nombre: loadingEquipos ? 'Cargando inventario...' : 'Seleccione un equipo del stock',
    equipo_specs: 'Sin especificaciones',
    serial: '---',
    estado: 'DISPONIBLE',
    categoria: 'Portátiles Corporativos',
    ubicacion: 'Bodega Centralizada TI'
  };

  // Funcionarios con perfil TI para entregar
  const funcionariosTI = usuariosDisponibles.filter(u => 
    u.rol === 'Administrador' || u.rol === 'Soporte TI'
  );
  const deliverersOptions = funcionariosTI.length > 0 ? funcionariosTI : usuariosDisponibles;

  const filteredUsers = colaboradorSearch.trim() === '' ? [] : usuariosDisponibles.filter(u => {
    const term = normalizeText(colaboradorSearch);
    return normalizeText(u.nombre).includes(term) ||
           (u.cedula && normalizeText(u.cedula).includes(term)) ||
           (u.email && normalizeText(u.email).includes(term));
  });

  const filteredEquipos = equipoSearch.trim() === '' ? [] : equiposVisibles.filter(eq => {
    const term = normalizeText(equipoSearch);
    return normalizeText(eq.equipo_nombre).includes(term) ||
           (eq.placa && normalizeText(eq.placa).includes(term)) ||
           (eq.serial && normalizeText(eq.serial).includes(term));
  });
  // Búsqueda interactiva de colaborador por nombre, cédula o correo
  const handleSearchColaborador = () => {
    if (!colaboradorSearch.trim()) return;
    const term = colaboradorSearch.toLowerCase().trim();
    const match = usuariosDisponibles.find(u => 
      (u.nombre || '').toLowerCase().includes(term) ||
      (u.cedula || '').toLowerCase().includes(term) ||
      (u.email || '').toLowerCase().includes(term)
    );
    if (match) {
      setSelectedColaboradorId(match.id);
    } else {
      alert("No se encontró ningún usuario registrado en la base de datos con ese criterio.");
    }
  };

  // Semilla rápida de equipos de prueba si Firestore está vacío
  const handleSeedEquiposDemo = async () => {
    try {
      setIsSeedingEquipos(true);
      const batch = writeBatch(db);
      initialDemoAssets.forEach((asset) => {
        const newDocRef = doc(collection(db, "equipos"));
        batch.set(newDocRef, {
          ...asset,
          createdAt: serverTimestamp()
        });
      });
      await batch.commit();
      setSuccessMsg("¡Equipos de prueba cargados con éxito en Firestore!");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      alert("Error al cargar equipos: " + err.message);
    } finally {
      setIsSeedingEquipos(false);
    }
  };

  // ----------------------------------------------------
  // INICIALIZACIÓN DEL CANVAS DE FIRMA DIGITAL
  // ----------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const updateCanvasSize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#00355f';
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);

    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: clientX - rect.left,
        y: clientY - rect.top
      };
    };

    const startDraw = (e) => {
      isDrawing.current = true;
      setHasSignature(true);
      const pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      if (e.touches) e.preventDefault();
    };

    const draw = (e) => {
      if (!isDrawing.current) return;
      const pos = getPos(e);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      if (e.touches) e.preventDefault();
    };

    const stopDraw = () => {
      isDrawing.current = false;
    };

    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    window.addEventListener('mouseup', stopDraw);

    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    window.addEventListener('touchend', stopDraw);

    return () => {
      window.removeEventListener('resize', updateCanvasSize);
      canvas.removeEventListener('mousedown', startDraw);
      canvas.removeEventListener('mousemove', draw);
      window.removeEventListener('mouseup', stopDraw);
      canvas.removeEventListener('touchstart', startDraw);
      canvas.removeEventListener('touchmove', draw);
      window.removeEventListener('touchend', stopDraw);
    };
  }, []);

  const handleClearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  // Función para generar e imprimir el Acta Oficial TI-FO-04 (PDF sin capturas de pantalla)
  const handleGenerateOfficialActa = (customData = null) => {
    let signatureDataUrl = null;
    if (hasSignature && canvasRef.current) {
      signatureDataUrl = canvasRef.current.toDataURL('image/png');
    }

    const accesoriosList = [];
    if (accesorios.maletin) accesoriosList.push('Maletín impermeable logo Casalimpia');
    if (accesorios.mouse) accesoriosList.push('Mouse Inalámbrico Logitech M185 con Dongle USB');
    if (accesorios.cargador) accesoriosList.push('Adaptador Corriente Original 65W');
    if (accesorios.guaya) accesoriosList.push('Guaya de seguridad Kensington con 2 llaves');
    if (accesorios.diadema) accesoriosList.push('Diadema Jabra Evolve 20 USB');
    if (accesorios.hub) accesoriosList.push('Hub Multipuesto USB-C HDMI');
    if (accesorioExtra.trim()) accesoriosList.push(accesorioExtra.trim());

    const data = customData || {
      acta_numero: actaNumero,
      fecha: fechaActa,
      equipo_id: currentEquipo.id,
      placa: currentEquipo.placa,
      equipo_nombre: currentEquipo.equipo_nombre,
      serial: currentEquipo.serial,
      categoria: currentEquipo.categoria || 'Hardware',
      equipo_specs: currentEquipo.equipo_specs,
      colaborador: {
        nombre: colaborador.nombre,
        cedula: colaborador.cedula || 'Sin cédula',
        cargo: colaborador.cargo || 'Funcionario',
        area: colaborador.area || 'General',
        sede: colaborador.sede || 'Bogotá',
        email: colaborador.email || '---'
      },
      entregado_por: {
        nombre: deliverer.nombre,
        cargo: deliverer.cargo || deliverer.rol || 'TI',
        sede: deliverer.sede
      },
      accesorios: accesoriosList,
      observaciones: observaciones,
      cert_hash: 'CERT-78A9' + Math.random().toString(36).substring(2, 6).toUpperCase(),
      firma_receptor_img: signatureDataUrl
    };

    generateAndPrintActa(data, 'ENTREGA');
  };

  // ----------------------------------------------------
  // CONFIRMAR Y GUARDAR ENTREGA EN FIRESTORE (RF-03 • RF-04)
  // ----------------------------------------------------
  const handleConfirmDelivery = async () => {
    if (!currentEquipo.id) {
      alert("Por favor seleccione un equipo de la base de datos para realizar la entrega.");
      return;
    }
    if (!colaborador.id) {
      alert("Por favor seleccione el colaborador receptor registrado en la base de datos.");
      return;
    }

    try {
      setIsSubmitting(true);

      const accesoriosList = [];
      if (accesorios.maletin) accesoriosList.push('Maletín impermeable logo Casalimpia');
      if (accesorios.mouse) accesoriosList.push('Mouse Inalámbrico Logitech M185 con Dongle USB');
      if (accesorios.cargador) accesoriosList.push('Adaptador Corriente Original 65W');
      if (accesorios.guaya) accesoriosList.push('Guaya de seguridad Kensington con 2 llaves');
      if (accesorios.diadema) accesoriosList.push('Diadema Jabra Evolve 20 USB');
      if (accesorios.hub) accesoriosList.push('Hub Multipuesto USB-C HDMI');
      if (accesorioExtra.trim()) accesoriosList.push(accesorioExtra.trim());

      // Obtener firma en base64 si fue dibujada
      let signatureDataUrl = null;
      if (hasSignature && canvasRef.current) {
        signatureDataUrl = canvasRef.current.toDataURL('image/png');
      }

      const certHash = '78a9c2' + Math.random().toString(36).substring(2, 10) + 'f0';

      // 1. Guardar Acta oficial en colección Firestore 'actas_entrega'
      const actaDocRef = await addDoc(collection(db, 'actas_entrega'), {
        acta_numero: actaNumero,
        fecha: fechaActa,
        equipo_id: currentEquipo.id,
        placa: currentEquipo.placa,
        equipo_nombre: currentEquipo.equipo_nombre,
        serial: currentEquipo.serial,
        categoria: currentEquipo.categoria || 'Hardware',
        colaborador: {
          id: colaborador.id,
          nombre: colaborador.nombre,
          cedula: colaborador.cedula || 'Sin cédula',
          cargo: colaborador.cargo || 'Funcionario',
          area: colaborador.area || 'General',
          sede: colaborador.sede || 'Bogotá',
          email: colaborador.email || '---'
        },
        entregado_por: {
          id: deliverer.id,
          nombre: deliverer.nombre,
          cargo: deliverer.cargo || deliverer.rol || 'TI',
          email: deliverer.email,
          sede: deliverer.sede
        },
        accesorios: accesoriosList,
        qa_checklist: qaChecklist,
        observaciones: observaciones,
        cert_hash: certHash,
        firma_receptor_img: signatureDataUrl,
        createdAt: serverTimestamp()
      });

      // 2. Registrar movimiento en colección global 'movimientos' para el Historial
      await addDoc(collection(db, 'movimientos'), {
        tipo: 'ENTREGA',
        acta_numero: actaNumero,
        acta_id: actaDocRef.id,
        fecha: fechaActa,
        equipo_id: currentEquipo.id,
        placa: currentEquipo.placa,
        equipo_nombre: currentEquipo.equipo_nombre,
        serial: currentEquipo.serial,
        origen: 'Bodega Centralizada TI',
        destino: `${colaborador.nombre} (${colaborador.cargo || 'Funcionario'})`,
        responsable_ti: deliverer.nombre,
        estado_resultante: 'ASIGNADO',
        detalles: `Asignación de hardware con ${accesoriosList.length} accesorios • ${colaborador.sede || 'Bogotá'}`,
        cert_hash: certHash,
        rawDoc: {
          acta_numero: actaNumero,
          fecha: fechaActa,
          equipo_id: currentEquipo.id,
          placa: currentEquipo.placa,
          equipo_nombre: currentEquipo.equipo_nombre,
          serial: currentEquipo.serial,
          categoria: currentEquipo.categoria || 'Hardware',
          equipo_specs: currentEquipo.equipo_specs,
          colaborador: {
            nombre: colaborador.nombre,
            cedula: colaborador.cedula,
            cargo: colaborador.cargo,
            area: colaborador.area,
            sede: colaborador.sede,
            email: colaborador.email
          },
          entregado_por: {
            nombre: deliverer.nombre,
            cargo: deliverer.cargo || deliverer.rol,
            sede: deliverer.sede
          },
          accesorios: accesoriosList,
          observaciones: observaciones,
          cert_hash: certHash,
          firma_receptor_img: signatureDataUrl
        },
        createdAt: serverTimestamp()
      });

      // 3. Actualizar estado del activo en Firestore 'equipos' a 'ASIGNADO'
      const assetRef = doc(db, 'equipos', currentEquipo.id);
      await updateDoc(assetRef, {
        estado: 'ASIGNADO',
        asignatario: colaborador.nombre,
        asignatario_id: colaborador.id,
        asignatario_email: colaborador.email,
        asignatario_cc: colaborador.cedula || '',
        ubicacion: `${colaborador.sede || 'Sede Principal'} • ${colaborador.area || colaborador.cargo || 'Oficina'}`,
        ultimo_movimiento: `Acta ${actaNumero} entregada a ${colaborador.nombre}`,
        acta_id: actaDocRef.id,
        acta_numero: actaNumero,
        updatedAt: serverTimestamp(),
        historial_movimientos: arrayUnion({
          fecha: new Date().toISOString(),
          tipo: 'ASIGNACIÓN',
          descripcion: `Equipo asignado a ${colaborador.nombre} (C.C. ${colaborador.cedula || 'N/A'}) - Acta ${actaNumero}`,
          responsable: deliverer.nombre || 'Administrador TI'
        })
      });

      const savedPayload = {
        acta_numero: actaNumero,
        fecha: fechaActa,
        placa: currentEquipo.placa,
        equipo_nombre: currentEquipo.equipo_nombre,
        serial: currentEquipo.serial,
        categoria: currentEquipo.categoria,
        equipo_specs: currentEquipo.equipo_specs,
        colaborador: { ...colaborador },
        entregado_por: { ...deliverer },
        accesorios: accesoriosList,
        observaciones: observaciones,
        cert_hash: certHash,
        firma_receptor_img: signatureDataUrl
      };

      setCreatedActaModal(savedPayload);
      setSuccessMsg(`¡Acta ${actaNumero} legalizada y guardada en el Historial! Hardware asignado a ${colaborador.nombre}.`);

    } catch (err) {
      alert('Error al legalizar entrega en Firebase: ' + err.message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-background font-body-md text-on-surface antialiased min-h-screen">
      
      {/* Toast Flotante de Éxito */}
      {successMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-secondary text-on-secondary px-space-xl py-space-md rounded-2xl shadow-2xl flex items-center gap-space-md border border-white/20 animate-bounce">
          <span className="material-symbols-outlined text-[28px]">verified</span>
          <div className="flex flex-col">
            <span className="font-bold font-headline-sm text-body-lg">{successMsg}</span>
            <span className="text-body-sm opacity-90">Actualizando el inventario institucional...</span>
          </div>
        </div>
      )}

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
                {equipos.length}
              </span>
            </a>

            {/* Menú Entrega y Recepción */}
            <div className="pt-space-xs">
              <div className="flex items-center justify-between px-space-md py-space-sm text-on-surface-variant rounded-lg">
                <div className="flex items-center gap-space-md">
                  <span className="material-symbols-outlined text-[20px] text-primary">assignment_return</span>
                  <span className="font-body-md text-body-md font-semibold text-on-surface">Entrega y Custodia</span>
                </div>
                <span className="material-symbols-outlined text-[16px] text-outline">expand_more</span>
              </div>
              <div className="ml-space-lg pl-space-md space-y-space-xs mt-space-xs border-l-2 border-primary/20">
                <a 
                  className="flex items-center gap-space-sm px-space-md py-space-xs transition-colors bg-primary-container text-on-primary font-headline-sm rounded-lg cursor-pointer" 
                  onClick={() => {}}
                >
                  <span className="material-symbols-outlined text-[16px]">post_add</span>
                  <span className="font-body-sm text-body-sm font-bold">Nueva Entrega (RF-04)</span>
                </a>
                <a 
                  className="flex items-center gap-space-sm px-space-md py-space-xs text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface rounded-lg transition-colors cursor-pointer"
                  onClick={() => navigate('/devoluciones')}
                >
                  <span className="material-symbols-outlined text-[16px]">keyboard_return</span>
                  <span className="font-body-sm text-body-sm">Devoluciones (Reintegro)</span>
                </a>
                <a 
                  className="flex items-center gap-space-sm px-space-md py-space-xs text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface rounded-lg transition-colors cursor-pointer"
                  onClick={() => navigate('/historial')}
                >
                  <span className="material-symbols-outlined text-[16px]">history</span>
                  <span className="font-body-sm text-body-sm">Historial y Auditoría ({historialActas.length})</span>
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
              <span className="font-code-mono text-code-mono bg-secondary/15 text-secondary font-bold px-space-sm py-0.5 rounded-full text-xs">
                {usuariosDisponibles.length}
              </span>
            </a>

            <a 
              className="flex items-center gap-space-md px-space-md py-space-sm text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface rounded-lg transition-colors cursor-pointer"
              onClick={() => navigate('/registrar-equipo')}
            >
              <span className="material-symbols-outlined text-[20px]">add_circle</span>
              <span className="font-body-md text-body-md">Registrar Hardware (RF-02)</span>
            </a>
          </nav>
        </div>

        {/* Indicador de Conexión Real */}
        <div className="p-space-lg m-space-md bg-surface-container rounded-xl flex items-center gap-space-md border border-surface-container-highest/40">
          <div className="h-9 w-9 rounded-lg bg-secondary text-on-secondary flex items-center justify-center shrink-0 shadow-sm">
            <span className="material-symbols-outlined text-[20px]">cloud_done</span>
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="font-label-sm text-label-sm text-primary uppercase font-bold truncate">Firestore SGI</span>
            <span className="font-body-sm text-body-sm text-outline truncate">
              {usuariosDisponibles.length} Usuarios • {equipos.length} Activos
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
                {deliverer.sede || 'Sede Principal Casalimpia S.A. • Bogotá D.C.'}
              </span>
            </div>

            <div className="relative w-full max-w-md">
              <span className="material-symbols-outlined absolute left-space-md top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
              <input 
                className="w-full h-9 pl-9 pr-space-md bg-surface-container-lowest text-on-surface rounded-lg font-body-sm text-body-sm placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-primary shadow-[0_1px_2px_0_rgba(15,23,42,0.04)]" 
                placeholder="Buscar activo o usuario en inventario..." 
                type="text"
                value={colaboradorSearch}
                onChange={(e) => setColaboradorSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearchColaborador();
                }}
              />
            </div>
          </div>

          <div className="flex items-center gap-space-md shrink-0">
            <button 
              onClick={() => setShowHistorialModal(true)}
              className="h-9 px-space-md flex items-center gap-space-xs rounded-lg text-primary bg-primary/10 hover:bg-primary/20 transition-colors cursor-pointer font-label-sm text-label-sm font-bold"
              title="Consultar Actas en Firestore"
            >
              <span className="material-symbols-outlined text-[18px]">history</span>
              <span>Historial ({historialActas.length})</span>
            </button>

            <div className="h-6 w-px bg-surface-container-highest"></div>

            {/* Perfil del Funcionario Autenticado (Desde BD) */}
            <div className="flex items-center gap-space-md pl-space-xs">
              <div className="flex flex-col text-right hidden sm:flex">
                <span className="font-label-md text-label-md text-on-surface font-bold">
                  {deliverer.nombre}
                </span>
                <span className="font-label-sm text-label-sm text-secondary font-semibold">
                  {deliverer.cargo || deliverer.rol || 'Administrador TI'}
                </span>
              </div>
              <img 
                alt="Foto Perfil" 
                className="w-8 h-8 rounded-full object-cover ring-2 ring-primary/20 shadow-sm" 
                src={deliverer.avatar || 'https://lh3.googleusercontent.com/aida-public/AB6AXuDyAiWOUn9njbbS4sZzxnzDv-_O7nlKMP0d8Uj3JmLf2C_0yjiCZpAy_-U4uCYuUD42dh2KBHFoTT45HDNZZYJ4xGPuondY8OzWlnn7_ZuxW3T5adr-8kHHxYrg8TKac--UfaKWJfhULlk7ZTIvToV2_6HQK6K4NU1fRHrt-A4bVhe1TrF6kp8FaNl7tV6SQ4Q_7jCd97VAYDW2x8agwEazqetgfvCbDatPHJzic_KZM9Czjj8JNoYE6Q'}
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

        {/* CONTENIDO PRINCIPAL: ASIGNACIÓN Y ACTA */}
        <main className="relative pt-16 flex-1 w-full px-gutter-lg pb-space-xl bg-background">
          <div className="flex flex-col w-full pt-4">
            
            {/* Header del Módulo */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md mb-space-lg">
              <div className="flex flex-col gap-space-xs">
                <div className="flex items-center gap-space-xs text-on-surface-variant font-label-sm text-label-sm">
                  <span className="text-secondary font-semibold">SGI CASALIMPIA S.A.</span>
                  <span>/</span>
                  <span>Gestión de Custodias TI</span>
                  <span>/</span>
                  <span className="font-code-mono text-primary font-semibold">RF-03 • RF-04</span>
                </div>
                <h1 className="font-headline-lg text-headline-lg text-primary font-bold tracking-tight">
                  Nueva Asignación y Entrega de Hardware
                </h1>
                <p className="font-body-sm text-body-sm text-on-surface-variant max-w-3xl">
                  Formulario oficial de salida de inventario en tiempo real. Utiliza la información de colaboradores y equipos registrados en la base de datos de Firebase Firestore conforme al Protocolo TI-FO-04.
                </p>
              </div>

              <div className="flex items-center gap-space-sm shrink-0">
                <div className="flex items-center gap-space-xs bg-surface-container-high px-space-md py-space-xs rounded-full">
                  <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold">Protocolo TI-FO-04 v3.2</span>
                </div>
                <div className="font-code-mono text-code-mono bg-primary text-on-primary font-semibold px-space-md py-space-xs rounded-lg shadow-sm">
                  {actaNumero}
                </div>
              </div>
            </div>

            {/* Stepper Informativo de Pasos */}
            <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm mb-space-lg border border-surface-container-high/30">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
                
                {/* Paso 1 */}
                <div className="flex items-center gap-space-md p-space-sm rounded-lg bg-surface-container-low transition-colors">
                  <div className="w-9 h-9 rounded-full bg-secondary text-on-secondary flex items-center justify-center shrink-0 shadow-sm">
                    <span className="material-symbols-outlined text-[20px]">person_check</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-bold">1. Receptor BD</span>
                    <span className="font-headline-sm text-body-md text-on-surface font-semibold truncate">
                      {loadingUsuarios ? 'Cargando usuarios...' : colaborador.nombre}
                    </span>
                  </div>
                </div>

                {/* Paso 2 */}
                <div className="flex items-center gap-space-md p-space-sm rounded-lg bg-surface-container-low transition-colors">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-headline-sm text-label-md font-bold ${currentEquipo.id ? 'bg-primary text-on-primary' : 'bg-surface-container-highest text-outline'}`}>
                    <span className="material-symbols-outlined text-[20px]">laptop_chromebook</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-label-sm text-label-sm uppercase tracking-wider text-primary font-bold">2. Hardware Stock</span>
                    <span className="font-headline-sm text-body-md text-on-surface font-semibold truncate">
                      {currentEquipo.id ? `${currentEquipo.placa} • ${currentEquipo.equipo_nombre}` : 'Sin stock disponible'}
                    </span>
                  </div>
                </div>

                {/* Paso 3 */}
                <div className={`flex items-center gap-space-md p-space-sm rounded-lg transition-colors ${hasSignature ? 'bg-secondary/15' : 'bg-surface-container-low'}`}>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-headline-sm text-label-md ${hasSignature ? 'bg-secondary text-on-secondary' : 'bg-surface-container-highest text-outline'}`}>
                    {hasSignature ? <span className="material-symbols-outlined text-[18px]">verified</span> : <span className="material-symbols-outlined text-[18px]">draw</span>}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className={`font-label-sm text-label-sm uppercase tracking-wider ${hasSignature ? 'text-secondary font-bold' : 'text-outline font-semibold'}`}>
                      {hasSignature ? '3. Firma Capturada' : '3. Firma Receptor'}
                    </span>
                    <span className="font-headline-sm text-body-md text-on-surface font-semibold truncate">
                      Legalización y Custodia
                    </span>
                  </div>
                </div>

              </div>
            </div>

            {/* Formulario (12 cols) dejando Acta en Modal */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg items-start">
              
              {/* ======================================================== */}
              {/* COLUMNA IZQUIERDA: FORMULARIO DINÁMICO DESDE FIRESTORE    */}
              {/* ======================================================== */}
              <div className="xl:col-span-12 flex flex-col gap-space-lg">
                
                {/* BLOQUE A: Colaborador Receptor (Desde Colección 'usuarios') */}
                <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm border border-surface-container-high/30">
                  <div className="flex items-center justify-between pb-space-sm mb-space-md bg-surface-container-low px-space-md py-space-xs rounded-lg">
                    <div className="flex items-center gap-space-sm">
                      <span className="material-symbols-outlined text-primary text-[20px]">badge</span>
                      <span className="font-headline-sm text-body-lg text-primary font-bold">Bloque A: Seleccionar Colaborador Receptor</span>
                    </div>
                    <span className="font-label-sm text-label-sm bg-secondary text-on-secondary px-space-sm py-0.5 rounded-full font-bold">
                      {usuariosDisponibles.length} Registrados en Firestore
                    </span>
                  </div>

                  <div className="flex flex-col gap-space-md">
                    
                    {/* Búsqueda Rápida por Cédula o Nombre */}
                    <div className="flex flex-col gap-space-xs">
                      <div className="flex flex-col gap-space-xs mb-space-sm bg-primary/10 p-space-sm rounded-lg border border-primary/20">
                          <span className="font-label-sm text-label-sm text-primary font-bold">Instrucción:</span>
                          <span className="font-body-sm text-body-sm text-on-surface-variant">
                            Busque el colaborador por su número de documento, nombre o correo corporativo.
                          </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-space-xs">
                      <label className="font-label-sm text-label-sm text-outline hidden">
                        Filtrar por Cédula, Nombre o Correo:
                      </label>
                      <div className="relative w-full">
                        <span className="material-symbols-outlined absolute left-space-md top-1/2 -translate-y-1/2 text-outline text-[18px]">person_search</span>
                        <input 
                          className="w-full h-10 pl-10 pr-4 bg-surface-container-low text-on-surface rounded-lg font-body-sm text-body-sm focus:outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary shadow-xs" 
                          placeholder="Escriba documento o nombre..." 
                          type="text" 
                          value={colaboradorSearch}
                          onChange={(e) => {
                            setColaboradorSearch(e.target.value);
                            setShowColaboradorDocs(true);
                          }}
                          onFocus={() => setShowColaboradorDocs(true)}
                          onBlur={() => setTimeout(() => setShowColaboradorDocs(false), 200)}
                        />
                        {showColaboradorDocs && filteredUsers.length > 0 && (
                          <ul className="absolute z-50 w-full mt-1 bg-surface-container-lowest border border-surface-container-highest/40 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                            {filteredUsers.map(u => (
                              <li 
                                key={u.id}
                                className="px-space-md py-space-sm hover:bg-surface-container cursor-pointer flex flex-col border-b border-surface-container-high/20 last:border-0"
                                onMouseDown={() => {
                                  setSelectedColaboradorId(u.id);
                                  setColaboradorSearch(u.nombre);
                                  setShowColaboradorDocs(false);
                                }}
                              >
                                <span className="font-bold text-on-surface">{u.nombre}</span>
                                <span className="text-xs text-on-surface-variant">C.C. {u.cedula} • {u.cargo}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {showColaboradorDocs && colaboradorSearch.trim() !== '' && filteredUsers.length === 0 && (
                          <div className="absolute z-50 w-full mt-1 bg-surface-container-lowest border border-surface-container-highest/40 rounded-lg shadow-xl p-space-md text-center text-sm text-outline">
                            No se encontraron resultados.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Ficha Dinámica del Colaborador Seleccionado (Desde el documento de Firestore) */}
                    {selectedColaboradorId && (
                      <div className="bg-surface-container-low p-space-md rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-md border border-surface-container-high/40 shadow-xs">
                      <div className="flex items-center gap-space-md">
                        <img 
                          alt="Foto Colaborador" 
                          className="w-14 h-14 rounded-full object-cover shadow-sm ring-2 ring-primary/20" 
                          src={colaborador.avatar || 'https://i.pravatar.cc/150'}
                        />
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-space-xs flex-wrap">
                            <span className="font-headline-sm text-headline-sm text-primary font-bold">
                              {colaborador.nombre}
                            </span>
                            <span className="font-label-sm text-[11px] bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded-full font-bold">
                              {colaborador.rol || 'Empleado'}
                            </span>
                          </div>
                          <div className="flex items-center gap-space-md flex-wrap text-on-surface-variant font-body-sm text-body-sm mt-0.5">
                            <span className="font-code-mono text-code-mono font-semibold text-primary">
                              C.C. {colaborador.cedula}
                            </span>
                            <span>•</span>
                            <span className="font-semibold text-on-surface">{colaborador.cargo || 'Funcionario'}</span>
                          </div>
                          <span className="font-body-sm text-body-sm text-outline truncate">{colaborador.email}</span>
                        </div>
                      </div>
                      <div className="flex flex-col sm:items-end gap-1 shrink-0 bg-surface-container-lowest p-space-sm rounded-lg shadow-xs">
                        <span className="font-label-sm text-label-sm text-outline uppercase font-semibold">Ubicación Institucional</span>
                        <span className="font-label-md text-label-md text-primary font-bold">{colaborador.sede || 'Sede Bogotá'}</span>
                        <span className="font-body-sm text-body-sm text-on-surface-variant">{colaborador.area || 'Operaciones'}</span>
                      </div>
                    </div>
                    )}

                    {/* Selector de Funcionario TI que realiza la Entrega (Custodio TI) */}
                    <div className="pt-space-xs border-t border-surface-container-high/40 flex flex-col gap-space-xs mt-space-md">
                      <label className="font-label-md text-label-md text-on-surface font-semibold flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-primary text-[18px]">verified_user</span>
                        Funcionario TI Responsable de la Entrega (Custodio TI):
                      </label>
                      <div className="flex items-center gap-space-sm p-space-sm bg-surface-container-low rounded-lg border border-surface-container-high/40">
                        <span className="material-symbols-outlined text-secondary text-[24px]">shield_person</span>
                        <div className="flex flex-col">
                          <span className="font-headline-sm text-body-md text-on-surface font-semibold">{deliverer.nombre}</span>
                          <span className="font-body-sm text-[12px] text-on-surface-variant">{deliverer.cargo || deliverer.rol} • {deliverer.sede || 'Sede Principal'}</span>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

                {/* BLOQUE B: Selección del Hardware a Asignar (Desde Colección 'equipos') */}
                <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm border border-surface-container-high/30">
                  <div className="flex items-center justify-between pb-space-sm mb-space-md bg-surface-container-low px-space-md py-space-xs rounded-lg">
                    <div className="flex items-center gap-space-sm">
                      <span className="material-symbols-outlined text-primary text-[20px]">laptop_chromebook</span>
                      <span className="font-headline-sm text-body-lg text-primary font-bold">Bloque B: Selección del Hardware a Asignar</span>
                    </div>
                    <div className="flex items-center gap-space-xs">
                      <button 
                        onClick={() => setVerSoloDisponibles(!verSoloDisponibles)}
                        className="font-label-sm text-label-sm text-primary hover:underline px-space-xs py-0.5 cursor-pointer"
                        type="button"
                      >
                        {verSoloDisponibles ? 'Ver todo el stock' : 'Solo disponibles'}
                      </button>
                      <span className="font-code-mono text-code-mono bg-secondary/15 text-secondary font-bold px-space-sm py-0.5 rounded-full text-xs">
                        {equiposDisponibles.length} Disponibles
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-space-md">
                    
                    {/* Alerta si no hay equipos disponibles */}
                    {equiposDisponibles.length === 0 && (
                      <div className="bg-primary/10 text-primary p-space-md rounded-xl flex items-center justify-between gap-space-md border border-primary/20">
                        <div className="flex items-center gap-space-sm">
                          <span className="material-symbols-outlined text-[24px]">info</span>
                          <span className="font-body-sm text-body-sm">
                            No hay equipos con estado <strong>DISPONIBLE</strong> en Firestore. Puedes cargar equipos de prueba o registrar uno nuevo.
                          </span>
                        </div>
                        <button 
                          onClick={handleSeedEquiposDemo}
                          disabled={isSeedingEquipos}
                          className="px-space-md py-1.5 bg-primary text-on-primary rounded-lg font-label-sm text-label-sm font-bold shrink-0 hover:bg-primary-container transition-colors cursor-pointer shadow-sm"
                        >
                          {isSeedingEquipos ? 'Cargando...' : 'Cargar Equipos Demo'}
                        </button>
                      </div>
                    )}

                    {/* Selector de Hardware en Firestore */}
                    <div className="flex flex-col gap-space-xs">
                      <div className="flex items-center justify-between">
                        <label className="font-label-md text-label-md text-on-surface font-semibold">
                          Seleccionar Equipo del Stock TI en Firestore:
                        </label>
                        <button 
                          onClick={() => navigate('/registrar-equipo')} 
                          className="text-primary hover:underline font-label-sm text-label-sm flex items-center gap-0.5 cursor-pointer"
                          type="button"
                        >
                          <span className="material-symbols-outlined text-[14px]">add_circle</span>
                          Registrar Nuevo Equipo
                        </button>
                      </div>

                      <div className="relative w-full">
                        <span className="material-symbols-outlined absolute left-space-md top-1/2 -translate-y-1/2 text-outline text-[18px]">laptop_chromebook</span>
                        <input 
                          className="w-full h-11 pl-10 pr-4 bg-surface-container-low text-on-surface rounded-lg font-body-sm text-body-sm focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary shadow-xs" 
                          placeholder="Buscar por placa, nombre o serial del equipo..." 
                          type="text" 
                          value={equipoSearch}
                          onChange={(e) => {
                            setEquipoSearch(e.target.value);
                            setShowEquipoDocs(true);
                          }}
                          onFocus={() => setShowEquipoDocs(true)}
                          onBlur={() => setTimeout(() => setShowEquipoDocs(false), 200)}
                        />
                        {showEquipoDocs && filteredEquipos.length > 0 && (
                          <ul className="absolute z-[60] w-full mt-1 bg-surface-container-lowest border border-surface-container-highest/40 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                            {filteredEquipos.map(eq => (
                              <li 
                                key={eq.id}
                                className="px-space-md py-space-sm hover:bg-surface-container cursor-pointer flex flex-col border-b border-surface-container-high/20 last:border-0"
                                onMouseDown={() => {
                                  setSelectedEquipoId(eq.id);
                                  setEquipoSearch(`${eq.equipo_nombre} (Placa: ${eq.placa})`);
                                  setShowEquipoDocs(false);
                                }}
                              >
                                <span className="font-bold text-on-surface">{eq.equipo_nombre} • [{eq.estado || 'DISPONIBLE'}]</span>
                                <span className="text-xs text-on-surface-variant">PLACA: {eq.placa} • SN: {eq.serial}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {showEquipoDocs && equipoSearch.trim() !== '' && filteredEquipos.length === 0 && (
                          <div className="absolute z-[60] w-full mt-1 bg-surface-container-lowest border border-surface-container-highest/40 rounded-lg shadow-xl p-space-md text-center text-sm text-outline">
                            No se encontraron equipos disponibles con ese criterio.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Ficha de Inspección Detallada del Hardware Seleccionado */}
                    {selectedEquipoId && (
                      <div className="bg-surface-container-low p-space-md rounded-xl flex flex-col gap-space-md border border-surface-container-high/40">
                      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-space-md">
                        <div className="flex items-center gap-space-md">
                          <div className="w-12 h-12 rounded-lg bg-primary text-on-primary flex items-center justify-center shrink-0 shadow-sm">
                            <span className="material-symbols-outlined text-[28px]">devices</span>
                          </div>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-space-sm flex-wrap">
                              <span className="font-headline-sm text-headline-sm text-primary font-bold">
                                {currentEquipo.equipo_nombre}
                              </span>
                              <span className="font-label-sm text-label-sm bg-secondary text-on-secondary font-bold px-2 py-0.5 rounded-full">
                                {currentEquipo.estado || 'DISPONIBLE'}
                              </span>
                            </div>
                            <span className="font-body-sm text-body-sm text-on-surface-variant">
                              {currentEquipo.equipo_specs || 'Sin especificaciones detalladas en la base de datos'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-space-sm font-code-mono text-code-mono">
                          <div className="bg-surface-container-lowest px-space-md py-1.5 rounded-lg shadow-xs text-center border border-surface-container-high/40">
                            <span className="font-label-sm text-label-sm text-outline block text-[10px]">PLACA TI</span>
                            <span className="font-bold text-primary">{currentEquipo.placa}</span>
                          </div>
                          <div className="bg-surface-container-lowest px-space-md py-1.5 rounded-lg shadow-xs text-center border border-surface-container-high/40">
                            <span className="font-label-sm text-label-sm text-outline block text-[10px]">SERIAL</span>
                            <span className="font-bold text-on-surface">{currentEquipo.serial}</span>
                          </div>
                        </div>
                      </div>

                      {/* Checklist Técnico de Mesa de Salida */}
                      <div className="bg-surface-container-lowest p-space-md rounded-lg shadow-xs border border-surface-container-high/40">
                        <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline font-bold block mb-space-sm">
                          Verificación Técnica en Mesa de Salida (Control de Calidad)
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-sm">
                          <label className="flex items-center gap-space-sm p-space-xs rounded hover:bg-surface-container cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={qaChecklist.cargadorOriginal}
                              onChange={(e) => setQaChecklist({ ...qaChecklist, cargadorOriginal: e.target.checked })}
                              className="w-4 h-4 rounded text-primary focus:ring-primary accent-primary cursor-pointer"
                            />
                            <span className="font-body-sm text-body-sm text-on-surface">Cargador Original 65W</span>
                          </label>
                          <label className="flex items-center gap-space-sm p-space-xs rounded hover:bg-surface-container cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={qaChecklist.saludBateria}
                              onChange={(e) => setQaChecklist({ ...qaChecklist, saludBateria: e.target.checked })}
                              className="w-4 h-4 rounded text-primary focus:ring-primary accent-primary cursor-pointer"
                            />
                            <span className="font-body-sm text-body-sm text-on-surface">Salud de Batería &gt; 95%</span>
                          </label>
                          <label className="flex items-center gap-space-sm p-space-xs rounded hover:bg-surface-container cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={qaChecklist.pruebaEncendido}
                              onChange={(e) => setQaChecklist({ ...qaChecklist, pruebaEncendido: e.target.checked })}
                              className="w-4 h-4 rounded text-primary focus:ring-primary accent-primary cursor-pointer"
                            />
                            <span className="font-body-sm text-body-sm text-on-surface">Prueba de Encendido OK</span>
                          </label>
                        </div>
                      </div>
                    </div>
                    )}

                  </div>
                </div>

                {/* BLOQUE C: Accesorios y Periféricos Entregados */}
                <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm border border-surface-container-high/30">
                  <div className="flex items-center justify-between pb-space-sm mb-space-md bg-surface-container-low px-space-md py-space-xs rounded-lg">
                    <div className="flex items-center gap-space-sm">
                      <span className="material-symbols-outlined text-primary text-[20px]">inventory_2</span>
                      <span className="font-headline-sm text-body-lg text-primary font-bold">Bloque C: Periféricos y Accesorios Físicos</span>
                    </div>
                    <span className="font-label-sm text-label-sm text-outline">Marque los elementos transferidos</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-space-sm">
                    <label className="flex items-start gap-space-sm p-space-sm bg-surface-container-low rounded-lg cursor-pointer hover:bg-surface-container transition-colors">
                      <input 
                        type="checkbox" 
                        checked={accesorios.maletin}
                        onChange={(e) => setAccesorios({ ...accesorios, maletin: e.target.checked })}
                        className="w-4 h-4 mt-0.5 rounded text-primary accent-primary cursor-pointer" 
                      />
                      <div className="flex flex-col">
                        <span className="font-label-md text-label-md text-on-surface font-semibold">Maletín Corporativo</span>
                        <span className="font-body-sm text-body-sm text-outline">Impermeable logo Casalimpia</span>
                      </div>
                    </label>

                    <label className="flex items-start gap-space-sm p-space-sm bg-surface-container-low rounded-lg cursor-pointer hover:bg-surface-container transition-colors">
                      <input 
                        type="checkbox" 
                        checked={accesorios.mouse}
                        onChange={(e) => setAccesorios({ ...accesorios, mouse: e.target.checked })}
                        className="w-4 h-4 mt-0.5 rounded text-primary accent-primary cursor-pointer" 
                      />
                      <div className="flex flex-col">
                        <span className="font-label-md text-label-md text-on-surface font-semibold">Mouse Inalámbrico Logitech</span>
                        <span className="font-body-sm text-body-sm text-outline">M185 con batería AA y Dongle</span>
                      </div>
                    </label>

                    <label className="flex items-start gap-space-sm p-space-sm bg-surface-container-low rounded-lg cursor-pointer hover:bg-surface-container transition-colors">
                      <input 
                        type="checkbox" 
                        checked={accesorios.cargador}
                        onChange={(e) => setAccesorios({ ...accesorios, cargador: e.target.checked })}
                        className="w-4 h-4 mt-0.5 rounded text-primary accent-primary cursor-pointer" 
                      />
                      <div className="flex flex-col">
                        <span className="font-label-md text-label-md text-on-surface font-semibold">Adaptador Corriente 65W</span>
                        <span className="font-body-sm text-body-sm text-outline">Cable trifásico original</span>
                      </div>
                    </label>

                    <label className="flex items-start gap-space-sm p-space-sm bg-surface-container-low rounded-lg cursor-pointer hover:bg-surface-container transition-colors">
                      <input 
                        type="checkbox" 
                        checked={accesorios.guaya}
                        onChange={(e) => setAccesorios({ ...accesorios, guaya: e.target.checked })}
                        className="w-4 h-4 mt-0.5 rounded text-primary accent-primary cursor-pointer" 
                      />
                      <div className="flex flex-col">
                        <span className="font-label-md text-label-md text-on-surface font-semibold">Guaya Kensington</span>
                        <span className="font-body-sm text-body-sm text-outline">Candado de seguridad con 2 llaves</span>
                      </div>
                    </label>

                    <label className="flex items-start gap-space-sm p-space-sm bg-surface-container-low rounded-lg cursor-pointer hover:bg-surface-container transition-colors">
                      <input 
                        type="checkbox" 
                        checked={accesorios.diadema}
                        onChange={(e) => setAccesorios({ ...accesorios, diadema: e.target.checked })}
                        className="w-4 h-4 mt-0.5 rounded text-primary accent-primary cursor-pointer" 
                      />
                      <div className="flex flex-col">
                        <span className="font-label-md text-label-md text-on-surface font-semibold">Diadema Jabra Evolve 20</span>
                        <span className="font-body-sm text-body-sm text-outline">Conexión USB Teams</span>
                      </div>
                    </label>

                    <label className="flex items-start gap-space-sm p-space-sm bg-surface-container-low rounded-lg cursor-pointer hover:bg-surface-container transition-colors">
                      <input 
                        type="checkbox" 
                        checked={accesorios.hub}
                        onChange={(e) => setAccesorios({ ...accesorios, hub: e.target.checked })}
                        className="w-4 h-4 mt-0.5 rounded text-primary accent-primary cursor-pointer" 
                      />
                      <div className="flex flex-col">
                        <span className="font-label-md text-label-md text-on-surface font-semibold">Hub Multipuesto USB-C</span>
                        <span className="font-body-sm text-body-sm text-outline">HDMI + 3 puertos USB 3.0</span>
                      </div>
                    </label>
                  </div>

                  {/* Accesorio extra opcional */}
                  <div className="mt-space-sm pt-space-xs border-t border-surface-container-high/40">
                    <input 
                      type="text" 
                      value={accesorioExtra}
                      onChange={(e) => setAccesorioExtra(e.target.value)}
                      placeholder="Añadir accesorio adicional (ej. Adaptador DisplayPort, Teclado externo)..."
                      className="w-full h-9 px-space-md bg-surface-container-low text-on-surface rounded-lg font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
                    />
                  </div>
                </div>

                {/* BLOQUE D: Términos Legales y Fecha del Acta */}
                <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm border border-surface-container-high/30">
                  <div className="flex items-center justify-between pb-space-sm mb-space-md bg-surface-container-low px-space-md py-space-xs rounded-lg">
                    <div className="flex items-center gap-space-sm">
                      <span className="material-symbols-outlined text-primary text-[20px]">gavel</span>
                      <span className="font-headline-sm text-body-lg text-primary font-bold">Bloque D: Fecha, Términos y Observaciones</span>
                    </div>
                    <span className="font-label-sm text-label-sm font-code-mono text-outline">POL-TI-CASALIMPIA</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md mb-space-md">
                    <div className="flex flex-col gap-space-xs">
                      <label className="font-label-sm text-label-sm text-outline font-semibold">Fecha de Emisión del Acta:</label>
                      <input 
                        type="text" 
                        value={fechaActa}
                        onChange={(e) => setFechaActa(e.target.value)}
                        className="w-full h-10 px-space-md bg-surface-container-low text-on-surface rounded-lg font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-primary shadow-xs font-semibold"
                      />
                    </div>
                    <div className="flex flex-col gap-space-xs">
                      <label className="font-label-sm text-label-sm text-outline font-semibold">Número de Consecutivo Legal:</label>
                      <input 
                        type="text" 
                        value={actaNumero}
                        onChange={(e) => setActaNumero(e.target.value)}
                        className="w-full h-10 px-space-md bg-surface-container-low text-primary rounded-lg font-code-mono text-body-sm focus:outline-none focus:ring-1 focus:ring-primary shadow-xs font-bold"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-space-md">
                    <div className="flex flex-col gap-space-xs">
                      <label className="font-label-md text-label-md text-on-surface font-semibold">
                        Observaciones de Configuración y Software Precargado:
                      </label>
                      <textarea 
                        className="w-full p-space-sm bg-surface-container-low text-on-surface rounded-lg font-body-sm text-body-sm focus:outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary shadow-xs" 
                        rows={3}
                        value={observaciones}
                        onChange={(e) => setObservaciones(e.target.value)}
                      />
                    </div>

                    <div className="p-space-md bg-surface-container-low rounded-lg flex gap-space-md items-start">
                      <span className="material-symbols-outlined text-primary text-[22px] shrink-0 mt-0.5">policy</span>
                      <div className="flex flex-col gap-1">
                        <span className="font-label-md text-label-md text-primary font-bold">Cláusula de Custodia y Responsabilidad Legal</span>
                        <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                          El colaborador receptor asume la custodia, conservación y buen uso del equipo de cómputo y periféricos descritos, reconociendo que son herramientas exclusivas para el desempeño de sus labores en <strong className="text-on-surface">CASALIMPIA S.A.</strong> Cualquier daño imputable a dolo o negligencia grave será procesado conforme al Reglamento Interno de Trabajo y la legislación colombiana vigente.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* ======================================================== */}
              {/* COLUMNA DERECHA: VISTA PREVIA DEL ACTA EN VIVO (5 cols)   */}
              {/* ======================================================== */}
              <div className="xl:col-span-12 flex flex-col gap-space-md">
                
                {/* Barra de Acciones del Acta */}
                <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex items-center justify-between gap-space-sm border border-surface-container-high/30">
                  <div className="flex items-center gap-space-xs">
                    <span className="w-2.5 h-2.5 rounded-full bg-secondary animate-pulse"></span>
                    <span className="font-label-sm text-label-sm text-on-surface font-bold uppercase tracking-wider">Acta en Vista Previa (En Vivo)</span>
                  </div>
                  <div className="flex items-center gap-space-xs">
                    <button 
                      onClick={() => handleGenerateOfficialActa()}
                      className="p-space-xs text-on-surface-variant hover:text-primary rounded hover:bg-surface-container transition-colors cursor-pointer" 
                      title="Imprimir acta oficial / Guardar PDF" 
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[20px]">print</span>
                    </button>
                  </div>
                </div>

                {/* DOCUMENTO OFICIAL TI-FO-04 (Simulación de Acta Legal) */}
                <div className="bg-surface-container-lowest rounded-xl shadow-md p-space-lg flex flex-col gap-space-md text-on-surface relative overflow-hidden border border-surface-container-high/40 print:shadow-none">
                  
                  {/* Marca de agua institucional */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-[0.03] select-none">
                    <span className="font-display-lg text-[120px] font-black tracking-widest text-primary rotate-[-25deg]">CASALIMPIA</span>
                  </div>

                  {/* Cabecera del Acta */}
                  <div className="flex items-start justify-between pb-space-md bg-surface-container-low p-space-md rounded-lg">
                    <div className="flex items-center gap-space-sm">
                      <div className="w-10 h-10 rounded bg-primary flex items-center justify-center text-on-primary font-headline-sm font-black">
                        CL
                      </div>
                      <div className="flex flex-col">
                        <span className="font-headline-sm text-label-md text-primary font-bold leading-tight">CASALIMPIA S.A.</span>
                        <span className="font-label-sm text-label-sm text-outline">NIT: 860.038.324-1</span>
                        <span className="font-label-sm text-[10px] text-secondary font-semibold uppercase">Gestión TI • ISO 27001</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end text-right">
                      <span className="font-code-mono text-label-md font-bold text-primary">TI-FO-04</span>
                      <span className="font-code-mono text-label-sm text-outline">Acta N°: {actaNumero}</span>
                      <span className="font-label-sm text-label-sm text-on-surface-variant mt-0.5">{fechaActa}</span>
                    </div>
                  </div>

                  {/* Título del Documento */}
                  <div className="text-center py-space-xs">
                    <h2 className="font-headline-sm text-headline-sm text-primary font-bold uppercase tracking-tight">
                      Acta de Entrega de Equipos Tecnológicos
                    </h2>
                    <span className="font-body-sm text-label-sm text-outline">Custodia de Bienes Informáticos y Periféricos</span>
                  </div>

                  {/* Sección 1: Datos del Asignatario (100% DINÁMICO DE FIRESTORE) */}
                  <div className="bg-surface-container-low p-space-sm rounded-lg flex flex-col gap-1 border border-surface-container-high/30">
                    <div className="flex items-center justify-between">
                      <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline font-bold">1. Datos del Asignatario Receptor</span>
                      <span className="font-code-mono text-label-sm text-secondary font-bold">C.C. {colaborador.cedula}</span>
                    </div>
                    <span className="font-headline-sm text-body-md text-on-surface font-bold">{colaborador.nombre}</span>
                    <div className="grid grid-cols-2 gap-x-space-md text-body-sm text-on-surface-variant">
                      <span>Cargo: <strong className="text-on-surface">{colaborador.cargo || 'Funcionario'}</strong></span>
                      <span>Área: <strong className="text-on-surface">{colaborador.area || 'Operaciones'}</strong></span>
                      <span>Sede: <strong className="text-on-surface">{colaborador.sede || 'Bogotá'}</strong></span>
                      <span>Correo: <span className="font-code-mono text-[11px] truncate">{colaborador.email}</span></span>
                    </div>
                  </div>

                  {/* Sección 2: Especificación del Activo Principal (100% DINÁMICO DE FIRESTORE) */}
                  <div className="bg-surface-container-low p-space-sm rounded-lg flex flex-col gap-1 border border-surface-container-high/30">
                    <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline font-bold">2. Especificación del Activo Principal</span>
                    <div className="flex items-center justify-between">
                      <span className="font-headline-sm text-body-md text-primary font-bold">{currentEquipo.equipo_nombre}</span>
                      <span className="font-code-mono text-code-mono bg-surface-container-highest px-space-xs py-0.5 rounded text-primary font-bold text-xs">
                        PLACA: {currentEquipo.placa}
                      </span>
                    </div>
                    <div className="font-code-mono text-code-mono text-on-surface-variant flex items-center justify-between text-xs">
                      <span>SERIE: {currentEquipo.serial}</span>
                      <span className="text-secondary font-semibold">ESTADO: {currentEquipo.estado || 'DISPONIBLE'}</span>
                    </div>
                  </div>

                  {/* Sección 3: Periféricos y Accesorios Relacionados */}
                  <div className="bg-surface-container-low p-space-sm rounded-lg flex flex-col gap-1 border border-surface-container-high/30">
                    <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline font-bold">3. Periféricos y Accesorios Relacionados</span>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1 font-body-sm text-body-sm text-on-surface">
                      {accesorios.maletin && <li className="flex items-center gap-1"><span className="text-secondary">•</span> Maletín corporativo</li>}
                      {accesorios.mouse && <li className="flex items-center gap-1"><span className="text-secondary">•</span> Mouse Logitech M185</li>}
                      {accesorios.cargador && <li className="flex items-center gap-1"><span className="text-secondary">•</span> Cargador original 65W</li>}
                      {accesorios.guaya && <li className="flex items-center gap-1"><span className="text-secondary">•</span> Guaya de seguridad</li>}
                      {accesorios.diadema && <li className="flex items-center gap-1"><span className="text-secondary">•</span> Diadema Jabra Teams</li>}
                      {accesorios.hub && <li className="flex items-center gap-1"><span className="text-secondary">•</span> Hub Multipuesto USB-C</li>}
                      {accesorioExtra.trim() && <li className="flex items-center gap-1 text-primary font-semibold"><span className="text-secondary">•</span> {accesorioExtra.trim()}</li>}
                    </ul>
                  </div>

                  {/* Sección 4: Firmas de Legalización */}
                  <div className="flex flex-col gap-space-sm mt-space-xs">
                    <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline font-bold">4. Conformidad y Firmas de Legalización</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
                      
                      {/* Firma Entrega por TI (Dinámico del Funcionario TI Seleccionado) */}
                      <div className="bg-surface-container-low p-space-sm rounded-lg flex flex-col items-center justify-between text-center min-h-[140px] border border-surface-container-high/30">
                        <span className="font-label-sm text-label-sm text-outline uppercase font-semibold">Entrega por TI</span>
                        <div className="flex flex-col items-center py-space-xs">
                          <span className="font-headline-sm text-headline-sm text-primary font-bold italic font-serif">
                            {deliverer.nombre}
                          </span>
                          <span className="font-code-mono text-[10px] text-secondary font-bold">CERT-HASH: 78a9c2...44f0</span>
                          <span className="font-label-sm text-[10px] text-outline">{fechaActa}</span>
                        </div>
                        <div className="w-full pt-1 bg-surface-container-high rounded text-center">
                          <span className="font-label-sm text-label-sm text-primary font-bold block truncate">
                            {deliverer.nombre}
                          </span>
                          <span className="font-body-sm text-[11px] text-outline block truncate">
                            {deliverer.cargo || deliverer.rol || 'Administrador TI'} • {deliverer.sede || 'Casalimpia'}
                          </span>
                        </div>
                      </div>

                      {/* Firma Receptor Digital (Dinámico del colaborador seleccionado) */}
                      <div className="bg-surface-container p-space-sm rounded-lg flex flex-col items-center justify-between text-center min-h-[140px] border border-surface-container-high/30">
                        <div className="w-full flex items-center justify-between">
                          <span className="font-label-sm text-label-sm text-primary uppercase font-bold">Firma Receptor</span>
                          <button 
                            onClick={handleClearSignature} 
                            className="font-label-sm text-[11px] text-error hover:underline flex items-center gap-0.5 cursor-pointer" 
                            type="button"
                          >
                            <span className="material-symbols-outlined text-[14px]">ink_eraser</span>
                            Limpiar
                          </button>
                        </div>
                        
                        {/* Canvas de Firma Digital */}
                        <div className="relative w-full h-16 bg-surface-container-lowest rounded flex items-center justify-center overflow-hidden cursor-crosshair shadow-inner my-1">
                          <canvas ref={canvasRef} className="w-full h-full block" id="signaturePad" />
                          {!hasSignature && (
                            <div className="absolute pointer-events-none flex flex-col items-center text-outline">
                              <span className="material-symbols-outlined text-[18px]">draw</span>
                              <span className="font-label-sm text-[10px]">Firme aquí con el cursor o pantalla táctil</span>
                            </div>
                          )}
                        </div>

                        <div className="w-full pt-1 bg-surface-container-high rounded text-center">
                          <span className="font-label-sm text-label-sm text-on-surface font-bold block truncate">{colaborador.nombre}</span>
                          <span className="font-body-sm text-[11px] text-outline block truncate">C.C. {colaborador.cedula}</span>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Pie Legal del Acta */}
                  <div className="pt-space-xs text-center text-outline font-body-sm text-[11px] leading-tight">
                    Documento electrónico con plena validez jurídica según la Ley 527 de 1999 de Colombia. Generado por el Sistema de Gestión de Inventario SGI CASALIMPIA.
                  </div>

                </div>

                {/* Panel de Botones de Acción */}
                <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col gap-space-sm border border-surface-container-high/30">
                  <button 
                    onClick={handleConfirmDelivery}
                    disabled={isSubmitting || !currentEquipo.id || !colaborador.id}
                    className="w-full h-12 bg-secondary text-on-secondary rounded-lg font-headline-sm text-body-md font-bold flex items-center justify-center gap-space-sm hover:opacity-95 transition-opacity shadow-md disabled:opacity-50 cursor-pointer" 
                    id="btnConfirmDelivery" 
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {isSubmitting ? 'sync' : 'verified_user'}
                    </span>
                    {isSubmitting ? 'Legalizando y Asignando en Firestore...' : 'Confirmar y Guardar Entrega'}
                  </button>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
                    <button 
                      onClick={() => handleGenerateOfficialActa()} 
                      className="h-10 px-space-sm bg-primary text-on-primary rounded-lg font-label-md text-label-md flex items-center justify-center gap-space-xs hover:bg-primary-container transition-colors shadow-sm cursor-pointer" 
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
                      Descargar / Imprimir Acta (PDF)
                    </button>
                    <button 
                      onClick={() => alert(`Copia electrónica del acta ${actaNumero} programada para enviarse a: ${colaborador.email}`)} 
                      className="h-9 px-space-sm bg-surface-container-high text-primary rounded-lg font-label-md text-label-md flex items-center justify-center gap-space-xs hover:bg-surface-container-highest transition-colors cursor-pointer" 
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[18px]">forward_to_inbox</span>
                      Enviar Copia al Correo
                    </button>
                  </div>

                  <button 
                    onClick={() => navigate('/inventario')} 
                    className="h-8 text-outline hover:text-error rounded font-label-sm text-label-sm transition-colors text-center cursor-pointer" 
                    type="button"
                  >
                    Cancelar y Volver al Inventario
                  </button>
                </div>

                {/* Etiqueta de Trazabilidad ISO */}
                <div className="p-space-sm bg-surface-container-low rounded-lg flex items-center gap-space-sm border border-surface-container-high/30">
                  <span className="material-symbols-outlined text-secondary text-[18px]">verified</span>
                  <div className="flex flex-col min-w-0">
                    <span className="font-label-sm text-label-sm text-primary font-bold">Trazabilidad ISO/IEC 27001 • Casalimpia S.A.</span>
                    <span className="font-body-sm text-[11px] text-outline truncate">
                      La asignación actualiza el hardware a estado ASIGNADO y registra el acta en Firestore.
                    </span>
                  </div>
                </div>

              </div>

            </div>

          </div>
        </main>

        {/* FOOTER */}
        <footer className="w-full bg-surface-container-lowest shadow-[0_-1px_4px_rgba(0,0,0,0.02)] py-space-md px-gutter-lg border-t border-surface-container-high/30">
          <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-space-xs text-outline">
            <span className="font-body-sm text-body-sm">CASALIMPIA S.A. - Tecnológico de Antioquia PPI 2026</span>
            <div className="flex items-center gap-space-md font-code-mono text-code-mono text-outline-variant">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-secondary"></span>
                Base de Datos Conectada
              </span>
              <span>v2.5.0</span>
            </div>
          </div>
        </footer>
      </div>

      {/* ======================================================== */}
      {/* MODAL: HISTORIAL DE ACTAS LEGALIZADAS EN FIRESTORE        */}
      {/* ======================================================== */}
      {showHistorialModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="px-6 py-4 bg-primary text-on-primary flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[24px]">history_edu</span>
                <h3 className="font-headline-sm text-headline-sm font-bold">
                  Historial de Actas Legalizadas en Firestore ({historialActas.length})
                </h3>
              </div>
              <button 
                onClick={() => {
                  setShowHistorialModal(false);
                  setActaEnDetalle(null);
                }}
                className="hover:bg-primary-container p-1.5 rounded-full transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {historialActas.length === 0 ? (
                <div className="py-12 text-center flex flex-col items-center gap-2 text-outline">
                  <span className="material-symbols-outlined text-[48px]">assignment_late</span>
                  <span className="font-headline-sm text-body-lg font-bold">Aún no se han legalizado actas en Firestore</span>
                  <span className="font-body-sm text-body-sm">Completa una asignación arriba para registrar la primera acta digital.</span>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {historialActas.map((acta) => (
                    <div 
                      key={acta.id} 
                      className="p-4 rounded-xl bg-surface-container-low border border-surface-container-high/50 hover:border-primary transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-[22px]">description</span>
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-code-mono font-bold text-primary">{acta.acta_numero}</span>
                            <span className="text-outline text-xs">•</span>
                            <span className="font-label-sm text-xs text-outline">{acta.fecha}</span>
                            <span className="font-code-mono text-[11px] bg-secondary/10 text-secondary px-2 py-0.5 rounded font-bold">
                              {acta.cert_hash}
                            </span>
                          </div>
                          <span className="font-bold text-on-surface mt-1">
                            {acta.equipo_nombre} (Placa: {acta.placa})
                          </span>
                          <span className="text-body-sm text-on-surface-variant">
                            Receptor: <strong>{acta.colaborador?.nombre}</strong> (C.C. {acta.colaborador?.cedula}) • {acta.colaborador?.sede}
                          </span>
                          <span className="text-[11px] text-outline">
                            Entregado por: {typeof acta.entregado_por === 'object' ? acta.entregado_por?.nombre : acta.entregado_por}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                        <button 
                          onClick={() => {
                            // Cargar datos en el preview principal
                            if (acta.colaborador?.id) setSelectedColaboradorId(acta.colaborador.id);
                            if (acta.equipo_id) setSelectedEquipoId(acta.equipo_id);
                            setActaNumero(acta.acta_numero);
                            setFechaActa(acta.fecha);
                            setShowHistorialModal(false);
                          }}
                          className="px-3 py-1.5 bg-surface-container-high text-primary hover:bg-surface-container-highest rounded-lg font-label-sm text-xs font-bold transition-colors cursor-pointer"
                        >
                          Cargar en Vista Previa
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-3 bg-surface-container-low border-t border-surface-container-high/40 flex justify-end">
              <button 
                onClick={() => setShowHistorialModal(false)}
                className="px-space-md py-1.5 bg-primary text-on-primary rounded-lg font-label-sm text-label-sm font-bold cursor-pointer"
              >
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: ACTA LEGALIZADA Y DESCARGA OFICIAL (PDF)           */}
      {/* ======================================================== */}
      {createdActaModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-surface-container-high/60 p-6 flex flex-col gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-secondary/15 text-secondary flex items-center justify-center mx-auto shadow-sm">
              <span className="material-symbols-outlined text-[36px]">verified</span>
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="font-headline-sm text-headline-sm font-black text-primary">
                ¡Acta Legalizada Exitosamente!
              </h3>
              <span className="font-code-mono font-bold text-secondary text-sm">
                {createdActaModal.acta_numero}
              </span>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                El hardware <strong>{createdActaModal.placa} ({createdActaModal.equipo_nombre})</strong> ha quedado asignado a <strong>{createdActaModal.colaborador?.nombre}</strong> y el registro fue almacenado permanentemente en el Historial de Firestore.
              </p>
            </div>

            <div className="flex flex-col gap-2 mt-2">
              <button 
                onClick={() => handleGenerateOfficialActa(createdActaModal)}
                className="w-full h-12 bg-primary text-on-primary rounded-xl font-headline-sm text-body-md font-bold flex items-center justify-center gap-2 hover:bg-primary-container transition-all shadow-md cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">picture_as_pdf</span>
                Descargar / Imprimir Acta Oficial TI-FO-04 (PDF)
              </button>
              
              <button 
                onClick={() => navigate('/historial')}
                className="w-full h-11 bg-surface-container-high text-primary rounded-xl font-label-md text-label-md font-bold flex items-center justify-center gap-2 hover:bg-surface-container-highest transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">history</span>
                Ver en el Historial de Movimientos
              </button>

              <button 
                onClick={() => {
                  setCreatedActaModal(null);
                  navigate('/inventario');
                }}
                className="w-full h-9 text-outline hover:text-on-surface rounded-lg font-label-sm text-xs transition-colors cursor-pointer"
              >
                Volver al Inventario de Activos
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
