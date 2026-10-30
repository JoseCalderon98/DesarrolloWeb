// Utilidades para exportación, importación y datos demo del Inventario SGI CASALIMPIA
import { resolveAssetArea } from './userHelpers';

/**
 * Formatea un valor numérico a moneda colombiana (COP)
 * @param {number|string} amount
 * @returns {string} Ejemplo: "$ 3.500.000"
 */
export function formatCurrencyCOP(amount) {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
  }).format(num);
}

/**
 * Retorna un valor comercial de referencia según la categoría si el activo no tiene valor declarado
 * @param {string} categoria
 * @returns {number}
 */
export function getEstimatedPriceByCategory(categoria = '') {
  const cat = String(categoria).toLowerCase();
  if (cat.includes('laptop') || cat.includes('portátil')) return 3500000;
  if (cat.includes('escritorio') || cat.includes('desktop') || cat.includes('prodesk')) return 2800000;
  if (cat.includes('servidor') || cat.includes('rack')) return 12500000;
  if (cat.includes('monitor') || cat.includes('display')) return 780000;
  if (cat.includes('impresora') || cat.includes('scanner')) return 1200000;
  if (cat.includes('red') || cat.includes('switch') || cat.includes('router')) return 1800000;
  return 2500000;
}

/**
 * Calcula la depreciación contable en línea recta de un activo institucional
 * @param {Object} asset
 * @returns {Object} { valorDeclarado, isEstimated, vidaUtilMeses, mesesUso, porcentajeDepreciado, depreciacionAcumulada, valorResidual, estaDepreciadoTotalmente }
 */
export function calculateDepreciation(asset = {}) {
  const hasDeclaredValue = asset.valor_declarado !== undefined && asset.valor_declarado !== null && asset.valor_declarado !== '' && Number(asset.valor_declarado) > 0;
  const valorDeclarado = hasDeclaredValue ? Number(asset.valor_declarado) : getEstimatedPriceByCategory(asset.categoria);
  const isEstimated = !hasDeclaredValue;
  const vidaUtilMeses = Number(asset.vida_util_meses) || 36; // 36 meses = 3 años estándar contable TI

  // Fecha de registro
  let registrationDate = null;
  if (asset.fecha_registro) {
    const parsed = new Date(asset.fecha_registro);
    if (!isNaN(parsed.getTime())) registrationDate = parsed;
  }
  if (!registrationDate && asset.createdAt?.seconds) {
    registrationDate = new Date(asset.createdAt.seconds * 1000);
  }
  if (!registrationDate) {
    registrationDate = new Date(); // Asumir hoy si no tiene fecha
  }

  const now = new Date();
  const diffTime = Math.max(0, now.getTime() - registrationDate.getTime());
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  const mesesUso = Math.max(0, +(diffDays / 30.44).toFixed(1));

  const porcentajeDepreciado = Math.min(100, Math.max(0, +((mesesUso / vidaUtilMeses) * 100).toFixed(1)));
  const depreciacionAcumulada = Math.round((valorDeclarado * porcentajeDepreciado) / 100);
  const valorResidual = Math.max(0, valorDeclarado - depreciacionAcumulada);
  const estaDepreciadoTotalmente = porcentajeDepreciado >= 100;

  return {
    valorDeclarado,
    isEstimated,
    vidaUtilMeses,
    mesesUso,
    porcentajeDepreciado,
    depreciacionAcumulada,
    valorResidual,
    estaDepreciadoTotalmente
  };
}

/**
 * Exporta la lista de activos a un archivo CSV compatible con Microsoft Excel
 * @param {Array} equipos Lista de objetos de equipos
 * @param {string} filename Nombre del archivo a descargar
 */
export function exportToCSV(equipos, filename = 'inventario_activos_casalimpia.csv') {
  if (!equipos || equipos.length === 0) {
    alert('No hay equipos para exportar.');
    return;
  }

  const headers = [
    'Placa / Codigo',
    'Equipo',
    'Especificaciones',
    'Numero Serial',
    'Categoria',
    'Estado',
    'Asignatario',
    'Area / Departamento',
    'Ubicacion / Regional',
    'Valor Declarado (COP)',
    'Depreciacion Acumulada (COP)',
    'Valor Residual en Libros (COP)',
    'Fecha de Registro',
    'Ultimo Movimiento'
  ];

  const formatFecha = (e) => {
    if (e.fecha_registro_texto) return e.fecha_registro_texto;
    if (e.fecha_registro) {
      try {
        return new Date(e.fecha_registro).toLocaleString('es-CO');
      } catch {
        return String(e.fecha_registro);
      }
    }
    if (e.createdAt?.seconds) {
      return new Date(e.createdAt.seconds * 1000).toLocaleString('es-CO');
    }
    return 'Sin registrar';
  };

  const rows = equipos.map(e => {
    const dep = calculateDepreciation(e);
    return [
      e.placa || '',
      e.equipo_nombre || '',
      e.equipo_specs || '',
      e.serial || '',
      e.categoria || '',
      e.estado || '',
      e.asignatario || '',
      resolveAssetArea(e),
      e.ubicacion || '',
      dep.valorDeclarado,
      dep.depreciacionAcumulada,
      dep.valorResidual,
      formatFecha(e),
      e.ultimo_movimiento || ''
    ];
  });

  const escapeCSV = (field) => {
    const stringField = String(field ?? '');
    if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
      return `"${stringField.replace(/"/g, '""')}"`;
    }
    return stringField;
  };

  const csvContent = [
    headers.map(escapeCSV).join(','),
    ...rows.map(row => row.map(escapeCSV).join(','))
  ].join('\r\n');

  // \uFEFF añade el Byte Order Mark (BOM) UTF-8 para que Excel lo abra con tildes y eñes correctamente
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Parsea un texto CSV simple a un arreglo de objetos equipo
 * @param {string} csvText Contenido del archivo CSV
 * @returns {Array} Lista de equipos normalizados
 */
export function parseCSV(csvText) {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length < 2) return [];

  // Omitir cabecera si contiene 'Placa'
  const startIndex = lines[0].toLowerCase().includes('placa') ? 1 : 0;
  const result = [];

  for (let i = startIndex; i < lines.length; i++) {
    // Parser simple de CSV respetando comillas
    const row = [];
    let insideQuote = false;
    let entry = '';
    const line = lines[i];

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        insideQuote = !insideQuote;
      } else if (char === ',' && !insideQuote) {
        row.push(entry.trim());
        entry = '';
      } else {
        entry += char;
      }
    }
    row.push(entry.trim());

    if (row.length >= 4) {
      const parsedValor = Number(String(row[8] || '').replace(/[^0-9]/g, '')) || 0;
      result.push({
        placa: row[0] || `CL-TI-${Math.floor(1000 + Math.random() * 9000)}`,
        equipo_nombre: row[1] || 'Equipo TI',
        equipo_specs: row[2] || 'Sin especificaciones detalladas',
        serial: row[3] || `SN${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
        categoria: row[4] || 'Laptops Corporativas',
        estado: (row[5] || 'DISPONIBLE').toUpperCase(),
        asignatario: row[6] || 'Bodega Centralizada TI',
        area: 'Tecnología e Infraestructura (TI)',
        ubicacion: row[7] || 'Regional Medellin',
        valor_declarado: parsedValor > 0 ? parsedValor : 3500000,
        vida_util_meses: 36,
        ultimo_movimiento: row[9] || 'Importación Lote CSV'
      });
    }
  }

  return result;
}

/**
 * Datos demo predefinidos para inicializar la base de datos de CASALIMPIA si está vacía
 */
export const initialDemoAssets = [
  {
    placa: 'CL-TI-10002',
    equipo_nombre: 'HP ProDesk 400 G9',
    equipo_specs: 'Intel Core i5-12500 • 16GB RAM DDR4 • SSD 512GB NVMe • Monitor 24"',
    serial: 'HP8CD4721XZ',
    categoria: 'Estaciones de Escritorio',
    estado: 'DISPONIBLE',
    asignatario: 'Bodega Centralizada TI',
    area: 'Tecnología e Infraestructura (TI)',
    ubicacion: 'Regional Bogota',
    valor_declarado: 2950000,
    vida_util_meses: 36,
    ultimo_movimiento: 'Alta Sistema RF-02'
  },
  {
    placa: 'CL-TI-0892',
    equipo_nombre: 'Dell Latitude 5430 Rugged',
    equipo_specs: 'Intel Core i7-1265U vPro • 16GB RAM • SSD 512GB NVMe',
    serial: 'DL9440KJ1X',
    categoria: 'Laptops Corporativas',
    estado: 'ASIGNADO',
    asignatario: 'Santiago Jiménez Castro',
    asignatario_email: 'santiago.jimenez@casalimpia.com.co',
    area: 'Talento Humano / Recursos Humanos',
    ubicacion: 'Regional Bogota',
    valor_declarado: 4800000,
    vida_util_meses: 36,
    ultimo_movimiento: 'Entrega Acta #04-2026'
  },
  {
    placa: 'CL-TI-0754',
    equipo_nombre: 'Lenovo ThinkPad L14 Gen 3',
    equipo_specs: 'AMD Ryzen 5 PRO 5675U • 16GB RAM • SSD 256GB NVMe',
    serial: 'PF39KLM88',
    categoria: 'Laptops Corporativas',
    estado: 'DISPONIBLE',
    asignatario: 'Bodega Centralizada TI',
    area: 'Tecnología e Infraestructura (TI)',
    ubicacion: 'Regional Medellin',
    valor_declarado: 3600000,
    vida_util_meses: 36,
    ultimo_movimiento: 'Devolución Acta #12'
  },
  {
    placa: 'CL-TI-0621',
    equipo_nombre: 'MacBook Pro 14" M2 Pro',
    equipo_specs: 'Apple M2 Pro 10 Core • 16GB Unified • SSD 512GB',
    serial: 'C02G879QMD6R',
    categoria: 'Laptops Corporativas',
    estado: 'MANTENIMIENTO',
    condicion_fisica: '4/10 Dañado (Requiere Reparación)',
    asignatario: 'Taller Central de Soporte',
    area: 'Tecnología e Infraestructura (TI)',
    ubicacion: 'Regional Bogota',
    valor_declarado: 8900000,
    vida_util_meses: 36,
    ultimo_movimiento: 'Novedad: Teclado y Batería'
  },
  {
    placa: 'CL-TI-0540',
    equipo_nombre: 'Servidor Dell PowerEdge R650',
    equipo_specs: '2x Intel Xeon Silver 4314 • 64GB RAM • 4x 1.2TB SAS 10K',
    serial: 'SV-DEL-8991',
    categoria: 'Servidores y Racks',
    estado: 'ASIGNADO',
    asignatario: 'Infraestructura y Redes',
    area: 'Tecnología e Infraestructura (TI)',
    ubicacion: 'Regional Bogota',
    valor_declarado: 18500000,
    vida_util_meses: 60,
    ultimo_movimiento: 'Mantenimiento Preventivo Q1'
  },
  {
    placa: 'CL-TI-0901',
    equipo_nombre: 'Monitor LG UltraWide 29"',
    equipo_specs: '29WL500-B 2560x1080',
    serial: 'LG29M940KJ1X',
    categoria: 'Monitores y Displays',
    estado: 'ASIGNADO',
    asignatario: 'Juan David Gutiérrez Zuleta',
    asignatario_email: 'juan.gutierrez@casalimpia.com.co',
    area: 'Operaciones y Servicios Generales',
    ubicacion: 'Regional Medellin',
    valor_declarado: 850000,
    vida_util_meses: 36,
    ultimo_movimiento: 'Entrega Acta #05-2026'
  }
];
