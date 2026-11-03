/**
 * Beneficiarios.js — Legajo individual y portal privado del beneficiario.
 *
 * Regla de oro del portal: el identificador del beneficiario SIEMPRE se toma de la sesión
 * (USUARIOS.beneficiario_id), nunca de los datos enviados por el navegador.
 */
var Beneficiarios = {
  legajo: function (ctx, id) {
    var b = Repo.obtenerOFallar('BENEFICIARIOS', id);
    Permisos.exigirProyecto(ctx.usuario, b.proyecto_id);
    var usuario = Repo.buscarPor('USUARIOS', 'beneficiario_id', b.id);
    return {
      beneficiario: b,
      fideicomiso: Repo.obtener('PROYECTOS', b.proyecto_id),
      unidad: Repo.obtener('UNIDADES', b.unidad_id),
      contrato: Repo.obtener('CONTRATOS', b.contrato_id),
      cuenta: Finanzas.estadoCuenta(b.id),
      documentos: Repo.todos('DOCUMENTOS', function (x) { return x.entidad === 'BENEFICIARIOS' && x.entidad_id === b.id && x.estado !== 'ANULADO'; }),
      comunicaciones: usuario ? Repo.todos('NOTIFICACIONES', function (n) { return n.destinatario === usuario.email; }) : [],
      solicitudes: Repo.todos('TAREAS', function (t) { return t.tipo === 'SOLICITUD_BENEFICIARIO' && JSON.parse(t.payload || '{}').beneficiario_id === b.id; }),
      cesiones: Repo.todos('CESIONES', function (c) { return c.beneficiario_id === b.id; }),
      tiene_usuario_portal: !!usuario
    };
  }
};

var Portal = {
  beneficiarioDe: function (ctx) {
    if (ctx.usuario.rol !== ROLES.BENEFICIARIO) throw errorApp_('PROHIBIDO', 'El portal es exclusivo para beneficiarios.');
    if (!ctx.usuario.beneficiario_id) throw errorApp_('PROHIBIDO', 'Su usuario no está vinculado a un legajo.');
    return Repo.obtenerOFallar('BENEFICIARIOS', ctx.usuario.beneficiario_id);
  },

  resumen: function (ctx) {
    var b = Portal.beneficiarioDe(ctx);
    var f = Repo.obtener('PROYECTOS', b.proyecto_id);
    var obras = Repo.todos('OBRAS', function (o) { return o.proyecto_id === b.proyecto_id && o.estado !== 'ANULADO'; });
    var cuenta = Finanzas.estadoCuenta(b.id);
    return {
      beneficiario: { id: b.id, nombre: b.nombre, estado_contractual: b.estado_contractual, fecha_adhesion: b.fecha_adhesion },
      fideicomiso: f ? { id: f.id, denominacion: f.denominacion, estado: f.estado, fecha_estimada_entrega: f.fecha_estimada_entrega } : null,
      unidad: (function (u) { return u ? { codigo: u.codigo, tipo: u.tipo, superficie_m2: u.superficie_m2 } : null; })(Repo.obtener('UNIDADES', b.unidad_id)),
      cuenta: { cuotas: cuenta.cuotas.map(function (c) { return { id: c.id, numero: c.numero, vencimiento: c.vencimiento, importe: c.importe, pagado: c.pagado, saldo: c.saldo, estado: c.estado }; }),
        pagos: cuenta.pagos.map(function (p) { return { id: p.id, fecha: p.fecha, importe: p.importe, estado: p.estado, motivo_rechazo: p.motivo_rechazo }; }),
        totales: cuenta.totales, proxima: cuenta.proxima },
      obra: obras.map(function (o) {
        return { nombre: o.nombre, avance_fisico: o.avance_fisico, fecha_fin_prevista: o.fecha_fin_prevista,
          etapas: Repo.todos('ETAPAS_OBRA', function (e) { return e.obra_id === o.id; }).map(function (e) { return { nombre: e.nombre, avance: e.avance_certificado }; }) };
      }),
      documentos: Repo.todos('DOCUMENTOS', function (x) {
        return x.visible_beneficiario && x.estado !== 'ANULADO' &&
          ((x.entidad === 'BENEFICIARIOS' && x.entidad_id === b.id) || (x.entidad === 'PROYECTOS' && x.proyecto_id === b.proyecto_id));
      }).map(function (x) { return { titulo: x.titulo, tipo: x.tipo, url: x.url, fecha: x.creado_en }; }),
      comunicaciones: Repo.todos('NOTIFICACIONES', function (n) { return n.destinatario === ctx.usuario.email; })
        .map(function (n) { return { asunto: n.asunto, mensaje: n.mensaje, fecha: n.creado_en }; }),
      solicitudes: Repo.todos('TAREAS', function (t) { return t.tipo === 'SOLICITUD_BENEFICIARIO' && JSON.parse(t.payload || '{}').beneficiario_id === b.id; })
        .map(function (t) { var p = JSON.parse(t.payload); return { id: t.id, asunto: p.asunto, estado: t.estado, fecha: t.creado_en, respuesta: t.resultado }; }),
      cesiones: Repo.todos('CESIONES', function (c) { return c.beneficiario_id === b.id; })
        .map(function (c) { return { id: c.id, alternativa: c.alternativa, estado: c.estado, fecha_solicitud: c.fecha_solicitud, decision: c.decision }; })
    };
  },

  informarPago: function (ctx, d) {
    var b = Portal.beneficiarioDe(ctx);
    var p = Finanzas.registrarPago(ctx, { beneficiario_id: b.id, importe: d.importe, fecha: d.fecha, medio: d.medio,
      referencia_bancaria: d.referencia_bancaria, comprobante_id: '' }, true);
    Alertas.crear(ctx, { tipo: 'PAGO_INFORMADO', severidad: 'INFO', proyecto_id: b.proyecto_id, entidad: 'PAGOS', entidad_id: p.id,
      mensaje: 'El beneficiario ' + b.nombre + ' informó un pago de $' + p.importe + '. Requiere verificación contra extracto.' });
    return { id: p.id, estado: p.estado, mensaje: 'Pago informado. Quedará acreditado cuando la administración lo verifique.' };
  },

  solicitud: function (ctx, d) {
    var b = Portal.beneficiarioDe(ctx);
    if (!d.asunto || !d.mensaje) throw errorApp_('VALIDACION', 'Complete asunto y mensaje.');
    var t = Repo.crear('TAREAS', { tipo: 'SOLICITUD_BENEFICIARIO', proyecto_id: b.proyecto_id, estado: 'PENDIENTE', intentos: 0,
      payload: JSON.stringify({ beneficiario_id: b.id, asunto: limpiarTexto_(d.asunto, 200), mensaje: limpiarTexto_(d.mensaje, 3000) }),
      clave_idempotencia: ctx.idempotencia || '' }, ctx);
    Alertas.crear(ctx, { tipo: 'SOLICITUD_BENEFICIARIO', severidad: 'INFO', proyecto_id: b.proyecto_id, entidad: 'TAREAS', entidad_id: t.id,
      mensaje: 'Nueva solicitud de ' + b.nombre + ': ' + limpiarTexto_(d.asunto, 100) });
    return { id: t.id };
  }
};

var ACC_BENEFICIARIOS = {
  'beneficiarios.legajo': accion_('beneficiarios', 'leer', function (ctx, d) { return Beneficiarios.legajo(ctx, d.beneficiario_id); }),
  'beneficiarios.responderSolicitud': accion_('beneficiarios', 'editar', function (ctx, d) {
    var t = Repo.obtenerOFallar('TAREAS', d.tarea_id);
    if (t.tipo !== 'SOLICITUD_BENEFICIARIO') throw errorApp_('VALIDACION', 'No es una solicitud de beneficiario.');
    Permisos.exigirProyecto(ctx.usuario, t.proyecto_id);
    var r = Tareas.actualizarEstado(ctx, t.id, 'COMPLETADA', { resultado: JSON.stringify(limpiarTexto_(d.respuesta, 3000)) });
    var p = JSON.parse(t.payload);
    var u = Repo.buscarPor('USUARIOS', 'beneficiario_id', p.beneficiario_id);
    if (u) Notificar.enviar(ctx, { destinatario: u.email, canal: 'PORTAL', asunto: 'Respuesta: ' + p.asunto, mensaje: d.respuesta,
      proyecto_id: t.proyecto_id, clave_idempotencia: 'RESP-' + t.id });
    return r;
  })
};

var ACC_PORTAL = {
  'portal.resumen': accion_('portal', 'leer', function (ctx) { return Portal.resumen(ctx); }),
  'portal.informarPago': accion_('portal', 'crear', function (ctx, d) { return Portal.informarPago(ctx, d); }),
  'portal.solicitud': accion_('portal', 'crear', function (ctx, d) { return Portal.solicitud(ctx, d); }),
  'portal.solicitarCesion': accion_('portal', 'crear', function (ctx, d) {
    var b = Portal.beneficiarioDe(ctx);
    return Cesiones.iniciar(ctx, { beneficiario_id: b.id, alternativa: d.alternativa, motivo: d.motivo }, true);
  }),
  'portal.recibo': accion_('portal', 'leer', function (ctx, d) {
    var b = Portal.beneficiarioDe(ctx);
    var p = Repo.obtenerOFallar('PAGOS', d.pago_id);
    if (p.beneficiario_id !== b.id) throw errorApp_('PROHIBIDO', 'El recibo no le pertenece.');
    return Finanzas.recibo(p.id);
  })
};
