/**
 * Instalacion.js — Instalación, migraciones de esquema, semillas, activadores y puntos de entrada de triggers.
 *
 * Funciones PÚBLICAS (sin "_" final) que el propietario ejecuta desde el editor de Apps Script:
 *   instalar()                 → crea base de datos, carpetas, secretos, semillas, activadores y código de instalación.
 *   migrar()                   → aplica cambios de esquema (solo agrega hojas/columnas, nunca borra).
 *   generarCodigoInstalacion() → nuevo código para crear el SUPERADMIN (solo si aún no existe).
 *   instalarActivadores()      → (re)crea los activadores instalables.
 *   cargarDatosPrueba()        → datos ficticios marcados es_prueba=TRUE (requiere permitir_datos_prueba=true).
 * Todas son idempotentes y seguras si alguien las invocara remotamente: no exponen secretos ni borran datos.
 */
var Migraciones = {
  /** Crea hojas faltantes y agrega columnas faltantes al final (nunca reordena ni elimina). */
  asegurarEsquema: function () {
    var libro = dbLibro_();
    var cambios = [];
    esquemaHojas_().forEach(function (nombre) {
      var h = libro.getSheetByName(nombre);
      var cols = esquemaEncabezados_(nombre);
      if (!h) {
        h = libro.insertSheet(nombre);
        h.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
        h.setFrozenRows(1);
        cambios.push('Hoja creada: ' + nombre);
      } else {
        var actuales = h.getLastColumn() ? h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0].map(String) : [];
        var faltan = cols.filter(function (c) { return actuales.indexOf(c) < 0; });
        if (faltan.length) {
          h.getRange(1, actuales.length + 1, 1, faltan.length).setValues([faltan]).setFontWeight('bold');
          cambios.push(nombre + ': columnas agregadas ' + faltan.join(', '));
        }
      }
      // Formato texto para columnas no numéricas: evita que Sheets convierta fechas, códigos o teléfonos.
      var enc = h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0].map(String);
      esquemaColumnas_(nombre).forEach(function (c) {
        if (['numero', 'moneda', 'bool'].indexOf(c.tipo) < 0) {
          var idx = enc.indexOf(c.nombre);
          if (idx >= 0) h.getRange(1, idx + 1, h.getMaxRows(), 1).setNumberFormat('@');
        }
      });
      dbInvalidar_(nombre);
    });
    var hoja1 = libro.getSheetByName('Hoja 1') || libro.getSheetByName('Sheet1');
    if (hoja1 && libro.getSheets().length > 1 && hoja1.getLastRow() === 0) libro.deleteSheet(hoja1);
    return cambios;
  },

  /** Protecciones de advertencia sobre hojas sensibles (el propietario puede editar, pero recibe aviso). */
  proteger: function () {
    ['AUDITORIA', 'MOVIMIENTOS', 'USUARIOS', 'PAGOS', 'CUOTAS', 'PERMISOS'].forEach(function (n) {
      var h = dbHoja_(n);
      if (!h.getProtections(SpreadsheetApp.ProtectionType.SHEET).length) {
        h.protect().setDescription('Hoja sensible: toda edición queda auditada. Use la aplicación.').setWarningOnly(true);
      }
    });
  },

  sembrar: function () {
    var ctx = { actor: 'instalacion', origen: 'semilla' };
    Object.keys(ROLES).forEach(function (k) {
      var r = ROLES[k];
      if (!Repo.buscarPor('ROLES', 'codigo', r)) {
        Repo.crear('ROLES', { codigo: r, nombre: r.replace(/_/g, ' '), estado: 'ACTIVO',
          alcance: r === 'BENEFICIARIO' ? 'PROPIO' : (ROLES_CON_ALCANCE_PROYECTO.indexOf(r) >= 0 ? 'PROYECTO' : 'GLOBAL') }, ctx, { sinAuditoria: true });
      }
    });
    if (!Repo.todos('PERMISOS').length) {
      Permisos.filasSemilla().forEach(function (p) { Repo.crear('PERMISOS', p, ctx, { sinAuditoria: true }); });
      Permisos._matriz = null;
    }
    CONFIG_DEFECTO.forEach(function (c) {
      if (!Repo.buscarPor('CONFIGURACION', 'clave', c.clave)) {
        Repo.crear('CONFIGURACION', { clave: c.clave, valor: c.valor, publica: c.publica, descripcion: c.descripcion, estado: 'ACTIVO' }, ctx, { sinAuditoria: true });
      }
    });
    if (!Repo.buscarPor('CONFIGURACION', 'clave', 'permitir_datos_prueba')) {
      Repo.crear('CONFIGURACION', { clave: 'permitir_datos_prueba', valor: 'false', publica: false, estado: 'ACTIVO',
        descripcion: 'Poner en true SOLO en entornos de prueba para habilitar cargarDatosPrueba()' }, ctx, { sinAuditoria: true });
    }
    AGENTES_DEFECTO.forEach(function (a) {
      if (!Repo.buscarPor('AGENTES', 'codigo', a.codigo)) {
        Repo.crear('AGENTES', { codigo: a.codigo, nombre: a.nombre, funcion: a.funcion, modalidad: a.modalidad, estado: 'ACTIVO',
          ejecuta_en: a.modalidad === 'REGLAS_APPS_SCRIPT' ? 'Google Apps Script (nube)' : a.modalidad === 'LOCAL_GRATUITO' ? 'Computadora local del operador' : 'Sesión manual de Claude Code',
          prompt_archivo: 'agentes/' + a.codigo.toLowerCase() + '.md' }, ctx, { sinAuditoria: true });
      }
    });
  },

  registrar: function (numero, descripcion) {
    if (!Repo.buscarPor('MIGRACIONES', 'numero', numero)) {
      Repo.crear('MIGRACIONES', { numero: numero, descripcion: descripcion, aplicada_en: ahoraIso_(), estado: 'APLICADA' }, { actor: 'instalacion' }, { sinAuditoria: true });
    }
  }
};

function instalar() {
  var props = PropertiesService.getScriptProperties();
  var log = [];
  if (!props.getProperty(PROP.SPREADSHEET_ID)) {
    var raiz = DriveApp.createFolder(APP.NOMBRE_PROVISIONAL + ' — DATOS PRIVADOS');
    var bak = raiz.createFolder('COPIAS_DE_SEGURIDAD');
    var docs = raiz.createFolder('DOCUMENTOS');
    var libro = SpreadsheetApp.create(APP.NOMBRE_PROVISIONAL + ' — BASE MAESTRA');
    DriveApp.getFileById(libro.getId()).moveTo(raiz);
    libro.setSpreadsheetTimeZone(APP.ZONA_HORARIA);
    libro.setSpreadsheetLocale('es_AR');
    props.setProperties({ SPREADSHEET_ID: libro.getId(), BACKUP_FOLDER_ID: bak.getId(), DRIVE_FOLDER_ID: docs.getId() });
    log.push('Base creada: ' + libro.getUrl());
  }
  if (!props.getProperty(PROP.PEPPER)) {
    props.setProperty(PROP.PEPPER, tokenAleatorio_() + tokenAleatorio_());
    log.push('Secreto de autenticación generado (solo en Script Properties).');
  }
  log = log.concat(Migraciones.asegurarEsquema());
  Migraciones.proteger();
  Migraciones.sembrar();
  Migraciones.registrar(APP.VERSION_ESQUEMA, 'Esquema inicial v' + APP.VERSION);
  instalarActivadores();
  log.push('Activadores instalados.');
  if (!Auth.existeSuperadmin()) log.push(generarCodigoInstalacion());
  log.forEach(function (l) { console.log(l); });
  return 'Instalación completa. Revise el registro de ejecución.';
}

function migrar() {
  var cambios = Migraciones.asegurarEsquema();
  Migraciones.sembrar();
  Migraciones.registrar(APP.VERSION_ESQUEMA, 'Esquema v' + APP.VERSION);
  console.log(cambios.length ? cambios.join('\n') : 'Esquema al día.');
  return cambios.length;
}

/** Genera un código de un solo uso y lo muestra SOLO en el registro de ejecución del propietario. */
function generarCodigoInstalacion() {
  if (Auth.existeSuperadmin()) return 'Ya existe un SUPERADMIN. No se genera código.';
  var alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, tokenAleatorio_());
  var codigo = '';
  for (var i = 0; i < 12; i++) codigo += alfabeto.charAt(((bytes[i] % 256) + 256) % 256 % alfabeto.length) + ((i === 3 || i === 7) ? '-' : '');
  fijarPropiedad_(PROP.SETUP_CODE_HASH, sha256Hex_(codigo));
  var msg = 'CÓDIGO DE INSTALACIÓN (uso único, no lo comparta): ' + codigo + '  → abra la URL de la aplicación con ?p=setup';
  console.log(msg);
  return msg;
}

var TRIGGERS = [
  { fn: 'trabajoDiario', tipo: 'diario' },
  { fn: 'trabajoHorario', tipo: 'horario' },
  { fn: 'trabajoSemanal', tipo: 'semanal' },
  { fn: 'alEditarHoja', tipo: 'edicion' }
];

function instalarActivadores() {
  var nombres = TRIGGERS.map(function (t) { return t.fn; });
  ScriptApp.getProjectTriggers().forEach(function (t) { if (nombres.indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('trabajoDiario').timeBased().everyDays(1).atHour(6).inTimezone(APP.ZONA_HORARIA).create();
  ScriptApp.newTrigger('trabajoHorario').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('trabajoSemanal').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(7).inTimezone(APP.ZONA_HORARIA).create();
  ScriptApp.newTrigger('alEditarHoja').forSpreadsheet(propiedad_(PROP.SPREADSHEET_ID)).onEdit().create();
  return true;
}

/** Verifica que la invocación provenga de un activador real del proyecto (no de google.script.run). */
function esActivadorLegitimo_(e) {
  if (!e || !e.triggerUid) return false;
  return ScriptApp.getProjectTriggers().some(function (t) { return t.getUniqueId() === String(e.triggerUid); });
}

function trabajoDiario(e) {
  if (!esActivadorLegitimo_(e)) return 'Solo ejecutable por activador. Use el panel (sistema.ejecutarTrabajo).';
  var ctx = { actor: 'activador_diario', origen: 'trigger' };
  var dia = hoyIso_();
  ['ACTUALIZAR_MORA', 'RECORDATORIO_CUOTAS', 'CONTROL_OBRAS', 'SEGUIMIENTO_OPORTUNIDADES', 'SEGUIMIENTO_CESIONES', 'INTEGRIDAD']
    .forEach(function (t) { Tareas.encolar(ctx, t, {}, t + '-' + dia); });
  return Tareas.procesar(ctx);
}

function trabajoHorario(e) {
  if (!esActivadorLegitimo_(e)) return 'Solo ejecutable por activador.';
  return Tareas.procesar({ actor: 'activador_horario', origen: 'trigger' });
}

function trabajoSemanal(e) {
  if (!esActivadorLegitimo_(e)) return 'Solo ejecutable por activador.';
  var ctx = { actor: 'activador_semanal', origen: 'trigger' };
  var semana = Utilities.formatDate(new Date(), APP.ZONA_HORARIA, "yyyy-'W'ww");
  Tareas.encolar(ctx, 'RESPALDO', {}, 'RESPALDO-' + semana);
  Tareas.encolar(ctx, 'REPORTE_SEMANAL', {}, 'REPORTE-' + semana);
  return Tareas.procesar(ctx);
}

function alEditarHoja(e) {
  if (!esActivadorLegitimo_(e)) return;
  try { Integridad.alEditar(e); } catch (err) { console.error('alEditarHoja', err && err.stack); }
}

/** Datos ficticios para pruebas. Nombres con prefijo "PRUEBA", documentos inválidos y es_prueba=TRUE. */
function cargarDatosPrueba() {
  if (Configuracion.valor('permitir_datos_prueba') !== 'true') return 'Deshabilitado. Ponga permitir_datos_prueba=true en CONFIGURACION (solo entornos de prueba).';
  return DatosPrueba.cargar({ actor: 'datos_prueba', origen: 'prueba', usuario: { email: 'datos_prueba@ejemplo.invalid', rol: ROLES.SUPERADMIN } });
}
