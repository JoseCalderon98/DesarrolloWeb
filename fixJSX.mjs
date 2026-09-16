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
  const userVarMatch = content.includes("currentUser?.rol") ? "currentUser?.rol" : "storedSession?.rol";

  // 1. Quitar todos los ')}' huérfanos que dejó el regex defectuoso.
  // El defctuoso de roles dejó:
  //              </a>
  //            )}
  // El de reportes dejó:
  //              </a>
  //            )}
  // Y los vamos a buscar literalmente y borrar
  content = content.replace(/<\/a>\s*\n\s*\)}/g, '</a>');

  // Ahora, vamos a aplicar correctamente las condiciones SIN regex codiciosos.
  // Para los bloques de <a> separaremos la busqueda de manera que encuentre el inicio verdadero del anchor.

  // A) Reemplazamos la etiqueta Manage Accounts por su versión condicional
  const manageAccountsOriginal = `<a \n              className="flex items-center justify-between px-space-md py-space-sm text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface rounded-lg transition-colors cursor-pointer"\n              onClick={() => navigate('/usuarios-roles')}\n            >\n              <div className="flex items-center gap-space-md">\n                <span className="material-symbols-outlined text-[20px]">manage_accounts</span>`;
  
  if (content.includes('manage_accounts</span>')) {
     // Buscamos dinámicamente todo el bloque completo midiendo el offset.
     // Mejor usar replace exacto sobre la linea.
     content = content.split('\n').map(line => {
       if (line.includes('onClick={() => navigate(\'/usuarios-roles\')}') || line.includes('manage_accounts')) {
         // Not safe enough for line by line if <a> is multi-line
       }
       return line;
     }).join('\n');
  }

  // La forma MÁS SEGURA de limpiar y rehacer la nav, es buscar la sección entera desde <nav... hasta </nav>
  // Pero ya que solo faltaba arreglar los )}, primero limpiemos.
  
  fs.writeFileSync(p, content, 'utf-8');
  console.log(`Cleaned ${file}`);
});
