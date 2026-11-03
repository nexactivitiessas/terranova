/**
 * Simulación en memoria de los servicios de Google Apps Script usados por la plataforma.
 * Objetivo: ejecutar el backend real (mismos archivos .js) en Node para pruebas automatizadas.
 * No reemplaza las pruebas en Apps Script real (ver docs/PLAN_DE_PRUEBAS.md).
 */
const crypto = require('crypto');

function toSigned(buf) { return Array.from(buf).map(b => (b > 127 ? b - 256 : b)); }
function toBuf(v) { return Buffer.isBuffer(v) ? v : Array.isArray(v) ? Buffer.from(v.map(b => (b + 256) % 256)) : Buffer.from(String(v), 'utf8'); }

class Rango {
  constructor(hoja, fila, col, nf, nc) { Object.assign(this, { hoja, fila, col, nf, nc }); }
  getValues() {
    const out = [];
    for (let i = 0; i < this.nf; i++) {
      const r = this.hoja.datos[this.fila - 1 + i] || [];
      const fila = [];
      for (let j = 0; j < this.nc; j++) { const v = r[this.col - 1 + j]; fila.push(v === undefined ? '' : v); }
      out.push(fila);
    }
    return out;
  }
  getValue() { return this.getValues()[0][0]; }
  setValues(vals) {
    vals.forEach((r, i) => r.forEach((v, j) => this.hoja._set(this.fila + i, this.col + j, v)));
    return this;
  }
  setValue(v) { this.hoja._set(this.fila, this.col, v); return this; }
  clearContent() { this.hoja._set(this.fila, this.col, ''); return this; }
  setFontWeight() { return this; }
  setNumberFormat() { return this; }
  getSheet() { return this.hoja; }
  getRow() { return this.fila; }
  getColumn() { return this.col; }
  getNumRows() { return this.nf; }
  getNumColumns() { return this.nc; }
  getA1Notation() { return 'R' + this.fila + 'C' + this.col; }
}

class Hoja {
  constructor(nombre) { this.nombre = nombre; this.datos = []; this.protecciones = []; }
  getName() { return this.nombre; }
  _set(f, c, v) {
    while (this.datos.length < f) this.datos.push([]);
    const fila = this.datos[f - 1];
    // Sheets descarta el apóstrofo inicial usado para escapar fórmulas
    if (typeof v === 'string' && /^'[=+\-@]/.test(v)) v = v.substring(1);
    fila[c - 1] = v;
  }
  getLastRow() { let n = this.datos.length; while (n > 0 && !(this.datos[n - 1] || []).some(v => v !== '' && v !== undefined)) n--; return n; }
  getLastColumn() { return this.datos.reduce((m, r) => Math.max(m, r.length), 0); }
  getMaxRows() { return Math.max(1000, this.datos.length); }
  getDataRange() { return new Rango(this, 1, 1, Math.max(this.getLastRow(), 1), Math.max(this.getLastColumn(), 1)); }
  getRange(f, c, nf, nc) { return new Rango(this, f, c, nf || 1, nc || 1); }
  appendRow(vals) { const f = this.getLastRow() + 1; vals.forEach((v, j) => this._set(f, j + 1, v)); return this; }
  clearContents() { this.datos = []; return this; }
  setFrozenRows() { return this; }
  getProtections() { return this.protecciones; }
  protect() { const p = { setDescription() { return p; }, setWarningOnly() { return p; } }; this.protecciones.push(p); return p; }
}

class Libro {
  constructor(id, nombre) { this.id = id; this.nombre = nombre; this.hojas = [new Hoja('Hoja 1')]; }
  getId() { return this.id; }
  getUrl() { return 'https://docs.google.com/spreadsheets/d/' + this.id; }
  getSheetByName(n) { return this.hojas.find(h => h.nombre === n) || null; }
  getSheets() { return this.hojas.slice(); }
  insertSheet(n) { const h = new Hoja(n); this.hojas.push(h); return h; }
  deleteSheet(h) { this.hojas = this.hojas.filter(x => x !== h); }
  setSpreadsheetTimeZone() {}
  setSpreadsheetLocale() {}
  clonar(id, nombre) {
    const l = new Libro(id, nombre);
    l.hojas = this.hojas.map(h => { const c = new Hoja(h.nombre); c.datos = h.datos.map(r => r.slice()); return c; });
    return l;
  }
}

function crearEntorno() {
  const libros = {};
  const archivos = {};
  const props = {};
  const cache = {};
  const correos = [];
  const triggers = [];
  let seq = 0;
  const nuevoId = p => p + (++seq).toString(36).padStart(6, '0');

  const Utilities = {
    DigestAlgorithm: { SHA_256: 'sha256' },
    Charset: { UTF_8: 'utf8' },
    computeDigest: (alg, v) => toSigned(crypto.createHash('sha256').update(toBuf(v)).digest()),
    computeHmacSha256Signature: (v, k) => toSigned(crypto.createHmac('sha256', toBuf(k)).update(toBuf(v)).digest()),
    getUuid: () => crypto.randomUUID(),
    formatDate: (d, tz, fmt) => {
      // Córdoba: UTC-3 sin horario de verano
      const t = new Date(d.getTime() - 3 * 3600000);
      const p = n => String(n).padStart(2, '0');
      const Y = t.getUTCFullYear(), M = p(t.getUTCMonth() + 1), D = p(t.getUTCDate()), h = p(t.getUTCHours()), m = p(t.getUTCMinutes()), s = p(t.getUTCSeconds());
      if (tz === 'UTC') return fmt === 'yyyyMMddHHmm' ? d.toISOString().replace(/[-T:]/g, '').substring(0, 12) : d.toISOString();
      return fmt.replace("'W'ww", 'W01').replace('yyyy', Y).replace('MM', M).replace('dd', D).replace('HH', h).replace('mm', m).replace('ss', s);
    }
  };

  const SpreadsheetApp = {
    ProtectionType: { SHEET: 'SHEET' },
    create: n => { const l = new Libro(nuevoId('SS'), n); libros[l.id] = l; archivos[l.id] = { tipo: 'libro' }; return l; },
    openById: id => { if (!libros[id]) throw new Error('No existe libro ' + id); return libros[id]; },
    flush: () => {}
  };

  const carpeta = id => ({ getId: () => id, createFolder: n => { const fid = nuevoId('FD'); return carpeta(fid); } });
  const DriveApp = {
    createFolder: () => carpeta(nuevoId('FD')),
    getFolderById: id => carpeta(id),
    getFileById: id => ({
      getId: () => id,
      moveTo: () => {},
      setTrashed: v => { if (archivos[id]) archivos[id].papelera = v; },
      makeCopy: (nombre) => { const nid = nuevoId('SS'); libros[nid] = libros[id].clonar(nid, nombre); archivos[nid] = { tipo: 'copia' }; return { getId: () => nid }; }
    })
  };

  const PropertiesService = {
    getScriptProperties: () => ({
      getProperty: k => (k in props ? props[k] : null),
      setProperty: (k, v) => { props[k] = String(v); },
      setProperties: o => Object.assign(props, o),
      deleteProperty: k => { delete props[k]; }
    })
  };

  const CacheService = {
    getScriptCache: () => ({
      get: k => { const e = cache[k]; if (!e) return null; if (Date.now() > e.exp) { delete cache[k]; return null; } return e.v; },
      put: (k, v, ttl) => { cache[k] = { v: String(v), exp: Date.now() + (ttl || 600) * 1000 }; },
      remove: k => { delete cache[k]; }
    })
  };

  const LockService = { getScriptLock: () => ({ tryLock: () => true, waitLock: () => {}, releaseLock: () => {} }) };
  const MailApp = { getRemainingDailyQuota: () => 100 - correos.length, sendEmail: o => correos.push(o) };

  const ScriptApp = {
    WeekDay: { MONDAY: 'MONDAY' },
    getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/PRUEBA/exec' }),
    getProjectTriggers: () => triggers.slice(),
    deleteTrigger: t => { const i = triggers.indexOf(t); if (i >= 0) triggers.splice(i, 1); },
    newTrigger: fn => {
      const b = { timeBased: () => b, everyDays: () => b, atHour: () => b, inTimezone: () => b, everyHours: () => b, onWeekDay: () => b,
        forSpreadsheet: () => b, onEdit: () => b,
        create: () => { const uid = nuevoId('TR'); const t = { getHandlerFunction: () => fn, getUniqueId: () => uid }; triggers.push(t); return t; } };
      return b;
    }
  };

  const salida = c => ({ c, setMimeType() { return this; }, getContent: () => c });
  const ContentService = { MimeType: { JSON: 'json' }, createTextOutput: salida };
  const HtmlService = {
    XFrameOptionsMode: { DEFAULT: 'DEFAULT' },
    createTemplateFromFile: () => ({ evaluate: () => ({ setTitle() { return this; }, addMetaTag() { return this; }, setXFrameOptionsMode() { return this; } }) }),
    createHtmlOutputFromFile: () => ({ getContent: () => '' })
  };
  const UrlFetchApp = { fetch: () => { throw new Error('UrlFetchApp deshabilitado en pruebas'); } };

  return {
    globals: { Utilities, SpreadsheetApp, DriveApp, PropertiesService, CacheService, LockService, MailApp, ScriptApp,
      ContentService, HtmlService, UrlFetchApp, Logger: { log: () => {} } },
    estado: { libros, archivos, props, cache, correos, triggers }
  };
}

module.exports = { crearEntorno };
