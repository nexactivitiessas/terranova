/**
 * Fideicomisos.js — Alta y ciclo de vida de fideicomisos (hoja PROYECTOS).
 * Cada fideicomiso es una unidad contable independiente: todo registro financiero lleva su proyecto_id.
 */
var TRANSICIONES_FIDEICOMISO = {
  EN_EVALUACION: ['PREPARACION_PRELIMINAR', 'CERRADO'],
  PREPARACION_PRELIMINAR: ['CONSTITUCION_JURIDICA', 'CERRADO'],
  CONSTITUCION_JURIDICA: ['LANZAMIENTO', 'CERRADO'],
  LANZAMIENTO: ['COMERCIALIZACION', 'CERRADO'],
  COMERCIALIZACION: ['EJECUCION', 'LIQUIDACION'],
  EJECUCION: ['FINALIZACION', 'LIQUIDACION'],
  FINALIZACION: ['ADJUDICACION'],
  ADJUDICACION: ['LIQUIDACION', 'CERRADO'],
  LIQUIDACION: ['CERRADO'],
  CERRADO: []
};

var Fideicomisos = {
  crear: function (ctx, d) {
    if (ctx.usuario.rol !== ROLES.SUPERADMIN && ctx.usuario.rol !== ROLES.ADMINISTRADOR) {
      throw errorApp_('PROHIBIDO', 'Solo SUPERADMIN o ADMINISTRADOR pueden crear fideicomisos.');
    }
    var datos = datosFiltrarCampos_('PROYECTOS', d, HOJAS_API.PROYECTOS.camposBloqueados);
    datos.estado = 'EN_EVALUACION';
    datos.publico = false;
    var f = Repo.crear('PROYECTOS', datos, ctx, { motivo: 'Alta de fideicomiso' });
    if (f.terreno_id) {
      var t = Repo.obtener('TERRENOS', f.terreno_id);
      if (t && t.estado !== 'APROBADO' && t.estado !== 'INCORPORADO_A_PROYECTO') {
        Alertas.crear(ctx, { tipo: 'TERRENO_NO_APROBADO', severidad: 'ADVERTENCIA', proyecto_id: f.id, entidad: 'TERRENOS', entidad_id: t.id,
          mensaje: 'El fideicomiso ' + f.denominacion + ' se asoció a un terreno que aún no está APROBADO.' });
      }
    }
    return f;
  },

  /** Marca/desmarca un requisito de habilitación comercial. Requiere permiso de aprobación. */
  marcarRequisito: function (ctx, d) {
    var req = REQUISITOS_COMERCIALIZACION.filter(function (r) { return r.campo === d.requisito; })[0];
    if (!req) throw errorApp_('VALIDACION', 'Requisito inexistente.');
    if (!d.motivo) throw errorApp_('VALIDACION', 'Indique el respaldo (documento, dictamen o acta) del requisito.');
    Permisos.exigirProyecto(ctx.usuario, d.proyecto_id);
    var cambios = {}; cambios[req.campo] = !!d.valor;
    return Repo.actualizar('PROYECTOS', d.proyecto_id, cambios, ctx,
      { operacion: 'REQUISITO_COMERCIAL', motivo: d.motivo, aprobacion: ctx.usuario.email });
  },

  requisitosPendientes: function (f) {
    return REQUISITOS_COMERCIALIZACION.filter(function (r) { return !f[r.campo]; }).map(function (r) { return r.etiqueta; });
  },

  cambiarEstado: function (ctx, d) {
    var f = Repo.obtenerOFallar('PROYECTOS', d.proyecto_id);
    Permisos.exigirProyecto(ctx.usuario, f.id);
    var permitidos = TRANSICIONES_FIDEICOMISO[f.estado] || [];
    if (permitidos.indexOf(d.estado) < 0) {
      throw errorApp_('TRANSICION', 'No se puede pasar de ' + f.estado + ' a ' + d.estado + '. Permitidos: ' + (permitidos.join(', ') || 'ninguno'));
    }
    if (!d.motivo) throw errorApp_('VALIDACION', 'El cambio de estado requiere un motivo.');
    if (d.estado === 'COMERCIALIZACION') {
      var pendientes = Fideicomisos.requisitosPendientes(f);
      if (pendientes.length) {
        throw errorApp_('HABILITACION_COMERCIAL', 'No puede pasar a COMERCIALIZACIÓN. Requisitos pendientes: ' + pendientes.join('; '), pendientes);
      }
      if (f.modalidad_oferta === 'PUBLICA' || f.tipo_fideicomiso === 'FINANCIERO') {
        Alertas.crear(ctx, { tipo: 'REGIMEN_ESPECIAL', severidad: 'CRITICA', proyecto_id: f.id, entidad: 'PROYECTOS', entidad_id: f.id,
          mensaje: 'Fideicomiso ' + f.tipo_fideicomiso + ' / oferta ' + f.modalidad_oferta + ': verifique con asesoría profesional el régimen regulatorio aplicable antes de comercializar.' });
      }
    }
    return Repo.actualizar('PROYECTOS', f.id, { estado: d.estado }, ctx, { operacion: 'CAMBIO_ESTADO', motivo: d.motivo, aprobacion: ctx.usuario.email });
  },

  /** Publica/oculta un fideicomiso en la web institucional (solo si está habilitado comercialmente o en lanzamiento). */
  publicar: function (ctx, d) {
    var f = Repo.obtenerOFallar('PROYECTOS', d.proyecto_id);
    if (d.publico && !f.req_publicidad_aprobada) throw errorApp_('HABILITACION_COMERCIAL', 'La documentación publicitaria no está aprobada.');
    return Repo.actualizar('PROYECTOS', f.id, { publico: !!d.publico }, ctx, { operacion: 'PUBLICACION_WEB', motivo: d.motivo || '' });
  },

  resumen: function (ctx, proyectoId) {
    Permisos.exigirProyecto(ctx.usuario, proyectoId);
    var f = Repo.obtenerOFallar('PROYECTOS', proyectoId);
    return { fideicomiso: f, requisitos: REQUISITOS_COMERCIALIZACION.map(function (r) { return { campo: r.campo, etiqueta: r.etiqueta, cumplido: !!f[r.campo] }; }),
      transiciones: TRANSICIONES_FIDEICOMISO[f.estado] || [], saldo: Finanzas.saldoProyecto(proyectoId) };
  }
};

var ACC_FIDEICOMISOS = {
  'fideicomisos.crear': accion_('fideicomisos', 'crear', function (ctx, d) { return Fideicomisos.crear(ctx, d); }),
  'fideicomisos.resumen': accion_('fideicomisos', 'leer', function (ctx, d) { return Fideicomisos.resumen(ctx, d.proyecto_id); }),
  'fideicomisos.marcarRequisito': accion_('fideicomisos', 'aprobar', function (ctx, d) { return Fideicomisos.marcarRequisito(ctx, d); }),
  'fideicomisos.cambiarEstado': accion_('fideicomisos', 'aprobar', function (ctx, d) { return Fideicomisos.cambiarEstado(ctx, d); }),
  'fideicomisos.publicar': accion_('fideicomisos', 'aprobar', function (ctx, d) { return Fideicomisos.publicar(ctx, d); })
};
