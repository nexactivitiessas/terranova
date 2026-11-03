/**
 * Esquema.js — Modelo de datos declarativo de Google Sheets.
 *
 * Cada hoja declara sus columnas con una mini-sintaxis:  'nombre|tipo|flags'
 *   tipos:  texto, numero, moneda, fecha, fechahora, bool, email, telefono, json, enum:<LISTA>, ref:<HOJA>, refs:<HOJA>
 *   flags:  req (obligatorio), unico, sensible (no se expone en listados públicos), pii (dato personal)
 *
 * Todas las hojas comparten las COLUMNAS_BASE (identificador estable, auditoría mínima y relación con proyecto).
 * Nunca se usan números de fila como identificadores.
 */
var COLUMNAS_BASE = [
  'id|texto|req,unico',
  'proyecto_id|ref:PROYECTOS',
  'estado|texto',
  'creado_en|fechahora|req',
  'actualizado_en|fechahora|req',
  'usuario_responsable|texto',
  'version|numero|req',
  'es_prueba|bool',
  'huella|texto'
];

var ESQUEMA = {
  CONFIGURACION: { prefijo: 'CFG', columnas: ['clave|texto|req,unico', 'valor|texto', 'descripcion|texto', 'publica|bool'] },
  USUARIOS: { prefijo: 'USR', columnas: ['email|email|req,unico,pii', 'nombre|texto|req,pii', 'rol|texto|req',
    'password_hash|texto|sensible', 'proyectos_asignados|refs:PROYECTOS', 'beneficiario_id|ref:BENEFICIARIOS',
    'intentos_fallidos|numero', 'bloqueado_hasta|fechahora', 'ultimo_acceso|fechahora',
    'reset_hash|texto|sensible', 'reset_expira|fechahora|sensible', 'debe_cambiar_password|bool'] },
  ROLES: { prefijo: 'ROL', columnas: ['codigo|texto|req,unico', 'nombre|texto|req', 'descripcion|texto', 'alcance|enum:GLOBAL,PROYECTO,PROPIO'] },
  PERMISOS: { prefijo: 'PRM', columnas: ['rol|texto|req', 'modulo|texto|req', 'accion|enum:leer,crear,editar,aprobar,exportar,administrar|req', 'permitido|bool|req'] },
  AUDITORIA: { prefijo: 'AUD', columnas: ['usuario|texto', 'operacion|texto|req', 'hoja|texto', 'registro_id|texto',
    'valor_anterior|json', 'valor_nuevo|json', 'motivo|texto', 'resultado|texto', 'aprobacion|texto', 'origen|texto',
    'hash_previo|texto', 'hash|texto'] },
  PROYECTOS: { prefijo: 'FID', columnas: ['denominacion|texto|req', 'tipo_fideicomiso|enum:ORDINARIO,FINANCIERO|req',
    'modalidad_oferta|enum:PRIVADA,PUBLICA|req', 'fiduciario_id|ref:FIDUCIARIOS', 'terreno_id|ref:TERRENOS', 'objeto|texto',
    'fecha_constitucion|fecha', 'plazo_contractual_meses|numero', 'fecha_estimada_entrega|fecha', 'presupuesto_total|moneda',
    'unidades_proyectadas|numero', 'estado_juridico|texto', 'estado_comercial|texto', 'estado_financiero|texto',
    'estado_constructivo|texto', 'publico|bool', 'descripcion_publica|texto', 'imagen_url|texto',
    'req_estructura_juridica_revisada|bool', 'req_contrato_aprobado|bool', 'req_responsables_identificados|bool',
    'req_presupuesto_validado|bool', 'req_cronograma|bool', 'req_reglas_aportes|bool', 'req_reglas_salida|bool',
    'req_publicidad_aprobada|bool', 'reglas_salida|texto', 'reglas_aportes|texto'] },
  TERRENOS: { prefijo: 'TER', columnas: ['propietario_id|ref:PROPIETARIOS', 'ubicacion|texto|req', 'direccion|texto',
    'superficie_m2|numero', 'medidas|texto', 'zonificacion|texto', 'servicios|texto', 'situacion_dominial|texto',
    'documentacion|texto', 'valuacion_estimada|moneda', 'precio_solicitado|moneda', 'modalidad_negociacion|texto',
    'responsable_comercial|texto', 'observaciones|texto', 'titularidad_verificada|bool', 'origen|texto'] },
  PROPIETARIOS: { prefijo: 'PRO', columnas: ['nombre|texto|req,pii', 'documento|texto|pii', 'email|email|pii',
    'telefono|telefono|pii', 'domicilio|texto|pii', 'consentimiento_contacto|bool', 'observaciones|texto'] },
  FIDUCIARIOS: { prefijo: 'FDR', columnas: ['razon_social|texto|req', 'cuit|texto', 'domicilio|texto', 'representante|texto', 'email|email', 'telefono|telefono'] },
  FIDUCIANTES: { prefijo: 'FDT', columnas: ['nombre|texto|req,pii', 'documento|texto|pii', 'email|email|pii', 'telefono|telefono|pii',
    'tipo_aporte|texto', 'contrato_id|ref:CONTRATOS'] },
  BENEFICIARIOS: { prefijo: 'BEN', columnas: ['nombre|texto|req,pii', 'documento|texto|req,pii', 'email|email|pii',
    'telefono|telefono|pii', 'domicilio|texto|pii', 'unidad_id|ref:UNIDADES', 'contrato_id|ref:CONTRATOS',
    'fecha_adhesion|fecha', 'estado_contractual|texto', 'consentimiento_comunicaciones|bool', 'observaciones|texto'] },
  UNIDADES: { prefijo: 'UNI', columnas: ['codigo|texto|req', 'tipo|texto', 'superficie_m2|numero', 'valor_referencia|moneda',
    'beneficiario_id|ref:BENEFICIARIOS', 'disponible|bool'] },
  CONTRATOS: { prefijo: 'CTR', columnas: ['tipo|enum:CONSTITUCION,ADHESION,APORTE_PRELIMINAR,CESION,OTRO|req', 'parte_id|texto',
    'fecha_firma|fecha', 'documento_id|ref:DOCUMENTOS', 'condiciones_salida|texto', 'condiciones_aporte|texto',
    'aprobado_por|texto', 'fecha_aprobacion|fecha'] },
  APORTES_PRELIMINARES: { prefijo: 'APP', columnas: ['aportante_nombre|texto|req,pii', 'aportante_contacto_id|ref:CONTACTOS_CRM',
    'fecha|fecha|req', 'importe|moneda|req', 'destino|texto', 'comprobante_id|ref:DOCUMENTOS', 'contrato_id|ref:CONTRATOS',
    'condicion|texto', 'beneficios_pactados|texto', 'saldo|moneda', 'verificado_por|texto', 'fecha_verificacion|fechahora', 'clave_idempotencia|texto|unico'] },
  MOVIMIENTOS: { prefijo: 'MOV', columnas: ['fecha|fecha|req', 'tipo|enum:' + 'APORTE_PRELIMINAR,APORTE_FIDUCIARIO,CUOTA_BENEFICIARIO,INGRESO_CESION,REINTEGRO,GASTO_PROYECTO,GASTO_PRELIMINAR,AJUSTE_COMPENSATORIO' + '|req',
    'sentido|enum:INGRESO,EGRESO|req', 'importe|moneda|req', 'moneda|texto', 'concepto|texto|req', 'origen_hoja|texto',
    'origen_id|texto', 'rectifica_id|ref:MOVIMIENTOS', 'clave_idempotencia|texto|unico', 'comprobante_id|ref:DOCUMENTOS'] },
  CUOTAS: { prefijo: 'CUO', columnas: ['beneficiario_id|ref:BENEFICIARIOS|req', 'unidad_id|ref:UNIDADES', 'plan_id|texto|req',
    'numero|numero|req', 'vencimiento|fecha|req', 'importe|moneda|req', 'pagado|moneda', 'saldo|moneda',
    'ajuste|moneda', 'interes_mora|moneda', 'clave_idempotencia|texto|unico'] },
  PAGOS: { prefijo: 'PAG', columnas: ['beneficiario_id|ref:BENEFICIARIOS|req', 'fecha|fecha|req', 'importe|moneda|req',
    'medio|texto', 'referencia_bancaria|texto', 'comprobante_id|ref:DOCUMENTOS', 'cuota_ids|refs:CUOTAS',
    'verificado_por|texto', 'fecha_verificacion|fechahora', 'motivo_rechazo|texto', 'movimiento_id|ref:MOVIMIENTOS',
    'cargado_por_beneficiario|bool', 'aplicacion|json', 'clave_idempotencia|texto|unico'] },
  GASTOS: { prefijo: 'GAS', columnas: ['fecha|fecha|req', 'categoria|texto|req', 'es_preliminar|bool', 'proveedor|texto',
    'importe|moneda|req', 'comprobante_id|ref:DOCUMENTOS', 'obra_id|ref:OBRAS', 'etapa_id|ref:ETAPAS_OBRA',
    'aprobado_por|texto', 'movimiento_id|ref:MOVIMIENTOS', 'concepto|texto', 'clave_idempotencia|texto|unico'] },
  PRESUPUESTOS: { prefijo: 'PRE', columnas: ['rubro|texto|req', 'importe|moneda|req', 'vigente_desde|fecha', 'validado_por|texto', 'obra_id|ref:OBRAS'] },
  OBRAS: { prefijo: 'OBR', columnas: ['nombre|texto|req', 'fecha_inicio_prevista|fecha', 'fecha_fin_prevista|fecha',
    'fecha_inicio_real|fecha', 'fecha_fin_real|fecha', 'presupuesto|moneda', 'responsable|texto', 'avance_fisico|numero', 'observaciones|texto'] },
  ETAPAS_OBRA: { prefijo: 'ETA', columnas: ['obra_id|ref:OBRAS|req', 'nombre|texto|req', 'orden|numero', 'peso_porcentual|numero|req',
    'responsable|texto', 'fecha_inicio_prevista|fecha', 'fecha_fin_prevista|fecha', 'fecha_inicio_real|fecha', 'fecha_fin_real|fecha',
    'presupuesto|moneda', 'avance_certificado|numero', 'desvio|texto', 'observaciones|texto'] },
  CERTIFICACIONES: { prefijo: 'CER', columnas: ['obra_id|ref:OBRAS|req', 'etapa_id|ref:ETAPAS_OBRA|req', 'fecha|fecha|req',
    'avance_porcentual|numero|req', 'importe_certificado|moneda', 'profesional|texto|req', 'documento_id|ref:DOCUMENTOS',
    'fotos|texto', 'aprobado_por|texto', 'fecha_aprobacion|fechahora', 'observaciones|texto'] },
  DOCUMENTOS: { prefijo: 'DOC', columnas: ['titulo|texto|req', 'tipo|texto', 'drive_file_id|texto', 'url|texto',
    'entidad|texto', 'entidad_id|texto', 'visible_beneficiario|bool', 'publico|bool', 'aprobado_por|texto'] },
  CESIONES: { prefijo: 'CES', columnas: ['beneficiario_id|ref:BENEFICIARIOS|req', 'unidad_id|ref:UNIDADES', 'alternativa|enum:CESION_DERECHOS,SUSTITUCION_BENEFICIARIO,RESOLUCION_CONTRACTUAL,REEMBOLSO,OTRA|req',
    'motivo|texto|req', 'fecha_solicitud|fecha|req', 'cuotas_abonadas|numero', 'total_abonado|moneda', 'obligaciones_pendientes|moneda',
    'derechos_contractuales|texto', 'condiciones_contrato|texto', 'cesionarios_potenciales|json', 'escenarios|json',
    'responsable|texto', 'decision|enum:APROBADA,RECHAZADA', 'decidido_por|texto', 'fecha_decision|fechahora',
    'fundamento_decision|texto', 'documento_id|ref:DOCUMENTOS', 'nuevo_beneficiario_id|ref:BENEFICIARIOS'] },
  DESVINCULACIONES: { prefijo: 'DES', columnas: ['cesion_id|ref:CESIONES|req', 'beneficiario_id|ref:BENEFICIARIOS|req',
    'fecha|fecha|req', 'tipo|texto', 'importe_reintegro|moneda', 'movimiento_id|ref:MOVIMIENTOS', 'aprobado_por|texto', 'observaciones|texto'] },
  CONTACTOS_CRM: { prefijo: 'CRM', columnas: ['nombre|texto|req,pii', 'email|email|pii', 'telefono|telefono|pii',
    'fuente|enum:WEB,WHATSAPP,YOUTUBE,X,INSTAGRAM,FACEBOOK,FORMULARIO,REFERIDO,OTRA|req',
    'clasificacion|enum:PROPIETARIO_TERRENO,APORTANTE_PRELIMINAR,BENEFICIARIO_POTENCIAL,INVERSOR,CONSULTA_GENERAL|req',
    'mensaje|texto', 'asesor|texto', 'consentimiento|bool', 'fecha_consentimiento|fechahora', 'baja_comunicaciones|bool',
    'preferencias|json', 'proximo_seguimiento|fecha'] },
  CONVERSACIONES: { prefijo: 'CNV', columnas: ['contacto_id|ref:CONTACTOS_CRM|req', 'canal|texto|req', 'direccion|enum:ENTRANTE,SALIENTE|req',
    'mensaje|texto|req', 'fecha|fechahora|req', 'enviado_por|texto', 'id_externo|texto'] },
  OPORTUNIDADES: { prefijo: 'OPO', columnas: ['contacto_id|ref:CONTACTOS_CRM|req', 'etapa|texto|req', 'valor_estimado|moneda',
    'probabilidad|numero', 'asesor|texto', 'proxima_accion|texto', 'fecha_proxima_accion|fecha', 'motivo_descarte|texto'] },
  'CAMPAÑAS': { prefijo: 'CAM', columnas: ['nombre|texto|req', 'objetivo|texto', 'plataformas|texto', 'fecha_inicio|fecha', 'fecha_fin|fecha', 'presupuesto|moneda'] },
  CONTENIDOS: { prefijo: 'CON', columnas: ['titulo|texto|req', 'tema|texto', 'campania_id|ref:CAMPAÑAS', 'formatos|texto',
    'guion_id|ref:GUIONES', 'audio_id|ref:AUDIOS', 'video_id|ref:VIDEOS', 'portada_url|texto', 'subtitulos_url|texto',
    'revision_juridica|json', 'aprobado_por|texto', 'fecha_aprobacion|fechahora', 'motivo_rechazo|texto'] },
  GUIONES: { prefijo: 'GUI', columnas: ['contenido_id|ref:CONTENIDOS|req', 'texto|texto|req', 'formato|texto', 'duracion_seg|numero', 'agente|texto', 'revisado_por|texto'] },
  AUDIOS: { prefijo: 'AUA', columnas: ['contenido_id|ref:CONTENIDOS|req', 'archivo_url|texto', 'motor_tts|texto', 'duracion_seg|numero'] },
  VIDEOS: { prefijo: 'VID', columnas: ['contenido_id|ref:CONTENIDOS|req', 'formato|enum:YOUTUBE_HORIZONTAL,SHORTS_VERTICAL,X,INSTAGRAM_REELS,FACEBOOK|req',
    'archivo_url|texto', 'duracion_seg|numero', 'revisado_por|texto'] },
  PUBLICACIONES: { prefijo: 'PUB', columnas: ['contenido_id|ref:CONTENIDOS|req', 'plataforma|texto|req', 'fecha_programada|fechahora',
    'fecha_publicada|fechahora', 'enlace|texto', 'publicado_por|texto', 'metricas|json', 'modo|enum:MANUAL,AUTOMATICO'] },
  AGENTES: { prefijo: 'AGT', columnas: ['codigo|texto|req,unico', 'nombre|texto|req', 'funcion|texto',
    'modalidad|enum:MANUAL_CLAUDE_CODE,LOCAL_GRATUITO,REGLAS_APPS_SCRIPT|req', 'ejecuta_en|texto', 'prompt_archivo|texto', 'ultima_ejecucion|fechahora'] },
  TAREAS: { prefijo: 'TAR', columnas: ['tipo|texto|req', 'payload|json', 'clave_idempotencia|texto|unico', 'intentos|numero',
    'ultimo_error|texto', 'programada_para|fechahora', 'resultado|json', 'requiere_aprobacion_de|texto'] },
  ALERTAS: { prefijo: 'ALE', columnas: ['tipo|texto|req', 'severidad|enum:INFO,ADVERTENCIA,CRITICA|req', 'mensaje|texto|req',
    'entidad|texto', 'entidad_id|texto', 'clave_idempotencia|texto|unico', 'resuelta_por|texto', 'fecha_resolucion|fechahora'] },
  NOTIFICACIONES: { prefijo: 'NOT', columnas: ['destinatario|texto|req', 'canal|enum:EMAIL,PORTAL,WHATSAPP|req', 'asunto|texto',
    'mensaje|texto|req', 'enviada_en|fechahora', 'error|texto', 'clave_idempotencia|texto|unico'] },
  COPIAS_SEGURIDAD: { prefijo: 'BAK', columnas: ['archivo_id|texto|req', 'nombre|texto', 'tipo|enum:AUTOMATICA,MANUAL,PRE_RESTAURACION', 'hojas|numero', 'filas|numero', 'restaurado_en|fechahora', 'restaurado_por|texto'] },
  // Hojas técnicas adicionales (documentadas en MODELO_DE_DATOS.md)
  MIGRACIONES: { prefijo: 'MIG', columnas: ['numero|numero|req,unico', 'descripcion|texto', 'aplicada_en|fechahora'] }
};

/** Hojas que solo admiten agregado desde la aplicación (sin edición ni borrado). */
var HOJAS_SOLO_AGREGADO = ['AUDITORIA', 'MOVIMIENTOS', 'CONVERSACIONES'];

/** Hojas que no requieren proyecto_id obligatoriamente (entidades globales). */
var HOJAS_GLOBALES = ['CONFIGURACION', 'USUARIOS', 'ROLES', 'PERMISOS', 'AUDITORIA', 'PROPIETARIOS', 'FIDUCIARIOS',
  'CONTACTOS_CRM', 'CONVERSACIONES', 'AGENTES', 'TAREAS', 'COPIAS_SEGURIDAD', 'MIGRACIONES', 'TERRENOS',
  'OPORTUNIDADES', 'CAMPAÑAS', 'CONTENIDOS', 'GUIONES', 'AUDIOS', 'VIDEOS', 'PUBLICACIONES', 'ALERTAS', 'NOTIFICACIONES', 'PROYECTOS'];

/** Devuelve las columnas parseadas de una hoja: [{nombre, tipo, ref, req, unico, sensible, pii, opciones}] */
function esquemaColumnas_(hoja) {
  var def = ESQUEMA[hoja];
  if (!def) throw errorApp_('ESQUEMA', 'Hoja inexistente en el esquema: ' + hoja);
  if (def._cache) return def._cache;
  var todas = COLUMNAS_BASE.concat(def.columnas);
  var vistos = {};
  var res = [];
  todas.forEach(function (spec) {
    var p = spec.split('|');
    var nombre = p[0];
    if (vistos[nombre]) return;
    vistos[nombre] = true;
    var tipo = p[1] || 'texto';
    var flags = (p[2] || '').split(',');
    var col = { nombre: nombre, tipo: tipo, req: flags.indexOf('req') >= 0, unico: flags.indexOf('unico') >= 0,
      sensible: flags.indexOf('sensible') >= 0, pii: flags.indexOf('pii') >= 0 };
    if (tipo.indexOf('enum:') === 0) { col.opciones = tipo.substring(5).split(','); col.tipo = 'enum'; }
    if (tipo.indexOf('ref:') === 0) { col.ref = tipo.substring(4); col.tipo = 'ref'; }
    if (tipo.indexOf('refs:') === 0) { col.ref = tipo.substring(5); col.tipo = 'refs'; }
    res.push(col);
  });
  def._cache = res;
  return res;
}

function esquemaEncabezados_(hoja) {
  return esquemaColumnas_(hoja).map(function (c) { return c.nombre; });
}

function esquemaHojas_() {
  return Object.keys(ESQUEMA);
}
