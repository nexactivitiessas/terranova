#!/usr/bin/env node
/**
 * Servidor local de DESARROLLO / DEMOSTRACIÓN.
 *
 * Ejecuta el backend real de Apps Script sobre la simulación en memoria de Google (tests/mocks/gas.js)
 * y sirve las mismas plantillas HTML. Sirve para revisar la interfaz sin desplegar.
 *  - Los datos viven en memoria y se pierden al cerrar: NO es un entorno productivo.
 *  - Solo escucha en 127.0.0.1.
 *
 * Uso:  node tools/servidor-local.js [puerto]
 *       (crea un SUPERADMIN de demostración y muestra sus credenciales efímeras en la consola)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { cargarBackend } = require('../tests/cargar');

const PUERTO = Number(process.argv[2] || process.env.PUERTO || 8787);
const UI = path.join(__dirname, '..', 'apps-script', 'src');

const g = cargarBackend({ verErrores: true });
g.instalar();
const codigo = g.generarCodigoInstalacion().match(/: ([A-Z0-9-]{14}) /)[1];
const passDemo = 'Clave-' + crypto.randomBytes(6).toString('hex') + '#A1';
g.api({ accion: 'setup.crearSuperadmin', datos: { codigo, email: 'admin.demo@ejemplo.invalid', nombre: 'Superadmin DEMO', password: passDemo } });
const token = g.api({ accion: 'auth.login', datos: { email: 'admin.demo@ejemplo.invalid', password: passDemo } }).datos.token;
g.api({ accion: 'configuracion.guardar', token, datos: { clave: 'permitir_datos_prueba', valor: 'true' } });
g.cargarDatosPrueba();
g.api({ accion: 'auth.logout', datos: { token } });

/** Compila una plantilla de HtmlService (<? ?>, <?= ?>, <?!= ?>) a HTML. */
function renderizar(nombre, vars) {
  const fuente = fs.readFileSync(path.join(UI, nombre + '.html'), 'utf8');
  let js = 'let __o = "";\n';
  let i = 0;
  const re = /<\?(!=|=)?([\s\S]*?)\?>/g;
  let m;
  while ((m = re.exec(fuente))) {
    js += '__o += ' + JSON.stringify(fuente.slice(i, m.index)) + ';\n';
    if (m[1] === '!=') js += '__o += String(' + m[2] + ');\n';
    else if (m[1] === '=') js += '__o += __esc(' + m[2] + ');\n';
    else js += m[2] + '\n';
    i = re.lastIndex;
  }
  js += '__o += ' + JSON.stringify(fuente.slice(i)) + ';\nreturn __o;';
  const esc = v => String(v === undefined || v === null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const include_ = n => renderizar(n, vars);
  // eslint-disable-next-line no-new-func
  return new Function('__esc', 'include_', ...Object.keys(vars), js)(esc, include_, ...Object.values(vars));
}

const SHIM = `<script>
/* Simulación de google.script.run para el servidor local */
window.google = { script: { run: (function () {
  function corredor(ok, mal) {
    return { withSuccessHandler: function (f) { return corredor(f, mal); }, withFailureHandler: function (f) { return corredor(ok, f); },
      api: function (req) { fetch('/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req) })
        .then(function (r) { return r.json(); }).then(function (d) { ok && ok(d); }).catch(function (e) { mal && mal(e); }); } };
  }
  return corredor(null, null);
})() } };
</script>`;

const servidor = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'POST' && url.pathname === '/api') {
    let cuerpo = '';
    req.on('data', c => { cuerpo += c; if (cuerpo.length > 1e6) req.destroy(); });
    req.on('end', () => {
      let r;
      try { r = g.api(JSON.parse(cuerpo)); } catch (e) { r = { ok: false, error: { codigo: 'SOLICITUD', mensaje: 'JSON inválido' } }; }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(r));
    });
    return;
  }
  if (url.pathname !== '/') { res.writeHead(404); res.end(); return; }
  const p = url.searchParams.get('p');
  const pagina = { app: 'ui/App', portal: 'ui/App', setup: 'ui/Setup' }[p] || 'ui/Publico';
  try {
    const html = renderizar(pagina, { marca: g.Configuracion.marcaPublica(), pagina: p || 'publico', url: '/' });
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'X-Frame-Options': 'DENY' });
    res.end('<!-- DEMO LOCAL: datos en memoria -->' + html.replace('<head>', '<head><meta name="viewport" content="width=device-width, initial-scale=1">' + SHIM));
  } catch (e) {
    res.writeHead(500); res.end('Error de plantilla: ' + e.message);
  }
});

servidor.listen(PUERTO, '127.0.0.1', () => {
  console.log('Servidor local de demostración: http://127.0.0.1:' + PUERTO);
  console.log('Panel: http://127.0.0.1:' + PUERTO + '/?p=app');
  console.log('Usuario DEMO: admin.demo@ejemplo.invalid  Contraseña efímera: ' + passDemo);
  console.log('Los datos son ficticios (PRUEBA) y se pierden al cerrar.');
});
