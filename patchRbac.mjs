import fs from 'fs';
import path from 'path';

const files = [
  'src/pages/Inventario.jsx',
  'src/pages/RegistrarEquipo.jsx',
  'src/pages/RegistroEntrega.jsx',
  'src/pages/Devoluciones.jsx',
  'src/pages/UsuariosRoles.jsx',
  'src/pages/Historial.jsx'
];

files.forEach(file => {
  const p = path.resolve(file);
  let content = fs.readFileSync(p, 'utf-8');

  // Determinar la variable de usuario
  const userVarMatch = content.match(/currentUser\?\.rol/) ? "currentUser?.rol" : "storedSession?.rol";

  // Identificar el bloque de "Entrega y Recepción" o "Entrega y Custodia" (puede ser un div > div y varios 'a')
  // Simplemente buscamos la etiqueta <div className="pt-space-xs"> y envolvemos todo hasta el penultimo a
  
  // Como los sidebars tienen ciertas ligeras variaciones, lo más confiable es usar replace basado en textos exactos encontrados.
  
  // 1. Envolver Usuarios y Roles
  const rolesRegex = /(<a[^>]*?>[\s\S]*?<span[^>]*?>manage_accounts<\/span>[\s\S]*?<\/a>|<a[^>]*?>[\s\S]*?<span[^>]*?>admin_panel_settings<\/span>[\s\S]*?<\/a>)/g;
  content = content.replace(rolesRegex, `{${userVarMatch} === 'Administrador' && (\n              $1\n            )}`);

  // 2. Envolver Reportes y Auditoría
  const auditRegex = /(<a[^>]*?>[\s\S]*?<span[^>]*?>verified_user<\/span>[\s\S]*?<\/a>)/g;
  content = content.replace(auditRegex, `{${userVarMatch} === 'Administrador' && (\n              $1\n            )}`);

  // 3. Envolver Novedades y Mantenimiento
  const mantRegex = /(<a[^>]*?>[\s\S]*?<span[^>]*?>build_circle<\/span>[\s\S]*?<\/a>)/g;
  content = content.replace(mantRegex, `{['Administrador', 'Soporte TI'].includes(${userVarMatch}) && (\n              $1\n            )}`);

  // 4. Envolver Todo el bloque de Entrega (pt-space-xs)
  const entregaRegex = /(<div className="pt-space-xs">[\s\S]*?<\/div>\s*<\/div>)/g;
  content = content.replace(entregaRegex, `{['Administrador', 'Soporte TI'].includes(${userVarMatch}) && (\n            $1\n            )}`);

  fs.writeFileSync(p, content, 'utf-8');
  console.log(`Patched ${file}`);
});
