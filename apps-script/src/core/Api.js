/**
 * Api.js — Punto de entrada web (doGet/doPost) y despachador central de acciones.
 *
 * El frontend invoca: google.script.run.api({ accion, token, datos, idempotencia })
 * Respuesta uniforme: { ok: true, datos } | { ok: false, error: { codigo, mensaje, incidente? } }
 */

function doGet(e) {
  e = e || { parameter: {} };
  var prm = e.parameter || {};
  // Verificación de webhook de WhatsApp Business Cloud API (solo si está configurado)
  if (prm['hub.mode'] === 'subscribe') return WhatsApp.verificarWebhook(prm);
  var pagina = { app: 'ui/App', portal: 'ui/App', setup: 'ui/Setup' }[prm.p] || 'ui/Publico';
  var t = HtmlService.createTemplateFromFile(pagina);
  t.marca = Configuracion.marcaPublica();
  t.pagina = prm.p || 'publico';
  t.url = ScriptApp.getService().getUrl();
  return t.evaluate()
    .setTitle(t.marca.nombre_comercial)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

function doPost(e) {
  var r;
  try {
    r = WhatsApp.recibirWebhook(e);
  } catch (err) {
    console.error('doPost', err && err.stack);
    r = { ok: false };
  }
  return ContentService.createTextOutput(JSON.stringify(r)).setMimeType(ContentService.MimeType.JSON);
}

/** Inclusión de fragmentos HTML en plantillas: <?!= include_('ui/Estilos') ?> */
function include_(nombre) {
  return HtmlService.createHtmlOutputFromFile(nombre).getContent();
}

var _ACCIONES_CACHE = null;
function accionesApi_() {
  if (_ACCIONES_CACHE) return _ACCIONES_CACHE;
  var todas = {};
  [ACC_AUTH, ACC_PUBLICO, ACC_DATOS, ACC_USUARIOS, ACC_FIDEICOMISOS, ACC_TERRENOS, ACC_CRM, ACC_FINANZAS,
    ACC_BENEFICIARIOS, ACC_OBRAS, ACC_CESIONES, ACC_CONTENIDOS, ACC_SISTEMA, ACC_DASHBOARD, ACC_PORTAL]
    .forEach(function (grupo) { Object.keys(grupo).forEach(function (k) { todas[k] = grupo[k]; }); });
  _ACCIONES_CACHE = todas;
  return todas;
}

/** Despachador central (expuesto a google.script.run). */
function api(solicitud) {
  var inicio = Date.now();
  try {
    if (!solicitud || typeof solicitud !== 'object') throw errorApp_('SOLICITUD', 'Solicitud inválida.');
    var nombre = String(solicitud.accion || '');
    var def = accionesApi_()[nombre];
    if (!def) throw errorApp_('SOLICITUD', 'Acción desconocida: ' + nombre);
    var datos = solicitud.datos && typeof solicitud.datos === 'object' ? solicitud.datos : {};
    var ctx = { origen: 'web', accion: nombre, idempotencia: solicitud.idempotencia ? limpiarTexto_(solicitud.idempotencia, 120) : '' };
    if (!def.publica) {
      ctx.usuario = Auth.usuarioDeSesion(solicitud.token);
      if (ctx.usuario.debe_cambiar_password && ['auth.cambiarPassword', 'auth.yo'].indexOf(nombre) < 0) {
        throw errorApp_('CAMBIO_PASSWORD_REQUERIDO', 'Debe cambiar su contraseña temporal antes de continuar.');
      }
      if (def.modulo) Permisos.exigir(ctx.usuario, def.modulo, def.permiso || 'leer');
    }
    var resultado = def.fn(ctx, datos);
    return { ok: true, datos: resultado, ms: Date.now() - inicio };
  } catch (err) {
    return respuestaError_(err, solicitud);
  }
}

function respuestaError_(err, solicitud) {
  if (err && err.codigoApp) {
    return { ok: false, error: { codigo: err.codigoApp, mensaje: err.message, detalles: err.detalles || null } };
  }
  var incidente = 'INC-' + Utilities.getUuid().substring(0, 8).toUpperCase();
  console.error(incidente, solicitud && solicitud.accion, err && err.stack ? err.stack : err);
  try {
    Auditoria.registrar({ actor: 'sistema', origen: 'error' }, { operacion: 'ERROR_INTERNO',
      motivo: incidente + ' ' + String(err && err.message).substring(0, 500), resultado: 'ERROR' });
  } catch (e2) { /* la auditoría no debe ocultar el error original */ }
  return { ok: false, error: { codigo: 'ERROR_INTERNO', mensaje: 'Ocurrió un error inesperado. Código de incidente: ' + incidente, incidente: incidente } };
}

/** Atajo para declarar acciones. */
function accion_(modulo, permiso, fn, publica) {
  return { modulo: modulo, permiso: permiso, fn: fn, publica: !!publica };
}

var ACC_AUTH = {
  'auth.login': accion_(null, null, function (ctx, d) { return Auth.login(d.email, d.password); }, true),
  'auth.logout': accion_(null, null, function (ctx, d) { return Auth.logout(d.token); }, true),
  'auth.yo': accion_(null, null, function (ctx) {
    return { usuario: Auth.perfil(ctx.usuario), menu: Menu.para(ctx.usuario) };
  }),
  'auth.cambiarPassword': accion_(null, null, function (ctx, d) { return Auth.cambiarPassword(ctx.usuario, d.actual, d.nueva); }),
  'auth.solicitarRecuperacion': accion_(null, null, function (ctx, d) {
    return Auth.solicitarRecuperacion(d.email, ScriptApp.getService().getUrl());
  }, true),
  'auth.confirmarRecuperacion': accion_(null, null, function (ctx, d) { return Auth.confirmarRecuperacion(d.token, d.password); }, true),
  'setup.estado': accion_(null, null, function () {
    var instalado = !!propiedad_(PROP.SPREADSHEET_ID);
    return { instalado: instalado, requiereSuperadmin: instalado && !Auth.existeSuperadmin() };
  }, true),
  'setup.crearSuperadmin': accion_(null, null, function (ctx, d) { return Auth.crearSuperadminInicial(d); }, true)
};
