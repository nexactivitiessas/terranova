/**
 * Util.js — Errores, fechas, identificadores, validación y saneamiento.
 */

/** Crea un error de aplicación con código estable (se devuelve al cliente sin stack). */
function errorApp_(codigo, mensaje, detalles) {
  var e = new Error(mensaje);
  e.codigoApp = codigo;
  e.detalles = detalles || null;
  return e;
}

function ahoraIso_() {
  return new Date().toISOString();
}

/** Formatea fecha DD/MM/AAAA en la zona horaria del sistema. */
function formatearFecha_(valor) {
  if (!valor) return '';
  var d = valor instanceof Date ? valor : new Date(valor);
  if (isNaN(d.getTime())) return String(valor);
  return Utilities.formatDate(d, APP.ZONA_HORARIA, 'dd/MM/yyyy');
}

/** Acepta 'DD/MM/AAAA' o ISO 'AAAA-MM-DD' y devuelve 'AAAA-MM-DD' (fecha de calendario sin hora). */
function normalizarFecha_(valor) {
  if (valor === null || valor === undefined || valor === '') return '';
  if (valor instanceof Date) return Utilities.formatDate(valor, APP.ZONA_HORARIA, 'yyyy-MM-dd');
  var s = String(valor).trim();
  var m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) s = m[3] + '-' + m[2] + '-' + m[1];
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) throw errorApp_('VALIDACION', 'Fecha inválida: ' + valor + ' (use DD/MM/AAAA)');
  var y = +m[1], mo = +m[2], d = +m[3];
  var dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
    throw errorApp_('VALIDACION', 'Fecha inexistente: ' + valor);
  }
  return m[1] + '-' + m[2] + '-' + m[3];
}

/** Hoy como 'AAAA-MM-DD' en Córdoba. */
function hoyIso_() {
  return Utilities.formatDate(new Date(), APP.ZONA_HORARIA, 'yyyy-MM-dd');
}

/** Suma meses a una fecha 'AAAA-MM-DD' ajustando al último día del mes si corresponde. */
function sumarMeses_(fechaIso, meses) {
  var p = fechaIso.split('-').map(Number);
  var y = p[0], m = p[1] - 1 + meses, d = p[2];
  y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
  var ultimo = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  var dd = Math.min(d, ultimo);
  return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(dd).padStart(2, '0');
}

function sumarDias_(fechaIso, dias) {
  var p = fechaIso.split('-').map(Number);
  return new Date(Date.UTC(p[0], p[1] - 1, p[2] + dias)).toISOString().substring(0, 10);
}

function diasEntre_(desdeIso, hastaIso) {
  return Math.round((Date.parse(hastaIso + 'T00:00:00Z') - Date.parse(desdeIso + 'T00:00:00Z')) / 86400000);
}

/** Identificador estable: PREFIJO-AAAAMMDD-xxxxxxxx */
function nuevoId_(prefijo) {
  var fecha = Utilities.formatDate(new Date(), APP.ZONA_HORARIA, 'yyyyMMdd');
  var rnd = Utilities.getUuid().replace(/-/g, '').substring(0, 10).toUpperCase();
  return prefijo + '-' + fecha + '-' + rnd;
}

/** Redondeo monetario a centavos (evita errores de coma flotante). */
function redondearMoneda_(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/** Elimina caracteres de control y recorta. El escape HTML se realiza en el cliente al renderizar. */
function limpiarTexto_(valor, max) {
  if (valor === null || valor === undefined) return '';
  var s = String(valor).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  // Neutraliza inyección de fórmulas en Google Sheets (CSV/formula injection)
  if (/^[=+\-@]/.test(s) && !/^[+\-]?[\d\s().,\-]+$/.test(s)) s = "'" + s;
  return s.substring(0, max || 5000);
}

function escaparHtml_(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function esEmail_(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s || ''));
}

/** Convierte un valor de entrada al tipo de la columna y valida. */
function convertirValor_(col, valor) {
  if (valor === undefined || valor === null || valor === '') {
    if (col.tipo === 'bool') return false;
    return '';
  }
  switch (col.tipo) {
    case 'numero':
    case 'moneda': {
      var n = typeof valor === 'number' ? valor : Number(String(valor).replace(/\./g, '').replace(',', '.'));
      if (typeof valor === 'string' && /^-?\d+(\.\d+)?$/.test(valor.trim())) n = Number(valor);
      if (!isFinite(n)) throw errorApp_('VALIDACION', 'Número inválido en "' + col.nombre + '"');
      return col.tipo === 'moneda' ? redondearMoneda_(n) : n;
    }
    case 'bool':
      return valor === true || valor === 'true' || valor === 'TRUE' || valor === 1 || valor === '1' || valor === 'SI';
    case 'fecha':
      return normalizarFecha_(valor);
    case 'fechahora': {
      var d = valor instanceof Date ? valor : new Date(valor);
      if (isNaN(d.getTime())) throw errorApp_('VALIDACION', 'Fecha/hora inválida en "' + col.nombre + '"');
      return d.toISOString();
    }
    case 'email': {
      var e = limpiarTexto_(valor, 254).toLowerCase();
      if (!esEmail_(e)) throw errorApp_('VALIDACION', 'Email inválido en "' + col.nombre + '"');
      return e;
    }
    case 'telefono': {
      var t = limpiarTexto_(valor, 40);
      if (!/^[+\d\s()\-]{6,40}$/.test(t)) throw errorApp_('VALIDACION', 'Teléfono inválido en "' + col.nombre + '"');
      return t;
    }
    case 'enum': {
      var v = limpiarTexto_(valor, 100);
      if (col.opciones.indexOf(v) < 0) throw errorApp_('VALIDACION', 'Valor no permitido en "' + col.nombre + '": ' + v);
      return v;
    }
    case 'json':
      return typeof valor === 'string' ? (JSON.parse(valor), valor) : JSON.stringify(valor);
    case 'refs':
      return (Array.isArray(valor) ? valor : String(valor).split(',')).map(function (x) { return limpiarTexto_(x, 80); })
        .filter(String).join(',');
    default:
      return limpiarTexto_(valor);
  }
}

/** Hash hexadecimal SHA-256 de un texto. */
function sha256Hex_(texto) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(texto), Utilities.Charset.UTF_8);
  return bytesAHex_(bytes);
}

function bytesAHex_(bytes) {
  return bytes.map(function (b) { var v = (b < 0 ? b + 256 : b).toString(16); return v.length === 1 ? '0' + v : v; }).join('');
}

/** Comparación en tiempo constante para hashes. */
function igualdadSegura_(a, b) {
  a = String(a || ''); b = String(b || '');
  if (a.length !== b.length) return false;
  var r = 0;
  for (var i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function tokenAleatorio_() {
  return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
}

function propiedad_(clave) {
  return PropertiesService.getScriptProperties().getProperty(clave);
}

function fijarPropiedad_(clave, valor) {
  PropertiesService.getScriptProperties().setProperty(clave, valor);
}
