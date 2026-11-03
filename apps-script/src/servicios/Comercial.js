/**
 * Comercial.js — Captación de terrenos, CRM comercial, embudo y formularios públicos.
 * Recibir un formulario NO equivale a verificar titularidad ni viabilidad.
 */
var Terrenos = {
  cambiarEstado: function (ctx, d) {
    var t = Repo.obtenerOFallar('TERRENOS', d.terreno_id);
    if (ESTADOS.TERRENO.indexOf(d.estado) < 0) throw errorApp_('VALIDACION', 'Estado de terreno inválido.');
    if (d.estado === 'APROBADO') {
      Permisos.exigir(ctx.usuario, 'terrenos', 'aprobar');
      if (!t.titularidad_verificada) throw errorApp_('VALIDACION', 'No puede aprobarse un terreno sin titularidad verificada por asesoría jurídica.');
    }
    if (d.estado === 'INCORPORADO_A_PROYECTO' && !d.proyecto_id) throw errorApp_('VALIDACION', 'Indique el fideicomiso al que se incorpora.');
    var cambios = { estado: d.estado };
    if (d.proyecto_id) cambios.proyecto_id = d.proyecto_id;
    return Repo.actualizar('TERRENOS', t.id, cambios, ctx, { operacion: 'CAMBIO_ESTADO', motivo: d.motivo || '', permitirCambioProyecto: !t.proyecto_id });
  },

  verificarTitularidad: function (ctx, d) {
    if (ctx.usuario.rol !== ROLES.SUPERADMIN && ctx.usuario.rol !== ROLES.ASESOR_JURIDICO) {
      throw errorApp_('PROHIBIDO', 'La titularidad solo puede verificarla asesoría jurídica o el SUPERADMIN.');
    }
    if (!d.motivo) throw errorApp_('VALIDACION', 'Indique el respaldo (informe de dominio, escritura, etc.).');
    return Repo.actualizar('TERRENOS', d.terreno_id, { titularidad_verificada: !!d.valor }, ctx,
      { operacion: 'VERIFICACION_TITULARIDAD', motivo: d.motivo, aprobacion: ctx.usuario.email });
  }
};

var Crm = {
  moverEtapa: function (ctx, d) {
    if (ESTADOS.EMBUDO.indexOf(d.etapa) < 0) throw errorApp_('VALIDACION', 'Etapa inválida.');
    var o = Repo.obtenerOFallar('OPORTUNIDADES', d.oportunidad_id);
    var cambios = { etapa: d.etapa, estado: d.etapa === 'DESCARTADO' ? 'CERRADA' : 'ABIERTA' };
    if (d.etapa === 'DESCARTADO') {
      if (!d.motivo) throw errorApp_('VALIDACION', 'Indique el motivo del descarte.');
      cambios.motivo_descarte = d.motivo;
    }
    if (d.proxima_accion) cambios.proxima_accion = d.proxima_accion;
    if (d.fecha_proxima_accion) cambios.fecha_proxima_accion = d.fecha_proxima_accion;
    return Repo.actualizar('OPORTUNIDADES', o.id, cambios, ctx, { operacion: 'CAMBIO_ETAPA', motivo: d.motivo || '' });
  },

  registrarMensaje: function (ctx, d) {
    var c = Repo.obtenerOFallar('CONTACTOS_CRM', d.contacto_id);
    var conv = Repo.crear('CONVERSACIONES', { contacto_id: c.id, canal: d.canal || 'MANUAL', direccion: d.direccion || 'SALIENTE',
      mensaje: d.mensaje, fecha: ahoraIso_(), enviado_por: ctx.usuario.email, estado: 'REGISTRADO' }, ctx, { sinAuditoria: true });
    var envio = null;
    if (d.enviarWhatsApp) {
      if (!c.consentimiento || c.baja_comunicaciones) throw errorApp_('CONSENTIMIENTO', 'El contacto no dio consentimiento o pidió la baja.');
      envio = WhatsApp.enviarTexto(c.telefono, d.mensaje);
    }
    return { conversacion: conv, envio: envio || { ok: false, motivo: 'Registrado sin envío automático' } };
  },

  baja: function (ctx, d) {
    return Repo.actualizar('CONTACTOS_CRM', d.contacto_id, { baja_comunicaciones: true }, ctx, { operacion: 'BAJA_COMUNICACIONES', motivo: d.motivo || 'Solicitud del contacto' });
  },

  /** Métricas del embudo comercial. */
  embudo: function () {
    var ops = Repo.todos('OPORTUNIDADES', function (o) { return o.estado !== 'ANULADO'; });
    var porEtapa = {};
    ESTADOS.EMBUDO.forEach(function (e) { porEtapa[e] = 0; });
    ops.forEach(function (o) { porEtapa[o.etapa] = (porEtapa[o.etapa] || 0) + 1; });
    var incorporados = (porEtapa.INCORPORACION || 0) + (porEtapa.SEGUIMIENTO || 0);
    return { porEtapa: porEtapa, total: ops.length, conversion: ops.length ? Math.round(incorporados * 1000 / ops.length) / 10 : 0 };
  }
};

/** Formularios públicos de la web institucional. */
var Publico = {
  antiSpam: function (d) {
    if (d.sitio_web) throw errorApp_('VALIDACION', 'Solicitud rechazada.'); // honeypot: campo invisible para humanos
    Auth.limitarIntentos('form-global:' + Utilities.formatDate(new Date(), 'UTC', 'yyyyMMddHHmm'), 30);
    if (d.email) Auth.limitarIntentos('form:' + String(d.email).toLowerCase(), 5);
    if (!d.consentimiento) throw errorApp_('VALIDACION', 'Debe aceptar el tratamiento de sus datos para que podamos contactarlo.');
  },

  contacto: function (d) {
    Publico.antiSpam(d);
    var ctx = { actor: 'web', origen: 'formulario_publico' };
    var clasif = ['APORTANTE_PRELIMINAR', 'BENEFICIARIO_POTENCIAL', 'INVERSOR', 'CONSULTA_GENERAL'].indexOf(d.interes) >= 0 ? d.interes : 'CONSULTA_GENERAL';
    var c = Repo.crear('CONTACTOS_CRM', { nombre: d.nombre, email: d.email, telefono: d.telefono, fuente: 'WEB', clasificacion: clasif,
      mensaje: d.mensaje, consentimiento: true, fecha_consentimiento: ahoraIso_(), estado: 'NUEVO_CONTACTO',
      proyecto_id: d.proyecto_id && Repo.obtener('PROYECTOS', d.proyecto_id) ? d.proyecto_id : '' }, ctx);
    Repo.crear('OPORTUNIDADES', { contacto_id: c.id, etapa: 'NUEVO_CONTACTO', estado: 'ABIERTA', proyecto_id: c.proyecto_id,
      proxima_accion: 'Primer contacto', fecha_proxima_accion: sumarMeses_(hoyIso_(), 0) }, ctx);
    Alertas.crear(ctx, { tipo: 'NUEVO_CONTACTO_WEB', severidad: 'INFO', entidad: 'CONTACTOS_CRM', entidad_id: c.id,
      mensaje: 'Nuevo contacto web: ' + c.nombre + ' (' + clasif + ')' });
    return { mensaje: 'Gracias. Recibimos su consulta y un asesor se comunicará con usted.' };
  },

  terreno: function (d) {
    Publico.antiSpam(d);
    var ctx = { actor: 'web', origen: 'formulario_terreno' };
    var p = Repo.crear('PROPIETARIOS', { nombre: d.nombre, email: d.email, telefono: d.telefono, consentimiento_contacto: true, estado: 'ACTIVO' }, ctx);
    var t = Repo.crear('TERRENOS', { propietario_id: p.id, ubicacion: d.ubicacion, direccion: d.direccion, superficie_m2: d.superficie_m2,
      medidas: d.medidas, servicios: d.servicios, observaciones: d.mensaje, estado: 'NUEVO_CONTACTO', titularidad_verificada: false,
      origen: 'WEB' }, ctx);
    var c = Repo.crear('CONTACTOS_CRM', { nombre: d.nombre, email: d.email, telefono: d.telefono, fuente: 'WEB',
      clasificacion: 'PROPIETARIO_TERRENO', mensaje: 'Terreno ' + t.id + ': ' + (d.ubicacion || ''), consentimiento: true,
      fecha_consentimiento: ahoraIso_(), estado: 'NUEVO_CONTACTO' }, ctx);
    Repo.crear('OPORTUNIDADES', { contacto_id: c.id, etapa: 'NUEVO_CONTACTO', estado: 'ABIERTA', proxima_accion: 'Contactar propietario' }, ctx);
    Alertas.crear(ctx, { tipo: 'NUEVO_TERRENO_WEB', severidad: 'INFO', entidad: 'TERRENOS', entidad_id: t.id,
      mensaje: 'Nuevo terreno ofrecido en ' + t.ubicacion + '. Pendiente de verificación (titularidad y viabilidad NO verificadas).' });
    return { mensaje: 'Gracias. Registramos su propuesta. La recepción no implica evaluación ni aceptación del terreno.' };
  },

  proyectos: function () {
    return Repo.todos('PROYECTOS', function (f) { return f.publico === true && f.estado !== 'CERRADO'; }).map(function (f) {
      var obras = Repo.todos('OBRAS', function (o) { return o.proyecto_id === f.id && o.estado !== 'ANULADO'; });
      return { id: f.id, denominacion: f.denominacion, estado: f.estado, descripcion: f.descripcion_publica, imagen_url: f.imagen_url,
        unidades: f.unidades_proyectadas, fecha_estimada_entrega: f.fecha_estimada_entrega ? formatearFecha_(f.fecha_estimada_entrega) : '',
        avance_fisico: obras.length ? Math.round(obras.reduce(function (s, o) { return s + (Number(o.avance_fisico) || 0); }, 0) / obras.length) : null };
    });
  }
};

var ACC_TERRENOS = {
  'terrenos.cambiarEstado': accion_('terrenos', 'editar', function (ctx, d) { return Terrenos.cambiarEstado(ctx, d); }),
  'terrenos.verificarTitularidad': accion_('terrenos', 'editar', function (ctx, d) { return Terrenos.verificarTitularidad(ctx, d); }),
  'terrenos.ficha': accion_('terrenos', 'leer', function (ctx, d) {
    var t = Repo.obtenerOFallar('TERRENOS', d.terreno_id);
    return { terreno: t, propietario: Repo.publico('PROPIETARIOS', Repo.obtener('PROPIETARIOS', t.propietario_id)),
      documentos: Repo.todos('DOCUMENTOS', function (x) { return x.entidad === 'TERRENOS' && x.entidad_id === t.id; }),
      historial: Repo.todos('AUDITORIA', function (a) { return a.registro_id === t.id; }).slice(-50) };
  })
};

var ACC_CRM = {
  'crm.moverEtapa': accion_('crm', 'editar', function (ctx, d) { return Crm.moverEtapa(ctx, d); }),
  'crm.registrarMensaje': accion_('crm', 'crear', function (ctx, d) { return Crm.registrarMensaje(ctx, d); }),
  'crm.baja': accion_('crm', 'editar', function (ctx, d) { return Crm.baja(ctx, d); }),
  'crm.embudo': accion_('crm', 'leer', function () { return Crm.embudo(); }),
  'crm.whatsappEstado': accion_('crm', 'leer', function () { return WhatsApp.estado(); })
};

var ACC_PUBLICO = {
  'publico.config': accion_(null, null, function () { return Configuracion.marcaPublica(); }, true),
  'publico.proyectos': accion_(null, null, function () { return Publico.proyectos(); }, true),
  'publico.contacto': accion_(null, null, function (ctx, d) { return Publico.contacto(d); }, true),
  'publico.terreno': accion_(null, null, function (ctx, d) { return Publico.terreno(d); }, true)
};
