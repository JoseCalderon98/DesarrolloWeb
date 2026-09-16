import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  collection, 
  onSnapshot, 
  query, 
  doc, 
  updateDoc, 
  addDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../firebase';
import { getStoredUser } from '../utils/userHelpers';
import { generateAndPrintActa } from '../utils/actaPrintService';

export default function Devoluciones() {
  const navigate = useNavigate();
  const storedSession = getStoredUser();

  // 1. Estados de Datos desde Firestore
  const [equipos, setEquipos] = useState([]);
  const [usuariosDisponibles, setUsuariosDisponibles] = useState([]);
  const [loadingEquipos, setLoadingEquipos] = useState(true);
  const [loadingUsuarios, setLoadingUsuarios] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [createdActaModal, setCreatedActaModal] = useState(null);

  // 2. Selección de Equipo Asignado a Devolver
  const [selectedEquipoId, setSelectedEquipoId] = useState('');
  const [equipoSearch, setEquipoSearch] = useState('');
  const [verSoloAsignados, setVerSoloAsignados] = useState(true);

  // 3. Funcionario TI que Recibe el Reintegro
  const [selectedReceivingTIId, setSelectedReceivingTIId] = useState('');

  // 4. Parámetros del Acta de Reintegro TI-FO-05
  const [actaNumero, setActaNumero] = useState(
    () => `DEV-${new Date().getFullYear()}-0${Math.floor(100 + Math.random() * 900)}`
  );
  const [fechaActa, setFechaActa] = useState(() => {
    return new Intl.DateTimeFormat('es-CO', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(new Date());
  });

  // 5. Diagnóstico de Entrada / Inspección Técnica
  const [condicionFisica, setCondicionFisica] = useState('10/10 Excelente Estado');
  const [nuevoEstado, setNuevoEstado] = useState('DISPONIBLE');
  const [nuevaUbicacion, setNuevaUbicacion] = useState('Bodega Central TI - Rack A1');
  const [motivoDevolucion, setMotivoDevolucion] = useState('Renovación de Equipo / Fin de Custodia');

  // Checklist de Verificación de Reintegro
  const [checklistDevolucion, setChecklistDevolucion] = useState({
    cargadorOriginal: true,
    pantallaIntacta: true,
    tecladoOperativo: true,
    bateriaOptima: true,
    borradoSeguroISO: true,
    desvinculacionCuentas: true
  });

  // Accesorios recibidos
  const [accesoriosDevueltos, setAccesoriosDevueltos] = useState({
    maletin: true,
    mouse: true,
    cargador: true,
    guaya: true,
    diadema: true,
    hub: false
  });
  const [observacionesTecnicas, setObservacionesTecnicas] = useState(
    'Equipo recibido en mesa técnica de soporte. Se constata serial original, componentes íntegros y se inicia protocolo de sanitización digital y borrado seguro conforme a la norma ISO/IEC 27001.'
  );

  // 6. Canvas de Firma Digital (Quien Devuelve / Colaborador)
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

  // Cargar Equipos desde Firestore
  useEffect(() => {
    const qEquipos = query(collection(db, "equipos"));
    const unsub = onSnapshot(qEquipos, (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setEquipos(list);
      setLoadingEquipos(false);

      // Auto-seleccionar primer equipo asignado
      const asignados = list.filter(e => e.estado === 'ASIGNADO');
      if (asignados.length > 0 && !selectedEquipoId) {
        setSelectedEquipoId(asignados[0].id);
      } else if (list.length > 0 && !selectedEquipoId) {
        setSelectedEquipoId(list[0].id);
      }
    }, (err) => {
      console.error("Error Firestore Equipos:", err);
      setLoadingEquipos(false);
    });
    return () => unsub();
  }, []);

  // Cargar Usuarios desde Firestore
  useEffect(() => {
    const qUsers = query(collection(db, "usuarios"));
    const unsub = onSnapshot(qUsers, (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setUsuariosDisponibles(list);
      setLoadingUsuarios(false);

      if (list.length > 0 && !selectedReceivingTIId) {
        // Seleccionar usuario activo o funcionario con rol Administrador/Soporte
        const matchSession = list.find(u => u.email === storedSession?.email);
        const defaultTI = matchSession || list.find(u => u.rol === 'Administrador' || u.rol === 'Soporte TI') || list[0];
        setSelectedReceivingTIId(defaultTI.id);
      }
    }, (err) => {
      console.error("Error Firestore Usuarios:", err);
      setLoadingUsuarios(false);
    });
    return () => unsub();
  }, []);

  // ----------------------------------------------------
  // DERIVACIONES DINÁMICAS
  // ----------------------------------------------------
  const equiposAsignados = equipos.filter(e => e.estado === 'ASIGNADO');
  const equiposVisibles = verSoloAsignados ? equiposAsignados : equipos;

  const currentEquipo = equipos.find(e => e.id === selectedEquipoId) || {
    id: '',
    placa: 'Sin equipo',
    equipo_nombre: loadingEquipos ? 'Cargando equipos...' : 'Seleccione un equipo asignado',
    equipo_specs: 'Sin datos',
    serial: '---',
    estado: 'DISPONIBLE',
    asignatario: 'Bodega Central TI',
    asignatario_cc: '---',
    asignatario_email: '---',
    ubicacion: 'Bodega Principal'
  };

  // Buscar colaborador asignado en la colección usuarios si existe match
  const colaboradorAsignado = usuariosDisponibles.find(u => 
    (u.nombre && currentEquipo.asignatario && u.nombre.toLowerCase().trim() === currentEquipo.asignatario.toLowerCase().trim()) ||
    (u.cedula && currentEquipo.asignatario_cc && u.cedula === currentEquipo.asignatario_cc) ||
    (u.email && currentEquipo.asignatario_email && u.email.toLowerCase().trim() === currentEquipo.asignatario_email.toLowerCase().trim())
  ) || {
    nombre: currentEquipo.asignatario || 'Colaborador Custodio',
    cedula: currentEquipo.asignatario_cc || 'No especificada',
    email: currentEquipo.asignatario_email || 'Sin correo asociado',
    cargo: 'Funcionario',
    sede: currentEquipo.ubicacion?.split('•')[0] || 'Sede Principal',
    area: currentEquipo.ubicacion?.split('•')[1] || 'Operaciones'
  };

  // Funcionario TI que recibe
  const receivingTIUser = usuariosDisponibles.find(u => u.id === selectedReceivingTIId) || {
    id: '',
    nombre: storedSession?.nombre || 'Técnico Soporte TI',
    cargo: storedSession?.cargo || 'Soporte TI',
    sede: storedSession?.sede || 'Bogotá',
    email: storedSession?.email || ''
  };

  const funcionariosTI = usuariosDisponibles.filter(u => 
    u.rol === 'Administrador' || u.rol === 'Soporte TI'
  );
  const tiOptions = funcionariosTI.length > 0 ? funcionariosTI : usuariosDisponibles;

  // Búsqueda interactiva de equipo asignado
  const handleSearchEquipo = () => {
    if (!equipoSearch.trim()) return;
    const q = equipoSearch.toLowerCase().trim();
    const match = equipos.find(e => 
      (e.placa || '').toLowerCase().includes(q) ||
      (e.serial || '').toLowerCase().includes(q) ||
      (e.asignatario || '').toLowerCase().includes(q) ||
      (e.equipo_nombre || '').toLowerCase().includes(q)
    );
    if (match) {
      setSelectedEquipoId(match.id);
    } else {
      alert("No se encontró ningún equipo en la base de datos con ese criterio de búsqueda.");
    }
  };

  // ----------------------------------------------------
  // INICIALIZAR CANVAS DE FIRMA DIGITAL
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
      return { x: clientX - rect.left, y: clientY - rect.top };
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

  // Función para generar e imprimir el Acta Oficial TI-FO-05 (PDF sin capturas de pantalla)
  const handleGenerateOfficialActa = (customData = null) => {
    let signatureDataUrl = null;
    if (hasSignature && canvasRef.current) {
      signatureDataUrl = canvasRef.current.toDataURL('image/png');
    }

    const accesoriosList = [];
    if (accesoriosDevueltos.maletin) accesoriosList.push('Maletín corporativo impermeable');
    if (accesoriosDevueltos.mouse) accesoriosList.push('Mouse inalámbrico con Dongle USB');
    if (accesoriosDevueltos.cargador) accesoriosList.push('Adaptador Corriente Original 65W');
    if (accesoriosDevueltos.guaya) accesoriosList.push('Guaya Kensington con llaves');
    if (accesoriosDevueltos.diadema) accesoriosList.push('Diadema Jabra Teams USB');
    if (accesoriosDevueltos.hub) accesoriosList.push('Hub Multipuesto USB-C');

    const data = customData || {
      acta_numero: actaNumero,
      fecha: fechaActa,
      equipo_id: currentEquipo.id,
      placa: currentEquipo.placa,
      equipo_nombre: currentEquipo.equipo_nombre,
      serial: currentEquipo.serial,
      nuevo_estado: nuevoEstado,
      categoria: currentEquipo.categoria || 'Portátiles Corporativos',
      equipo_specs: currentEquipo.equipo_specs,
      entregado_por_colaborador: {
        nombre: colaboradorAsignado.nombre,
        cedula: colaboradorAsignado.cedula,
        cargo: colaboradorAsignado.cargo,
        email: colaboradorAsignado.email,
        sede: colaboradorAsignado.sede
      },
      recibido_por_ti: {
        nombre: receivingTIUser.nombre,
        cargo: receivingTIUser.cargo || receivingTIUser.rol,
        sede: receivingTIUser.sede
      },
      accesorios_recibidos: accesoriosList,
      observaciones: observacionesTecnicas,
      cert_hash: 'DEV-CERT-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      firma_colaborador_img: signatureDataUrl
    };

    generateAndPrintActa(data, 'DEVOLUCION');
  };

  // ----------------------------------------------------
  // PROCESAR Y CONFIRMAR REINTEGRO EN FIRESTORE
  // ----------------------------------------------------
  const handleConfirmReturn = async () => {
    if (!currentEquipo.id) {
      alert("Por favor seleccione un equipo asignado de la base de datos.");
      return;
    }

    try {
      setIsSubmitting(true);

      const accesoriosList = [];
      if (accesoriosDevueltos.maletin) accesoriosList.push('Maletín corporativo impermeable');
      if (accesoriosDevueltos.mouse) accesoriosList.push('Mouse inalámbrico con Dongle USB');
      if (accesoriosDevueltos.cargador) accesoriosList.push('Adaptador Corriente Original 65W');
      if (accesoriosDevueltos.guaya) accesoriosList.push('Guaya Kensington con llaves');
      if (accesoriosDevueltos.diadema) accesoriosList.push('Diadema Jabra Teams USB');
      if (accesoriosDevueltos.hub) accesoriosList.push('Hub Multipuesto USB-C');

      let signatureDataUrl = null;
      if (hasSignature && canvasRef.current) {
        signatureDataUrl = canvasRef.current.toDataURL('image/png');
      }

      const certHash = 'DEV-CERT-' + Math.random().toString(36).substring(2, 10).toUpperCase();

      // 1. Guardar Acta de Devolución en colección Firestore 'actas_devolucion'
      const returnDocRef = await addDoc(collection(db, 'actas_devolucion'), {
        acta_numero: actaNumero,
        fecha: fechaActa,
        equipo_id: currentEquipo.id,
        placa: currentEquipo.placa,
        equipo_nombre: currentEquipo.equipo_nombre,
        serial: currentEquipo.serial,
        motivo: motivoDevolucion,
        condicion_fisica: condicionFisica,
        nuevo_estado: nuevoEstado,
        nueva_ubicacion: nuevaUbicacion,
        entregado_por_colaborador: {
          nombre: colaboradorAsignado.nombre,
          cedula: colaboradorAsignado.cedula,
          cargo: colaboradorAsignado.cargo,
          email: colaboradorAsignado.email,
          sede: colaboradorAsignado.sede
        },
        recibido_por_ti: {
          id: receivingTIUser.id,
          nombre: receivingTIUser.nombre,
          cargo: receivingTIUser.cargo || receivingTIUser.rol || 'Técnico TI',
          email: receivingTIUser.email,
          sede: receivingTIUser.sede
        },
        accesorios_recibidos: accesoriosList,
        checklist_diagnostico: checklistDevolucion,
        observaciones: observacionesTecnicas,
        cert_hash: certHash,
        firma_colaborador_img: signatureDataUrl,
        createdAt: serverTimestamp()
      });

      // 2. Registrar movimiento en la colección global 'movimientos'
      await addDoc(collection(db, 'movimientos'), {
        tipo: 'DEVOLUCION',
        acta_numero: actaNumero,
        acta_id: returnDocRef.id,
        fecha: fechaActa,
        equipo_id: currentEquipo.id,
        placa: currentEquipo.placa,
        equipo_nombre: currentEquipo.equipo_nombre,
        serial: currentEquipo.serial,
        origen: colaboradorAsignado.nombre,
        destino: nuevoEstado === 'DISPONIBLE' ? 'Stock Bodega Central TI' : 'Taller Laboratorio Soporte',
        responsable_ti: receivingTIUser.nombre,
        estado_resultante: nuevoEstado,
        detalles: `Reintegro: ${motivoDevolucion} • Estado físico: ${condicionFisica}`,
        cert_hash: certHash,
        rawDoc: {
          acta_numero: actaNumero,
          fecha: fechaActa,
          equipo_id: currentEquipo.id,
          placa: currentEquipo.placa,
          equipo_nombre: currentEquipo.equipo_nombre,
          serial: currentEquipo.serial,
          nuevo_estado: nuevoEstado,
          categoria: currentEquipo.categoria || 'Portátiles Corporativos',
          equipo_specs: currentEquipo.equipo_specs,
          entregado_por_colaborador: {
            nombre: colaboradorAsignado.nombre,
            cedula: colaboradorAsignado.cedula,
            cargo: colaboradorAsignado.cargo,
            email: colaboradorAsignado.email,
            sede: colaboradorAsignado.sede
          },
          recibido_por_ti: {
            nombre: receivingTIUser.nombre,
            cargo: receivingTIUser.cargo || receivingTIUser.rol,
            sede: receivingTIUser.sede
          },
          accesorios_recibidos: accesoriosList,
          observaciones: observacionesTecnicas,
          cert_hash: certHash,
          firma_colaborador_img: signatureDataUrl
        },
        createdAt: serverTimestamp()
      });

      // 3. Actualizar el equipo en Firestore 'equipos'
      const assetRef = doc(db, 'equipos', currentEquipo.id);
      await updateDoc(assetRef, {
        estado: nuevoEstado,
        asignatario: nuevoEstado === 'DISPONIBLE' ? 'Bodega Centralizada TI' : (nuevoEstado === 'MANTENIMIENTO' ? 'Taller de Soporte TI' : 'Baja Definitiva'),
        asignatario_cc: '',
        asignatario_email: '',
        asignatario_id: '',
        ubicacion: nuevaUbicacion,
        ultimo_movimiento: `Reintegro Acta ${actaNumero} (${colaboradorAsignado.nombre})`,
        ultima_devolucion_acta: actaNumero,
        updatedAt: serverTimestamp()
      });

      const savedPayload = {
        acta_numero: actaNumero,
        fecha: fechaActa,
        equipo_id: currentEquipo.id,
        placa: currentEquipo.placa,
        equipo_nombre: currentEquipo.equipo_nombre,
        serial: currentEquipo.serial,
        nuevo_estado: nuevoEstado,
        categoria: currentEquipo.categoria || 'Portátiles Corporativos',
        equipo_specs: currentEquipo.equipo_specs,
        entregado_por_colaborador: {
          nombre: colaboradorAsignado.nombre,
          cedula: colaboradorAsignado.cedula,
          cargo: colaboradorAsignado.cargo,
          email: colaboradorAsignado.email,
          sede: colaboradorAsignado.sede
        },
        recibido_por_ti: {
          nombre: receivingTIUser.nombre,
          cargo: receivingTIUser.cargo || receivingTIUser.rol,
          sede: receivingTIUser.sede
        },
        accesorios_recibidos: accesoriosList,
        observaciones: observacionesTecnicas,
        cert_hash: certHash,
        firma_colaborador_img: signatureDataUrl
      };

      setCreatedActaModal(savedPayload);
      setSuccessMsg(`¡Reintegro completado! Acta ${actaNumero} registrada en Firestore y en el Historial.`);

      setTimeout(() => {
        navigate('/historial');
      }, 2500);

    } catch (err) {
      alert("Error al procesar devolución en Firebase: " + err.message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-background font-body-md text-on-surface antialiased min-h-screen">
      
      {/* Toast Flotante de Éxito */}
      {successMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-secondary text-on-secondary px-space-xl py-space-md rounded-2xl shadow-2xl flex items-center gap-space-md border border-white/20 animate-bounce">
          <span className="material-symbols-outlined text-[28px]">assignment_turned_in</span>
          <div className="flex flex-col">
            <span className="font-bold font-headline-sm text-body-lg">{successMsg}</span>
            <span className="text-body-sm opacity-90">Redirigiendo al Historial de Auditoría...</span>
          </div>
        </div>
      )}

      {/* ASIDE / SIDEBAR */}
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

            {/* Menú Entrega y Custodia */}
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
                  className="flex items-center gap-space-sm px-space-md py-space-xs transition-colors bg-primary-container text-on-primary font-headline-sm rounded-lg cursor-pointer"
                  onClick={() => {}}
                >
                  <span className="material-symbols-outlined text-[16px]">keyboard_return</span>
                  <span className="font-body-sm text-body-sm font-bold">Devoluciones (Reintegro)</span>
                </a>
                <a 
                  className="flex items-center gap-space-sm px-space-md py-space-xs text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface rounded-lg transition-colors cursor-pointer"
                  onClick={() => navigate('/historial')}
                >
                  <span className="material-symbols-outlined text-[16px]">history</span>
                  <span className="font-body-sm text-body-sm">Historial y Auditoría</span>
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
          </nav>
        </div>

        <div className="p-space-lg m-space-md bg-surface-container rounded-xl flex items-center gap-space-md border border-surface-container-highest/40">
          <div className="h-9 w-9 rounded-lg bg-secondary text-on-secondary flex items-center justify-center shrink-0 shadow-sm">
            <span className="material-symbols-outlined text-[20px]">verified</span>
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="font-label-sm text-label-sm text-primary uppercase font-bold truncate">Reintegros TI-FO-05</span>
            <span className="font-body-sm text-body-sm text-outline truncate">
              {equiposAsignados.length} Equipos Asignados
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
                {receivingTIUser.sede || 'Sede Principal Casalimpia S.A. • Mesa Técnica de Entrada'}
              </span>
            </div>

            <div className="relative w-full max-w-md">
              <span className="material-symbols-outlined absolute left-space-md top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
              <input 
                className="w-full h-9 pl-9 pr-space-md bg-surface-container-lowest text-on-surface rounded-lg font-body-sm text-body-sm placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-primary shadow-xs" 
                placeholder="Buscar activo asignado por placa o custodio..." 
                type="text"
                value={equipoSearch}
                onChange={(e) => setEquipoSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearchEquipo();
                }}
              />
            </div>
          </div>

          <div className="flex items-center gap-space-md shrink-0">
            <button 
              onClick={() => navigate('/historial')}
              className="h-9 px-space-md flex items-center gap-space-xs rounded-lg text-primary bg-primary/10 hover:bg-primary/20 transition-colors cursor-pointer font-label-sm text-label-sm font-bold"
              title="Ir al Historial de Movimientos"
            >
              <span className="material-symbols-outlined text-[18px]">history</span>
              <span>Historial</span>
            </button>

            <div className="h-6 w-px bg-surface-container-highest"></div>

            <div className="flex items-center gap-space-md pl-space-xs">
              <div className="flex flex-col text-right hidden sm:flex">
                <span className="font-label-md text-label-md text-on-surface font-bold">
                  {storedSession?.nombre || 'Funcionario SGI'}
                </span>
                <span className="font-label-sm text-label-sm text-secondary font-semibold">
                  {storedSession?.cargo || storedSession?.rol || 'Administrador TI'}
                </span>
              </div>
              <img 
                alt="Foto Perfil" 
                className="w-8 h-8 rounded-full object-cover ring-2 ring-primary/20 shadow-sm" 
                src={storedSession?.avatar || 'https://lh3.googleusercontent.com/aida-public/AB6AXuDyAiWOUn9njbbS4sZzxnzDv-_O7nlKMP0d8Uj3JmLf2C_0yjiCZpAy_-U4uCYuUD42dh2KBHFoTT45HDNZZYJ4xGPuondY8OzWlnn7_ZuxW3T5adr-8kHHxYrg8TKac--UfaKWJfhULlk7ZTIvToV2_6HQK6K4NU1fRHrt-A4bVhe1TrF6kp8FaNl7tV6SQ4Q_7jCd97VAYDW2x8agwEazqetgfvCbDatPHJzic_KZM9Czjj8JNoYE6Q'}
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

        {/* CONTENIDO DEL FORMULARIO Y ACTA TI-FO-05 */}
        <main className="relative pt-16 flex-1 w-full px-gutter-lg pb-space-xl bg-background">
          <div className="flex flex-col w-full pt-4">
            
            {/* Cabecera */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md mb-space-lg">
              <div className="flex flex-col gap-space-xs">
                <div className="flex items-center gap-space-xs text-on-surface-variant font-label-sm text-label-sm">
                  <span className="text-secondary font-semibold">SGI CASALIMPIA S.A.</span>
                  <span>/</span>
                  <span>Custodia y Trazabilidad</span>
                  <span>/</span>
                  <span className="font-code-mono text-primary font-semibold">TI-FO-05 • REINTEGRO</span>
                </div>
                <h1 className="font-headline-lg text-headline-lg text-primary font-bold tracking-tight">
                  Devolución y Reintegro de Hardware TI
                </h1>
                <p className="font-body-sm text-body-sm text-on-surface-variant max-w-3xl">
                  Formulario oficial de entrada a bodega y descargo de custodia. Permite recibir activos asignados a colaboradores, calificar su condición física, registrar faltantes o daños y actualizar su estado a Disponible o Mantenimiento.
                </p>
              </div>

              <div className="flex items-center gap-space-sm shrink-0">
                <div className="flex items-center gap-space-xs bg-surface-container-high px-space-md py-space-xs rounded-full">
                  <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold">Protocolo TI-FO-05 v2.1</span>
                </div>
                <div className="font-code-mono text-code-mono bg-secondary text-on-secondary font-semibold px-space-md py-space-xs rounded-lg shadow-sm">
                  {actaNumero}
                </div>
              </div>
            </div>

            {/* Layout Dos Columnas */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg items-start">
              
              {/* COLUMNA IZQUIERDA: FORMULARIO DE REINTEGRO */}
              <div className="xl:col-span-7 flex flex-col gap-space-lg">
                
                {/* BLOQUE 1: Selección del Activo Asignado */}
                <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm border border-surface-container-high/30">
                  <div className="flex items-center justify-between pb-space-sm mb-space-md bg-surface-container-low px-space-md py-space-xs rounded-lg">
                    <div className="flex items-center gap-space-sm">
                      <span className="material-symbols-outlined text-primary text-[20px]">assignment_returned</span>
                      <span className="font-headline-sm text-body-lg text-primary font-bold">1. Selección del Activo Asignado</span>
                    </div>
                    <span className="font-code-mono text-code-mono bg-primary/10 text-primary font-bold px-space-sm py-0.5 rounded-full text-xs">
                      {equiposAsignados.length} Asignados en BD
                    </span>
                  </div>

                  <div className="flex flex-col gap-space-md">
                    
                    {/* Alerta si no hay equipos asignados */}
                    {equiposAsignados.length === 0 && (
                      <div className="bg-secondary/10 text-secondary p-space-md rounded-xl flex items-center justify-between gap-space-md border border-secondary/20">
                        <div className="flex items-center gap-space-sm">
                          <span className="material-symbols-outlined text-[24px]">info</span>
                          <span className="font-body-sm text-body-sm">
                            Actualmente no hay equipos en estado <strong>ASIGNADO</strong> en la base de datos. Puedes realizar una entrega primero o seleccionar un equipo disponible.
                          </span>
                        </div>
                        <button 
                          onClick={() => navigate('/entrega-hardware')}
                          className="px-space-md py-1.5 bg-primary text-on-primary rounded-lg font-label-sm text-label-sm font-bold shrink-0 hover:bg-primary-container transition-colors cursor-pointer shadow-sm"
                        >
                          Ir a Nueva Entrega
                        </button>
                      </div>
                    )}

                    <div className="flex flex-col gap-space-xs">
                      <div className="flex items-center justify-between">
                        <label className="font-label-md text-label-md text-on-surface font-semibold">
                          Seleccionar Equipo Asignado a Retornar:
                        </label>
                        <button 
                          onClick={() => setVerSoloAsignados(!verSoloAsignados)}
                          className="font-label-sm text-label-sm text-primary hover:underline cursor-pointer"
                          type="button"
                        >
                          {verSoloAsignados ? 'Mostrar todos los equipos' : 'Ver solo asignados'}
                        </button>
                      </div>

                      <div className="relative">
                        <select 
                          className="w-full h-11 px-space-md bg-surface-container-low text-on-surface rounded-lg font-body-sm text-body-sm focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary appearance-none cursor-pointer pr-10 shadow-xs"
                          value={selectedEquipoId}
                          onChange={(e) => setSelectedEquipoId(e.target.value)}
                        >
                          {equiposVisibles.length === 0 ? (
                            <option value="">No hay equipos para devolver.</option>
                          ) : (
                            equiposVisibles.map(e => (
                              <option key={e.id} value={e.id}>
                                {e.equipo_nombre} • Placa: {e.placa} • Custodio Actual: {e.asignatario || 'Sin asignar'} [{e.estado}]
                              </option>
                            ))
                          )}
                        </select>
                        <span className="material-symbols-outlined absolute right-space-md top-1/2 -translate-y-1/2 pointer-events-none text-outline">
                          expand_more
                        </span>
                      </div>
                    </div>

                    {/* Ficha del Colaborador Custodio Actual (Cargado en vivo de Firestore) */}
                    <div className="bg-surface-container-low p-space-md rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-md border border-surface-container-high/40 shadow-xs">
                      <div className="flex items-center gap-space-md">
                        <div className="w-12 h-12 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-headline-sm shadow-sm">
                          {colaboradorAsignado.nombre?.charAt(0) || 'C'}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-label-sm text-[11px] text-outline uppercase font-semibold">Custodio que entrega el equipo:</span>
                          <span className="font-headline-sm text-headline-sm text-primary font-bold">
                            {colaboradorAsignado.nombre}
                          </span>
                          <div className="flex items-center gap-space-sm text-body-sm text-on-surface-variant flex-wrap">
                            <span className="font-code-mono font-bold text-primary">C.C. {colaboradorAsignado.cedula}</span>
                            <span>•</span>
                            <span>{colaboradorAsignado.cargo}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col sm:items-end gap-1 bg-surface-container-lowest p-space-sm rounded-lg shadow-xs shrink-0">
                        <span className="font-label-sm text-label-sm text-outline uppercase font-semibold">Placa a Reintegrar</span>
                        <span className="font-code-mono text-headline-sm font-black text-secondary">{currentEquipo.placa}</span>
                        <span className="font-body-sm text-xs text-on-surface-variant">{currentEquipo.serial}</span>
                      </div>
                    </div>

                    {/* Funcionario TI que Recibe */}
                    <div className="flex flex-col gap-space-xs pt-space-xs border-t border-surface-container-high/30">
                      <label className="font-label-md text-label-md text-on-surface font-semibold flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-primary text-[18px]">verified_user</span>
                        Funcionario TI que Recibe e Inspecciona:
                      </label>
                      <div className="relative">
                        <select 
                          className="w-full h-10 px-space-md bg-surface-container-low text-on-surface rounded-lg font-body-sm text-body-sm focus:outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary appearance-none cursor-pointer pr-10"
                          value={selectedReceivingTIId}
                          onChange={(e) => setSelectedReceivingTIId(e.target.value)}
                        >
                          {tiOptions.map(u => (
                            <option key={u.id} value={u.id}>
                              {u.nombre} — {u.cargo || u.rol} ({u.sede || 'Sede Principal'})
                            </option>
                          ))}
                        </select>
                        <span className="material-symbols-outlined absolute right-space-md top-1/2 -translate-y-1/2 pointer-events-none text-outline">
                          expand_more
                        </span>
                      </div>
                    </div>

                  </div>
                </div>

                {/* BLOQUE 2: Diagnóstico y Destino Post-Reintegro */}
                <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm border border-surface-container-high/30">
                  <div className="flex items-center justify-between pb-space-sm mb-space-md bg-surface-container-low px-space-md py-space-xs rounded-lg">
                    <div className="flex items-center gap-space-sm">
                      <span className="material-symbols-outlined text-primary text-[20px]">build_circle</span>
                      <span className="font-headline-sm text-body-lg text-primary font-bold">2. Diagnóstico Técnico y Destino del Activo</span>
                    </div>
                    <span className="font-label-sm text-label-sm text-outline">Norma ISO 20000 / 27001</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md mb-space-md">
                    
                    {/* Motivo de la Devolución */}
                    <div className="flex flex-col gap-space-xs">
                      <label className="font-label-sm text-label-sm text-outline font-semibold">Motivo del Reintegro:</label>
                      <select 
                        value={motivoDevolucion} 
                        onChange={(e) => setMotivoDevolucion(e.target.value)}
                        className="w-full h-10 px-space-md bg-surface-container-low text-on-surface rounded-lg font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="Renovación de Equipo / Fin de Custodia">Renovación de Equipo / Fin de Custodia</option>
                        <option value="Retiro / Desvinculación de Personal">Retiro / Desvinculación de Personal</option>
                        <option value="Falla de Hardware / Solicitud Mantenimiento">Falla de Hardware / Novedad Técnica</option>
                        <option value="Cambio de Rol o Traslado de Sede">Cambio de Rol o Traslado de Sede</option>
                        <option value="Devolución Temporal por Vacaciones/Licencia">Devolución Temporal</option>
                      </select>
                    </div>

                    {/* Calificación Física */}
                    <div className="flex flex-col gap-space-xs">
                      <label className="font-label-sm text-label-sm text-outline font-semibold">Calificación Física del Activo:</label>
                      <select 
                        value={condicionFisica} 
                        onChange={(e) => setCondicionFisica(e.target.value)}
                        className="w-full h-10 px-space-md bg-surface-container-low text-on-surface rounded-lg font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-primary font-semibold"
                      >
                        <option value="10/10 Excelente Estado">🟢 10/10 Excelente Estado (Sin detalles)</option>
                        <option value="8/10 Bueno (Desgaste Normal)">🟡 8/10 Bueno (Desgaste normal de uso)</option>
                        <option value="6/10 Regular (Rayones / Golpes Leves)">🟠 6/10 Regular (Detalles estéticos)</option>
                        <option value="4/10 Dañado (Requiere Reparación)">🔴 4/10 Dañado (Falla pantalla, teclado o chasis)</option>
                      </select>
                    </div>

                    {/* Nuevo Estado en el Inventario */}
                    <div className="flex flex-col gap-space-xs">
                      <label className="font-label-sm text-label-sm text-primary font-bold">
                        Nuevo Estado del Equipo en Firestore:
                      </label>
                      <select 
                        value={nuevoEstado} 
                        onChange={(e) => setNuevoEstado(e.target.value)}
                        className="w-full h-10 px-space-md bg-primary text-on-primary rounded-lg font-body-sm font-bold focus:outline-none shadow-sm cursor-pointer"
                      >
                        <option value="DISPONIBLE">🟢 DISPONIBLE (Vuelve a Stock de Bodega)</option>
                        <option value="MANTENIMIENTO">🟡 MANTENIMIENTO (Pasa a Laboratorio TI)</option>
                        <option value="BAJA">🔴 BAJA DEFINITIVA (Obsolescencia / Daño)</option>
                      </select>
                    </div>

                    {/* Nueva Ubicación Física */}
                    <div className="flex flex-col gap-space-xs">
                      <label className="font-label-sm text-label-sm text-outline font-semibold">Nueva Ubicación en Instalaciones:</label>
                      <input 
                        type="text" 
                        value={nuevaUbicacion}
                        onChange={(e) => setNuevaUbicacion(e.target.value)}
                        placeholder="Ej. Bodega Central TI - Rack A1"
                        className="w-full h-10 px-space-md bg-surface-container-low text-on-surface rounded-lg font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
                      />
                    </div>
                  </div>

                  {/* Checklist de Entrada y Seguridad ISO 27001 */}
                  <div className="bg-surface-container-low p-space-md rounded-lg shadow-xs border border-surface-container-high/40 flex flex-col gap-space-xs">
                    <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline font-bold block mb-1">
                      Checklist Técnico de Recepción (ISO/IEC 27001)
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
                      <label className="flex items-center gap-space-sm p-1 rounded hover:bg-surface-container cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={checklistDevolucion.pantallaIntacta}
                          onChange={(e) => setChecklistDevolucion({ ...checklistDevolucion, pantallaIntacta: e.target.checked })}
                          className="w-4 h-4 rounded text-primary focus:ring-primary accent-primary cursor-pointer"
                        />
                        <span className="font-body-sm text-body-sm">Pantalla sin fisuras ni pixeles muertos</span>
                      </label>
                      <label className="flex items-center gap-space-sm p-1 rounded hover:bg-surface-container cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={checklistDevolucion.tecladoOperativo}
                          onChange={(e) => setChecklistDevolucion({ ...checklistDevolucion, tecladoOperativo: e.target.checked })}
                          className="w-4 h-4 rounded text-primary focus:ring-primary accent-primary cursor-pointer"
                        />
                        <span className="font-body-sm text-body-sm">Teclado y Touchpad 100% operativos</span>
                      </label>
                      <label className="flex items-center gap-space-sm p-1 rounded hover:bg-surface-container cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={checklistDevolucion.cargadorOriginal}
                          onChange={(e) => setChecklistDevolucion({ ...checklistDevolucion, cargadorOriginal: e.target.checked })}
                          className="w-4 h-4 rounded text-primary focus:ring-primary accent-primary cursor-pointer"
                        />
                        <span className="font-body-sm text-body-sm">Cargador original recibido y verificado</span>
                      </label>
                      <label className="flex items-center gap-space-sm p-1 rounded hover:bg-surface-container cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={checklistDevolucion.borradoSeguroISO}
                          onChange={(e) => setChecklistDevolucion({ ...checklistDevolucion, borradoSeguroISO: e.target.checked })}
                          className="w-4 h-4 rounded text-primary focus:ring-primary accent-primary cursor-pointer"
                        />
                        <span className="font-body-sm text-body-sm text-secondary font-semibold">Borrado Seguro de Datos / Formateo ISO</span>
                      </label>
                    </div>
                  </div>

                  {/* Accesorios Devueltos */}
                  <div className="mt-space-md flex flex-col gap-space-xs">
                    <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline font-bold">
                      Accesorios Físicos Reintegrados
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-space-xs">
                      <label className="flex items-center gap-2 p-space-xs bg-surface-container-low rounded cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={accesoriosDevueltos.cargador} 
                          onChange={(e) => setAccesoriosDevueltos({ ...accesoriosDevueltos, cargador: e.target.checked })}
                          className="accent-primary"
                        />
                        <span className="text-body-sm">Cargador 65W</span>
                      </label>
                      <label className="flex items-center gap-2 p-space-xs bg-surface-container-low rounded cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={accesoriosDevueltos.maletin} 
                          onChange={(e) => setAccesoriosDevueltos({ ...accesoriosDevueltos, maletin: e.target.checked })}
                          className="accent-primary"
                        />
                        <span className="text-body-sm">Maletín Casalimpia</span>
                      </label>
                      <label className="flex items-center gap-2 p-space-xs bg-surface-container-low rounded cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={accesoriosDevueltos.mouse} 
                          onChange={(e) => setAccesoriosDevueltos({ ...accesoriosDevueltos, mouse: e.target.checked })}
                          className="accent-primary"
                        />
                        <span className="text-body-sm">Mouse USB</span>
                      </label>
                      <label className="flex items-center gap-2 p-space-xs bg-surface-container-low rounded cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={accesoriosDevueltos.guaya} 
                          onChange={(e) => setAccesoriosDevueltos({ ...accesoriosDevueltos, guaya: e.target.checked })}
                          className="accent-primary"
                        />
                        <span className="text-body-sm">Guaya de Seguridad</span>
                      </label>
                      <label className="flex items-center gap-2 p-space-xs bg-surface-container-low rounded cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={accesoriosDevueltos.diadema} 
                          onChange={(e) => setAccesoriosDevueltos({ ...accesoriosDevueltos, diadema: e.target.checked })}
                          className="accent-primary"
                        />
                        <span className="text-body-sm">Diadema Jabra</span>
                      </label>
                      <label className="flex items-center gap-2 p-space-xs bg-surface-container-low rounded cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={accesoriosDevueltos.hub} 
                          onChange={(e) => setAccesoriosDevueltos({ ...accesoriosDevueltos, hub: e.target.checked })}
                          className="accent-primary"
                        />
                        <span className="text-body-sm">Hub Multipuesto</span>
                      </label>
                    </div>
                  </div>

                  {/* Observaciones */}
                  <div className="mt-space-md flex flex-col gap-space-xs">
                    <label className="font-label-md text-label-md text-on-surface font-semibold">
                      Observaciones de la Mesa Técnica:
                    </label>
                    <textarea 
                      rows={2} 
                      value={observacionesTecnicas} 
                      onChange={(e) => setObservacionesTecnicas(e.target.value)}
                      className="w-full p-space-sm bg-surface-container-low text-on-surface rounded-lg font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
                    />
                  </div>

                </div>

              </div>

              {/* COLUMNA DERECHA: VISTA PREVIA ACTA DE REINTEGRO (TI-FO-05) */}
              <div className="xl:col-span-5 flex flex-col gap-space-md sticky top-20">
                
                {/* Cabecera de Vista Previa */}
                <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex items-center justify-between gap-space-sm border border-surface-container-high/30">
                  <div className="flex items-center gap-space-xs">
                    <span className="w-2.5 h-2.5 rounded-full bg-secondary animate-pulse"></span>
                    <span className="font-label-sm text-label-sm text-on-surface font-bold uppercase tracking-wider">Acta de Reintegro en Vivo</span>
                  </div>
                  <button 
                    onClick={() => handleGenerateOfficialActa()}
                    className="p-space-xs text-on-surface-variant hover:text-primary rounded hover:bg-surface-container transition-colors cursor-pointer" 
                    title="Imprimir Acta TI-FO-05 Oficial / Guardar PDF" 
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[20px]">print</span>
                  </button>
                </div>

                {/* DOCUMENTO OFICIAL TI-FO-05 */}
                <div className="bg-surface-container-lowest rounded-xl shadow-md p-space-lg flex flex-col gap-space-md text-on-surface relative overflow-hidden border border-surface-container-high/40 print:shadow-none">
                  
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-[0.03] select-none">
                    <span className="font-display-lg text-[120px] font-black tracking-widest text-primary rotate-[-25deg]">CASALIMPIA</span>
                  </div>

                  {/* Header Acta */}
                  <div className="flex items-start justify-between pb-space-md bg-surface-container-low p-space-md rounded-lg">
                    <div className="flex items-center gap-space-sm">
                      <div className="w-10 h-10 rounded bg-secondary flex items-center justify-center text-on-secondary font-headline-sm font-black">
                        CL
                      </div>
                      <div className="flex flex-col">
                        <span className="font-headline-sm text-label-md text-primary font-bold leading-tight">CASALIMPIA S.A.</span>
                        <span className="font-label-sm text-label-sm text-outline">NIT: 860.038.324-1</span>
                        <span className="font-label-sm text-[10px] text-secondary font-semibold uppercase">Recepción Activos TI</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end text-right">
                      <span className="font-code-mono text-label-md font-bold text-secondary">TI-FO-05</span>
                      <span className="font-code-mono text-label-sm text-outline">N°: {actaNumero}</span>
                      <span className="font-label-sm text-label-sm text-on-surface-variant mt-0.5">{fechaActa}</span>
                    </div>
                  </div>

                  {/* Título */}
                  <div className="text-center py-space-xs">
                    <h2 className="font-headline-sm text-headline-sm text-primary font-bold uppercase tracking-tight">
                      Acta de Devolución y Descargo de Custodia
                    </h2>
                    <span className="font-body-sm text-label-sm text-outline">Reintegro de Activos Informáticos a Bodega TI</span>
                  </div>

                  {/* 1. Colaborador que Entrega */}
                  <div className="bg-surface-container-low p-space-sm rounded-lg flex flex-col gap-1 border border-surface-container-high/30">
                    <div className="flex items-center justify-between">
                      <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline font-bold">1. Colaborador que Reintegra</span>
                      <span className="font-code-mono text-label-sm text-secondary font-bold">C.C. {colaboradorAsignado.cedula}</span>
                    </div>
                    <span className="font-headline-sm text-body-md text-on-surface font-bold">{colaboradorAsignado.nombre}</span>
                    <div className="grid grid-cols-2 gap-x-space-md text-body-sm text-on-surface-variant text-xs">
                      <span>Cargo: <strong className="text-on-surface">{colaboradorAsignado.cargo}</strong></span>
                      <span>Sede: <strong className="text-on-surface">{colaboradorAsignado.sede}</strong></span>
                      <span className="col-span-2">Motivo: <strong className="text-primary">{motivoDevolucion}</strong></span>
                    </div>
                  </div>

                  {/* 2. Activo Reintegrado */}
                  <div className="bg-surface-container-low p-space-sm rounded-lg flex flex-col gap-1 border border-surface-container-high/30">
                    <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline font-bold">2. Especificación del Activo Devuelto</span>
                    <div className="flex items-center justify-between">
                      <span className="font-headline-sm text-body-md text-primary font-bold">{currentEquipo.equipo_nombre}</span>
                      <span className="font-code-mono text-code-mono bg-secondary/15 px-space-xs py-0.5 rounded text-secondary font-bold text-xs">
                        PLACA: {currentEquipo.placa}
                      </span>
                    </div>
                    <div className="font-code-mono text-code-mono text-on-surface-variant flex items-center justify-between text-xs">
                      <span>SERIE: {currentEquipo.serial}</span>
                      <span className="font-bold text-primary">DESTINO: {nuevoEstado}</span>
                    </div>
                    <span className="text-xs text-outline font-semibold mt-0.5">Condición: {condicionFisica}</span>
                  </div>

                  {/* 3. Firmas de Legalización */}
                  <div className="flex flex-col gap-space-sm mt-space-xs">
                    <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline font-bold">3. Firmas de Descargo de Responsabilidad</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
                      
                      {/* Firma Funcionario TI Receptor */}
                      <div className="bg-surface-container-low p-space-sm rounded-lg flex flex-col items-center justify-between text-center min-h-[130px] border border-surface-container-high/30">
                        <span className="font-label-sm text-label-sm text-outline uppercase font-semibold">Recibido por TI</span>
                        <div className="flex flex-col items-center py-space-xs">
                          <span className="font-headline-sm text-headline-sm text-primary font-bold italic font-serif">
                            {receivingTIUser.nombre}
                          </span>
                          <span className="font-code-mono text-[10px] text-secondary font-bold">HASH: DEV-CERT-78A9</span>
                        </div>
                        <div className="w-full pt-1 bg-surface-container-high rounded text-center">
                          <span className="font-label-sm text-label-sm text-primary font-bold block truncate">
                            {receivingTIUser.nombre}
                          </span>
                          <span className="font-body-sm text-[11px] text-outline block truncate">
                            {receivingTIUser.cargo || 'Soporte TI'}
                          </span>
                        </div>
                      </div>

                      {/* Firma Colaborador que Entrega (Canvas) */}
                      <div className="bg-surface-container p-space-sm rounded-lg flex flex-col items-center justify-between text-center min-h-[130px] border border-surface-container-high/30">
                        <div className="w-full flex items-center justify-between">
                          <span className="font-label-sm text-label-sm text-primary uppercase font-bold">Firma Colaborador</span>
                          <button 
                            onClick={handleClearSignature} 
                            className="font-label-sm text-[11px] text-error hover:underline flex items-center gap-0.5 cursor-pointer" 
                            type="button"
                          >
                            <span className="material-symbols-outlined text-[14px]">ink_eraser</span>
                            Limpiar
                          </button>
                        </div>
                        
                        <div className="relative w-full h-14 bg-surface-container-lowest rounded flex items-center justify-center overflow-hidden cursor-crosshair shadow-inner my-1">
                          <canvas ref={canvasRef} className="w-full h-full block" id="signaturePad" />
                          {!hasSignature && (
                            <div className="absolute pointer-events-none flex flex-col items-center text-outline">
                              <span className="material-symbols-outlined text-[16px]">draw</span>
                              <span className="font-label-sm text-[10px]">Firma de descargo</span>
                            </div>
                          )}
                        </div>

                        <div className="w-full pt-1 bg-surface-container-high rounded text-center">
                          <span className="font-label-sm text-label-sm text-on-surface font-bold block truncate">{colaboradorAsignado.nombre}</span>
                          <span className="font-body-sm text-[11px] text-outline block truncate">C.C. {colaboradorAsignado.cedula}</span>
                        </div>
                      </div>

                    </div>
                  </div>

                  <div className="pt-space-xs text-center text-outline font-body-sm text-[11px] leading-tight">
                    Con la firma del presente documento, CASALIMPIA S.A. certifica la recepción a conformidad del equipo de cómputo y libera al colaborador de la custodia legal del activo.
                  </div>

                </div>

                {/* Botón de Acción Principal */}
                <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col gap-space-sm border border-surface-container-high/30">
                  <button 
                    onClick={handleConfirmReturn}
                    disabled={isSubmitting || !currentEquipo.id}
                    className="w-full h-12 bg-secondary text-on-secondary rounded-lg font-headline-sm text-body-md font-bold flex items-center justify-center gap-space-sm hover:opacity-95 transition-opacity shadow-md disabled:opacity-50 cursor-pointer" 
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {isSubmitting ? 'sync' : 'assignment_turned_in'}
                    </span>
                    {isSubmitting ? 'Procesando Reintegro en Firestore...' : 'Confirmar Reintegro y Liberar Custodia'}
                  </button>

                  <button 
                    onClick={() => handleGenerateOfficialActa()}
                    className="w-full h-10 px-space-sm bg-primary text-on-primary rounded-lg font-label-md text-label-md flex items-center justify-center gap-space-xs hover:bg-primary-container transition-colors shadow-sm cursor-pointer" 
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
                    Descargar / Imprimir Acta Oficial (PDF)
                  </button>

                  <button 
                    onClick={() => navigate('/inventario')} 
                    className="h-8 text-outline hover:text-error rounded font-label-sm text-label-sm transition-colors text-center cursor-pointer" 
                    type="button"
                  >
                    Cancelar y Volver
                  </button>
                </div>

              </div>

            </div>

          </div>
        </main>
      </div>

      {/* ======================================================== */}
      {/* MODAL: REINTEGRO EXITOSO Y DESCARGA OFICIAL               */}
      {/* ======================================================== */}
      {createdActaModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-surface-container-high/60 p-6 flex flex-col gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-secondary/15 text-secondary flex items-center justify-center mx-auto shadow-sm">
              <span className="material-symbols-outlined text-[36px]">assignment_turned_in</span>
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="font-headline-sm text-headline-sm font-black text-primary">
                ¡Reintegro Procesado Exitosamente!
              </h3>
              <span className="font-code-mono font-bold text-secondary text-sm">
                {createdActaModal.acta_numero}
              </span>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                El hardware <strong>{createdActaModal.placa} ({createdActaModal.equipo_nombre})</strong> ha sido reintegrado a bodega con estado <strong>{createdActaModal.nuevo_estado}</strong> y el registro oficial quedó asentado en el Historial de Firestore.
              </p>
            </div>

            <div className="flex flex-col gap-2 mt-2">
              <button 
                onClick={() => handleGenerateOfficialActa(createdActaModal)}
                className="w-full h-12 bg-primary text-on-primary rounded-xl font-headline-sm text-body-md font-bold flex items-center justify-center gap-2 hover:bg-primary-container transition-all shadow-md cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">picture_as_pdf</span>
                Descargar / Imprimir Acta TI-FO-05 Oficial (PDF)
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
