/**
 * Sistema.js — Alertas, cola de tareas, automatizaciones, copias de seguridad, restauración e integridad.
 */
var Alertas = {
  /** Crea una alerta. Con clave_idempotencia no se duplica. */
  crear: function (ctx, a) {
    var alerta = Repo.crear('ALERTAS', { tipo: a.tipo, severidad: a.severidad || 'INFO', mensaje: a.mensaje, entidad: a.entidad || '',
      entidad_id: a.entidad_id || '', proyecto_id: a.proyecto_id || '', clave_idempotencia: a.clave_idempotencia || '', estado: 'ABIERTA' },
      ctx || { actor: 'sistema' }, { sinAuditoria: true });
    if (alerta.severidad === 'CRITICA' && alerta.creado_en === alerta.actualizado_en && alerta.version === 1) {
      var dest = Configuracion.valor('email_alertas');
      if (dest) { try { Notificar.email(dest, 'Alerta crítica: ' + alerta.tipo, alerta.mensaje); } catch (e) { console.warn(e); } }
    }
    return alerta;
  },
  resolver: function (ctx, id, motivo) {
    if (!motivo) throw errorApp_('VALIDACION', 'Indique cómo se resolvió la alerta.');
    return Repo.actualizar('ALERTAS', id, { estado: 'RESUELTA', resuelta_por: ctx.usuario.email, fecha_resolucion: ahoraIso_() }, ctx,
      { operacion: 'RESOLVER_ALERTA', motivo: motivo });
  }
};

/** Cola de tareas con idempotencia, reintentos y aprobación humana. */
var MANEJADORES_TAREA = {
  ACTUALIZAR_MORA: function (ctx) { return Finanzas.actualizarMora(ctx); },
  CONTROL_OBRAS: function (ctx) { return Obras.controlar(ctx); },
  RECORDATORIO_CUOTAS: function (ctx) { return Automatizaciones.recordatoriosCuotas(ctx); },
  SEGUIMIENTO_OPORTUNIDADES: function (ctx) { return Automatizaciones.seguimientoOportunidades(ctx); },
  SEGUIMIENTO_CESIONES: function (ctx) { return Automatizaciones.seguimientoCesiones(ctx); },
  INTEGRIDAD: function (ctx) { return Integridad.verificar(ctx); },
  RESPALDO: function (ctx) { return Respaldos.crear(ctx, 'AUTOMATICA'); },
  REPORTE_SEMANAL: function (ctx) { return Automatizaciones.reporteSemanal(ctx); }
};

var Tareas = {
  encolar: function (ctx, tipo, payload, clave, requiereAprobacion) {
    return Repo.crear('TAREAS', { tipo: tipo, payload: JSON.stringify(payload || {}), clave_idempotencia: clave || '', intentos: 0,
      estado: requiereAprobacion ? 'REQUIERE_APROBACION' : 'PENDIENTE', programada_para: ahoraIso_(),
      requiere_aprobacion_de: requiereAprobacion ? 'SUPERADMIN' : '' }, ctx, { sinAuditoria: true });
  },

  actualizarEstado: function (ctx, id, estado, extra) {
    if (ESTADOS.TAREA.indexOf(estado) < 0) throw errorApp_('VALIDACION', 'Estado de tarea inválido.');
    var cambios = extra || {};
    cambios.estado = estado;
    return Repo.actualizar('TAREAS', id, cambios, ctx, { sinAuditoria: estado !== 'COMPLETADA' && estado !== 'PENDIENTE' });
  },

  aprobar: function (ctx, id) {
    if (ctx.usuario.rol !== ROLES.SUPERADMIN) throw errorApp_('PROHIBIDO', 'Solo el SUPERADMIN aprueba tareas.');
    var t = Repo.obtenerOFallar('TAREAS', id);
    if (t.estado !== 'REQUIERE_APROBACION') throw errorApp_('TRANSICION', 'La tarea no requiere aprobación.');
    return Repo.actualizar('TAREAS', id, { estado: 'PENDIENTE' }, ctx, { operacion: 'APROBAR_TAREA', aprobacion: ctx.usuario.email });
  },

  reintentar: function (ctx, id) {
    var t = Repo.obtenerOFallar('TAREAS', id);
    if (t.estado !== 'ERROR') throw errorApp_('TRANSICION', 'Solo se reintentan tareas en ERROR.');
    return Repo.actualizar('TAREAS', id, { estado: 'PENDIENTE', intentos: 0 }, ctx, { operacion: 'REINTENTAR_TAREA' });
  },

  /** Procesa un lote respetando el tiempo máximo de ejecución de Apps Script. */
  procesar: function (ctx) {
    var inicio = Date.now();
    var hace10 = new Date(Date.now() - 10 * 60000).toISOString();
    // Recupera tareas colgadas (ejecución anterior interrumpida)
    Repo.todos('TAREAS', function (t) { return t.estado === 'EN_PROCESO' && t.actualizado_en < hace10; })
      .forEach(function (t) { Repo.actualizar('TAREAS', t.id, { estado: 'PENDIENTE', ultimo_error: 'Recuperada tras interrupción' }, ctx, { sinAuditoria: true }); });
    var pendientes = Repo.todos('TAREAS', function (t) { return t.estado === 'PENDIENTE' && MANEJADORES_TAREA[t.tipo]; })
      .sort(function (a, b) { return a.creado_en < b.creado_en ? -1 : 1; }).slice(0, APP.TAREA_LOTE);
    var res = { procesadas: 0, errores: 0, pendientes_restantes: 0 };
    for (var i = 0; i < pendientes.length; i++) {
      if (Date.now() - inicio > APP.TIEMPO_MAX_EJECUCION_MS) { res.pendientes_restantes = pendientes.length - i; break; }
      var t = pendientes[i];
      Repo.actualizar('TAREAS', t.id, { estado: 'EN_PROCESO', intentos: (Number(t.intentos) || 0) + 1 }, ctx, { sinAuditoria: true });
      try {
        var r = MANEJADORES_TAREA[t.tipo](ctx, JSON.parse(t.payload || '{}'));
        Repo.actualizar('TAREAS', t.id, { estado: 'COMPLETADA', resultado: JSON.stringify(r || {}).substring(0, 5000), ultimo_error: '' }, ctx, { sinAuditoria: true });
        res.procesadas++;
      } catch (e) {
        var intentos = (Number(t.intentos) || 0) + 1;
        var final = intentos >= APP.TAREA_MAX_INTENTOS;
        Repo.actualizar('TAREAS', t.id, { estado: final ? 'ERROR' : 'PENDIENTE', ultimo_error: String(e.message).substring(0, 1000) }, ctx, { sinAuditoria: true });
        if (final) Alertas.crear(ctx, { tipo: 'TAREA_FALLIDA', severidad: 'CRITICA', entidad: 'TAREAS', entidad_id: t.id,
          mensaje: 'La tarea ' + t.tipo + ' falló ' + intentos + ' veces: ' + e.message, clave_idempotencia: 'TAREA-ERR-' + t.id });
        res.errores++;
      }
    }
    return res;
  }
};

var Automatizaciones = {
  recordatoriosCuotas: function (ctx) {
    var dias = Configuracion.numero('dias_aviso_vencimiento') || 5;
    var hoy = hoyIso_();
    var lim = sumarDias_(hoy, dias);
    var enviados = 0;
    Repo.todos('CUOTAS', function (c) { return c.saldo > 0 && c.vencimiento >= hoy && c.vencimiento <= lim && c.estado !== 'ANULADA'; })
      .slice(0, 80).forEach(function (c) {
        var b = Repo.obtener('BENEFICIARIOS', c.beneficiario_id);
        if (!b || !b.consentimiento_comunicaciones || !b.email) return;
        Notificar.enviar(ctx, { destinatario: b.email, canal: 'EMAIL', proyecto_id: c.proyecto_id, asunto: 'Recordatorio de vencimiento',
          mensaje: 'Estimado/a ' + b.nombre + ': le recordamos que la cuota N° ' + c.numero + ' por $ ' + c.saldo + ' vence el ' + formatearFecha_(c.vencimiento) +
            '.\nSi ya abonó, desestime este mensaje. Informe su pago desde el portal para su verificación.',
          clave_idempotencia: 'REC-' + c.id + '-' + c.vencimiento });
        enviados++;
      });
    return { recordatorios: enviados };
  },

  seguimientoOportunidades: function (ctx) {
    var hoy = hoyIso_(), n = 0;
    Repo.todos('OPORTUNIDADES', function (o) { return o.estado === 'ABIERTA' && o.fecha_proxima_accion && o.fecha_proxima_accion <= hoy; })
      .forEach(function (o) {
        Alertas.crear(ctx, { tipo: 'SEGUIMIENTO_COMERCIAL', severidad: 'INFO', proyecto_id: o.proyecto_id, entidad: 'OPORTUNIDADES', entidad_id: o.id,
          mensaje: 'Acción comercial pendiente: ' + (o.proxima_accion || 'seguimiento') + ' (' + (o.asesor || 'sin asesor') + ')', clave_idempotencia: 'SEG-' + o.id + '-' + hoy });
        n++;
      });
    return { alertas: n };
  },

  seguimientoCesiones: function (ctx) {
    var hace15 = new Date(Date.now() - 15 * 86400000).toISOString(), n = 0;
    Repo.todos('CESIONES', function (c) { return ['RECHAZADA', 'FORMALIZADA', 'DESISTIDA'].indexOf(c.estado) < 0 && c.actualizado_en < hace15; })
      .forEach(function (c) {
        Alertas.crear(ctx, { tipo: 'CESION_DEMORADA', severidad: 'ADVERTENCIA', proyecto_id: c.proyecto_id, entidad: 'CESIONES', entidad_id: c.id,
          mensaje: 'Solicitud ' + c.id + ' sin movimiento hace más de 15 días (estado ' + c.estado + ').', clave_idempotencia: 'CESD-' + c.id + '-' + hoyIso_() });
        n++;
      });
    return { alertas: n };
  },

  reporteSemanal: function (ctx) {
    var dest = Configuracion.valor('email_alertas');
    var k = Dashboard.indicadores({ usuario: { rol: ROLES.SUPERADMIN } }, {});
    var lineas = ['Resumen semanal — ' + formatearFecha_(new Date()), ''];
    Object.keys(k.globales).forEach(function (x) { lineas.push(x + ': ' + k.globales[x]); });
    lineas.push('', 'Por fideicomiso:');
    k.porFideicomiso.forEach(function (f) { lineas.push('- ' + f.denominacion + ' [' + f.estado + ']: saldo $ ' + f.saldo + ', morosidad ' + f.morosidad_pct + '%, avance físico ' + f.avance_fisico + '%'); });
    var enviado = dest ? Notificar.email(dest, 'Reporte semanal', lineas.join('\n')) : false;
    return { enviado: enviado, lineas: lineas.length };
  }
};

var Respaldos = {
  carpeta: function () {
    var id = propiedad_(PROP.BACKUP_FOLDER_ID);
    if (!id) throw errorApp_('NO_INSTALADO', 'No está configurada la carpeta de respaldos.');
    return DriveApp.getFolderById(id);
  },

  crear: function (ctx, tipo) {
    var libro = dbLibro_();
    var nombre = 'RESPALDO_' + Utilities.formatDate(new Date(), APP.ZONA_HORARIA, 'yyyyMMdd_HHmmss') + '_' + (tipo || 'MANUAL');
    var copia = DriveApp.getFileById(libro.getId()).makeCopy(nombre, Respaldos.carpeta());
    var filas = libro.getSheets().reduce(function (s, h) { return s + Math.max(0, h.getLastRow() - 1); }, 0);
    var reg = Repo.crear('COPIAS_SEGURIDAD', { archivo_id: copia.getId(), nombre: nombre, tipo: tipo || 'MANUAL', hojas: libro.getSheets().length,
      filas: filas, estado: 'DISPONIBLE' }, ctx, { motivo: 'Copia de seguridad ' + (tipo || 'MANUAL') });
    if (tipo === 'AUTOMATICA') Respaldos.aplicarRetencion(ctx);
    return reg;
  },

  aplicarRetencion: function (ctx) {
    var max = Configuracion.numero('retencion_respaldos') || 30;
    var autos = Repo.todos('COPIAS_SEGURIDAD', function (b) { return b.tipo === 'AUTOMATICA' && b.estado === 'DISPONIBLE'; })
      .sort(function (a, b) { return a.creado_en < b.creado_en ? 1 : -1; });
    autos.slice(max).forEach(function (b) {
      try { DriveApp.getFileById(b.archivo_id).setTrashed(true); } catch (e) { /* ya eliminado */ }
      Repo.actualizar('COPIAS_SEGURIDAD', b.id, { estado: 'DEPURADA' }, ctx, { operacion: 'RETENCION_RESPALDO' });
    });
  },

  /**
   * Restaura hojas desde una copia. Antes crea una copia PRE_RESTAURACION.
   * AUDITORIA y COPIAS_SEGURIDAD nunca se restauran (la historia es de solo agregado).
   */
  restaurar: function (ctx, d) {
    if (ctx.usuario.rol !== ROLES.SUPERADMIN) throw errorApp_('PROHIBIDO', 'Solo el SUPERADMIN puede restaurar.');
    if (!d.confirmacion || d.confirmacion !== 'RESTAURAR') throw errorApp_('VALIDACION', 'Escriba RESTAURAR para confirmar.');
    if (!d.motivo) throw errorApp_('VALIDACION', 'Indique el motivo de la restauración.');
    var b = Repo.obtenerOFallar('COPIAS_SEGURIDAD', d.respaldo_id);
    if (b.estado !== 'DISPONIBLE') throw errorApp_('VALIDACION', 'La copia no está disponible.');
    var excluidas = ['AUDITORIA', 'COPIAS_SEGURIDAD', 'MIGRACIONES'];
    var hojas = (d.hojas && d.hojas.length ? d.hojas : esquemaHojas_()).filter(function (h) { return excluidas.indexOf(h) < 0 && ESQUEMA[h]; });
    var previa = Respaldos.crear(ctx, 'PRE_RESTAURACION');
    var origen = SpreadsheetApp.openById(b.archivo_id);
    var resumen = {};
    dbConLock_(function () {
      hojas.forEach(function (nombre) {
        var src = origen.getSheetByName(nombre);
        if (!src) { resumen[nombre] = 'no existe en la copia'; return; }
        var valores = src.getDataRange().getValues();
        var dst = dbHoja_(nombre);
        dst.clearContents();
        dst.getRange(1, 1, valores.length, valores[0].length).setValues(valores);
        dbInvalidar_(nombre);
        resumen[nombre] = valores.length - 1;
      });
    });
    Permisos._matriz = null; Configuracion._cache = null;
    Migraciones.asegurarEsquema(); // re-agrega columnas nuevas si la copia es anterior a una migración
    Repo.actualizar('COPIAS_SEGURIDAD', b.id, { restaurado_en: ahoraIso_(), restaurado_por: ctx.usuario.email }, ctx,
      { operacion: 'RESTAURACION', motivo: d.motivo + ' | copia previa: ' + previa.id + ' | ' + JSON.stringify(resumen) });
    return { restauradas: resumen, copia_previa: previa.id };
  }
};

/**
 * Integridad — Detecta ediciones directas en Google Sheets comparando la huella de cada fila,
 * valida su contenido, registra en auditoría y alerta inconsistencias.
 */
var Integridad = {
  verificar: function (ctx) {
    var inicio = Date.now();
    var informe = { hojas: 0, ediciones_externas: 0, inconsistencias: [], auditoria: null };
    esquemaHojas_().forEach(function (nombre) {
      if (Date.now() - inicio > APP.TIEMPO_MAX_EJECUCION_MS) return;
      informe.hojas++;
      var h = dbHoja_(nombre);
      var enc = h.getRange(1, 1, 1, Math.max(1, h.getLastColumn())).getValues()[0].map(String);
      var faltan = esquemaEncabezados_(nombre).filter(function (c) { return enc.indexOf(c) < 0; });
      if (faltan.length) { informe.inconsistencias.push({ hoja: nombre, problema: 'Faltan columnas: ' + faltan.join(', ') }); return; }
      dbInvalidar_(nombre);
      var filas = dbTabla_(nombre).filas;
      var vistos = {};
      // Filas sin id (agregadas a mano sin identificador)
      var crudos = h.getDataRange().getValues();
      for (var i = 1; i < crudos.length; i++) {
        if (!crudos[i][0] && crudos[i].some(function (v) { return v !== '' && v !== null; })) {
          informe.inconsistencias.push({ hoja: nombre, problema: 'Fila ' + (i + 1) + ' sin identificador' });
        }
      }
      filas.forEach(function (r) {
        if (vistos[r.id]) informe.inconsistencias.push({ hoja: nombre, id: r.id, problema: 'Identificador duplicado' });
        vistos[r.id] = true;
        if (nombre === 'AUDITORIA') return; // se valida por cadena de hashes
        if (r.huella === huellaRegistro_(nombre, r)) return;
        // Edición externa detectada
        try {
          Repo.validar(nombre, r, false);
          Repo.verificarIntegridad(nombre, r, r.id);
          if (HOJAS_SOLO_AGREGADO.indexOf(nombre) >= 0) throw errorApp_('PROHIBIDO', 'Hoja de solo agregado modificada manualmente');
          Auditoria.registrar(ctx, { operacion: 'EDICION_EXTERNA_VALIDADA', hoja: nombre, registro_id: r.id, proyecto_id: r.proyecto_id,
            valor_nuevo: Repo.ocultarSensibles(nombre, r), motivo: 'Edición directa en Google Sheets detectada y validada' });
          dbConLock_(function () {
            var nuevo = {}; Object.keys(r).forEach(function (k) { nuevo[k] = r[k]; });
            nuevo.version = (Number(r.version) || 0) + 1;
            nuevo.actualizado_en = ahoraIso_();
            nuevo.huella = huellaRegistro_(nombre, nuevo);
            var t = dbTabla_(nombre);
            h.getRange(r._fila, 1, 1, t.encabezados.length).setValues([dbFilaAArray_(t.encabezados, nuevo)]);
          });
          informe.ediciones_externas++;
        } catch (e) {
          informe.inconsistencias.push({ hoja: nombre, id: r.id, problema: e.message });
          Alertas.crear(ctx, { tipo: 'INCONSISTENCIA_DATOS', severidad: 'CRITICA', proyecto_id: r.proyecto_id, entidad: nombre, entidad_id: r.id,
            mensaje: 'Edición directa inválida en ' + nombre + ' ' + r.id + ': ' + e.message, clave_idempotencia: 'INT-' + nombre + '-' + r.id + '-' + r.huella });
        }
      });
      dbInvalidar_(nombre);
    });
    informe.auditoria = Auditoria.verificarCadena();
    if (!informe.auditoria.ok) {
      Alertas.crear(ctx, { tipo: 'AUDITORIA_ALTERADA', severidad: 'CRITICA', entidad: 'AUDITORIA', entidad_id: informe.auditoria.registro || '',
        mensaje: 'La cadena de auditoría está rota: ' + informe.auditoria.motivo, clave_idempotencia: 'AUDROTA-' + hoyIso_() });
    }
    return informe;
  },

  /** Disparador onEdit instalable: registra la edición y revierte cambios prohibidos de una sola celda. */
  alEditar: function (e) {
    if (!e || !e.range) return;
    var hoja = e.range.getSheet().getName();
    if (!ESQUEMA[hoja]) return;
    var ctx = { actor: (e.user && e.user.getEmail && e.user.getEmail()) || 'editor_hoja', origen: 'edicion_directa' };
    var unaCelda = e.range.getNumRows() === 1 && e.range.getNumColumns() === 1;
    var fila = e.range.getRow();
    var col = e.range.getColumn();
    var encabezado = String(e.range.getSheet().getRange(1, col).getValue());
    var idFila = fila > 1 ? String(e.range.getSheet().getRange(fila, 1).getValue()) : '';
    var revertir = '';
    if (fila === 1) revertir = 'No se modifican encabezados';
    else if (HOJAS_SOLO_AGREGADO.indexOf(hoja) >= 0) revertir = 'Hoja de solo agregado';
    else if (['id', 'creado_en', 'huella', 'version'].indexOf(encabezado) >= 0) revertir = 'Campo técnico protegido';
    else if (unaCelda) {
      var colDef = esquemaColumnas_(hoja).filter(function (c) { return c.nombre === encabezado; })[0];
      if (colDef && (colDef.tipo === 'ref' || colDef.tipo === 'refs') && e.value) {
        var malas = String(e.value).split(',').filter(function (x) { return x && !Repo.obtener(colDef.ref, x); });
        if (malas.length) revertir = 'Referencia inexistente: ' + malas.join(',');
      }
    }
    if (revertir && unaCelda && e.oldValue !== undefined) e.range.setValue(e.oldValue);
    else if (revertir && unaCelda) e.range.clearContent();
    Auditoria.registrar(ctx, { operacion: revertir ? 'EDICION_DIRECTA_REVERTIDA' : 'EDICION_DIRECTA', hoja: hoja, registro_id: idFila,
      valor_anterior: unaCelda ? { campo: encabezado, valor: e.oldValue } : { rango: e.range.getA1Notation() },
      valor_nuevo: unaCelda ? { campo: encabezado, valor: e.value } : null, motivo: revertir || 'Pendiente de validación por control de integridad',
      resultado: revertir ? 'REVERTIDO' : 'OK' });
    if (revertir && !unaCelda) {
      Alertas.crear(ctx, { tipo: 'EDICION_MULTIPLE_PROHIBIDA', severidad: 'CRITICA', entidad: hoja, entidad_id: idFila,
        mensaje: 'Edición de rango ' + e.range.getA1Notation() + ' en ' + hoja + ': ' + revertir + '. Restaure desde copia si corresponde.' });
    }
  }
};

var ACC_SISTEMA = {
  'alertas.listar': accion_('alertas', 'leer', function (ctx, d) {
    var alc = Permisos.filtroAlcance(ctx.usuario);
    return Repo.listar('ALERTAS', { filtro: alc, igual: { estado: d.estado || 'ABIERTA', proyecto_id: d.proyecto_id || '' }, pagina: d.pagina, tamanio: d.tamanio });
  }),
  'alertas.resolver': accion_('alertas', 'editar', function (ctx, d) { return Alertas.resolver(ctx, d.alerta_id, d.motivo); }),
  'tareas.aprobar': accion_('tareas', 'leer', function (ctx, d) { return Tareas.aprobar(ctx, d.tarea_id); }),
  'tareas.reintentar': accion_('tareas', 'leer', function (ctx, d) {
    if (ctx.usuario.rol !== ROLES.SUPERADMIN && ctx.usuario.rol !== ROLES.ADMINISTRADOR) throw errorApp_('PROHIBIDO', 'Sin permiso.');
    return Tareas.reintentar(ctx, d.tarea_id);
  }),
  'sistema.ejecutarTrabajo': accion_('configuracion', 'administrar', function (ctx, d) {
    var tipo = d.tipo;
    if (!MANEJADORES_TAREA[tipo]) throw errorApp_('VALIDACION', 'Trabajo inexistente.');
    Tareas.encolar(ctx, tipo, {}, tipo + '-MANUAL-' + Utilities.getUuid());
    return Tareas.procesar(ctx);
  }),
  'respaldos.crear': accion_('respaldos', 'crear', function (ctx) { return Respaldos.crear(ctx, 'MANUAL'); }),
  'respaldos.restaurar': accion_('respaldos', 'administrar', function (ctx, d) { return Respaldos.restaurar(ctx, d); }),
  'integridad.verificar': accion_('auditoria', 'leer', function (ctx) { return Integridad.verificar(ctx); }),
  'configuracion.guardar': accion_('configuracion', 'administrar', function (ctx, d) {
    if (!d.clave || !/^[a-z_]{3,60}$/.test(d.clave)) throw errorApp_('VALIDACION', 'Clave inválida.');
    if (/^color_/.test(d.clave) && !/^#[0-9a-fA-F]{6}$/.test(d.valor)) throw errorApp_('VALIDACION', 'Use un color hexadecimal #RRGGBB.');
    return Configuracion.guardar(ctx, d.clave, d.valor);
  }),
  'configuracion.todas': accion_('configuracion', 'leer', function () {
    return { valores: Configuracion.todas(), defectos: CONFIG_DEFECTO, whatsapp: WhatsApp.estado(), version: APP.VERSION,
      cuota_email_restante: MailApp.getRemainingDailyQuota() };
  })
};
