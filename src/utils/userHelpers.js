// Utilidades, definición de roles e integrantes del PPI SGI CASALIMPIA

export const ROLES = [
  'Administrador',
  'Soporte TI',
  'Empleado',
  'Auditor'
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
 * Integrantes oficiales del PPI - Tecnológico de Antioquia (SGI CASALIMPIA S.A.)
 */
export const initialPPIMembers = [
  {
    nombre: 'Jhonfer Alexis Cruz Gutiérrez',
    cedula: '1.020.455.890',
    email: 'alexis.cruz@casalimpia.com.co',
    rol: 'Administrador',
    cargo: 'Ingeniero Administrador TI',
    area: 'Tecnología e Infraestructura',
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
    area: 'Tecnología e Infraestructura',
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
    area: 'Soporte Técnico y Hardware',
    sede: 'Medellín - Poblado',
    estado: 'ACTIVO',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'
  },
  {
    nombre: 'Juan David Gutiérrez Zuleta',
    cedula: '1.020.455.891',
    email: 'juan.gutierrez@casalimpia.com.co',
    rol: 'Empleado',
    cargo: 'Analista de Operaciones y Servicios',
    area: 'Servicios Generales',
    sede: 'Bogotá - Av. El Dorado',
    estado: 'ACTIVO',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBGsQE4UpuHooVIQ04f_YXJzXSdny24c9qcuPr1cMP7E4D0fr4H3zy4UOsHO9xZEClCFY1bkk-g_Xpzvn8G3xYhBX7yHYVnzEWjWnGQtd9Eoum0fT7tscs2fRHPj-v0WtIi5uGGU25yihacJ_e5Iv0qXvC7l8NaVI7cnqtD-6vDgu2_3qjKc0QBBw9K8bc3vR_ht51hHYqSMbBUb2y9PlxaMsdkLoFSV8BpGGaugbqPrjso00WxNqWonQ'
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
