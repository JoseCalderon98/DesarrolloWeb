// Utilidades para exportación, importación y datos demo del Inventario SGI CASALIMPIA

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
    'Ubicacion',
    'Ultimo Movimiento'
  ];

  const rows = equipos.map(e => [
    e.placa || '',
    e.equipo_nombre || '',
    e.equipo_specs || '',
    e.serial || '',
    e.categoria || '',
    e.estado || '',
    e.asignatario || '',
    e.ubicacion || '',
    e.ultimo_movimiento || ''
  ]);

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
      result.push({
        placa: row[0] || `CL-TI-${Math.floor(1000 + Math.random() * 9000)}`,
        equipo_nombre: row[1] || 'Equipo TI',
        equipo_specs: row[2] || 'Sin especificaciones detalladas',
        serial: row[3] || `SN${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
        categoria: row[4] || 'Laptops Corporativas',
        estado: (row[5] || 'DISPONIBLE').toUpperCase(),
        asignatario: row[6] || 'Bodega Centralizada TI',
        ubicacion: row[7] || 'Bogotá - Av. El Dorado',
        ultimo_movimiento: row[8] || 'Importación Lote CSV'
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
    ubicacion: 'Rack A1 - Principal',
    sede: 'Bogotá',
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
    ubicacion: 'Sede Principal Av. El Dorado',
    sede: 'Bogotá',
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
    ubicacion: 'Rack B2 - Piso 2',
    sede: 'Medellín',
    ultimo_movimiento: 'Devolución Acta #12'
  },
  {
    placa: 'CL-TI-0621',
    equipo_nombre: 'MacBook Pro 14" M2 Pro',
    equipo_specs: 'Apple M2 Pro 10 Core • 16GB Unified • SSD 512GB',
    serial: 'C02G879QMD6R',
    categoria: 'Laptops Corporativas',
    estado: 'MANTENIMIENTO',
    asignatario: 'Taller Central de Soporte',
    ubicacion: 'Laboratorio Hardware - Mesa 3',
    sede: 'Bogotá',
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
    ubicacion: 'Datacenter Principal - Rack 4',
    sede: 'Bogotá',
    ultimo_movimiento: 'Mantenimiento Preventivo Q1'
  }
];
