/**
 * Db.js — Repositorio genérico sobre Google Sheets.
 *
 * - Mapea filas a objetos por encabezado (nunca por posición fija ni número de fila como ID).
 * - Toda escritura ocurre bajo LockService (reentrante dentro de la misma ejecución).
 * - Control de concurrencia optimista mediante la columna "version".
 * - No existe borrado físico: se anula lógicamente (estado = ANULADO).
 * - Las hojas de solo agregado (AUDITORIA, MOVIMIENTOS, CONVERSACIONES) no admiten actualización.
 */
var _DB = { libro: null, tablas: {}, lockProfundidad: 0, lock: null };

function dbLibro_() {
  if (_DB.libro) return _DB.libro;
  var id = propiedad_(PROP.SPREADSHEET_ID);
  if (!id) throw errorApp_('NO_INSTALADO', 'La plataforma no está instalada. Ejecute instalar() desde el editor de Apps Script.');
  _DB.libro = SpreadsheetApp.openById(id);
  return _DB.libro;
}

function dbHoja_(nombre) {
  var h = dbLibro_().getSheetByName(nombre);
  if (!h) throw errorApp_('ESQUEMA', 'No existe la hoja ' + nombre + '. Ejecute migrar().');
  return h;
}

function dbInvalidar_(nombre) {
  if (nombre) delete _DB.tablas[nombre]; else _DB.tablas = {};
}

/** Ejecuta fn bajo el lock de script. Reentrante. */
function dbConLock_(fn) {
  if (_DB.lockProfundidad > 0) {
    _DB.lockProfundidad++;
    try { return fn(); } finally { _DB.lockProfundidad--; }
  }
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) throw errorApp_('OCUPADO', 'El sistema está ocupado. Reintente en unos segundos.');
  _DB.lockProfundidad = 1;
  try {
    return fn();
  } finally {
    _DB.lockProfundidad = 0;
    SpreadsheetApp.flush();
    lock.releaseLock();
  }
}

/** Convierte un valor de celda al formato canónico de la columna. */
function dbLeerCelda_(col, v) {
  if (v === '' || v === null || v === undefined) return col.tipo === 'bool' ? false : '';
  if (col.tipo === 'fecha') return v instanceof Date ? normalizarFecha_(v) : String(v);
  if (col.tipo === 'fechahora') return v instanceof Date ? v.toISOString() : String(v);
  if (col.tipo === 'bool') return v === true || v === 'TRUE' || v === 'true';
  if (col.tipo === 'numero' || col.tipo === 'moneda') return typeof v === 'number' ? v : Number(v);
  return typeof v === 'string' ? v : String(v);
}

/** Lee la tabla completa (cacheada durante la ejecución). */
function dbTabla_(nombre) {
  if (_DB.tablas[nombre]) return _DB.tablas[nombre];
  var h = dbHoja_(nombre);
  var valores = h.getDataRange().getValues();
  var encabezados = (valores[0] || []).map(String);
  var cols = esquemaColumnas_(nombre);
  var mapa = {};
  cols.forEach(function (c) { mapa[c.nombre] = c; });
  var filas = [];
  for (var i = 1; i < valores.length; i++) {
    var fila = valores[i];
    if (!fila[0]) continue; // filas sin id se ignoran (se reportan en el chequeo de integridad)
    var obj = {};
    for (var j = 0; j < encabezados.length; j++) {
      var c = mapa[encabezados[j]];
      if (c) obj[c.nombre] = dbLeerCelda_(c, fila[j]);
    }
    Object.defineProperty(obj, '_fila', { value: i + 1, enumerable: false });
    filas.push(obj);
  }
  _DB.tablas[nombre] = { encabezados: encabezados, filas: filas };
  return _DB.tablas[nombre];
}

function dbFilaAArray_(encabezados, obj) {
  return encabezados.map(function (e) {
    var v = obj[e];
    return v === undefined || v === null ? '' : v;
  });
}

var Repo = {
  /** Lista con filtros, búsqueda de texto, orden y paginación. */
  listar: function (nombre, opciones) {
    opciones = opciones || {};
    var filas = dbTabla_(nombre).filas;
    if (opciones.filtro) filas = filas.filter(opciones.filtro);
    if (opciones.igual) {
      var eq = opciones.igual;
      filas = filas.filter(function (r) {
        return Object.keys(eq).every(function (k) { return eq[k] === '' || eq[k] === undefined || String(r[k]) === String(eq[k]); });
      });
    }
    if (opciones.busqueda) {
      var q = String(opciones.busqueda).toLowerCase();
      filas = filas.filter(function (r) {
        return Object.keys(r).some(function (k) { return String(r[k]).toLowerCase().indexOf(q) >= 0; });
      });
    }
    var orden = opciones.orden || 'creado_en';
    var desc = opciones.desc !== false;
    filas = filas.slice().sort(function (a, b) {
      var x = a[orden], y = b[orden];
      if (x === y) return 0;
      return (x > y ? 1 : -1) * (desc ? -1 : 1);
    });
    var total = filas.length;
    var tam = Math.min(Number(opciones.tamanio) || 50, APP.PAGINA_MAX);
    var pag = Math.max(Number(opciones.pagina) || 1, 1);
    if (opciones.sinPaginar) return { total: total, pagina: 1, tamanio: total, registros: filas };
    return { total: total, pagina: pag, tamanio: tam, registros: filas.slice((pag - 1) * tam, pag * tam) };
  },

  todos: function (nombre, filtro) {
    var f = dbTabla_(nombre).filas;
    return filtro ? f.filter(filtro) : f.slice();
  },

  obtener: function (nombre, id) {
    if (!id) return null;
    var f = dbTabla_(nombre).filas;
    for (var i = 0; i < f.length; i++) if (f[i].id === id) return f[i];
    return null;
  },

  obtenerOFallar: function (nombre, id) {
    var r = Repo.obtener(nombre, id);
    if (!r) throw errorApp_('NO_ENCONTRADO', 'No existe ' + nombre + ' con id ' + id);
    return r;
  },

  buscarPor: function (nombre, campo, valor) {
    var f = dbTabla_(nombre).filas;
    for (var i = 0; i < f.length; i++) if (String(f[i][campo]) === String(valor)) return f[i];
    return null;
  },

  /** Valida y normaliza un objeto según el esquema. parcial=true para actualizaciones. */
  validar: function (nombre, datos, parcial) {
    var cols = esquemaColumnas_(nombre);
    var limpio = {};
    var errores = [];
    cols.forEach(function (c) {
      if (['id', 'creado_en', 'actualizado_en', 'version', 'usuario_responsable'].indexOf(c.nombre) >= 0) return;
      if (!(c.nombre in datos)) {
        if (!parcial && c.req) errores.push('Falta el campo obligatorio "' + c.nombre + '"');
        return;
      }
      try {
        var v = convertirValor_(c, datos[c.nombre]);
        if (c.req && (v === '' || v === null)) errores.push('El campo "' + c.nombre + '" es obligatorio');
        limpio[c.nombre] = v;
      } catch (e) { errores.push(e.message); }
    });
    if (errores.length) throw errorApp_('VALIDACION', errores.join('. '), errores);
    return limpio;
  },

  /** Verifica unicidad e integridad referencial. */
  verificarIntegridad: function (nombre, registro, idPropio) {
    var cols = esquemaColumnas_(nombre);
    cols.forEach(function (c) {
      var v = registro[c.nombre];
      if (v === '' || v === undefined || v === null) return;
      if (c.unico) {
        var dup = dbTabla_(nombre).filas.some(function (r) { return r.id !== idPropio && String(r[c.nombre]) === String(v); });
        if (dup) throw errorApp_('DUPLICADO', 'Ya existe un registro con ' + c.nombre + ' = ' + v, { campo: c.nombre });
      }
      if (c.tipo === 'ref' || c.tipo === 'refs') {
        String(v).split(',').filter(String).forEach(function (rid) {
          if (c.ref === nombre && rid === idPropio) return;
          if (!Repo.obtener(c.ref, rid)) throw errorApp_('INTEGRIDAD', 'Referencia inexistente: ' + c.nombre + ' → ' + c.ref + ' ' + rid);
        });
      }
    });
    if (HOJAS_GLOBALES.indexOf(nombre) < 0 && !registro.proyecto_id) {
      throw errorApp_('INTEGRIDAD', 'El registro de ' + nombre + ' debe pertenecer a un fideicomiso (proyecto_id).');
    }
  },

  crear: function (nombre, datos, ctx, opciones) {
    opciones = opciones || {};
    return dbConLock_(function () {
      dbInvalidar_(nombre);
      var limpio = Repo.validar(nombre, datos, false);
      // Idempotencia: si existe un registro con la misma clave, se devuelve sin duplicar.
      if (limpio.clave_idempotencia) {
        var previo = Repo.buscarPor(nombre, 'clave_idempotencia', limpio.clave_idempotencia);
        if (previo) return previo;
      }
      var ahora = ahoraIso_();
      limpio.id = opciones.id || nuevoId_(ESQUEMA[nombre].prefijo);
      limpio.creado_en = ahora;
      limpio.actualizado_en = ahora;
      limpio.version = 1;
      limpio.usuario_responsable = ctx && ctx.usuario ? ctx.usuario.email : 'sistema';
      if (!limpio.estado && opciones.estadoInicial) limpio.estado = opciones.estadoInicial;
      Repo.verificarIntegridad(nombre, limpio, limpio.id);
      var t = dbTabla_(nombre);
      limpio.huella = huellaRegistro_(nombre, limpio);
      dbHoja_(nombre).appendRow(dbFilaAArray_(t.encabezados, limpio));
      dbInvalidar_(nombre);
      if (nombre !== 'AUDITORIA' && !opciones.sinAuditoria) {
        Auditoria.registrar(ctx, { operacion: 'CREAR', hoja: nombre, registro_id: limpio.id, proyecto_id: limpio.proyecto_id,
          valor_nuevo: Repo.ocultarSensibles(nombre, limpio), motivo: opciones.motivo, resultado: 'OK' });
      }
      return limpio;
    });
  },

  actualizar: function (nombre, id, cambios, ctx, opciones) {
    opciones = opciones || {};
    if (HOJAS_SOLO_AGREGADO.indexOf(nombre) >= 0) {
      throw errorApp_('PROHIBIDO', 'La hoja ' + nombre + ' es de solo agregado. Registre un movimiento compensatorio.');
    }
    return dbConLock_(function () {
      dbInvalidar_(nombre);
      var actual = Repo.obtenerOFallar(nombre, id);
      if (opciones.versionEsperada && Number(opciones.versionEsperada) !== Number(actual.version)) {
        throw errorApp_('CONFLICTO', 'El registro fue modificado por otra persona. Recargue antes de guardar.');
      }
      var limpio = Repo.validar(nombre, cambios, true);
      if ('proyecto_id' in limpio && actual.proyecto_id && limpio.proyecto_id !== actual.proyecto_id && !opciones.permitirCambioProyecto) {
        throw errorApp_('PROHIBIDO', 'No se puede mover un registro entre fideicomisos. Los recursos no se mezclan.');
      }
      var nuevo = {};
      Object.keys(actual).forEach(function (k) { nuevo[k] = actual[k]; });
      Object.keys(limpio).forEach(function (k) { nuevo[k] = limpio[k]; });
      nuevo.actualizado_en = ahoraIso_();
      nuevo.version = (Number(actual.version) || 0) + 1;
      nuevo.usuario_responsable = ctx && ctx.usuario ? ctx.usuario.email : 'sistema';
      Repo.verificarIntegridad(nombre, nuevo, id);
      var t = dbTabla_(nombre);
      var fila = actual._fila;
      nuevo.huella = huellaRegistro_(nombre, nuevo);
      dbHoja_(nombre).getRange(fila, 1, 1, t.encabezados.length).setValues([dbFilaAArray_(t.encabezados, nuevo)]);
      dbInvalidar_(nombre);
      var antes = {}, despues = {};
      Object.keys(limpio).forEach(function (k) {
        if (String(actual[k]) !== String(limpio[k])) { antes[k] = actual[k]; despues[k] = limpio[k]; }
      });
      if (!opciones.sinAuditoria) {
        Auditoria.registrar(ctx, { operacion: opciones.operacion || 'ACTUALIZAR', hoja: nombre, registro_id: id,
          proyecto_id: nuevo.proyecto_id, valor_anterior: Repo.ocultarSensibles(nombre, antes),
          valor_nuevo: Repo.ocultarSensibles(nombre, despues), motivo: opciones.motivo, resultado: 'OK',
          aprobacion: opciones.aprobacion });
      }
      return nuevo;
    });
  },

  /** Anulación lógica (no hay borrado físico). Requiere motivo. */
  anular: function (nombre, id, motivo, ctx) {
    if (!motivo) throw errorApp_('VALIDACION', 'La anulación requiere un motivo.');
    return Repo.actualizar(nombre, id, { estado: 'ANULADO' }, ctx, { motivo: motivo, operacion: 'ANULAR' });
  },

  ocultarSensibles: function (nombre, obj) {
    var cols = esquemaColumnas_(nombre);
    var r = {};
    Object.keys(obj).forEach(function (k) { r[k] = obj[k]; });
    cols.forEach(function (c) { if (c.sensible && r[c.nombre]) r[c.nombre] = '***'; });
    return r;
  },

  /** Proyección segura para enviar al cliente (sin columnas sensibles). */
  publico: function (nombre, obj) {
    if (!obj) return obj;
    var cols = esquemaColumnas_(nombre);
    var r = {};
    cols.forEach(function (c) { if (!c.sensible) r[c.nombre] = obj[c.nombre]; });
    return r;
  }
};

/**
 * Huella de contenido de un registro (SHA-256 de todas las columnas salvo "huella").
 * Permite detectar ediciones directas en Google Sheets realizadas fuera de la aplicación.
 */
function huellaRegistro_(nombre, obj) {
  var partes = esquemaColumnas_(nombre).filter(function (c) { return c.nombre !== 'huella'; }).map(function (c) {
    var v = dbLeerCelda_(c, obj[c.nombre]);
    var s = v === undefined || v === null ? '' : String(v);
    if (/^'[=+\-@]/.test(s)) s = s.substring(1); // Sheets descarta el apóstrofo de escape
    return c.nombre + '=' + s;
  });
  return sha256Hex_(partes.join('\u0001')).substring(0, 32);
}
