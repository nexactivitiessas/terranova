/**
 * Carga todos los archivos del backend en un contexto aislado (vm), igual que Apps Script V8:
 * un único ámbito global compartido por todos los archivos.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { crearEntorno } = require('./mocks/gas');

const SRC = path.join(__dirname, '..', 'apps-script', 'src');

function archivosBackend() {
  const out = [];
  (function rec(dir) {
    fs.readdirSync(dir).sort().forEach(f => {
      const p = path.join(dir, f);
      if (fs.statSync(p).isDirectory()) rec(p);
      else if (f.endsWith('.js')) out.push(p);
    });
  })(SRC);
  return out;
}

function cargarBackend(opciones = {}) {
  const entorno = crearEntorno();
  const silencioso = { log() {}, warn() {}, error: opciones.verErrores ? console.error : () => {} };
  const ctx = vm.createContext(Object.assign({ console: silencioso }, entorno.globals));
  archivosBackend().forEach(f => vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f }));
  ctx.__estado = entorno.estado;
  return ctx;
}

module.exports = { cargarBackend, archivosBackend };
