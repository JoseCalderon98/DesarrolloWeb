// Utilidades, definición de roles, áreas, regionales e integrantes del PPI SGI CASALIMPIA

export const ROLES = [
  'Administrador',
  'Soporte TI',
  'Empleado',
  'Auditor'
];

export const AREAS_CORPORATIVAS = [
  'Talento Humano / Recursos Humanos',
  'Tecnología e Infraestructura (TI)',
  'Operaciones y Servicios Generales',
  'Contabilidad y Finanzas',
  'Comercial y Mercadeo',
  'Compras, Logística y Bodega',
  'Seguridad y Salud en el Trabajo (SST / HSEQ)',
  'Gerencia y Dirección Administrativa'
];

export const SEDES_CORPORATIVAS = [
  'Bogotá - Av. El Dorado',
  'Medellín - Poblado',
  'Cali - Valle del Lili',
  'Barranquilla - Prado',
  'Pereira - Circunvalar',
  'Bucaramanga - Cabecera'
];

export const REGIONALES_FILTRO = [
  { id: 'bogota', label: 'Regional Bogotá (Av. El Dorado)', shortLabel: 'Bogotá' },
  { id: 'medellin', label: 'Regional Medellín (Poblado)', shortLabel: 'Medellín' },
  { id: 'cali', label: 'Regional Cali (Valle del Lili)', shortLabel: 'Cali' },
  { id: 'barranquilla', label: 'Regional Barranquilla (Prado)', shortLabel: 'Barranquilla' },
  { id: 'pereira', label: 'Regional Pereira (Circunvalar)', shortLabel: 'Pereira' },
  { id: 'bucaramanga', label: 'Regional Bucaramanga (Cabecera)', shortLabel: 'Bucaramanga' }
];

export const ROLE_INFO = {
  'Administrador': {
    badgeClass: 'bg-primary text-on-primary',
    desc: 'Acceso total al sistema, inventario, asignaciones, reportes y roles.',
    icon: 'shield_person'
  },
  'Soporte TI': {
    badgeClass: 'bg-secondary-container text-on-secondary-container',
    desc: 'Gestión técnica de inventario, entrega/recepción y mantenimiento.',
    icon: 'build'
  },
  'Empleado': {
    badgeClass: 'bg-surface-container-high text-on-surface',
    desc: 'Custodia de equipos asignados y firma digital de actas.',
    icon: 'person'
  },
  'Auditor': {
    badgeClass: 'bg-primary-fixed text-on-primary-fixed',
    desc: 'Consulta y exportación de reportes de auditoría ISO 20000 / 27001.',
    icon: 'verified_user'
  }
};

/**
 * Normaliza un nombre de área libre o antiguo hacia una de las 8 áreas corporativas oficiales
 */
export function normalizeArea(rawArea = '') {
  const clean = String(rawArea || '').trim();
  if (!clean) return 'Tecnología e Infraestructura (TI)';

  const exactMatch = AREAS_CORPORATIVAS.find(a => a.toLowerCase() === clean.toLowerCase());
  if (exactMatch) return exactMatch;

  const lower = clean.toLowerCase();
  if (lower.includes('talento') || lower.includes('recurso') || lower.includes('rrhh') || lower.includes('humano') || lower.includes('nomina') || lower.includes('nómina')) {
    return 'Talento Humano / Recursos Humanos';
  }
  if (lower.includes('tecnolog') || lower.includes('infraestructura') || lower.includes('soporte') || lower.includes('sistemas') || lower.includes('bodega ti') || lower.includes('taller')) {
    return 'Tecnología e Infraestructura (TI)';
  }
  if (lower.includes('operacion') || lower.includes('servicios generales') || lower.includes('aseo') || lower.includes('mantenimiento locativo')) {
    return 'Operaciones y Servicios Generales';
  }
  if (lower.includes('contab') || lower.includes('finanz') || lower.includes('tesorer') || lower.includes('cartera') || lower.includes('facturaci')) {
    return 'Contabilidad y Finanzas';
  }
  if (lower.includes('comercial') || lower.includes('mercad') || lower.includes('venta') || lower.includes('licitaci')) {
    return 'Comercial y Mercadeo';
  }
  if (lower.includes('compra') || lower.includes('logíst') || lower.includes('logist') || lower.includes('almac') || lower.includes('bodega')) {
    return 'Compras, Logística y Bodega';
  }
  if (lower.includes('sst') || lower.includes('hseq') || lower.includes('salud') || lower.includes('seguridad') || lower.includes('calidad')) {
    return 'Seguridad y Salud en el Trabajo (SST / HSEQ)';
  }
  if (lower.includes('gerencia') || lower.includes('direcci') || lower.includes('administraci') || lower.includes('jurídic') || lower.includes('juridic')) {
    return 'Gerencia y Dirección Administrativa';
  }

  return clean;
}

/**
 * Determina el Área / Departamento donde se encuentra cargado un equipo,
 * cruzando campo directo `area`, datos del asignatario o cadena de `ubicacion`.
 */
export function resolveAssetArea(equipo = {}, usuariosList = []) {
  if (!equipo) return 'Tecnología e Infraestructura (TI)';

  if (equipo.area && String(equipo.area).trim()) {
    return normalizeArea(equipo.area);
  }

  // Si está en Bodega o disponible sin asignatario personal
  const asignatarioStr = String(equipo.asignatario || '').toLowerCase();
  if (
    equipo.estado === 'DISPONIBLE' ||
    !equipo.asignatario ||
    asignatarioStr.includes('bodega') ||
    asignatarioStr.includes('taller')
  ) {
    return 'Tecnología e Infraestructura (TI)';
  }

  // Buscar en la lista de usuarios de Firestore o en initialPPIMembers
  const allUsers = [...usuariosList, ...initialPPIMembers];
  const matchedUser = allUsers.find(u => {
    const matchEmail = equipo.asignatario_email && u.email && equipo.asignatario_email.trim().toLowerCase() === u.email.trim().toLowerCase();
    const matchName = equipo.asignatario && u.nombre && equipo.asignatario.trim().toLowerCase() === u.nombre.trim().toLowerCase();
    return matchEmail || matchName;
  });

  if (matchedUser?.area) {
    return normalizeArea(matchedUser.area);
  }

  // Revisar si la ubicación contiene "• Área" (formato de RegistroEntrega)
  if (equipo.ubicacion && String(equipo.ubicacion).includes('•')) {
    const parts = String(equipo.ubicacion).split('•');
    if (parts[1]) {
      return normalizeArea(parts[1].trim());
    }
  }

  return 'Tecnología e Infraestructura (TI)';
}

/**
 * Determina la clave regional normalizada ('bogota', 'medellin', 'cali', 'barranquilla', 'pereira', 'bucaramanga')
 */
export function resolveAssetRegionalId(equipo = {}) {
  const raw = `${equipo.ubicacion || ''} ${equipo.sede || ''} ${equipo.regional || ''}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (raw.includes('bogot') || raw.includes('dorado')) return 'bogota';
  if (raw.includes('medell') || raw.includes('poblad')) return 'medellin';
  if (raw.includes('cali') || raw.includes('lili')) return 'cali';
  if (raw.includes('barranquill') || raw.includes('prado') || raw.includes('costa')) return 'barranquilla';
  if (raw.includes('pereir') || raw.includes('circunvalar') || raw.includes('eje')) return 'pereira';
  if (raw.includes('bucaramang') || raw.includes('cabecera')) return 'bucaramanga';
  return 'medellin';
}

export function resolveAssetRegionalLabel(equipo = {}) {
  const id = resolveAssetRegionalId(equipo);
  const found = REGIONALES_FILTRO.find(r => r.id === id);
  return found ? found.shortLabel : (equipo.ubicacion || 'Medellín');
}

/**
 * Integrantes oficiales del PPI - Tecnológico de Antioquia (SGI CASALIMPIA S.A.)
 */
export const initialPPIMembers = [
  {
    nombre: 'Jhonfer Alexis Cruz Gutiérrez',
    cedula: '1.020.455.890',
    email: 'alexis.cruz@casalimpia.com.co',
    email_personal: 'alexbyc728@gmail.com',
    rol: 'Administrador',
    cargo: 'Ingeniero Administrador TI',
    area: 'Tecnología e Infraestructura (TI)',
    sede: 'Bogotá - Av. El Dorado',
    estado: 'ACTIVO',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDyAiWOUn9njbbS4sZzxnzDv-_O7nlKMP0d8Uj3JmLf2C_0yjiCZpAy_-U4uCYuUD42dh2KBHFoTT45HDNZZYJ4xGPuondY8OzWlnn7_ZuxW3T5adr-8kHHxYrg8TKac--UfaKWJfhULlk7ZTIvToV2_6HQK6K4NU1fRHrt-A4bVhe1TrF6kp8FaNl7tV6SQ4Q_7jCd97VAYDW2x8agwEazqetgfvCbDatPHJzic_KZM9Czjj8JNoYE6Q'
  },
  {
    nombre: 'José Alejandro Calderón Cuartas',
    cedula: '1.035.890.123',
    email: 'alejandro.calderon@casalimpia.com.co',
    rol: 'Administrador',
    cargo: 'Líder de Desarrollo y Arquitectura TI',
    area: 'Tecnología e Infraestructura (TI)',
    sede: 'Medellín - Poblado',
    estado: 'ACTIVO',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
  },
  {
    nombre: 'Santiago Jiménez Céspedes',
    cedula: '1.017.654.321',
    email: 'santiago.jimenez@casalimpia.com.co',
    rol: 'Soporte TI',
    cargo: 'Coordinador de Soporte TI de Campo',
    area: 'Tecnología e Infraestructura (TI)',
    sede: 'Medellín - Poblado',
    estado: 'ACTIVO',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'
  },
  {
    nombre: 'Juan David Gutiérrez Zuleta',
    cedula: '1.020.455.891',
    email: 'gjuandavid757@gmail.com',
    rol: 'Empleado',
    cargo: 'Analista de Operaciones y Servicios',
    area: 'Operaciones y Servicios Generales',
    sede: 'Bogotá - Av. El Dorado',
    estado: 'ACTIVO',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBGsQE4UpuHooVIQ04f_YXJzXSdny24c9qcuPr1cMP7E4D0fr4H3zy4UOsHO9xZEClCFY1bkk-g_Xpzvn8G3xYhBX7yHYVnzEWjWnGQtd9Eoum0fT7tscs2fRHPj-v0WtIi5uGGU25yihacJ_e5Iv0qXvC7l8NaVI7cnqtD-6vDgu2_3qjKc0QBBw9K8bc3vR_ht51hHYqSMbBUb2y9PlxaMsdkLoFSV8BpGGaugbqPrjso00WxNqWonQ'
  },
  {
    nombre: 'Carlos Mario Restrepo V.',
    cedula: '1.045.712.900',
    email: 'carlos.restrepo@casalimpia.com.co',
    rol: 'Soporte TI',
    cargo: 'Líder de Soporte TI Regional Costa',
    area: 'Tecnología e Infraestructura (TI)',
    sede: 'Barranquilla - Prado',
    estado: 'ACTIVO',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80'
  },
  {
    nombre: 'Paola Andrea Gómez L.',
    cedula: '1.088.341.229',
    email: 'paola.gomez@casalimpia.com.co',
    rol: 'Soporte TI',
    cargo: 'Supervisora de Operaciones TI Eje Cafetero',
    area: 'Talento Humano / Recursos Humanos',
    sede: 'Pereira - Circunvalar',
    estado: 'ACTIVO',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80'
  }
];

/**
 * Obtiene el usuario autenticado almacenado localmente
 */
export function getStoredUser() {
  try {
    const raw = localStorage.getItem('sgi_casalimpia_user');
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error("Error reading stored user:", e);
  }
  return initialPPIMembers[0]; // fallback al Administrador Alexis Cruz
}

/**
 * Guarda el usuario autenticado en localStorage
 */
export function setStoredUser(user) {
  try {
    localStorage.setItem('sgi_casalimpia_user', JSON.stringify(user));
  } catch (e) {
    console.error("Error saving stored user:", e);
  }
}
