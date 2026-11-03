/**
 * Obras.js — Seguimiento constructivo. El avance físico SOLO se actualiza a partir de certificaciones
 * aprobadas, firmadas por un profesional responsable. Tablero físico vs financiero vs plazo.
 */
var Obras = {
  presentarCertificacion: function (ctx, d) {
    var e = Repo.obtenerOFallar('ETAPAS_OBRA', d.etapa_id);
    Permisos.exigirProyecto(ctx.usuario, e.proyecto_id);
    var av = Number(d.avance_porcentual);
    if (!(av >= 0 && av <= 100)) throw errorApp_('VALIDACION', 'El avance debe estar entre 0 y 100.');
    if (av < (Number(e.avance_certificado) || 0)) throw errorApp_('VALIDACION', 'El avance acumulado no puede ser menor al ya certificado. Registre una observación de desvío.');
    if (!d.profesional) throw errorApp_('VALIDACION', 'Indique el profesional que certifica.');
    return Repo.crear('CERTIFICACIONES', { proyecto_id: e.proyecto_id, obra_id: e.obra_id, etapa_id: e.id, fecha: d.fecha || hoyIso_(),
      avance_porcentual: av, importe_certificado: d.importe_certificado || 0, profesional: d.profesional, documento_id: d.documento_id || '',
      fotos: d.fotos || '', observaciones: d.observaciones || '', estado: 'PRESENTADA' }, ctx);
  },

  decidirCertificacion: function (ctx, d) {
    var c = Repo.obtenerOFallar('CERTIFICACIONES', d.certificacion_id);
    Permisos.exigirProyecto(ctx.usuario, c.proyecto_id);
    if (c.estado !== 'PRESENTADA') throw errorApp_('TRANSICION', 'La certificación ya fue decidida.');
    if (c.usuario_responsable === ctx.usuario.email && ctx.usuario.rol !== ROLES.SUPERADMIN) {
      throw errorApp_('SEGREGACION', 'Quien presenta la certificación no puede aprobarla.');
    }
    if (d.aprobar === false) {
      if (!d.motivo) throw errorApp_('VALIDACION', 'Indique el motivo del rechazo.');
      return Repo.actualizar('CERTIFICACIONES', c.id, { estado: 'RECHAZADA', observaciones: d.motivo }, ctx, { operacion: 'RECHAZO_CERTIFICACION', motivo: d.motivo });
    }
    var r = Repo.actualizar('CERTIFICACIONES', c.id, { estado: 'APROBADA', aprobado_por: ctx.usuario.email, fecha_aprobacion: ahoraIso_() }, ctx,
      { operacion: 'APROBACION_CERTIFICACION', aprobacion: ctx.usuario.email, motivo: d.motivo || '' });
    Repo.actualizar('ETAPAS_OBRA', c.etapa_id, { avance_certificado: c.avance_porcentual }, ctx, { operacion: 'AVANCE_CERTIFICADO', motivo: 'Certificación ' + c.id });
    Obras.recalcularAvance(ctx, c.obra_id);
    return r;
  },

  /** Avance físico de la obra = Σ(peso de etapa × avance certificado) / Σ pesos. */
  recalcularAvance: function (ctx, obraId) {
    var etapas = Repo.todos('ETAPAS_OBRA', function (e) { return e.obra_id === obraId && e.estado !== 'ANULADO'; });
    var pesos = etapas.reduce(function (s, e) { return s + (Number(e.peso_porcentual) || 0); }, 0);
    var avance = pesos ? etapas.reduce(function (s, e) { return s + (Number(e.peso_porcentual) || 0) * (Number(e.avance_certificado) || 0); }, 0) / pesos : 0;
    avance = Math.round(avance * 10) / 10;
    Repo.actualizar('OBRAS', obraId, { avance_fisico: avance }, ctx, { operacion: 'RECALCULO_AVANCE', motivo: 'Certificaciones aprobadas' });
    return avance;
  },

  tablero: function (obraId) {
    var o = Repo.obtenerOFallar('OBRAS', obraId);
    var gastos = Repo.todos('GASTOS', function (g) { return g.obra_id === o.id && g.estado === 'APROBADO'; });
    var ejecutado = redondearMoneda_(gastos.reduce(function (s, g) { return s + g.importe; }, 0));
    var saldo = Finanzas.saldoProyecto(o.proyecto_id);
    var recaudado = saldo.porTipo.CUOTA_BENEFICIARIO || 0;
    var hoy = hoyIso_();
    var plazoTotal = o.fecha_inicio_prevista && o.fecha_fin_prevista ? diasEntre_(o.fecha_inicio_prevista, o.fecha_fin_prevista) : 0;
    var transcurrido = o.fecha_inicio_prevista ? Math.max(0, diasEntre_(o.fecha_inicio_prevista, hoy)) : 0;
    var avanceFinanciero = o.presupuesto ? Math.round(ejecutado * 1000 / o.presupuesto) / 10 : 0;
    var avanceTemporal = plazoTotal ? Math.min(100, Math.round(transcurrido * 1000 / plazoTotal) / 10) : 0;
    return {
      obra: o, avance_fisico: Number(o.avance_fisico) || 0, avance_financiero: avanceFinanciero, avance_temporal: avanceTemporal,
      presupuesto: o.presupuesto, ejecutado: ejecutado, disponible_presupuesto: redondearMoneda_((o.presupuesto || 0) - ejecutado),
      recaudacion: recaudado, saldo_fideicomiso: saldo.saldo,
      plazo_total_dias: plazoTotal, plazo_transcurrido_dias: transcurrido, plazo_restante_dias: Math.max(0, plazoTotal - transcurrido),
      etapas: Repo.todos('ETAPAS_OBRA', function (e) { return e.obra_id === o.id; }).sort(function (a, b) { return a.orden - b.orden; })
    };
  },

  /** Genera alertas de atraso, sobrecosto, disponibilidad y desvío físico/financiero (idempotentes por día). */
  controlar: function (ctx) {
    var umbral = Configuracion.numero('umbral_desvio_fisico_financiero') || 10;
    var dia = hoyIso_();
    var generadas = 0;
    Repo.todos('OBRAS', function (o) { return o.estado !== 'ANULADO' && o.estado !== 'FINALIZADA'; }).forEach(function (o) {
      var t = Obras.tablero(o.id);
      function alerta(tipo, sev, msg) {
        Alertas.crear(ctx, { tipo: tipo, severidad: sev, proyecto_id: o.proyecto_id, entidad: 'OBRAS', entidad_id: o.id, mensaje: msg,
          clave_idempotencia: tipo + '-' + o.id + '-' + dia });
        generadas++;
      }
      if (t.avance_temporal - t.avance_fisico > umbral) alerta('OBRA_ATRASADA', 'ADVERTENCIA', o.nombre + ': avance físico ' + t.avance_fisico + '% vs plazo transcurrido ' + t.avance_temporal + '%.');
      if (t.presupuesto && t.ejecutado > t.presupuesto) alerta('SOBRECOSTO', 'CRITICA', o.nombre + ': ejecutado $' + t.ejecutado + ' supera presupuesto $' + t.presupuesto + '.');
      if (Math.abs(t.avance_financiero - t.avance_fisico) > umbral) alerta('DESVIO_FISICO_FINANCIERO', 'ADVERTENCIA', o.nombre + ': físico ' + t.avance_fisico + '% / financiero ' + t.avance_financiero + '%.');
      if (t.saldo_fideicomiso < 0) alerta('DISPONIBILIDAD_NEGATIVA', 'CRITICA', 'El fideicomiso de ' + o.nombre + ' tiene saldo negativo.');
      t.etapas.forEach(function (e) {
        if (e.fecha_fin_prevista && e.fecha_fin_prevista < dia && (Number(e.avance_certificado) || 0) < 100) {
          alerta('ETAPA_VENCIDA', 'ADVERTENCIA', o.nombre + ' / ' + e.nombre + ': fecha prevista vencida con ' + (e.avance_certificado || 0) + '% certificado.');
        }
      });
      var sinDoc = Repo.todos('CERTIFICACIONES', function (c) { return c.obra_id === o.id && c.estado === 'APROBADA' && !c.documento_id; });
      if (sinDoc.length) alerta('CERTIFICACION_SIN_DOCUMENTO', 'ADVERTENCIA', o.nombre + ': ' + sinDoc.length + ' certificación(es) aprobada(s) sin documento respaldatorio.');
    });
    return { alertas: generadas };
  }
};

var ACC_OBRAS = {
  'obras.presentarCertificacion': accion_('obras', 'crear', function (ctx, d) { return Obras.presentarCertificacion(ctx, d); }),
  'obras.decidirCertificacion': accion_('obras', 'aprobar', function (ctx, d) { return Obras.decidirCertificacion(ctx, d); }),
  'obras.tablero': accion_('obras', 'leer', function (ctx, d) {
    Permisos.exigirProyecto(ctx.usuario, Repo.obtenerOFallar('OBRAS', d.obra_id).proyecto_id);
    return Obras.tablero(d.obra_id);
  })
};
