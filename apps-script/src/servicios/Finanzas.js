/**
 * Finanzas.js — Libro de movimientos por fideicomiso, pozo preliminar, gastos, cuotas, pagos y conciliación.
 *
 * Principios:
 *  - Cada movimiento pertenece a UN fideicomiso (proyecto_id obligatorio). Nunca se mezclan recursos.
 *  - MOVIMIENTOS es de solo agregado: las correcciones se hacen con AJUSTE_COMPENSATORIO (rectifica_id).
 *  - Un pago NO se acredita porque se haya subido un comprobante: debe verificarlo un usuario autorizado.
 *  - Toda operación reintentable usa clave_idempotencia para no duplicar movimientos.
 */
var Movimientos = {
  registrar: function (ctx, m) {
    if (TIPOS_MOVIMIENTO.indexOf(m.tipo) < 0) throw errorApp_('VALIDACION', 'Tipo de movimiento inválido.');
    if (!(Number(m.importe) > 0)) throw errorApp_('VALIDACION', 'El importe debe ser mayor a cero.');
    if (!m.proyecto_id) throw errorApp_('INTEGRIDAD', 'Todo movimiento debe pertenecer a un fideicomiso.');
    return Repo.crear('MOVIMIENTOS', {
      proyecto_id: m.proyecto_id, fecha: m.fecha || hoyIso_(), tipo: m.tipo, sentido: m.sentido, importe: m.importe,
      moneda: APP.MONEDA, concepto: m.concepto, origen_hoja: m.origen_hoja || '', origen_id: m.origen_id || '',
      rectifica_id: m.rectifica_id || '', clave_idempotencia: m.clave_idempotencia, comprobante_id: m.comprobante_id || '',
      estado: 'REGISTRADO'
    }, ctx, { motivo: m.concepto });
  },

  /** Genera un movimiento compensatorio que neutraliza otro (no se edita ni borra el original). */
  rectificar: function (ctx, movimientoId, motivo) {
    if (!motivo) throw errorApp_('VALIDACION', 'La rectificación requiere un motivo.');
    var o = Repo.obtenerOFallar('MOVIMIENTOS', movimientoId);
    if (o.tipo === 'AJUSTE_COMPENSATORIO' && o.rectifica_id) throw errorApp_('VALIDACION', 'No se rectifica una rectificación; registre un nuevo movimiento.');
    return Movimientos.registrar(ctx, { proyecto_id: o.proyecto_id, tipo: 'AJUSTE_COMPENSATORIO',
      sentido: o.sentido === 'INGRESO' ? 'EGRESO' : 'INGRESO', importe: o.importe, concepto: 'Rectificación de ' + o.id + ': ' + motivo,
      rectifica_id: o.id, origen_hoja: o.origen_hoja, origen_id: o.origen_id, clave_idempotencia: 'RECT-' + o.id });
  }
};

var Finanzas = {
  saldoProyecto: function (proyectoId) {
    var porTipo = {};
    var ingresos = 0, egresos = 0;
    Repo.todos('MOVIMIENTOS', function (m) { return m.proyecto_id === proyectoId; }).forEach(function (m) {
      var signo = m.sentido === 'INGRESO' ? 1 : -1;
      porTipo[m.tipo] = redondearMoneda_((porTipo[m.tipo] || 0) + signo * m.importe);
      if (signo > 0) ingresos += m.importe; else egresos += m.importe;
    });
    return { proyecto_id: proyectoId, ingresos: redondearMoneda_(ingresos), egresos: redondearMoneda_(egresos),
      saldo: redondearMoneda_(ingresos - egresos), porTipo: porTipo, moneda: APP.MONEDA };
  },

  // ---------- Pozo preliminar ----------
  registrarAportePreliminar: function (ctx, d) {
    Permisos.exigirProyecto(ctx.usuario, d.proyecto_id);
    var a = Repo.crear('APORTES_PRELIMINARES', {
      proyecto_id: d.proyecto_id, aportante_nombre: d.aportante_nombre, aportante_contacto_id: d.aportante_contacto_id || '',
      fecha: d.fecha || hoyIso_(), importe: d.importe, destino: d.destino, comprobante_id: d.comprobante_id || '',
      contrato_id: d.contrato_id || '', condicion: d.condicion || 'Según instrumento jurídico aprobado',
      beneficios_pactados: d.beneficios_pactados || 'Ninguno, salvo que el instrumento jurídico disponga lo contrario',
      saldo: d.importe, estado: 'PENDIENTE_VERIFICACION', clave_idempotencia: ctx.idempotencia || ''
    }, ctx);
    if (!a.contrato_id) {
      Alertas.crear(ctx, { tipo: 'APORTE_SIN_CONTRATO', severidad: 'ADVERTENCIA', proyecto_id: a.proyecto_id, entidad: 'APORTES_PRELIMINARES',
        entidad_id: a.id, mensaje: 'Aporte preliminar de ' + a.aportante_nombre + ' sin instrumento contractual vinculado.' });
    }
    return a;
  },

  verificarAportePreliminar: function (ctx, d) {
    var a = Repo.obtenerOFallar('APORTES_PRELIMINARES', d.aporte_id);
    Permisos.exigirProyecto(ctx.usuario, a.proyecto_id);
    if (a.estado !== 'PENDIENTE_VERIFICACION') throw errorApp_('TRANSICION', 'El aporte ya fue procesado (' + a.estado + ').');
    if (d.aprobar === false) {
      if (!d.motivo) throw errorApp_('VALIDACION', 'Indique el motivo del rechazo.');
      return Repo.actualizar('APORTES_PRELIMINARES', a.id, { estado: 'RECHAZADO' }, ctx, { operacion: 'RECHAZO_APORTE', motivo: d.motivo });
    }
    var mov = Movimientos.registrar(ctx, { proyecto_id: a.proyecto_id, tipo: 'APORTE_PRELIMINAR', sentido: 'INGRESO', importe: a.importe,
      fecha: a.fecha, concepto: 'Aporte preliminar ' + a.aportante_nombre, origen_hoja: 'APORTES_PRELIMINARES', origen_id: a.id,
      comprobante_id: a.comprobante_id, clave_idempotencia: 'APP-' + a.id });
    return Repo.actualizar('APORTES_PRELIMINARES', a.id, { estado: 'ACREDITADO', verificado_por: ctx.usuario.email,
      fecha_verificacion: ahoraIso_() }, ctx, { operacion: 'ACREDITACION_APORTE', motivo: d.motivo || 'Verificado contra extracto', aprobacion: ctx.usuario.email + ' / ' + mov.id });
  },

  // ---------- Gastos ----------
  registrarGasto: function (ctx, d) {
    Permisos.exigirProyecto(ctx.usuario, d.proyecto_id);
    var preliminar = !!d.es_preliminar;
    if (preliminar && CATEGORIAS_GASTO_PRELIMINAR.indexOf(d.categoria) < 0) {
      throw errorApp_('VALIDACION', 'Categoría de gasto preliminar inválida. Opciones: ' + CATEGORIAS_GASTO_PRELIMINAR.join(', '));
    }
    return Repo.crear('GASTOS', { proyecto_id: d.proyecto_id, fecha: d.fecha || hoyIso_(), categoria: d.categoria, es_preliminar: preliminar,
      proveedor: d.proveedor, importe: d.importe, comprobante_id: d.comprobante_id || '', obra_id: d.obra_id || '',
      etapa_id: d.etapa_id || '', concepto: d.concepto || d.categoria, estado: 'PENDIENTE_APROBACION',
      clave_idempotencia: ctx.idempotencia || '' }, ctx);
  },

  aprobarGasto: function (ctx, d) {
    var g = Repo.obtenerOFallar('GASTOS', d.gasto_id);
    Permisos.exigirProyecto(ctx.usuario, g.proyecto_id);
    if (g.estado !== 'PENDIENTE_APROBACION') throw errorApp_('TRANSICION', 'El gasto ya fue procesado.');
    if (d.aprobar === false) {
      if (!d.motivo) throw errorApp_('VALIDACION', 'Indique el motivo del rechazo.');
      return Repo.actualizar('GASTOS', g.id, { estado: 'RECHAZADO' }, ctx, { operacion: 'RECHAZO_GASTO', motivo: d.motivo });
    }
    var saldo = Finanzas.saldoProyecto(g.proyecto_id).saldo;
    if (saldo < g.importe) {
      Alertas.crear(ctx, { tipo: 'FONDOS_INSUFICIENTES', severidad: 'CRITICA', proyecto_id: g.proyecto_id, entidad: 'GASTOS', entidad_id: g.id,
        mensaje: 'Gasto de $' + g.importe + ' supera el saldo disponible ($' + saldo + ') del fideicomiso.', clave_idempotencia: 'FONDOS-' + g.id });
      throw errorApp_('FONDOS_INSUFICIENTES', 'El saldo disponible del fideicomiso ($' + saldo + ') no cubre el gasto.');
    }
    var mov = Movimientos.registrar(ctx, { proyecto_id: g.proyecto_id, tipo: g.es_preliminar ? 'GASTO_PRELIMINAR' : 'GASTO_PROYECTO',
      sentido: 'EGRESO', importe: g.importe, fecha: g.fecha, concepto: g.concepto + ' — ' + (g.proveedor || ''),
      origen_hoja: 'GASTOS', origen_id: g.id, comprobante_id: g.comprobante_id, clave_idempotencia: 'GAS-' + g.id });
    return Repo.actualizar('GASTOS', g.id, { estado: 'APROBADO', aprobado_por: ctx.usuario.email, movimiento_id: mov.id }, ctx,
      { operacion: 'APROBACION_GASTO', aprobacion: ctx.usuario.email, motivo: d.motivo || '' });
  },

  // ---------- Cuotas ----------
  generarPlan: function (ctx, d) {
    Permisos.exigirProyecto(ctx.usuario, d.proyecto_id);
    var b = Repo.obtenerOFallar('BENEFICIARIOS', d.beneficiario_id);
    if (b.proyecto_id !== d.proyecto_id) throw errorApp_('INTEGRIDAD', 'El beneficiario no pertenece a ese fideicomiso.');
    var total = redondearMoneda_(d.valor_total), inicial = redondearMoneda_(d.aporte_inicial || 0);
    var n = Math.floor(Number(d.cantidad_cuotas));
    if (!(total > 0) || !(n >= 1) || n > 360 || inicial < 0 || inicial >= total) throw errorApp_('VALIDACION', 'Parámetros del plan inválidos.');
    var primer = normalizarFecha_(d.primer_vencimiento);
    var planId = d.plan_id || ctx.idempotencia || ('PLAN-' + b.id + '-' + primer);
    var existentes = Repo.todos('CUOTAS', function (c) { return c.plan_id === planId; });
    if (existentes.length) return { plan_id: planId, cuotas: existentes, reutilizado: true };
    var base = Math.floor(((total - inicial) / n) * 100) / 100;
    var cuotas = [];
    if (inicial > 0) cuotas.push({ numero: 0, vencimiento: d.fecha_aporte_inicial ? normalizarFecha_(d.fecha_aporte_inicial) : primer, importe: inicial });
    for (var i = 1; i <= n; i++) {
      var imp = i === n ? redondearMoneda_(total - inicial - base * (n - 1)) : base;
      cuotas.push({ numero: i, vencimiento: sumarMeses_(primer, i - 1), importe: imp });
    }
    if (cuotas.length > APP.LOTE_MAX) throw errorApp_('VALIDACION', 'Plan demasiado grande para una operación.');
    var creadas = cuotas.map(function (c) {
      return Repo.crear('CUOTAS', { proyecto_id: d.proyecto_id, beneficiario_id: b.id, unidad_id: d.unidad_id || b.unidad_id || '',
        plan_id: planId, numero: c.numero, vencimiento: c.vencimiento, importe: c.importe, pagado: 0, saldo: c.importe, ajuste: 0,
        interes_mora: 0, estado: 'PENDIENTE', clave_idempotencia: planId + '#' + c.numero }, ctx, { sinAuditoria: true });
    });
    Auditoria.registrar(ctx, { operacion: 'GENERAR_PLAN_CUOTAS', hoja: 'CUOTAS', registro_id: planId, proyecto_id: d.proyecto_id,
      valor_nuevo: { beneficiario: b.id, total: total, inicial: inicial, cuotas: n, primer_vencimiento: primer } });
    return { plan_id: planId, cuotas: creadas, reutilizado: false };
  },

  // ---------- Pagos ----------
  registrarPago: function (ctx, d, desdePortal) {
    var b = Repo.obtenerOFallar('BENEFICIARIOS', d.beneficiario_id);
    if (!desdePortal) Permisos.exigirProyecto(ctx.usuario, b.proyecto_id);
    if (!(Number(d.importe) > 0)) throw errorApp_('VALIDACION', 'El importe debe ser mayor a cero.');
    return Repo.crear('PAGOS', { proyecto_id: b.proyecto_id, beneficiario_id: b.id, fecha: d.fecha || hoyIso_(), importe: d.importe,
      medio: d.medio || 'TRANSFERENCIA', referencia_bancaria: d.referencia_bancaria || '', comprobante_id: d.comprobante_id || '',
      cuota_ids: d.cuota_ids || '', cargado_por_beneficiario: !!desdePortal, estado: 'PENDIENTE_VERIFICACION',
      clave_idempotencia: ctx.idempotencia || '' }, ctx);
  },

  /** Verificación humana del pago: acredita, genera movimiento y aplica a cuotas (más antiguas primero). */
  verificarPago: function (ctx, d) {
    return dbConLock_(function () {
      var p = Repo.obtenerOFallar('PAGOS', d.pago_id);
      Permisos.exigirProyecto(ctx.usuario, p.proyecto_id);
      if (p.estado !== 'PENDIENTE_VERIFICACION') throw errorApp_('TRANSICION', 'El pago ya fue procesado (' + p.estado + ').');
      if (d.aprobar === false) {
        if (!d.motivo) throw errorApp_('VALIDACION', 'Indique el motivo del rechazo.');
        return Repo.actualizar('PAGOS', p.id, { estado: 'RECHAZADO', motivo_rechazo: d.motivo, verificado_por: ctx.usuario.email,
          fecha_verificacion: ahoraIso_() }, ctx, { operacion: 'RECHAZO_PAGO', motivo: d.motivo });
      }
      if (p.usuario_responsable === ctx.usuario.email && ctx.usuario.rol !== ROLES.SUPERADMIN) {
        throw errorApp_('SEGREGACION', 'Quien carga un pago no puede verificarlo (control por oposición). Solicite a otro usuario autorizado.');
      }
      if (!d.referencia_verificada) throw errorApp_('VALIDACION', 'Indique la referencia del extracto bancario con la que verificó la acreditación.');
      var mov = Movimientos.registrar(ctx, { proyecto_id: p.proyecto_id, tipo: 'CUOTA_BENEFICIARIO', sentido: 'INGRESO', importe: p.importe,
        fecha: p.fecha, concepto: 'Pago ' + p.id + ' beneficiario ' + p.beneficiario_id, origen_hoja: 'PAGOS', origen_id: p.id,
        comprobante_id: p.comprobante_id, clave_idempotencia: 'PAG-' + p.id });
      var aplicacion = Finanzas.aplicarACuotas(ctx, p);
      return Repo.actualizar('PAGOS', p.id, { estado: 'ACREDITADO', verificado_por: ctx.usuario.email, fecha_verificacion: ahoraIso_(),
        movimiento_id: mov.id, aplicacion: aplicacion, referencia_bancaria: p.referencia_bancaria || d.referencia_verificada },
        ctx, { operacion: 'ACREDITACION_PAGO', motivo: 'Verificado contra ' + d.referencia_verificada, aprobacion: ctx.usuario.email });
    });
  },

  aplicarACuotas: function (ctx, p) {
    var restante = redondearMoneda_(p.importe);
    var preferidas = String(p.cuota_ids || '').split(',').filter(String);
    var cuotas = Repo.todos('CUOTAS', function (c) {
      return c.beneficiario_id === p.beneficiario_id && c.saldo > 0 && c.estado !== 'ANULADA';
    }).sort(function (a, b) {
      var pa = preferidas.indexOf(a.id) >= 0 ? 0 : 1, pb = preferidas.indexOf(b.id) >= 0 ? 0 : 1;
      return pa - pb || (a.vencimiento < b.vencimiento ? -1 : a.vencimiento > b.vencimiento ? 1 : a.numero - b.numero);
    });
    var aplic = [];
    cuotas.forEach(function (c) {
      if (restante <= 0) return;
      var monto = Math.min(restante, redondearMoneda_(c.saldo));
      var pagado = redondearMoneda_(c.pagado + monto), saldo = redondearMoneda_(c.saldo - monto);
      Repo.actualizar('CUOTAS', c.id, { pagado: pagado, saldo: saldo, estado: saldo <= 0 ? 'PAGADA' : 'PAGADA_PARCIAL' }, ctx, { sinAuditoria: true });
      aplic.push({ cuota_id: c.id, monto: monto });
      restante = redondearMoneda_(restante - monto);
    });
    if (restante > 0) aplic.push({ cuota_id: 'SALDO_A_FAVOR', monto: restante });
    return JSON.stringify(aplic);
  },

  /** Anula un pago acreditado mediante rectificación: no borra nada, revierte la aplicación. */
  anularPago: function (ctx, d) {
    if (!d.motivo) throw errorApp_('VALIDACION', 'La anulación requiere motivo.');
    return dbConLock_(function () {
      var p = Repo.obtenerOFallar('PAGOS', d.pago_id);
      if (p.estado !== 'ACREDITADO') throw errorApp_('TRANSICION', 'Solo se anulan pagos acreditados.');
      Movimientos.rectificar(ctx, p.movimiento_id, d.motivo);
      JSON.parse(p.aplicacion || '[]').forEach(function (a) {
        if (a.cuota_id === 'SALDO_A_FAVOR') return;
        var c = Repo.obtener('CUOTAS', a.cuota_id);
        var pagado = redondearMoneda_(c.pagado - a.monto), saldo = redondearMoneda_(c.saldo + a.monto);
        var vencida = c.vencimiento < hoyIso_();
        Repo.actualizar('CUOTAS', c.id, { pagado: pagado, saldo: saldo, estado: pagado > 0 ? 'PAGADA_PARCIAL' : (vencida ? 'VENCIDA' : 'PENDIENTE') }, ctx, { sinAuditoria: true });
      });
      return Repo.actualizar('PAGOS', p.id, { estado: 'ANULADO' }, ctx, { operacion: 'ANULACION_PAGO', motivo: d.motivo, aprobacion: ctx.usuario.email });
    });
  },

  estadoCuenta: function (beneficiarioId) {
    var b = Repo.obtenerOFallar('BENEFICIARIOS', beneficiarioId);
    var cuotas = Repo.todos('CUOTAS', function (c) { return c.beneficiario_id === b.id && c.estado !== 'ANULADA'; })
      .sort(function (x, y) { return x.vencimiento < y.vencimiento ? -1 : 1; });
    var pagos = Repo.todos('PAGOS', function (p) { return p.beneficiario_id === b.id; });
    var hoy = hoyIso_();
    var tot = { emitido: 0, pagado: 0, saldo: 0, vencido: 0, interes_mora: 0 };
    cuotas.forEach(function (c) {
      tot.emitido += c.importe; tot.pagado += c.pagado; tot.saldo += c.saldo; tot.interes_mora += Number(c.interes_mora) || 0;
      if (c.vencimiento < hoy && c.saldo > 0) tot.vencido += c.saldo;
    });
    Object.keys(tot).forEach(function (k) { tot[k] = redondearMoneda_(tot[k]); });
    return { beneficiario: Repo.publico('BENEFICIARIOS', b), cuotas: cuotas, pagos: pagos, totales: tot,
      proxima: cuotas.filter(function (c) { return c.saldo > 0 && c.vencimiento >= hoy; })[0] || null };
  },

  recibo: function (pagoId) {
    var p = Repo.obtenerOFallar('PAGOS', pagoId);
    if (p.estado !== 'ACREDITADO') throw errorApp_('VALIDACION', 'Solo se emiten recibos de pagos acreditados.');
    var b = Repo.obtener('BENEFICIARIOS', p.beneficiario_id);
    var f = Repo.obtener('PROYECTOS', p.proyecto_id);
    return { numero: 'R-' + p.id, fecha: formatearFecha_(p.fecha), fecha_verificacion: formatearFecha_(p.fecha_verificacion),
      beneficiario: b.nombre, documento: b.documento, fideicomiso: f ? f.denominacion : p.proyecto_id, importe: p.importe,
      moneda: APP.MONEDA, medio: p.medio, referencia: p.referencia_bancaria, aplicacion: JSON.parse(p.aplicacion || '[]'),
      verificado_por: p.verificado_por, emisor: Configuracion.valor('nombre_comercial') };
  },

  /** Marca cuotas vencidas, calcula mora SOLO si la tasa contractual está configurada y genera alertas. */
  actualizarMora: function (ctx) {
    var hoy = hoyIso_();
    var tasa = Configuracion.numero('tasa_mora_diaria') / 100;
    var n = 0;
    Repo.todos('CUOTAS', function (c) { return c.saldo > 0 && c.vencimiento < hoy && ['PENDIENTE', 'PAGADA_PARCIAL', 'VENCIDA'].indexOf(c.estado) >= 0; })
      .slice(0, APP.LOTE_MAX).forEach(function (c) {
        var cambios = { estado: 'VENCIDA' };
        if (tasa > 0) cambios.interes_mora = redondearMoneda_(c.saldo * tasa * diasEntre_(c.vencimiento, hoy));
        if (c.estado !== 'VENCIDA' || tasa > 0) { Repo.actualizar('CUOTAS', c.id, cambios, ctx, { sinAuditoria: true }); n++; }
        Alertas.crear(ctx, { tipo: 'MORA', severidad: 'ADVERTENCIA', proyecto_id: c.proyecto_id, entidad: 'CUOTAS', entidad_id: c.id,
          mensaje: 'Cuota ' + c.numero + ' de ' + c.beneficiario_id + ' vencida el ' + formatearFecha_(c.vencimiento) + '. Saldo $' + c.saldo,
          clave_idempotencia: 'MORA-' + c.id });
      });
    return { actualizadas: n };
  },

  morosidad: function (proyectoId) {
    var hoy = hoyIso_();
    var vencidas = Repo.todos('CUOTAS', function (c) { return (!proyectoId || c.proyecto_id === proyectoId) && c.saldo > 0 && c.vencimiento < hoy && c.estado !== 'ANULADA'; });
    var porBen = {};
    vencidas.forEach(function (c) {
      var k = c.beneficiario_id;
      porBen[k] = porBen[k] || { beneficiario_id: k, proyecto_id: c.proyecto_id, cuotas: 0, saldo: 0, dias_max: 0 };
      porBen[k].cuotas++; porBen[k].saldo = redondearMoneda_(porBen[k].saldo + c.saldo);
      porBen[k].dias_max = Math.max(porBen[k].dias_max, diasEntre_(c.vencimiento, hoy));
    });
    return Object.keys(porBen).map(function (k) { return porBen[k]; }).sort(function (a, b) { return b.saldo - a.saldo; });
  },

  proyeccionRecaudacion: function (proyectoId, meses) {
    var hoy = hoyIso_();
    var limite = sumarMeses_(hoy, meses || 12);
    var porMes = {};
    Repo.todos('CUOTAS', function (c) { return (!proyectoId || c.proyecto_id === proyectoId) && c.saldo > 0 && c.estado !== 'ANULADA' && c.vencimiento <= limite; })
      .forEach(function (c) {
        var mes = c.vencimiento < hoy ? 'VENCIDO' : c.vencimiento.substring(0, 7);
        porMes[mes] = redondearMoneda_((porMes[mes] || 0) + c.saldo);
      });
    return porMes;
  },

  calendario: function (proyectoId, desde, hasta) {
    desde = desde ? normalizarFecha_(desde) : hoyIso_();
    hasta = hasta ? normalizarFecha_(hasta) : sumarMeses_(desde, 1);
    return Repo.todos('CUOTAS', function (c) {
      return (!proyectoId || c.proyecto_id === proyectoId) && c.vencimiento >= desde && c.vencimiento <= hasta && c.estado !== 'ANULADA';
    }).sort(function (a, b) { return a.vencimiento < b.vencimiento ? -1 : 1; });
  },

  /**
   * Conciliación: compara líneas de extracto bancario (cargadas por el contador) con pagos pendientes.
   * Solo SUGIERE coincidencias; la acreditación sigue requiriendo verificarPago().
   */
  conciliar: function (proyectoId, extracto) {
    var pendientes = Repo.todos('PAGOS', function (p) { return p.proyecto_id === proyectoId && p.estado === 'PENDIENTE_VERIFICACION'; });
    var usados = {};
    return (extracto || []).map(function (l) {
      var imp = redondearMoneda_(l.importe), ref = String(l.referencia || '').trim();
      var fecha = l.fecha ? normalizarFecha_(l.fecha) : '';
      var candidato = pendientes.filter(function (p) { return !usados[p.id] && redondearMoneda_(p.importe) === imp; })
        .map(function (p) {
          var puntaje = 50;
          if (ref && p.referencia_bancaria && p.referencia_bancaria === ref) puntaje += 40;
          if (fecha && Math.abs(diasEntre_(p.fecha, fecha)) <= 3) puntaje += 10;
          return { pago: p, puntaje: puntaje };
        }).sort(function (a, b) { return b.puntaje - a.puntaje; })[0];
      if (candidato) usados[candidato.pago.id] = true;
      return { linea: l, sugerencia: candidato ? { pago_id: candidato.pago.id, beneficiario_id: candidato.pago.beneficiario_id, confianza: candidato.puntaje } : null };
    });
  }
};

var ACC_FINANZAS = {
  'finanzas.saldo': accion_('finanzas', 'leer', function (ctx, d) { Permisos.exigirProyecto(ctx.usuario, d.proyecto_id); return Finanzas.saldoProyecto(d.proyecto_id); }),
  'finanzas.rectificar': accion_('finanzas', 'aprobar', function (ctx, d) { return Movimientos.rectificar(ctx, d.movimiento_id, d.motivo); }),
  'finanzas.registrarGasto': accion_('finanzas', 'crear', function (ctx, d) { return Finanzas.registrarGasto(ctx, d); }),
  'finanzas.aprobarGasto': accion_('finanzas', 'aprobar', function (ctx, d) { return Finanzas.aprobarGasto(ctx, d); }),
  'finanzas.conciliar': accion_('pagos', 'aprobar', function (ctx, d) { Permisos.exigirProyecto(ctx.usuario, d.proyecto_id); return Finanzas.conciliar(d.proyecto_id, d.extracto); }),
  'finanzas.proyeccion': accion_('cuotas', 'leer', function (ctx, d) { return Finanzas.proyeccionRecaudacion(d.proyecto_id, d.meses); }),
  'finanzas.morosidad': accion_('cuotas', 'leer', function (ctx, d) { return Finanzas.morosidad(d.proyecto_id); }),
  'finanzas.calendario': accion_('cuotas', 'leer', function (ctx, d) { return Finanzas.calendario(d.proyecto_id, d.desde, d.hasta); }),
  'preliminar.registrar': accion_('preliminar', 'crear', function (ctx, d) { return Finanzas.registrarAportePreliminar(ctx, d); }),
  'preliminar.verificar': accion_('preliminar', 'aprobar', function (ctx, d) { return Finanzas.verificarAportePreliminar(ctx, d); }),
  'cuotas.generarPlan': accion_('cuotas', 'crear', function (ctx, d) { return Finanzas.generarPlan(ctx, d); }),
  'cuotas.estadoCuenta': accion_('cuotas', 'leer', function (ctx, d) {
    Permisos.exigirProyecto(ctx.usuario, Repo.obtenerOFallar('BENEFICIARIOS', d.beneficiario_id).proyecto_id);
    return Finanzas.estadoCuenta(d.beneficiario_id);
  }),
  'pagos.registrar': accion_('pagos', 'crear', function (ctx, d) { return Finanzas.registrarPago(ctx, d, false); }),
  'pagos.verificar': accion_('pagos', 'aprobar', function (ctx, d) { return Finanzas.verificarPago(ctx, d); }),
  'pagos.anular': accion_('pagos', 'aprobar', function (ctx, d) { return Finanzas.anularPago(ctx, d); }),
  'pagos.recibo': accion_('pagos', 'leer', function (ctx, d) {
    Permisos.exigirProyecto(ctx.usuario, Repo.obtenerOFallar('PAGOS', d.pago_id).proyecto_id);
    return Finanzas.recibo(d.pago_id);
  })
};
