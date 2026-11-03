/** Incrusta el CSS compilado de Tailwind en apps-script/src/ui/Estilos.html (Apps Script no sirve archivos estáticos). */
const fs = require('fs');
const path = require('path');
const raiz = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(raiz, 'salida', 'tailwind.css'), 'utf8');
const destino = path.join(raiz, 'apps-script', 'src', 'ui', 'Estilos.html');
fs.writeFileSync(destino, '<!-- GENERADO por npm run build:css. No editar a mano: modificar estilos/entrada.css -->\n<style>\n' + css + '\n</style>\n');
console.log('Estilos.html generado (' + (css.length / 1024).toFixed(1) + ' KB)');
