import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, doc, writeBatch, getDocs, Timestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCYQEojGcBE5G-t-fxjzdH7MIHa4fk2kn0",
  authDomain: "desarrolloweb-e8531.firebaseapp.com",
  projectId: "desarrolloweb-e8531",
  storageBucket: "desarrolloweb-e8531.firebasestorage.app",
  messagingSenderId: "986911853700",
  appId: "1:986911853700:web:7f98d474de54ab495006d1"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const AREAS = [
  'Talento Humano / Recursos Humanos',
  'Tecnología e Infraestructura (TI)',
  'Operaciones y Servicios Generales',
  'Contabilidad y Finanzas',
  'Comercial y Mercadeo',
  'Compras, Logística y Bodega',
  'Seguridad y Salud en el Trabajo (SST / HSEQ)',
  'Gerencia y Dirección Administrativa'
];

const SEDES = [
  { sede: 'Bogotá - Av. El Dorado', regional: 'Regional Bogota' },
  { sede: 'Medellín - Poblado', regional: 'Regional Medellin' },
  { sede: 'Cali - Valle del Lili', regional: 'Regional Cali' },
  { sede: 'Barranquilla - Prado', regional: 'Regional Barranquilla' },
  { sede: 'Pereira - Circunvalar', regional: 'Regional Pereira' },
  { sede: 'Bucaramanga - Cabecera', regional: 'Regional Bucaramanga' }
];

const CARGOS_POR_AREA = {
  'Talento Humano / Recursos Humanos': [
    'Coordinador(a) de Selección y Contratación',
    'Analista de Nómina y Compensación',
    'Psicólogo(a) Organizacional',
    'Especialista en Bienestar Laboral',
    'Analista de Capacitación y Desarrollo',
    'Auxiliar de Gestión Humana',
    'Profesional de Relaciones Laborales',
    'Líder de Talento Humano Regional'
  ],
  'Tecnología e Infraestructura (TI)': [
    'Ingeniero de Soporte N2',
    'Administrador de Redes y Servidores',
    'Analista de Mesa de Ayuda TI',
    'Especialista en Ciberseguridad ISO 27001',
    'Desarrollador de Software Interno',
    'Técnico de Mantenimiento de Hardware',
    'Coordinador de Infraestructura Cloud',
    'Auditor Técnico de Sistemas'
  ],
  'Operaciones y Servicios Generales': [
    'Supervisor(a) de Operaciones de Campo',
    'Coordinador(a) de Servicios Generales',
    'Analista de Programación de Turnos',
    'Líder Operativo de Cuentas Corporativas',
    'Inspector de Calidad Operativa',
    'Gestor de Maquinaria y Equipos',
    'Coordinador Regional de Operaciones',
    'Asistente de Control Operativo'
  ],
  'Contabilidad y Finanzas': [
    'Contador(a) Senior NIIF',
    'Analista de Tesorería y Pagos',
    'Analista de Facturación y Cartera',
    'Especialista Tributario y Fiscal',
    'Analista de Costos y Presupuestos',
    'Auxiliar Contable y Conciliaciones',
    'Auditor Financiero Interno',
    'Coordinador(a) de Finanzas Corporativas'
  ],
  'Comercial y Mercadeo': [
    'Ejecutivo(a) de Cuentas Corporativas',
    'Analista de Licitaciones Públicas y Privadas',
    'Coordinador(a) de Mercadeo y Marca',
    'Especialista en Servicio al Cliente CRM',
    'Consultor Comercial B2B',
    'Analista de Inteligencia de Mercados',
    'Gestor de Propuestas Comerciales',
    'Director(a) Comercial Regional'
  ],
  'Compras, Logística y Bodega': [
    'Coordinador(a) de Compras y Proveedores',
    'Analista de Inventarios y Almacén',
    'Jefe de Bodega e Insumos',
    'Especialista en Negociación y Abastecimiento',
    'Auxiliar de Despachos y Ruteo',
    'Analista de Logística Nacional',
    'Controlador de Stock Regional',
    'Gestor de Flota y Transporte'
  ],
  'Seguridad y Salud en el Trabajo (SST / HSEQ)': [
    'Profesional Especialista SST',
    'Coordinador(a) del Sistema HSEQ',
    'Inspector de Seguridad Industrial',
    'Analista de Gestión Ambiental ISO 14001',
    'Auditor de Calidad ISO 9001',
    'Médico / Enfermero(a) Laboral',
    'Analista de Prevención de Riesgos ARL',
    'Líder de Copasst y Brigadas'
  ],
  'Gerencia y Dirección Administrativa': [
    'Gerente Regional de Operaciones',
    'Director(a) Administrativo y Financiero',
    'Abogado(a) Corporativo y Contratación',
    'Jefe de Control Interno y Cumplimiento',
    'Coordinador(a) de Planeación Estratégica',
    'Asistente Ejecutivo(a) de Gerencia',
    'Líder de Gobierno Corporativo',
    'Subgerente de Desarrollo Organizacional'
  ]
};

const NOMBRES = [
  'Andrés Camilo', 'Laura Valentina', 'Carlos Eduardo', 'María Fernanda', 'Sebastián', 'Daniela Alejandra',
  'Jorge Iván', 'Natalia Andrea', 'Diego Fernando', 'Paula Catalina', 'Felipe Andrés', 'Carolina',
  'Mateo', 'Valentina', 'Nicolás', 'Juliana', 'Cristian David', 'Luisa Fernanda',
  'Esteban', 'Manuela', 'Mauricio', 'Diana Marcela', 'Óscar Javier', 'Ángela Patricia',
  'Hernán Darío', 'Marcela', 'Camilo Andrés', 'Sandra Milena', 'Juan Pablo', 'Tatiana',
  'Gustavo Adolfo', 'Mónica Liliana', 'Sergio Alejandro', 'Adriana Lucía', 'Fabián', 'Claudia Ximena'
];

const APELLIDOS = [
  'Gómez', 'Rodríguez', 'Martínez', 'Hernández', 'López', 'González', 'Pérez', 'Sánchez',
  'Ramírez', 'Torres', 'Flórez', 'Rivera', ' Valencia', 'Restrepo', 'Ospina', 'Castaño',
  'Giraldo', 'Morales', 'Ortiz', 'Gutiérrez', 'Vargas', 'Rojas', 'Medina', 'Aguilar',
  'Mejía', 'Cardona', 'Salazar', 'Botero', 'Quintero', 'Arias', 'Pineda', 'Montoya'
];

const MODELOS_HARDWARE = [
  { nombre: 'Lenovo ThinkPad T14 Gen 3', specs: 'Intel Core i7-1255U • 16GB RAM DDR4 • 512GB SSD NVMe • 14" FHD', cat: 'Laptops Corporativas', valor: 4200000, vida: 36, pref: 'LNV' },
  { nombre: 'Dell Latitude 5430 Corporativo', specs: 'Intel Core i5-1245U vPro • 16GB RAM • 512GB SSD NVMe • Windows 11 Pro', cat: 'Laptops Corporativas', valor: 3850000, vida: 36, pref: 'DLL' },
  { nombre: 'HP EliteBook 840 G9', specs: 'Intel Core i7-1260P • 16GB DDR5 • 512GB SSD • Chasis Aluminio', cat: 'Laptops Corporativas', valor: 4600000, vida: 36, pref: 'HPE' },
  { nombre: 'ASUS ExpertBook B1400', specs: 'Intel Core i5-1135G7 • 16GB RAM • 256GB SSD • Ultraliviano', cat: 'Laptops Corporativas', valor: 3100000, vida: 36, pref: 'ASU' },
  { nombre: 'MacBook Air 13" M2 Corporativo', specs: 'Chip Apple M2 8-Core • 16GB Unified • 512GB SSD • Space Gray', cat: 'Laptops Corporativas', valor: 5800000, vida: 36, pref: 'MAC' },
  { nombre: 'HP ProDesk 400 G9 SFF', specs: 'Intel Core i5-12500 • 16GB RAM • 512GB SSD + Monitor HP 24"', cat: 'Estaciones de Escritorio', valor: 3200000, vida: 48, pref: 'HPD' },
  { nombre: 'Dell OptiPlex 7000 Micro', specs: 'Intel Core i7-12700T • 16GB RAM • 512GB NVMe + Doble Monitor 22"', cat: 'Estaciones de Escritorio', valor: 3900000, vida: 48, pref: 'DOP' },
  { nombre: 'Lenovo ThinkCentre M70q Gen 3', specs: 'Intel Core i5-12400T • 16GB RAM • 512GB SSD • Kit Teclado/Mouse', cat: 'Estaciones de Escritorio', valor: 2950000, vida: 48, pref: 'LTC' },
  { nombre: 'Monitor Dell UltraSharp 27" USB-C', specs: '27" IPS QHD 2560x1440 • Hub USB-C 90W • Ergonómico', cat: 'Monitores y Displays', valor: 1450000, vida: 48, pref: 'MON' },
  { nombre: 'Monitor LG UltraWide 29" IPS', specs: '29" 21:9WFHD 2560x1080 • HDR10 • Dual Controller', cat: 'Monitores y Displays', valor: 980000, vida: 36, pref: 'LGM' },
  { nombre: 'Servidor Dell PowerEdge R550 Rack', specs: 'Dual Xeon Silver 4310 • 64GB ECC • 4TB RAID 10 SAS', cat: 'Servidores y Racks', valor: 19500000, vida: 60, pref: 'SRV' },
  { nombre: 'Teléfono IP Cisco 8845 Gigabit', specs: 'Pantalla Color 5" • Video HD 720p • PoE • Audio Wideband', cat: 'Telefonía IP / Cisco', valor: 890000, vida: 48, pref: 'CSC' },
  { nombre: 'Docking Station Dell WD19TBS Thunderbolt', specs: 'Thunderbolt 3 • 130W Power Delivery • Triple Display 4K', cat: 'Periféricos y Docks', valor: 920000, vida: 24, pref: 'DCK' }
];

function slugify(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
}

async function runSeed() {
  console.log('Autenticando en Firebase para poblar datos...');
  try {
    await signInWithEmailAndPassword(auth, 'alexis.cruz@casalimpia.com.co', 'hospi123');
    console.log('Autenticado como alexis.cruz@casalimpia.com.co');
  } catch (e) {
    try {
      await createUserWithEmailAndPassword(auth, 'alexis.cruz@casalimpia.com.co', 'hospi123');
      console.log('Cuenta admin creada y autenticada');
    } catch (e2) {
      console.warn('Continuando sin auth estricto:', e2.message);
    }
  }

  const existingUsersSnap = await getDocs(collection(db, 'usuarios'));
  const existingEmails = new Set();
  existingUsersSnap.forEach(d => {
    const data = d.data();
    if (data.email) existingEmails.add(data.email.toLowerCase());
  });

  const existingEquiposSnap = await getDocs(collection(db, 'equipos'));
  const existingPlacas = new Set();
  existingEquiposSnap.forEach(d => {
    const data = d.data();
    if (data.placa) existingPlacas.add(data.placa.toUpperCase());
  });

  console.log(`Usuarios actuales: ${existingEmails.size} | Equipos actuales: ${existingPlacas.size}`);

  // 1. Generar 12 usuarios por cada una de las 8 áreas (96 nuevos usuarios)
  const nuevosUsuarios = [];
  let userCounter = 1;

  for (let aIdx = 0; aIdx < AREAS.length; aIdx++) {
    const areaName = AREAS[aIdx];
    const cargosArea = CARGOS_POR_AREA[areaName];

    for (let i = 0; i < 12; i++) {
      const nombreBase = NOMBRES[(aIdx * 12 + i) % NOMBRES.length];
      const apellido1 = APELLIDOS[(aIdx * 7 + i * 3) % APELLIDOS.length].trim();
      const apellido2 = APELLIDOS[(aIdx * 11 + i * 5 + 4) % APELLIDOS.length].trim();
      const nombreCompleto = `${nombreBase} ${apellido1} ${apellido2}`;

      const primerNombreSlug = slugify(nombreBase.split(' ')[0]);
      const apellidoSlug = slugify(apellido1);
      const email = `${primerNombreSlug}.${apellidoSlug}${userCounter}@casalimpia.com.co`;

      if (existingEmails.has(email)) {
        userCounter++;
        continue;
      }

      const sedeObj = SEDES[(aIdx + i) % SEDES.length];
      const cargo = cargosArea[i % cargosArea.length];

      // Rol acorde al área o cargo
      let rol = 'Empleado';
      if (areaName === 'Tecnología e Infraestructura (TI)') {
        rol = i === 0 ? 'Administrador' : (i < 8 ? 'Soporte TI' : 'Empleado');
      } else if (cargo.toLowerCase().includes('auditor') || cargo.toLowerCase().includes('control interno')) {
        rol = 'Auditor';
      }

      const cedulaNum = 1015000000 + (aIdx * 100000) + (i * 4321) + userCounter;
      const cedulaFormatted = cedulaNum.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      const avatarImg = ((aIdx * 12 + i) % 68) + 1;

      const userRef = doc(collection(db, 'usuarios'));
      const userDoc = {
        id: userRef.id,
        nombre: nombreCompleto,
        cedula: cedulaFormatted,
        email,
        rol,
        cargo,
        area: areaName,
        sede: sedeObj.sede,
        regional: sedeObj.regional,
        estado: i === 11 && aIdx % 2 === 1 ? 'INACTIVO' : 'ACTIVO',
        avatar: `https://i.pravatar.cc/150?img=${avatarImg}`,
        createdAt: Timestamp.now()
      };

      nuevosUsuarios.push({ ref: userRef, data: userDoc, sedeObj });
      userCounter++;
    }
  }

  // 2. Generar equipos asignados a la mayoría de estos usuarios + equipos disponibles en stock y en taller por cada área y regional
  const nuevosEquipos = [];
  const nuevasActasEntrega = [];
  const nuevasActasTraslado = [];
  const nuevosMovimientos = [];

  let placaCounter = 2100;
  let actaCounter = 101;

  // Asignar equipos a ~75% de los usuarios creados (unos 9 equipos asignados por área + 2 disponibles/mantenimiento por área = ~88-96 equipos nuevos)
  for (let idx = 0; idx < nuevosUsuarios.length; idx++) {
    const { data: u, sedeObj } = nuevosUsuarios[idx];

    // 9 de cada 12 usuarios por área tienen equipo asignado
    const posInArea = idx % 12;
    if (posInArea >= 10) continue; // Dejar 2 usuarios por área sin equipo aún

    while (existingPlacas.has(`CL-TI-${placaCounter}`)) {
      placaCounter++;
    }
    const placa = `CL-TI-${placaCounter++}`;
    const hw = MODELOS_HARDWARE[(idx * 3 + posInArea) % MODELOS_HARDWARE.length];
    const serial = `${hw.pref}${Math.floor(100000 + Math.random() * 899999)}X${(idx % 9) + 1}`;

    // Fecha de registro escalonada entre hace 2 y 26 meses para que la depreciación NIIF sea rica y realista
    const monthsAgo = ((idx * 3) % 24) + 1;
    const regDate = new Date();
    regDate.setMonth(regDate.getMonth() - monthsAgo);
    const regISO = regDate.toISOString();
    const regTexto = regDate.toLocaleString('es-CO');
    const regCorta = regISO.split('T')[0];

    // Fecha de entrega unos días después del alta
    const entDate = new Date(regDate.getTime() + 86400000 * 5);
    const entISO = entDate.toISOString();
    const entCorta = entISO.split('T')[0];

    const esEnTaller = posInArea === 9 && (idx % 2 === 0); // Algunos equipos en mantenimiento por área
    const esDisponibleArea = posInArea === 8; // Algunos equipos disponibles asignados al pool del área

    const estadoEquipo = esEnTaller ? 'MANTENIMIENTO' : (esDisponibleArea ? 'DISPONIBLE' : 'ASIGNADO');
    const actaNum = `ACT-2026-0${actaCounter++}`;
    const certHash = `78a9c2${Math.random().toString(36).substring(2, 10)}f0`;

    const eqRef = doc(collection(db, 'equipos'));
    const eqData = {
      placa,
      equipo_nombre: hw.nombre,
      equipo_specs: hw.specs,
      serial,
      categoria: hw.cat,
      estado: estadoEquipo,
      valor_declarado: hw.valor,
      vida_util_meses: hw.vida,
      area: u.area,
      sede: u.sede,
      regional: sedeObj.regional,
      asignatario: estadoEquipo === 'ASIGNADO' ? u.nombre : (estadoEquipo === 'MANTENIMIENTO' ? `Taller TI (${u.area})` : `Stock Disponible (${u.area})`),
      asignatario_id: estadoEquipo === 'ASIGNADO' ? u.id : '',
      asignatario_email: estadoEquipo === 'ASIGNADO' ? u.email : '',
      asignatario_cc: estadoEquipo === 'ASIGNADO' ? u.cedula : '',
      ubicacion: `${u.sede} • ${u.area}`,
      condicion_fisica: esEnTaller ? 'Requiere cambio de batería / revisión de placa' : '10/10 Óptimo',
      ultimo_movimiento: estadoEquipo === 'ASIGNADO'
        ? `Acta ${actaNum} entregada a ${u.nombre}`
        : (esEnTaller ? 'Novedad reportada: Mantenimiento preventivo/correctivo' : 'Disponible en sede para asignación'),
      acta_numero: estadoEquipo === 'ASIGNADO' ? actaNum : 'N/A',
      fecha_registro: regISO,
      fecha_registro_corta: regCorta,
      fecha_registro_texto: regTexto,
      registrado_por: {
        id: 'admin-seed',
        nombre: 'Jhonfer Alexis Cruz Gutiérrez',
        email: 'alexis.cruz@casalimpia.com.co'
      },
      historial_movimientos: [
        {
          fecha: regISO,
          tipo: 'ALTA',
          descripcion: `Ingreso inicial a inventario institucional (${u.sede})`,
          responsable: 'Jhonfer Alexis Cruz Gutiérrez'
        },
        ...(estadoEquipo === 'ASIGNADO' ? [{
          fecha: entISO,
          tipo: 'ASIGNACIÓN',
          descripcion: `Equipo asignado a ${u.nombre} (${u.cargo} - ${u.area}) mediante ${actaNum}`,
          responsable: 'Santiago Jiménez Céspedes'
        }] : [])
      ],
      createdAt: Timestamp.fromDate(regDate)
    };

    nuevosEquipos.push({ ref: eqRef, data: eqData });

    // Si está ASIGNADO, crear su Acta de Entrega oficial y Movimiento para Reportes y Auditoría
    if (estadoEquipo === 'ASIGNADO') {
      const actaRef = doc(collection(db, 'actas_entrega'));
      const actaPayload = {
        acta_numero: actaNum,
        fecha: entCorta,
        equipo_id: eqRef.id,
        placa,
        equipo_nombre: hw.nombre,
        equipo_specs: hw.specs,
        serial,
        categoria: hw.cat,
        estado_equipo: 'Óptimo (10/10)',
        colaborador: {
          id: u.id,
          nombre: u.nombre,
          cedula: u.cedula,
          cargo: u.cargo,
          area: u.area,
          sede: u.sede,
          email: u.email
        },
        entregado_por: {
          nombre: 'Santiago Jiménez Céspedes',
          cargo: 'Coordinador de Soporte TI de Campo',
          email: 'santiago.jimenez@casalimpia.com.co',
          sede: u.sede
        },
        accesorios: ['Cargador Original OEM', 'Maletín Corporativo', 'Mouse Óptico USB', 'Guaya de Seguridad'],
        observaciones: `Asignación operativa para el área de ${u.area} en ${u.sede}.`,
        cert_hash: certHash,
        createdAt: Timestamp.fromDate(entDate)
      };
      nuevasActasEntrega.push({ ref: actaRef, data: actaPayload });

      const movRef = doc(collection(db, 'movimientos'));
      nuevosMovimientos.push({
        ref: movRef,
        data: {
          tipo: 'ENTREGA',
          acta_numero: actaNum,
          acta_id: actaRef.id,
          fecha: entISO,
          fecha_registro: entISO,
          equipo_id: eqRef.id,
          placa,
          equipo_nombre: hw.nombre,
          serial,
          colaborador_nombre: u.nombre,
          responsable: 'Santiago Jiménez Céspedes',
          descripcion: `Asignación a ${u.nombre} (${u.area} • ${u.sede})`,
          cert_hash: certHash,
          createdAt: Timestamp.fromDate(entDate)
        }
      });
    }
  }

  // Crear también 8 traslados inter-regionales para que la pestaña de Traslados tenga datos ricos
  for (let t = 0; t < 8; t++) {
    const eqSample = nuevosEquipos[t * 4]?.data;
    if (!eqSample) continue;
    const orig = SEDES[t % SEDES.length];
    const dest = SEDES[(t + 1) % SEDES.length];
    const remNum = `TR-2026-00${t + 15}`;
    const trDate = new Date(Date.now() - (t + 1) * 86400000 * 3);
    const trRef = doc(collection(db, 'actas_traslado'));
    nuevasActasTraslado.push({
      ref: trRef,
      data: {
        acta_numero: remNum,
        fecha: trDate.toLocaleDateString('es-CO'),
        placa: eqSample.placa,
        equipo_nombre: eqSample.equipo_nombre,
        serial: eqSample.serial,
        categoria: eqSample.categoria,
        regional_origen: orig.regional,
        regional_destino: dest.regional,
        nueva_ubicacion: `${dest.sede} • ${eqSample.area}`,
        empresa_transporte: t % 2 === 0 ? 'Servientrega Corporativo' : 'Coordinadora Mercantil',
        guia_transporte: `GUIA-${908120 + t * 13}`,
        motivo: `Refuerzo operativo para el departamento de ${eqSample.area}`,
        despachado_por: {
          nombre: 'Jhonfer Alexis Cruz Gutiérrez',
          cargo: 'Ingeniero Administrador TI'
        },
        recibido_por: {
          nombre: 'Carlos Mario Restrepo V.',
          cargo: 'Líder de Soporte TI Regional'
        },
        cert_hash: `TR-CERT-${7000 + t}`,
        createdAt: Timestamp.fromDate(trDate)
      }
    });
  }

  // Ejecutar escritura por lotes (máximo 400 operaciones por batch en Firestore)
  const allOps = [
    ...nuevosUsuarios.map(item => ({ ref: item.ref, data: item.data })),
    ...nuevosEquipos.map(item => ({ ref: item.ref, data: item.data })),
    ...nuevasActasEntrega.map(item => ({ ref: item.ref, data: item.data })),
    ...nuevasActasTraslado.map(item => ({ ref: item.ref, data: item.data })),
    ...nuevosMovimientos.map(item => ({ ref: item.ref, data: item.data }))
  ];

  console.log(`Preparando inserción de:
  - ${nuevosUsuarios.length} nuevos usuarios (12 por cada una de las 8 áreas)
  - ${nuevosEquipos.length} nuevos equipos cargados en las áreas y regionales
  - ${nuevasActasEntrega.length} actas de entrega legalizadas
  - ${nuevasActasTraslado.length} remisiones de traslado regional
  - ${nuevosMovimientos.length} movimientos de auditoría`);

  const chunkSize = 350;
  for (let i = 0; i < allOps.length; i += chunkSize) {
    const chunk = allOps.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    chunk.forEach(op => batch.set(op.ref, op.data));
    await batch.commit();
    console.log(`Batch completado: ${Math.min(i + chunkSize, allOps.length)} / ${allOps.length} documentos guardados`);
  }

  console.log('¡Población de base de datos completada con éxito!');
  process.exit(0);
}

runSeed().catch(err => {
  console.error('Error en seed:', err);
  process.exit(1);
});
