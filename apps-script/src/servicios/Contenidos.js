/**
 * Contenidos.js — Fábrica de contenidos, revisor jurídico por reglas, calendario editorial y centro de agentes.
 *
 * Los agentes de esta plataforma NO usan APIs pagas de IA. Modalidades:
 *  - REGLAS_APPS_SCRIPT: lógica determinística que corre en la nube de Google (revisor, analista, monitor, clasificador).
 *  - MANUAL_CLAUDE_CODE: el operador ejecuta el prompt del agente (carpeta /agentes) con Claude Code y pega el resultado.
 *  - LOCAL_GRATUITO: scripts locales (FFmpeg, TTS libre) en la computadora del operador (tools/fabrica).
 * Ningún contenido se publica sin aprobación humana del SUPERADMIN.
 */
var FLUJO_CONTENIDO = ['TEMA', 'INVESTIGACION', 'PLANIFICACION', 'GUION', 'REVISION_JURIDICA_COMERCIAL', 'GUION_APROBADO', 'AUDIO',
  'IMAGENES', 'EDICION', 'SUBTITULOS', 'REVISION_TECNICA', 'PENDIENTE_APROBACION_FINAL'];

var REGLAS_REVISOR = [
  { re: /rentabilidad(es)?\s+(garantizad|asegurad|fij)/i, sev: 'CRITICA', msg: 'Promete rentabilidad garantizada/fija.' },
  { re: /\bgarantiz(a|amos|ado|ada|ados|adas)\b/i, sev: 'CRITICA', msg: 'Uso de "garantía": solo si surge del contrato y fue validado jurídicamente.' },
  { re: /sin\s+riesgos?|riesgo\s+cero|cero\s+riesgo|100\s*%\s*segur/i, sev: 'CRITICA', msg: 'Afirma ausencia de riesgo.' },
  { re: /ganancia\s+segura|inversi[oó]n\s+segura|duplic[aá]\s+tu|multiplic[aá]\s+tu/i, sev: 'CRITICA', msg: 'Promesa de ganancia.' },
  { re: /devoluci[oó]n\s+(asegurad|garantizad|inmediat)|reintegro\s+(asegurad|garantizad)/i, sev: 'CRITICA', msg: 'Promete devolución/reintegro.' },
  { re: /entrega\s+(asegurad|garantizad|inmediat)|plazo\s+(asegurad|garantizad)/i, sev: 'CRITICA', msg: 'Promete plazos incondicionales.' },
  { re: /liquidez\s+(asegurad|garantizad|inmediat)|siempre\s+(pod[eé]s|vas\s+a\s+poder)\s+vender/i, sev: 'CRITICA', msg: 'Promete liquidez o salida.' },
  { re: /oferta\s+p[uú]blica|cotiza|acciones|valores\s+negociables/i, sev: 'ADVERTENCIA', msg: 'Términos de mercado de capitales: requiere revisión regulatoria.' },
  { re: /\d+\s*%\s*(anual|mensual|de\s+renta|de\s+rentabilidad|de\s+ganancia)/i, sev: 'ADVERTENCIA', msg: 'Porcentaje de rendimiento: debe estar respaldado documentalmente.' },
  { re: /cuotas?\s+fijas?|sin\s+ajuste|precio\s+congelado/i, sev: 'ADVERTENCIA', msg: 'Cuotas fijas/sin ajuste: verificar contra el contrato.' },
  { re: /[uú]ltimas?\s+unidades|solo\s+por\s+hoy|aprovech[aá]\s+ya/i, sev: 'ADVERTENCIA', msg: 'Urgencia comercial: evitar presión indebida.' },
  { re: /los\s+mejores|el\s+mejor|n[uú]mero\s+uno|l[ií]der/i, sev: 'INFO', msg: 'Superlativo publicitario: verificar sustento.' }
];

var Revisor = {
  /** Revisión jurídico-comercial determinística. NO reemplaza el dictamen de un profesional. */
  revisar: function (texto, proyectoId) {
    var hallazgos = [];
    var t = String(texto || '');
    REGLAS_REVISOR.forEach(function (r) {
      var m = t.match(r.re);
      if (m) hallazgos.push({ severidad: r.sev, mensaje: r.msg, fragmento: m[0] });
    });
    if (!/no\s+constituye\s+oferta|condiciones\s+.*contrato|sujeto\s+a\s+contrato|informaci[oó]n\s+orientativa/i.test(t)) {
      hallazgos.push({ severidad: 'ADVERTENCIA', mensaje: 'Falta aviso legal: indicar que las condiciones surgen del contrato y no constituye oferta.', fragmento: '' });
    }
    if (proyectoId) {
      var f = Repo.obtener('PROYECTOS', proyectoId);
      if (f && ['COMERCIALIZACION', 'EJECUCION'].indexOf(f.estado) < 0 && /(adher|reserv|suscrib|compr|invert)[ií]?/i.test(t)) {
        hallazgos.push({ severidad: 'CRITICA', mensaje: 'Llamado a adherir/invertir en un fideicomiso que no está habilitado comercialmente (' + f.estado + ').', fragmento: f.denominacion });
      }
    }
    var criticas = hallazgos.filter(function (h) { return h.severidad === 'CRITICA'; }).length;
    return { apto: criticas === 0, criticas: criticas, hallazgos: hallazgos, fecha: ahoraIso_(),
      aviso: 'Revisión automática por reglas. No reemplaza el dictamen jurídico humano.' };
  }
};

var Contenidos = {
  crear: function (ctx, d) {
    return Repo.crear('CONTENIDOS', { titulo: d.titulo, tema: d.tema || '', proyecto_id: d.proyecto_id || '', campania_id: d.campania_id || '',
      formatos: d.formatos || 'YOUTUBE_HORIZONTAL,SHORTS_VERTICAL', estado: 'TEMA' }, ctx);
  },

  guardarGuion: function (ctx, d) {
    var c = Repo.obtenerOFallar('CONTENIDOS', d.contenido_id);
    if (['APROBADO', 'PUBLICADO'].indexOf(c.estado) >= 0) throw errorApp_('PROHIBIDO', 'El contenido aprobado no puede modificarse. Cree una nueva versión.');
    var g = Repo.crear('GUIONES', { contenido_id: c.id, proyecto_id: c.proyecto_id, texto: d.texto, formato: d.formato || '', duracion_seg: d.duracion_seg || '',
      agente: d.agente || 'MANUAL', estado: 'BORRADOR' }, ctx);
    var rev = Revisor.revisar(d.texto, c.proyecto_id);
    Repo.actualizar('CONTENIDOS', c.id, { guion_id: g.id, estado: 'REVISION_JURIDICA_COMERCIAL', revision_juridica: JSON.stringify(rev) }, ctx,
      { operacion: 'GUION_CARGADO' });
    return { guion: g, revision: rev };
  },

  avanzar: function (ctx, d) {
    var c = Repo.obtenerOFallar('CONTENIDOS', d.contenido_id);
    var i = FLUJO_CONTENIDO.indexOf(c.estado);
    var destino = d.estado;
    var j = FLUJO_CONTENIDO.indexOf(destino);
    if (j < 0) throw errorApp_('VALIDACION', 'Estado inválido para avanzar. Use aprobarFinal() para aprobar o rechazar.');
    if (j !== i + 1 && !(j < i)) throw errorApp_('TRANSICION', 'No se pueden saltear etapas del flujo de producción.');
    if (destino === 'GUION_APROBADO') {
      Permisos.exigir(ctx.usuario, 'contenidos', 'aprobar');
      var rev = JSON.parse(c.revision_juridica || '{}');
      if (!c.guion_id) throw errorApp_('VALIDACION', 'No hay guion cargado.');
      if (rev.criticas > 0) {
        var jur = ctx.usuario.rol === ROLES.ASESOR_JURIDICO || ctx.usuario.rol === ROLES.SUPERADMIN;
        if (!jur || !d.motivo) throw errorApp_('REVISION_JURIDICA', 'El guion tiene ' + rev.criticas + ' observación(es) crítica(s). Corríjalo o un asesor jurídico debe justificar su aprobación.');
      }
      Repo.actualizar('GUIONES', c.guion_id, { estado: 'APROBADO', revisado_por: ctx.usuario.email }, ctx, { operacion: 'APROBACION_GUION', motivo: d.motivo || '' });
    }
    var cambios = { estado: destino };
    ['audio_id', 'video_id', 'portada_url', 'subtitulos_url'].forEach(function (k) { if (d[k]) cambios[k] = d[k]; });
    return Repo.actualizar('CONTENIDOS', c.id, cambios, ctx, { operacion: 'AVANCE_PRODUCCION', motivo: d.motivo || '' });
  },

  /** Aprobación o rechazo final: exclusiva del SUPERADMIN. */
  aprobarFinal: function (ctx, d) {
    if (ctx.usuario.rol !== ROLES.SUPERADMIN) throw errorApp_('PROHIBIDO', 'Solo el SUPERADMIN aprueba contenidos para publicar.');
    var c = Repo.obtenerOFallar('CONTENIDOS', d.contenido_id);
    if (c.estado !== 'PENDIENTE_APROBACION_FINAL') throw errorApp_('TRANSICION', 'El contenido no está pendiente de aprobación final.');
    if (d.aprobar === false) {
      if (!d.motivo) throw errorApp_('VALIDACION', 'Indique el motivo del rechazo.');
      return Repo.actualizar('CONTENIDOS', c.id, { estado: 'RECHAZADO', motivo_rechazo: d.motivo }, ctx, { operacion: 'RECHAZO_CONTENIDO', motivo: d.motivo });
    }
    if (!c.video_id && !c.guion_id) throw errorApp_('VALIDACION', 'No hay piezas para aprobar.');
    return Repo.actualizar('CONTENIDOS', c.id, { estado: 'APROBADO', aprobado_por: ctx.usuario.email, fecha_aprobacion: ahoraIso_() }, ctx,
      { operacion: 'APROBACION_CONTENIDO', aprobacion: ctx.usuario.email, motivo: d.motivo || '' });
  },

  programar: function (ctx, d) {
    var c = Repo.obtenerOFallar('CONTENIDOS', d.contenido_id);
    if (c.estado !== 'APROBADO' && c.estado !== 'PUBLICADO') throw errorApp_('NO_APROBADO', 'Nunca se publica contenido no aprobado.');
    return Repo.crear('PUBLICACIONES', { contenido_id: c.id, proyecto_id: c.proyecto_id, plataforma: d.plataforma, fecha_programada: d.fecha_programada,
      modo: 'MANUAL', estado: 'PROGRAMADA' }, ctx);
  },

  registrarPublicada: function (ctx, d) {
    var p = Repo.obtenerOFallar('PUBLICACIONES', d.publicacion_id);
    var c = Repo.obtenerOFallar('CONTENIDOS', p.contenido_id);
    if (c.estado !== 'APROBADO' && c.estado !== 'PUBLICADO') throw errorApp_('NO_APROBADO', 'El contenido no está aprobado.');
    if (!/^https:\/\//.test(String(d.enlace || ''))) throw errorApp_('VALIDACION', 'Ingrese el enlace https de la publicación.');
    var r = Repo.actualizar('PUBLICACIONES', p.id, { estado: 'PUBLICADA', fecha_publicada: ahoraIso_(), enlace: d.enlace, publicado_por: ctx.usuario.email }, ctx,
      { operacion: 'PUBLICACION_REGISTRADA' });
    if (c.estado !== 'PUBLICADO') Repo.actualizar('CONTENIDOS', c.id, { estado: 'PUBLICADO' }, ctx, { operacion: 'PUBLICADO' });
    return r;
  },

  registrarMetricas: function (ctx, d) {
    return Repo.actualizar('PUBLICACIONES', d.publicacion_id, { metricas: JSON.stringify(d.metricas || {}) }, ctx, { operacion: 'METRICAS' });
  }
};

/** Definición de los 12 agentes (se siembra en la hoja AGENTES). */
var AGENTES_DEFECTO = [
  { codigo: 'INVESTIGADOR', nombre: 'Investigador', modalidad: 'MANUAL_CLAUDE_CODE', funcion: 'Busca temas de educación y marketing inmobiliario.' },
  { codigo: 'ESTRATEGA', nombre: 'Estratega', modalidad: 'MANUAL_CLAUDE_CODE', funcion: 'Planifica campañas y calendario de contenidos.' },
  { codigo: 'GUIONISTA', nombre: 'Guionista', modalidad: 'MANUAL_CLAUDE_CODE', funcion: 'Redacta guiones para YouTube, Shorts, Reels y X.' },
  { codigo: 'REVISOR_JURIDICO', nombre: 'Revisor jurídico', modalidad: 'REGLAS_APPS_SCRIPT', funcion: 'Detecta promesas y afirmaciones riesgosas. No reemplaza dictamen humano.' },
  { codigo: 'GENERADOR_AUDIO', nombre: 'Generador de audio', modalidad: 'LOCAL_GRATUITO', funcion: 'Sintetiza voz con motores libres locales (Piper / espeak-ng).' },
  { codigo: 'PRODUCTOR_AUDIOVISUAL', nombre: 'Productor audiovisual', modalidad: 'LOCAL_GRATUITO', funcion: 'Combina audio, imágenes y subtítulos con FFmpeg.' },
  { codigo: 'EDITOR', nombre: 'Editor', modalidad: 'LOCAL_GRATUITO', funcion: 'Controla calidad técnica (duración, resolución, audio) con ffprobe.' },
  { codigo: 'PUBLICADOR', nombre: 'Publicador', modalidad: 'MANUAL_CLAUDE_CODE', funcion: 'Prepara textos y paquetes por red social para publicación manual.' },
  { codigo: 'ASESOR_COMERCIAL', nombre: 'Asesor comercial', modalidad: 'REGLAS_APPS_SCRIPT', funcion: 'Clasifica consultas y sugiere respuestas desde plantillas aprobadas.' },
  { codigo: 'ATENCION_BENEFICIARIO', nombre: 'Atención al beneficiario', modalidad: 'REGLAS_APPS_SCRIPT', funcion: 'Responde con información autorizada del portal.' },
  { codigo: 'ANALISTA_FINANCIERO', nombre: 'Analista financiero', modalidad: 'REGLAS_APPS_SCRIPT', funcion: 'Reportes de saldo, morosidad y desvíos por fideicomiso.' },
  { codigo: 'MONITOR_PROYECTOS', nombre: 'Monitor de proyectos', modalidad: 'REGLAS_APPS_SCRIPT', funcion: 'Controla cronogramas y genera alertas.' }
];

var REGLAS_CLASIFICACION = [
  { clase: 'PROPIETARIO_TERRENO', re: /terreno|lote|propiedad\s+para|vend(o|er)\s+(mi|un)\s+(terreno|lote)|permuta/i,
    respuesta: 'Gracias por ofrecernos su terreno. Para evaluarlo necesitamos ubicación, superficie y situación dominial. La recepción no implica aceptación.' },
  { clase: 'APORTANTE_PRELIMINAR', re: /aporte\s+preliminar|pozo|etapa\s+inicial|fondo\s+inicial/i,
    respuesta: 'Los aportes preliminares se rigen exclusivamente por el instrumento jurídico de cada proyecto. Un asesor le enviará la documentación.' },
  { clase: 'INVERSOR', re: /invert|inversi[oó]n|rentabilidad|renta/i,
    respuesta: 'No ofrecemos rentabilidades garantizadas. Podemos explicarle cómo funciona el fideicomiso y sus riesgos. Un asesor lo contactará.' },
  { clase: 'BENEFICIARIO_POTENCIAL', re: /departamento|unidad|cuota|vivienda|adherir|plan/i,
    respuesta: 'Gracias por su interés. Le enviaremos información de los proyectos habilitados y las condiciones contractuales vigentes.' }
];

var Agentes = {
  clasificarConsulta: function (texto) {
    for (var i = 0; i < REGLAS_CLASIFICACION.length; i++) {
      if (REGLAS_CLASIFICACION[i].re.test(texto)) return { clasificacion: REGLAS_CLASIFICACION[i].clase, respuesta_sugerida: REGLAS_CLASIFICACION[i].respuesta, requiere_revision_humana: true };
    }
    return { clasificacion: 'CONSULTA_GENERAL', respuesta_sugerida: 'Gracias por su consulta. Un asesor le responderá a la brevedad.', requiere_revision_humana: true };
  },

  ejecutar: function (ctx, codigo, d) {
    var a = Repo.buscarPor('AGENTES', 'codigo', codigo);
    if (!a) throw errorApp_('NO_ENCONTRADO', 'Agente inexistente.');
    if (a.modalidad !== 'REGLAS_APPS_SCRIPT') {
      return { ejecutado: false, modalidad: a.modalidad, instrucciones: a.modalidad === 'MANUAL_CLAUDE_CODE'
        ? 'Este agente se ejecuta manualmente con Claude Code usando ' + (a.prompt_archivo || 'agentes/' + codigo.toLowerCase() + '.md') + '. Cargue el resultado en el módulo correspondiente.'
        : 'Este agente corre en una computadora local con tools/fabrica. No funciona en la nube.' };
    }
    var r;
    switch (codigo) {
      case 'REVISOR_JURIDICO': r = Revisor.revisar(d.texto, d.proyecto_id); break;
      case 'ASESOR_COMERCIAL': r = Agentes.clasificarConsulta(String(d.texto || '')); break;
      case 'ANALISTA_FINANCIERO':
        r = Repo.todos('PROYECTOS', Permisos.filtroAlcance(ctx.usuario) || null).map(function (f) {
          return { fideicomiso: f.denominacion, id: f.id, saldo: Finanzas.saldoProyecto(f.id), morosos: Finanzas.morosidad(f.id).length };
        });
        break;
      case 'MONITOR_PROYECTOS': r = Obras.controlar(ctx); break;
      case 'ATENCION_BENEFICIARIO': r = { aviso: 'Disponible en el portal del beneficiario: responde solo con su información autorizada.' }; break;
      default: throw errorApp_('NO_IMPLEMENTADO', 'Agente sin implementación por reglas.');
    }
    Repo.actualizar('AGENTES', a.id, { ultima_ejecucion: ahoraIso_() }, ctx, { sinAuditoria: true });
    return { ejecutado: true, resultado: r };
  }
};

var ACC_CONTENIDOS = {
  'contenidos.crear': accion_('contenidos', 'crear', function (ctx, d) { return Contenidos.crear(ctx, d); }),
  'contenidos.guardarGuion': accion_('contenidos', 'editar', function (ctx, d) { return Contenidos.guardarGuion(ctx, d); }),
  'contenidos.avanzar': accion_('contenidos', 'editar', function (ctx, d) { return Contenidos.avanzar(ctx, d); }),
  'contenidos.aprobarFinal': accion_('contenidos', 'aprobar', function (ctx, d) { return Contenidos.aprobarFinal(ctx, d); }),
  'contenidos.revisarTexto': accion_('contenidos', 'leer', function (ctx, d) { return Revisor.revisar(d.texto, d.proyecto_id); }),
  'publicaciones.programar': accion_('publicaciones', 'crear', function (ctx, d) { return Contenidos.programar(ctx, d); }),
  'publicaciones.registrarPublicada': accion_('publicaciones', 'editar', function (ctx, d) { return Contenidos.registrarPublicada(ctx, d); }),
  'publicaciones.metricas': accion_('publicaciones', 'editar', function (ctx, d) { return Contenidos.registrarMetricas(ctx, d); }),
  'agentes.ejecutar': accion_('agentes', 'leer', function (ctx, d) { return Agentes.ejecutar(ctx, d.codigo, d); })
};
