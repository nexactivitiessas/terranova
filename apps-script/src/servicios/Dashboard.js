/**
 * Dashboard.js — Indicadores globales y por fideicomiso, con filtro por proyecto y período.
 * Los montos NUNCA se suman entre fideicomisos sin identificarlos: se informan por fideicomiso.
 */
var Dashboard = {
  indicadores: function (ctx, d) {
    d = d || {};
    var alcance = ctx.usuario ? Permisos.filtroAlcance(ctx.usuario) : null;
    var desde = d.desde ? normalizarFecha_(d.desde) : '0000-01-01';
    var hasta = d.hasta ? normalizarFecha_(d.hasta) : '9999-12-31';
    function enPeriodo(fecha) { var f = String(fecha || '').substring(0, 10); return f >= desde && f <= hasta; }
    function delProyecto(r) { return (!d.proyecto_id || r.proyecto_id === d.proyecto_id) && (!alcance || alcance(r)); }

    var proyectos = Repo.todos('PROYECTOS', function (f) { return (!d.proyecto_id || f.id === d.proyecto_id) && (!alcance || alcance(f)) && f.estado !== 'ANULADO'; });
    var terrenos = Repo.todos('TERRENOS', function (t) { return t.estado !== 'ANULADO' && enPeriodo(t.creado_en); });
    var contactos = Repo.todos('CONTACTOS_CRM', function (c) { return c.estado !== 'ANULADO' && enPeriodo(c.creado_en); });
    var contenidosPend = Repo.todos('CONTENIDOS', function (c) { return c.estado === 'PENDIENTE_APROBACION_FINAL'; });
    var cesiones = Repo.todos('CESIONES', function (c) { return delProyecto(c) && enPeriodo(c.fecha_solicitud); });
    var embudo = Crm.embudo();

    var porFideicomiso = proyectos.map(function (f) {
      var cuotas = Repo.todos('CUOTAS', function (c) { return c.proyecto_id === f.id && c.estado !== 'ANULADA' && enPeriodo(c.vencimiento); });
      var hoy = hoyIso_();
      var emitidas = cuotas.reduce(function (s, c) { return s + c.importe; }, 0);
      var cobradas = cuotas.reduce(function (s, c) { return s + c.pagado; }, 0);
      var vencido = cuotas.filter(function (c) { return c.vencimiento < hoy; }).reduce(function (s, c) { return s + c.saldo; }, 0);
      var exigible = cuotas.filter(function (c) { return c.vencimiento < hoy; }).reduce(function (s, c) { return s + c.importe; }, 0);
      var saldo = Finanzas.saldoProyecto(f.id);
      var obras = Repo.todos('OBRAS', function (o) { return o.proyecto_id === f.id && o.estado !== 'ANULADO'; });
      var avFis = obras.length ? Math.round(obras.reduce(function (s, o) { return s + (Number(o.avance_fisico) || 0); }, 0) / obras.length * 10) / 10 : 0;
      var presup = obras.reduce(function (s, o) { return s + (Number(o.presupuesto) || 0); }, 0);
      var gastos = Repo.todos('GASTOS', function (g) { return g.proyecto_id === f.id && g.estado === 'APROBADO' && enPeriodo(g.fecha); })
        .reduce(function (s, g) { return s + g.importe; }, 0);
      return {
        id: f.id, denominacion: f.denominacion, estado: f.estado, tipo: f.tipo_fideicomiso,
        beneficiarios_activos: Repo.todos('BENEFICIARIOS', function (b) { return b.proyecto_id === f.id && b.estado === 'ACTIVO'; }).length,
        aportes_preliminares: redondearMoneda_(Repo.todos('APORTES_PRELIMINARES', function (a) { return a.proyecto_id === f.id && a.estado === 'ACREDITADO' && enPeriodo(a.fecha); })
          .reduce(function (s, a) { return s + a.importe; }, 0)),
        cuotas_emitidas: redondearMoneda_(emitidas), cuotas_cobradas: redondearMoneda_(cobradas),
        cuotas_pendientes: redondearMoneda_(emitidas - cobradas), vencido: redondearMoneda_(vencido),
        morosidad_pct: exigible ? Math.round(vencido * 1000 / exigible) / 10 : 0,
        gastos_ejecutados: redondearMoneda_(gastos), saldo: saldo.saldo, avance_fisico: avFis,
        avance_financiero: presup ? Math.round(gastos * 1000 / presup) / 10 : 0,
        cesiones_abiertas: cesiones.filter(function (c) { return c.proyecto_id === f.id && ['RECHAZADA', 'FORMALIZADA', 'DESISTIDA'].indexOf(c.estado) < 0; }).length,
        moneda: APP.MONEDA
      };
    });

    var cuenta = function (lista, estados) { return lista.filter(function (x) { return estados.indexOf(x.estado) >= 0; }).length; };
    return {
      filtros: { proyecto_id: d.proyecto_id || '', desde: d.desde || '', hasta: d.hasta || '' },
      globales: {
        terrenos_captados: terrenos.length,
        terrenos_en_evaluacion: cuenta(terrenos, ['EVALUACION_JURIDICA', 'EVALUACION_URBANISTICA', 'EVALUACION_ECONOMICA', 'NEGOCIACION', 'DOCUMENTACION_PENDIENTE']),
        fideicomisos_activos: proyectos.filter(function (f) { return ['CERRADO', 'EN_EVALUACION'].indexOf(f.estado) < 0; }).length,
        proyectos_en_preparacion: cuenta(proyectos, ['EN_EVALUACION', 'PREPARACION_PRELIMINAR', 'CONSTITUCION_JURIDICA', 'LANZAMIENTO']),
        proyectos_en_ejecucion: cuenta(proyectos, ['EJECUCION']),
        beneficiarios_activos: porFideicomiso.reduce(function (s, f) { return s + f.beneficiarios_activos; }, 0),
        solicitudes_cesion: cesiones.filter(function (c) { return c.alternativa === 'CESION_DERECHOS' || c.alternativa === 'SUSTITUCION_BENEFICIARIO'; }).length,
        solicitudes_desvinculacion: cesiones.filter(function (c) { return ['RESOLUCION_CONTRACTUAL', 'REEMBOLSO', 'OTRA'].indexOf(c.alternativa) >= 0; }).length,
        contactos_comerciales: contactos.length,
        conversion_comercial_pct: embudo.conversion,
        contenidos_pendientes_aprobacion: contenidosPend.length,
        alertas_criticas_abiertas: Repo.todos('ALERTAS', function (a) { return a.estado === 'ABIERTA' && a.severidad === 'CRITICA' && delProyecto(a); }).length
      },
      porFideicomiso: porFideicomiso,
      embudo: embudo.porEtapa,
      aviso: 'Los importes se informan por fideicomiso; no se consolidan recursos de fideicomisos distintos.'
    };
  }
};

var ACC_DASHBOARD = {
  'dashboard.indicadores': accion_('reportes', 'leer', function (ctx, d) { return Dashboard.indicadores(ctx, d); })
};
