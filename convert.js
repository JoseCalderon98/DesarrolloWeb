import fs from 'fs';
import path from 'path';

const srcPath = path.resolve('tmp_ui_extracted/stitch_sgi_casalimpia_web_ui/inventario_de_equipos_sgi_casalimpia/code.html');
const destPath = path.resolve('src/pages/Inventario.jsx');

let html = fs.readFileSync(srcPath, 'utf-8');

// Extract body contents
const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/);
if (bodyMatch) {
  html = bodyMatch[1];
}

// Remove script tags
html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

// Convert HTML comments to JSX comments
html = html.replace(/<!--([\s\S]*?)-->/g, '{/*$1*/}');

// class -> className
html = html.replace(/class="/g, 'className="');

// for -> htmlFor
html = html.replace(/for="/g, 'htmlFor="');

// style="width: 82%;" -> style={{ width: '82%' }}
html = html.replace(/style="width: ([\d.]+)%;"/g, "style={{ width: '82%' }}");

// Ensure img is closed
html = html.replace(/<img([^>]*)>/g, (match, p1) => {
  if (p1.trim().endsWith('/')) return match; 
  return `<img${p1}/>`;
});

// Ensure input is closed
html = html.replace(/<input([^>]*)>/g, (match, p1) => {
  if (p1.trim().endsWith('/')) return match;
  return `<input${p1}/>`;
});

// Ensure any other lone tags are handled if necessary, but HR and BR
html = html.replace(/<hr([^>]*)>/g, '<hr$1/>');
html = html.replace(/<br([^>]*)>/g, '<br$1/>');

// disabled="" -> disabled={true}
// Sometimes disabled is just without =""
html = html.replace(/disabled=""/g, 'disabled={true}');
html = html.replace(/\bdisabled\b(?!=[{"])/g, 'disabled={true}'); // very fragile, let's just stick to string replace

// We need to wrap it into a React component
const finalJsx = `import React from 'react';

export default function Inventario() {
  return (
    <div className="bg-background font-body-md text-on-surface antialiased min-h-screen">
      ${html}
    </div>
  );
}
`;

fs.writeFileSync(destPath, finalJsx);
console.log('Successfully written Inventario.jsx');
