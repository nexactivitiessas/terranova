/**
 * Cesiones.js — SOLICITUD DE CESIÓN Y DESVINCULACIÓN.
 *
 * Nada se aprueba automáticamente. El sistema calcula escenarios SOLO con reglas cargadas desde el contrato
 * aprobado, no garantiza compradores, liquidez, precios de salida ni reintegros, y exige decisión humana
 * fundada y respaldo documental antes de formalizar.
 */
var TRANSICIONES_CESION = {
  INICIADA: ['EN_ANALISIS', 'DESISTIDA'],
  EN_ANALISIS: ['DOCUMENTACION_PRELIMINAR', 'PENDIENTE_DECISION', 'DESISTIDA'],
  DOCUMENTACION_PRELIMINAR: ['PENDIENTE_DECISION', 'DESISTIDA'],
  PENDIENTE_DECISION: [], // solo mediante decidir()
  APROBADA: [], // solo mediante formalizar()
  RECHAZADA: [], FORMALIZADA: [], DESISTIDA: []
};

var Cesiones = {
  iniciar: function (ctx, d, desdePortal) {
    var b = Repo.obtenerOFallar('BENEFICIARIOS', d.beneficiario_id);
    if (!desdePortal) Permisos.exigirProyecto(ctx.usuario, b.proyecto_id);
    var abiertas = Repo.todos('CESIONES', function (c) {
      return c.beneficiario_id === b.id && ['RECHAZADA', 'FORMALIZADA', 'DESISTIDA'].indexOf(c.estado) < 0;
    });
    if (abiertas.length) throw errorApp_('DUPLICADO', 'Ya existe una solicitud abierta (' + abiertas[0].id + ').');
    var cuenta = Finanzas.estadoCuenta(b.id);
    var contrato = Repo.obtener('CONTRATOS', b.contrato_id);
    var f = Repo.obtener('PROYECTOS', b.proyecto_id);
    var condiciones = (contrato && contrato.condiciones_salida) || (f && f.reglas_salida) || '';
    var c = Repo.crear('CESIONES', {
      proyecto_id: b.proyecto_id, beneficiario_id: b.id, unidad_id: b.unidad_id || '', alternativa: d.alternativa,
      motivo: d.motivo, fecha_solicitud: hoyIso_(),
      cuotas_abonadas: cuenta.cuotas.filter(function (x) { return x.estado === 'PAGADA'; }).length,
      total_abonado: cuenta.totales.pagado, obligaciones_pendientes: cuenta.totales.saldo,
      derechos_contractuales: contrato ? 'Contrato ' + contrato.id + ' (' + contrato.tipo + ')' : 'SIN CONTRATO VINCULADO',
      condiciones_contrato: condiciones || 'SIN REGLAS DE SALIDA APROBADAS: requiere análisis jurídico antes de cualquier cálculo.',
      cesionarios_potenciales: '[]', escenarios: '[]', estado: 'INICIADA'
    }, ctx, { motivo: d.motivo });
    Alertas.crear(ctx, { tipo: 'SOLICITUD_SALIDA', severidad: 'ADVERTENCIA', proyecto_id: b.proyecto_id, entidad: 'CESIONES', entidad_id: c.id,
      mensaje: 'Solicitud de ' + d.alternativa + ' iniciada por/para ' + b.nombre + '. Requiere análisis y decisión humana.' });
    return c;
  },

  avanzar: function (ctx, d) {
    var c = Repo.obtenerOFallar('CESIONES', d.cesion_id);
    Permisos.exigirProyecto(ctx.usuario, c.proyecto_id);
    if ((TRANSICIONES_CESION[c.estado] || []).indexOf(d.estado) < 0) throw errorApp_('TRANSICION', 'Transición no permitida: ' + c.estado + ' → ' + d.estado);
    var cambios = { estado: d.estado };
    if (d.responsable) cambios.responsable = d.responsable;
    return Repo.actualizar('CESIONES', c.id, cambios, ctx, { operacion: 'CAMBIO_ESTADO', motivo: d.motivo || '' });
  },

  registrarCesionario: function (ctx, d) {
    var c = Repo.obtenerOFallar('CESIONES', d.cesion_id);
    Permisos.exigirProyecto(ctx.usuario, c.proyecto_id);
    var lista = JSON.parse(c.cesionarios_potenciales || '[]');
    lista.push({ nombre: limpiarTexto_(d.nombre, 200), contacto_id: d.contacto_id || '', oferta: d.oferta ? redondearMoneda_(d.oferta) : null,
      observaciones: limpiarTexto_(d.observaciones || '', 500), registrado_por: ctx.usuario.email, fecha: ahoraIso_() });
    return Repo.actualizar('CESIONES', c.id, { cesionarios_potenciales: JSON.stringify(lista) }, ctx, { operacion: 'CESIONARIO_POTENCIAL' });
  },

  /**
   * Escenario de cálculo con parámetros tomados del contrato. El usuario declara la cláusula de origen.
   * Resultado: orientativo, no vinculante.
   */
  calcularEscenario: function (ctx, d) {
    var c = Repo.obtenerOFallar('CESIONES', d.cesion_id);
    Permisos.exigirProyecto(ctx.usuario, c.proyecto_id);
    if (/^SIN REGLAS/.test(c.condiciones_contrato)) throw errorApp_('SIN_REGLAS', 'No hay reglas de salida aprobadas para este contrato. Cargue las condiciones antes de calcular.');
    if (!d.clausula) throw errorApp_('VALIDACION', 'Indique la cláusula contractual de la que surgen los parámetros.');
    var pctReintegro = Number(d.porcentaje_reintegro) || 0;
    var penalidad = Number(d.penalidad_porcentual) || 0;
    var gastos = redondearMoneda_(d.gastos_administrativos || 0);
    if (pctReintegro < 0 || pctReintegro > 100 || penalidad < 0 || penalidad > 100) throw errorApp_('VALIDACION', 'Porcentajes fuera de rango.');
    var base = c.total_abonado;
    var penal = redondearMoneda_(base * penalidad / 100);
    var reintegro = Math.max(0, redondearMoneda_(base * pctReintegro / 100 - penal - gastos));
    var esc = { nombre: d.nombre || 'Escenario', clausula: limpiarTexto_(d.clausula, 300), base_abonado: base, porcentaje_reintegro: pctReintegro,
      penalidad: penal, gastos_administrativos: gastos, reintegro_estimado: reintegro, plazo_reintegro: limpiarTexto_(d.plazo || '', 200),
      calculado_por: ctx.usuario.email, fecha: ahoraIso_(),
      advertencia: 'Escenario orientativo y no vinculante. No garantiza liquidez, comprador, precio ni reintegro.' };
    var lista = JSON.parse(c.escenarios || '[]');
    lista.push(esc);
    Repo.actualizar('CESIONES', c.id, { escenarios: JSON.stringify(lista) }, ctx, { operacion: 'ESCENARIO_SALIDA' });
    return esc;
  },

  documentoPreliminar: function (ctx, d) {
    var c = Repo.obtenerOFallar('CESIONES', d.cesion_id);
    Permisos.exigirProyecto(ctx.usuario, c.proyecto_id);
    var b = Repo.obtener('BENEFICIARIOS', c.beneficiario_id);
    var f = Repo.obtener('PROYECTOS', c.proyecto_id);
    var texto = [
      'BORRADOR PRELIMINAR — NO VINCULANTE — REQUIERE REVISIÓN JURÍDICA',
      '',
      'Solicitud: ' + c.id + ' del ' + formatearFecha_(c.fecha_solicitud),
      'Fideicomiso: ' + (f ? f.denominacion : c.proyecto_id),
      'Beneficiario: ' + b.nombre + ' — Documento: ' + b.documento,
      'Unidad/derecho: ' + (c.unidad_id || 'no especificada'),
      'Alternativa solicitada: ' + c.alternativa,
      'Motivo: ' + c.motivo,
      'Cuotas abonadas: ' + c.cuotas_abonadas + ' — Total abonado: $ ' + c.total_abonado,
      'Obligaciones pendientes: $ ' + c.obligaciones_pendientes,
      'Derechos contractuales: ' + c.derechos_contractuales,
      'Condiciones contractuales de salida: ' + c.condiciones_contrato,
      '',
      'Este documento no implica aprobación de la cesión, desvinculación ni reintegro alguno.',
      'Toda decisión será adoptada por los responsables designados y formalizada por instrumento jurídico.'
    ].join('\n');
    var doc = Repo.crear('DOCUMENTOS', { proyecto_id: c.proyecto_id, titulo: 'Borrador ' + c.alternativa + ' ' + c.id, tipo: 'BORRADOR_CESION',
      entidad: 'CESIONES', entidad_id: c.id, visible_beneficiario: false, publico: false, estado: 'BORRADOR' }, ctx);
    if (c.estado === 'EN_ANALISIS') Repo.actualizar('CESIONES', c.id, { estado: 'DOCUMENTACION_PRELIMINAR', documento_id: doc.id }, ctx, { operacion: 'DOCUMENTO_PRELIMINAR' });
    else Repo.actualizar('CESIONES', c.id, { documento_id: doc.id }, ctx, { operacion: 'DOCUMENTO_PRELIMINAR' });
    return { documento: doc, texto: texto };
  },

  decidir: function (ctx, d) {
    var c = Repo.obtenerOFallar('CESIONES', d.cesion_id);
    Permisos.exigirProyecto(ctx.usuario, c.proyecto_id);
    if (c.estado !== 'PENDIENTE_DECISION') throw errorApp_('TRANSICION', 'La solicitud debe estar PENDIENTE_DECISION.');
    if (['APROBADA', 'RECHAZADA'].indexOf(d.decision) < 0) throw errorApp_('VALIDACION', 'Decisión inválida.');
    if (!d.fundamento || String(d.fundamento).length < 20) throw errorApp_('VALIDACION', 'La decisión requiere un fundamento (mínimo 20 caracteres).');
    var r = Repo.actualizar('CESIONES', c.id, { estado: d.decision, decision: d.decision, decidido_por: ctx.usuario.email,
      fecha_decision: ahoraIso_(), fundamento_decision: d.fundamento }, ctx, { operacion: 'DECISION_CESION', motivo: d.fundamento, aprobacion: ctx.usuario.email });
    var u = Repo.buscarPor('USUARIOS', 'beneficiario_id', c.beneficiario_id);
    if (u) Notificar.enviar(ctx, { destinatario: u.email, canal: 'PORTAL', asunto: 'Su solicitud ' + c.id, proyecto_id: c.proyecto_id,
      mensaje: 'Su solicitud fue ' + d.decision.toLowerCase() + '. La administración se comunicará para los pasos siguientes.', clave_idempotencia: 'DEC-' + c.id });
    return r;
  },

  /** Ejecuta la decisión aprobada con respaldo documental. Idempotente por cesión. */
  formalizar: function (ctx, d) {
    return dbConLock_(function () {
      var c = Repo.obtenerOFallar('CESIONES', d.cesion_id);
      Permisos.exigirProyecto(ctx.usuario, c.proyecto_id);
      if (c.estado !== 'APROBADA') throw errorApp_('TRANSICION', 'Solo se formalizan solicitudes APROBADAS.');
      if (!d.documento_id || !Repo.obtener('DOCUMENTOS', d.documento_id)) throw errorApp_('VALIDACION', 'Adjunte el instrumento firmado (documento_id) antes de formalizar.');
      var b = Repo.obtenerOFallar('BENEFICIARIOS', c.beneficiario_id);
      var res = { cesion_id: c.id };
      if (c.alternativa === 'CESION_DERECHOS' || c.alternativa === 'SUSTITUCION_BENEFICIARIO') {
        var nuevo = d.nuevo_beneficiario_id ? Repo.obtenerOFallar('BENEFICIARIOS', d.nuevo_beneficiario_id) : Repo.crear('BENEFICIARIOS', {
          proyecto_id: c.proyecto_id, nombre: d.nuevo_nombre, documento: d.nuevo_documento, email: d.nuevo_email || '', telefono: d.nuevo_telefono || '',
          unidad_id: b.unidad_id, fecha_adhesion: hoyIso_(), estado_contractual: 'INCORPORADO_POR_CESION', estado: 'ACTIVO' }, ctx);
        if (nuevo.proyecto_id !== c.proyecto_id) throw errorApp_('INTEGRIDAD', 'El cesionario debe pertenecer al mismo fideicomiso.');
        // Las cuotas sin pagos se transfieren; las pagadas o parciales quedan en el legajo original como historia.
        Repo.todos('CUOTAS', function (q) { return q.beneficiario_id === b.id && q.pagado === 0 && q.estado !== 'ANULADA'; }).forEach(function (q) {
          Repo.actualizar('CUOTAS', q.id, { beneficiario_id: nuevo.id }, ctx, { operacion: 'TRANSFERENCIA_CUOTA', motivo: 'Cesión ' + c.id });
        });
        if (b.unidad_id) Repo.actualizar('UNIDADES', b.unidad_id, { beneficiario_id: nuevo.id }, ctx, { operacion: 'TRANSFERENCIA_UNIDAD', motivo: 'Cesión ' + c.id });
        Repo.actualizar('BENEFICIARIOS', b.id, { estado: 'CEDIDO', estado_contractual: 'CEDIDO a ' + nuevo.id }, ctx, { operacion: 'CESION', motivo: c.id });
        if (Number(d.importe_ingreso_cesion) > 0) {
          Movimientos.registrar(ctx, { proyecto_id: c.proyecto_id, tipo: 'INGRESO_CESION', sentido: 'INGRESO', importe: d.importe_ingreso_cesion,
            concepto: 'Ingreso por cesión ' + c.id, origen_hoja: 'CESIONES', origen_id: c.id, clave_idempotencia: 'ICES-' + c.id });
        }
        res.nuevo_beneficiario_id = nuevo.id;
        Repo.actualizar('CESIONES', c.id, { nuevo_beneficiario_id: nuevo.id }, ctx, { sinAuditoria: true });
      } else {
        var reintegro = redondearMoneda_(d.importe_reintegro || 0);
        var mov = null;
        if (reintegro > 0) {
          mov = Movimientos.registrar(ctx, { proyecto_id: c.proyecto_id, tipo: 'REINTEGRO', sentido: 'EGRESO', importe: reintegro,
            concepto: 'Reintegro por ' + c.alternativa + ' ' + c.id, origen_hoja: 'CESIONES', origen_id: c.id, clave_idempotencia: 'REI-' + c.id });
        }
        Repo.crear('DESVINCULACIONES', { proyecto_id: c.proyecto_id, cesion_id: c.id, beneficiario_id: b.id, fecha: hoyIso_(), tipo: c.alternativa,
          importe_reintegro: reintegro, movimiento_id: mov ? mov.id : '', aprobado_por: c.decidido_por, estado: 'FORMALIZADA',
          observaciones: d.observaciones || '' }, ctx);
        Repo.todos('CUOTAS', function (q) { return q.beneficiario_id === b.id && q.saldo > 0 && q.estado !== 'ANULADA'; }).forEach(function (q) {
          Repo.actualizar('CUOTAS', q.id, { estado: 'ANULADA' }, ctx, { operacion: 'ANULACION_CUOTA', motivo: 'Desvinculación ' + c.id });
        });
        if (b.unidad_id) Repo.actualizar('UNIDADES', b.unidad_id, { beneficiario_id: '', disponible: true }, ctx, { operacion: 'LIBERACION_UNIDAD', motivo: c.id });
        Repo.actualizar('BENEFICIARIOS', b.id, { estado: 'DESVINCULADO', estado_contractual: c.alternativa }, ctx, { operacion: 'DESVINCULACION', motivo: c.id });
        res.reintegro = reintegro;
      }
      Repo.actualizar('CESIONES', c.id, { estado: 'FORMALIZADA', documento_id: d.documento_id }, ctx, { operacion: 'FORMALIZACION', aprobacion: c.decidido_por });
      return res;
    });
  }
};

var ACC_CESIONES = {
  'cesiones.iniciar': accion_('cesiones', 'crear', function (ctx, d) { return Cesiones.iniciar(ctx, d, false); }),
  'cesiones.avanzar': accion_('cesiones', 'editar', function (ctx, d) { return Cesiones.avanzar(ctx, d); }),
  'cesiones.registrarCesionario': accion_('cesiones', 'editar', function (ctx, d) { return Cesiones.registrarCesionario(ctx, d); }),
  'cesiones.calcularEscenario': accion_('cesiones', 'editar', function (ctx, d) { return Cesiones.calcularEscenario(ctx, d); }),
  'cesiones.documentoPreliminar': accion_('cesiones', 'editar', function (ctx, d) { return Cesiones.documentoPreliminar(ctx, d); }),
  'cesiones.decidir': accion_('cesiones', 'aprobar', function (ctx, d) { return Cesiones.decidir(ctx, d); }),
  'cesiones.formalizar': accion_('cesiones', 'aprobar', function (ctx, d) { return Cesiones.formalizar(ctx, d); })
};
