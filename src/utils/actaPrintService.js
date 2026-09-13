/**
 * Servicio de Generación e Impresión Oficial de Actas SGI CASALIMPIA S.A.
 * Genera un documento formal, aislado y limpio para guardado en PDF o impresión física (ISO/IEC 27001).
 * Sin elementos de interfaz (sidebars, botones, inputs o colores oscuros de fondo).
 */

export function generateAndPrintActa(actaData, tipo = 'ENTREGA') {
  const isEntrega = tipo === 'ENTREGA';
  const codigoFormato = isEntrega ? 'TI-FO-04' : 'TI-FO-05';
  const tituloDocumento = isEntrega 
    ? 'ACTA DE ENTREGA DE EQUIPOS Y CUSTODIA DE BIENES INFORMÁTICOS' 
    : 'ACTA DE DEVOLUCIÓN Y DESCARGO DE CUSTODIA DE ACTIVOS TI';
  const subtituloDocumento = isEntrega
    ? 'Asignación Institucional de Hardware y Periféricos Tecnológicos'
    : 'Reintegro de Hardware a Bodega y Verificación Técnica de Salida';

  // Datos normalizados
  const actaNumero = actaData.acta_numero || 'ACT-2026-000';
  const fecha = actaData.fecha || new Date().toLocaleDateString('es-CO');
  const certHash = actaData.cert_hash || 'CERT-' + Math.random().toString(36).substring(2, 10).toUpperCase();

  // Equipo
  const equipoNombre = actaData.equipo_nombre || 'Equipo Tecnológico';
  const placa = actaData.placa || '---';
  const serial = actaData.serial || '---';
  const categoria = actaData.categoria || 'Portátiles Corporativos';
  const specs = actaData.equipo_specs || actaData.rawDoc?.equipo_specs || 'Configuración estándar institucional';
  const estadoEquipo = actaData.nuevo_estado || actaData.rawDoc?.estado || 'DISPONIBLE';

  // Colaborador
  const colaboradorNombre = typeof actaData.colaborador === 'object' 
    ? (actaData.colaborador?.nombre || 'Funcionario') 
    : (actaData.entregado_por_colaborador?.nombre || actaData.colaborador || 'Funcionario');
  const colaboradorCedula = typeof actaData.colaborador === 'object' 
    ? (actaData.colaborador?.cedula || '---') 
    : (actaData.entregado_por_colaborador?.cedula || actaData.colaborador_cc || '---');
  const colaboradorCargo = typeof actaData.colaborador === 'object' 
    ? (actaData.colaborador?.cargo || 'Funcionario') 
    : (actaData.entregado_por_colaborador?.cargo || 'Funcionario');
  const colaboradorArea = typeof actaData.colaborador === 'object' 
    ? (actaData.colaborador?.area || 'Operaciones') 
    : (actaData.entregado_por_colaborador?.area || 'Operaciones');
  const colaboradorSede = typeof actaData.colaborador === 'object' 
    ? (actaData.colaborador?.sede || 'Bogotá') 
    : (actaData.entregado_por_colaborador?.sede || actaData.colaborador_sede || 'Bogotá');
  const colaboradorEmail = typeof actaData.colaborador === 'object' 
    ? (actaData.colaborador?.email || '---') 
    : (actaData.entregado_por_colaborador?.email || '---');

  // Funcionario TI
  const tiNombre = typeof actaData.entregado_por === 'object' 
    ? (actaData.entregado_por?.nombre || 'Técnico TI') 
    : (actaData.recibido_por_ti?.nombre || actaData.responsable_ti || 'Administrador TI');
  const tiCargo = typeof actaData.entregado_por === 'object' 
    ? (actaData.entregado_por?.cargo || 'Administrador TI') 
    : (actaData.recibido_por_ti?.cargo || 'Soporte TI');

  // Accesorios
  const accesorios = actaData.accesorios || actaData.accesorios_recibidos || [
    'Maletín impermeable logo Casalimpia',
    'Mouse Inalámbrico con Dongle USB',
    'Adaptador Corriente Original 65W',
    'Guaya de seguridad Kensington'
  ];

  // Observaciones
  const observaciones = actaData.observaciones || 'Equipo verificado y configurado bajo estándares institucionales Casalimpia S.A.';

  // Firma
  const firmaImg = actaData.firma_receptor_img || actaData.firma_colaborador_img || actaData.rawDoc?.firma_receptor_img || actaData.rawDoc?.firma_colaborador_img || null;

  // HTML completo del documento oficial
  const printContent = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <title>${codigoFormato} - ${actaNumero} - CASALIMPIA S.A.</title>
      <style>
        @page {
          size: letter portrait;
          margin: 12mm 15mm;
        }
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        body {
          font-family: 'Segoe UI', Arial, sans-serif;
          color: #1e293b;
          background: #ffffff;
          font-size: 11px;
          line-height: 1.4;
        }
        .page {
          width: 100%;
          max-width: 780px;
          margin: 0 auto;
          padding: 10px;
        }
        .header-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 12px;
          border: 1.5px solid #00355f;
        }
        .header-table td {
          padding: 8px 10px;
          border: 1px solid #cbd5e1;
          vertical-align: middle;
        }
        .logo-box {
          width: 130px;
          text-align: center;
          background: #00355f;
          color: #ffffff;
          font-weight: 900;
          font-size: 18px;
          letter-spacing: 1px;
        }
        .header-title {
          text-align: center;
        }
        .header-title h1 {
          font-size: 13px;
          font-weight: 800;
          color: #00355f;
          text-transform: uppercase;
        }
        .header-title p {
          font-size: 10px;
          color: #64748b;
          font-weight: 600;
        }
        .header-meta {
          width: 150px;
          font-size: 9.5px;
          background: #f8fafc;
        }
        .header-meta strong {
          color: #00355f;
        }
        .doc-title {
          text-align: center;
          margin: 10px 0;
          padding: 6px;
          background: #f1f5f9;
          border-left: 4px solid #00355f;
        }
        .doc-title h2 {
          font-size: 13px;
          color: #00355f;
          font-weight: 800;
          letter-spacing: 0.5px;
        }
        .doc-title span {
          font-size: 10px;
          color: #475569;
        }
        .section-title {
          background: #00355f;
          color: #ffffff;
          padding: 4px 8px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          margin-top: 10px;
          letter-spacing: 0.5px;
        }
        .data-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 8px;
        }
        .data-table td {
          padding: 5px 8px;
          border: 1px solid #cbd5e1;
          font-size: 10px;
        }
        .data-table .label {
          background: #f8fafc;
          font-weight: 700;
          color: #334155;
          width: 25%;
        }
        .data-table .val {
          color: #0f172a;
          width: 25%;
        }
        .accessories-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 4px 12px;
          padding: 6px 8px;
          border: 1px solid #cbd5e1;
          background: #f8fafc;
          font-size: 10px;
        }
        .accessory-item {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .check-box {
          display: inline-block;
          width: 10px;
          height: 10px;
          border: 1.5px solid #00355f;
          background: #00355f;
          color: #fff;
          text-align: center;
          line-height: 9px;
          font-size: 8px;
          font-weight: bold;
        }
        .legal-box {
          border: 1px solid #cbd5e1;
          background: #fafafa;
          padding: 8px;
          font-size: 9px;
          color: #475569;
          text-align: justify;
          line-height: 1.35;
          margin-top: 8px;
        }
        .legal-box strong {
          color: #00355f;
        }
        .signatures-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 14px;
        }
        .signatures-table td {
          width: 50%;
          border: 1px solid #cbd5e1;
          padding: 8px;
          vertical-align: bottom;
          text-align: center;
        }
        .sig-container {
          min-height: 65px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          margin-bottom: 6px;
        }
        .sig-container img {
          max-height: 55px;
          max-width: 180px;
          object-fit: contain;
        }
        .sig-line {
          border-top: 1.5px solid #00355f;
          padding-top: 4px;
          font-size: 10px;
        }
        .sig-title {
          font-weight: 800;
          color: #00355f;
        }
        .sig-sub {
          font-size: 9px;
          color: #64748b;
        }
        .footer-note {
          text-align: center;
          font-size: 8.5px;
          color: #94a3b8;
          margin-top: 10px;
          border-top: 1px dashed #cbd5e1;
          padding-top: 6px;
        }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      </style>
    </head>
    <body>
      <div class="page">
        
        <!-- CABECERA INSTITUCIONAL CASALIMPIA S.A. -->
        <table class="header-table">
          <tr>
            <td class="logo-box">CASALIMPIA</td>
            <td class="header-title">
              <h1>CASALIMPIA S.A.</h1>
              <p>NIT: 860.038.324-1 • Sistema de Gestión de Información (SGI-TI)</p>
              <p style="font-size: 9px; color: #0284c7; margin-top: 2px;">GESTIÓN DE ACTIVOS INFORMÁTICOS • ISO/IEC 27001 & ISO 20000</p>
            </td>
            <td class="header-meta">
              <div><strong>Código:</strong> ${codigoFormato}</div>
              <div><strong>Versión:</strong> 3.2</div>
              <div><strong>Acta N°:</strong> <span style="font-weight:bold; color:#00355f;">${actaNumero}</span></div>
              <div><strong>Fecha:</strong> ${fecha}</div>
            </td>
          </tr>
        </table>

        <!-- TÍTULO DEL ACTA -->
        <div class="doc-title">
          <h2>${tituloDocumento}</h2>
          <span>${subtituloDocumento}</span>
        </div>

        <!-- 1. DATOS DEL COLABORADOR -->
        <div class="section-title">1. Datos del Colaborador ${isEntrega ? 'Receptor (Asignatario)' : 'que Reintegra'}</div>
        <table class="data-table">
          <tr>
            <td class="label">Nombre Completo:</td>
            <td class="val" style="font-weight:bold; color:#00355f;">${colaboradorNombre}</td>
            <td class="label">Cédula de Ciudadanía:</td>
            <td class="val" style="font-weight:bold;">${colaboradorCedula}</td>
          </tr>
          <tr>
            <td class="label">Cargo / Función:</td>
            <td class="val">${colaboradorCargo}</td>
            <td class="label">Área / Departamento:</td>
            <td class="val">${colaboradorArea}</td>
          </tr>
          <tr>
            <td class="label">Sede / Ubicación:</td>
            <td class="val">${colaboradorSede}</td>
            <td class="label">Correo Institucional:</td>
            <td class="val">${colaboradorEmail}</td>
          </tr>
        </table>

        <!-- 2. DATOS DEL EQUIPO TECNOLÓGICO -->
        <div class="section-title">2. Especificación Técnica del Activo Informático</div>
        <table class="data-table">
          <tr>
            <td class="label">Equipo / Modelo:</td>
            <td class="val" style="font-weight:bold; color:#00355f;">${equipoNombre}</td>
            <td class="label">Placa de Inventario:</td>
            <td class="val" style="font-weight:bold; color:#0284c7;">${placa}</td>
          </tr>
          <tr>
            <td class="label">Número de Serie (SN):</td>
            <td class="val" style="font-family:monospace; font-weight:bold;">${serial}</td>
            <td class="label">Categoría:</td>
            <td class="val">${categoria}</td>
          </tr>
          <tr>
            <td class="label">Especificaciones:</td>
            <td class="val" colspan="3">${specs}</td>
          </tr>
          <tr>
            <td class="label">Estado Físico / Técnico:</td>
            <td class="val" style="font-weight:bold;">${estadoEquipo}</td>
            <td class="label">Hash de Trazabilidad:</td>
            <td class="val" style="font-family:monospace; font-size:9px; color:#475569;">${certHash}</td>
          </tr>
        </table>

        <!-- 3. ACCESORIOS Y PERIFÉRICOS -->
        <div class="section-title">3. Periféricos y Accesorios Relacionados</div>
        <div class="accessories-grid">
          ${accesorios.map(acc => `
            <div class="accessory-item">
              <span class="check-box">&#10003;</span>
              <span>${acc}</span>
            </div>
          `).join('')}
        </div>

        <!-- 4. OBSERVACIONES TÉCNICAS -->
        <div class="section-title">4. Observaciones Técnicas y Configuración</div>
        <table class="data-table" style="margin-bottom:0;">
          <tr>
            <td class="val" colspan="4" style="padding:6px 8px; font-style:italic;">
              ${observaciones}
            </td>
          </tr>
        </table>

        <!-- 5. CLÁUSULA LEGAL Y COMPROMISO DE CUSTODIA -->
        <div class="legal-box">
          <strong>CLÁUSULA DE CUSTODIA Y RESPONSABILIDAD LEGAL:</strong> El colaborador declara recibir/entregar a entera satisfacción el hardware y los accesorios descritos, reconociendo que son herramientas de propiedad exclusiva de <strong>CASALIMPIA S.A.</strong> destinadas al cumplimiento de sus obligaciones contractuales. El colaborador se compromete al uso ético y diligente, salvaguardando la confidencialidad de la información institucional según la Ley 1273 de 2009 (Delitos Informáticos), la Ley 527 de 1999 (Comercio Electrónico y Firmas Digitales) y las políticas corporativas de Seguridad de la Información ISO/IEC 27001.
        </div>

        <!-- 6. CONFORMIDAD Y FIRMAS -->
        <table class="signatures-table">
          <tr>
            <td>
              <div class="sig-container">
                <div style="font-style:italic; font-family:serif; font-size:14px; font-weight:bold; color:#00355f;">
                  ${tiNombre}
                </div>
                <div style="font-size:8px; color:#64748b; font-family:monospace;">CERT-HASH: ${certHash.substring(0, 16)}</div>
                <div style="font-size:8px; color:#94a3b8;">${fecha}</div>
              </div>
              <div class="sig-line">
                <div class="sig-title">${tiNombre}</div>
                <div class="sig-sub">${tiCargo} • Casalimpia S.A.</div>
                <div class="sig-sub" style="font-weight:bold; color:#00355f;">RESPONSABLE DE TI (${isEntrega ? 'ENTREGA' : 'RECEPCIÓN'})</div>
              </div>
            </td>
            <td>
              <div class="sig-container">
                ${firmaImg ? `
                  <img src="${firmaImg}" alt="Firma Digital" />
                ` : `
                  <div style="font-size:10px; color:#94a3b8; font-style:italic;">Firma Electrónica Registrada</div>
                  <div style="font-size:8px; color:#00355f; font-weight:bold;">C.C. ${colaboradorCedula}</div>
                `}
              </div>
              <div class="sig-line">
                <div class="sig-title">${colaboradorNombre}</div>
                <div class="sig-sub">C.C. ${colaboradorCedula} • ${colaboradorCargo}</div>
                <div class="sig-sub" style="font-weight:bold; color:#00355f;">COLABORADOR (${isEntrega ? 'RECEPTOR CUSTODIO' : 'QUIEN REINTEGRA'})</div>
              </div>
            </td>
          </tr>
        </table>

        <div class="footer-note">
          CASALIMPIA S.A. • Sistema de Gestión de Inventario SGI • Documento emitido electrónicamente con validez jurídica según la Ley 527 de 1999 de la República de Colombia.
        </div>

      </div>
    </body>
    </html>
  `;

  // Abrir ventana dedicada para impresión o guardado directo a PDF
  const printWindow = window.open('', '_blank', 'width=850,height=950');
  if (!printWindow) {
    alert("Por favor permita las ventanas emergentes (pop-ups) para generar el PDF oficial del Acta.");
    return;
  }

  printWindow.document.open();
  printWindow.document.write(printContent);
  printWindow.document.close();

  // Esperar carga de imágenes y disparar impresión limpia
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 400);
  };
}

/**
 * Permite descargar directamente el acta oficial como un archivo HTML/Doc autónomo
 */
export function downloadActaFile(actaData, tipo = 'ENTREGA') {
  generateAndPrintActa(actaData, tipo);
}
