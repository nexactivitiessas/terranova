/**
 * Datos.js — CRUD genérico controlado por permisos y reglas por hoja.
 *
 * Las operaciones con efectos contables, contractuales o de aprobación NO se hacen por aquí: tienen servicios
 * específicos (camposBloqueados / soloLectura). Esto evita, por ejemplo, marcar un pago como ACREDITADO
 * editando un campo, o aprobar una cesión sin el flujo de decisión.
 */
var HOJAS_API = {
  CONFIGURACION: { modulo: 'configuracion', soloLectura: true },
  USUARIOS: { modulo: 'usuarios', soloLectura: true },
  ROLES: { modulo: 'usuarios', soloLectura: true },
  PERMISOS: { modulo: 'usuarios', camposBloqueados: [] , permisoEscritura: 'administrar' },
  AUDITORIA: { modulo: 'auditoria', soloLectura: true },
  PROYECTOS: { modulo: 'fideicomisos', camposBloqueados: ['estado', 'req_estructura_juridica_revisada', 'req_contrato_aprobado',
    'req_responsables_identificados', 'req_presupuesto_validado', 'req_cronograma', 'req_reglas_aportes', 'req_reglas_salida',
    'req_publicidad_aprobada'], crearPorServicio: true },
  TERRENOS: { modulo: 'terrenos', camposBloqueados: ['titularidad_verificada'] },
  PROPIETARIOS: { modulo: 'terrenos' },
  FIDUCIARIOS: { modulo: 'fideicomisos' },
  FIDUCIANTES: { modulo: 'fideicomisos' },
  BENEFICIARIOS: { modulo: 'beneficiarios' },
  UNIDADES: { modulo: 'fideicomisos' },
  CONTRATOS: { modulo: 'documentos', camposBloqueados: ['aprobado_por', 'fecha_aprobacion'] },
  APORTES_PRELIMINARES: { modulo: 'preliminar', camposBloqueados: ['estado', 'verificado_por', 'fecha_verificacion', 'saldo'] },
  MOVIMIENTOS: { modulo: 'finanzas', soloLectura: true },
  CUOTAS: { modulo: 'cuotas', soloLectura: true },
  PAGOS: { modulo: 'pagos', soloLectura: true },
  GASTOS: { modulo: 'finanzas', soloLectura: true },
  PRESUPUESTOS: { modulo: 'finanzas', camposBloqueados: ['validado_por'] },
  OBRAS: { modulo: 'obras', camposBloqueados: ['avance_fisico'] },
  ETAPAS_OBRA: { modulo: 'obras', camposBloqueados: ['avance_certificado'] },
  CERTIFICACIONES: { modulo: 'obras', camposBloqueados: ['estado', 'aprobado_por', 'fecha_aprobacion'] },
  DOCUMENTOS: { modulo: 'documentos', camposBloqueados: ['aprobado_por', 'publico'] },
  CESIONES: { modulo: 'cesiones', soloLectura: true },
  DESVINCULACIONES: { modulo: 'cesiones', soloLectura: true },
  CONTACTOS_CRM: { modulo: 'crm' },
  CONVERSACIONES: { modulo: 'crm' },
  OPORTUNIDADES: { modulo: 'crm' },
  'CAMPAÑAS': { modulo: 'contenidos' },
  CONTENIDOS: { modulo: 'contenidos', camposBloqueados: ['estado', 'aprobado_por', 'fecha_aprobacion', 'revision_juridica'] },
  GUIONES: { modulo: 'contenidos' },
  AUDIOS: { modulo: 'contenidos' },
  VIDEOS: { modulo: 'contenidos' },
  PUBLICACIONES: { modulo: 'publicaciones', soloLectura: true },
  AGENTES: { modulo: 'agentes' },
  TAREAS: { modulo: 'tareas', soloLectura: true },
  ALERTAS: { modulo: 'alertas', soloLectura: true },
  NOTIFICACIONES: { modulo: 'alertas', soloLectura: true },
  COPIAS_SEGURIDAD: { modulo: 'respaldos', soloLectura: true },
  MIGRACIONES: { modulo: 'configuracion', soloLectura: true }
};

function datosDefHoja_(hoja) {
  var d = HOJAS_API[hoja];
  if (!d) throw errorApp_('SOLICITUD', 'Hoja no disponible: ' + hoja);
  return d;
}

function datosFiltrarCampos_(hoja, datos, bloqueados) {
  var permitidas = esquemaEncabezados_(hoja);
  var r = {};
  Object.keys(datos || {}).forEach(function (k) {
    if (permitidas.indexOf(k) < 0) return;
    if (['id', 'creado_en', 'actualizado_en', 'version', 'usuario_responsable', 'huella'].indexOf(k) >= 0) return;
    if ((bloqueados || []).indexOf(k) >= 0) throw errorApp_('PROHIBIDO', 'El campo "' + k + '" solo se modifica mediante su flujo de aprobación.');
    r[k] = datos[k];
  });
  return r;
}

var ACC_DATOS = {
  'datos.esquema': accion_(null, null, function (ctx, d) {
    var def = datosDefHoja_(d.hoja);
    Permisos.exigir(ctx.usuario, def.modulo, 'leer');
    return { hoja: d.hoja, columnas: esquemaColumnas_(d.hoja).filter(function (c) { return !c.sensible; }),
      soloLectura: !!def.soloLectura, camposBloqueados: def.camposBloqueados || [], crearPorServicio: !!def.crearPorServicio };
  }),

  'datos.listar': accion_(null, null, function (ctx, d) {
    var def = datosDefHoja_(d.hoja);
    Permisos.exigir(ctx.usuario, def.modulo, 'leer');
    var alcance = Permisos.filtroAlcance(ctx.usuario);
    var igual = {};
    if (d.proyecto_id) igual.proyecto_id = d.proyecto_id;
    if (d.estado) igual.estado = d.estado;
    Object.keys(d.filtros || {}).forEach(function (k) { if (esquemaEncabezados_(d.hoja).indexOf(k) >= 0) igual[k] = d.filtros[k]; });
    var res = Repo.listar(d.hoja, { filtro: alcance, igual: igual, busqueda: d.busqueda, pagina: d.pagina, tamanio: d.tamanio,
      orden: d.orden, desc: d.desc });
    res.registros = res.registros.map(function (r) { return Repo.publico(d.hoja, r); });
    return res;
  }),

  'datos.obtener': accion_(null, null, function (ctx, d) {
    var def = datosDefHoja_(d.hoja);
    Permisos.exigir(ctx.usuario, def.modulo, 'leer');
    var r = Repo.obtenerOFallar(d.hoja, d.id);
    Permisos.exigirProyecto(ctx.usuario, d.hoja === 'PROYECTOS' ? r.id : r.proyecto_id);
    return Repo.publico(d.hoja, r);
  }),

  'datos.crear': accion_(null, null, function (ctx, d) {
    var def = datosDefHoja_(d.hoja);
    if (def.soloLectura || def.crearPorServicio) throw errorApp_('PROHIBIDO', 'Esta hoja se gestiona mediante su módulo específico.');
    Permisos.exigir(ctx.usuario, def.modulo, def.permisoEscritura || 'crear');
    var datos = datosFiltrarCampos_(d.hoja, d.registro, def.camposBloqueados);
    if (datos.proyecto_id) Permisos.exigirProyecto(ctx.usuario, datos.proyecto_id);
    if (ctx.idempotencia && esquemaEncabezados_(d.hoja).indexOf('clave_idempotencia') >= 0) datos.clave_idempotencia = ctx.idempotencia;
    if (!datos.estado) datos.estado = 'ACTIVO';
    return Repo.publico(d.hoja, Repo.crear(d.hoja, datos, ctx));
  }),

  'datos.actualizar': accion_(null, null, function (ctx, d) {
    var def = datosDefHoja_(d.hoja);
    if (def.soloLectura) throw errorApp_('PROHIBIDO', 'Esta hoja se gestiona mediante su módulo específico.');
    Permisos.exigir(ctx.usuario, def.modulo, def.permisoEscritura || 'editar');
    var actual = Repo.obtenerOFallar(d.hoja, d.id);
    Permisos.exigirProyecto(ctx.usuario, d.hoja === 'PROYECTOS' ? actual.id : actual.proyecto_id);
    var datos = datosFiltrarCampos_(d.hoja, d.cambios, def.camposBloqueados);
    if (d.hoja === 'PERMISOS') Permisos._matriz = null;
    return Repo.publico(d.hoja, Repo.actualizar(d.hoja, d.id, datos, ctx, { versionEsperada: d.version, motivo: d.motivo }));
  }),

  'datos.anular': accion_(null, null, function (ctx, d) {
    var def = datosDefHoja_(d.hoja);
    if (def.soloLectura) throw errorApp_('PROHIBIDO', 'Esta hoja se gestiona mediante su módulo específico.');
    Permisos.exigir(ctx.usuario, def.modulo, 'editar');
    var actual = Repo.obtenerOFallar(d.hoja, d.id);
    Permisos.exigirProyecto(ctx.usuario, d.hoja === 'PROYECTOS' ? actual.id : actual.proyecto_id);
    return Repo.publico(d.hoja, Repo.anular(d.hoja, d.id, d.motivo, ctx));
  }),

  'datos.exportar': accion_(null, null, function (ctx, d) {
    var def = datosDefHoja_(d.hoja);
    Permisos.exigir(ctx.usuario, def.modulo, 'exportar');
    var cols = esquemaColumnas_(d.hoja).filter(function (c) { return !c.sensible; }).map(function (c) { return c.nombre; });
    var filas = Repo.listar(d.hoja, { filtro: Permisos.filtroAlcance(ctx.usuario), igual: d.proyecto_id ? { proyecto_id: d.proyecto_id } : null, sinPaginar: true }).registros;
    var csv = [cols.join(',')].concat(filas.map(function (r) {
      return cols.map(function (c) {
        var v = String(r[c] === undefined ? '' : r[c]);
        if (/^[=+\-@]/.test(v)) v = "'" + v;
        return '"' + v.replace(/"/g, '""') + '"';
      }).join(',');
    })).join('\n');
    Auditoria.registrar(ctx, { operacion: 'EXPORTAR', hoja: d.hoja, proyecto_id: d.proyecto_id || '', motivo: filas.length + ' filas' });
    return { nombre: d.hoja + '_' + hoyIso_() + '.csv', contenido: csv };
  })
};

/** Administración de usuarios (solo SUPERADMIN / ADMINISTRADOR con permisos). */
var ACC_USUARIOS = {
  'usuarios.listar': accion_('usuarios', 'leer', function () {
    return Repo.todos('USUARIOS').map(function (u) { return Repo.publico('USUARIOS', u); });
  }),

  'usuarios.crear': accion_('usuarios', 'crear', function (ctx, d) {
    var rol = String(d.rol || '');
    var rolesValidos = Object.keys(ROLES).map(function (k) { return ROLES[k]; });
    if (rolesValidos.indexOf(rol) < 0) throw errorApp_('VALIDACION', 'Rol inválido.');
    if ((rol === ROLES.SUPERADMIN || rol === ROLES.ADMINISTRADOR) && ctx.usuario.rol !== ROLES.SUPERADMIN) {
      throw errorApp_('PROHIBIDO', 'Solo el SUPERADMIN puede crear administradores.');
    }
    if (rol === ROLES.BENEFICIARIO && !d.beneficiario_id) throw errorApp_('VALIDACION', 'Un usuario BENEFICIARIO debe vincularse a un legajo.');
    // Contraseña temporal aleatoria: se muestra UNA vez al administrador y debe cambiarse en el primer ingreso.
    var temporal = 'Tmp-' + tokenAleatorio_().substring(0, 10) + '!9a';
    var u = Repo.crear('USUARIOS', { email: d.email, nombre: d.nombre, rol: rol, estado: 'ACTIVO',
      proyectos_asignados: d.proyectos_asignados || '', beneficiario_id: d.beneficiario_id || '',
      password_hash: Auth.hashPassword(temporal), debe_cambiar_password: true, intentos_fallidos: 0 }, ctx);
    return { usuario: Repo.publico('USUARIOS', u), password_temporal: temporal,
      aviso: 'Comunique la contraseña temporal por un canal seguro. No volverá a mostrarse.' };
  }),

  'usuarios.actualizar': accion_('usuarios', 'editar', function (ctx, d) {
    var u = Repo.obtenerOFallar('USUARIOS', d.id);
    var cambios = {};
    ['nombre', 'rol', 'estado', 'proyectos_asignados', 'beneficiario_id'].forEach(function (k) { if (k in d) cambios[k] = d[k]; });
    var tocaAdmin = [u.rol, cambios.rol].some(function (r) { return r === ROLES.SUPERADMIN || r === ROLES.ADMINISTRADOR; });
    if (tocaAdmin && ctx.usuario.rol !== ROLES.SUPERADMIN) throw errorApp_('PROHIBIDO', 'Solo el SUPERADMIN puede modificar administradores.');
    if (u.id === ctx.usuario.id && (cambios.estado && cambios.estado !== 'ACTIVO' || cambios.rol && cambios.rol !== u.rol)) {
      throw errorApp_('PROHIBIDO', 'No puede desactivarse ni cambiar su propio rol.');
    }
    if (cambios.estado && ['ACTIVO', 'INACTIVO'].indexOf(cambios.estado) < 0) throw errorApp_('VALIDACION', 'Estado inválido.');
    return Repo.publico('USUARIOS', Repo.actualizar('USUARIOS', d.id, cambios, ctx, { motivo: d.motivo, versionEsperada: d.version }));
  }),

  'usuarios.resetearPassword': accion_('usuarios', 'editar', function (ctx, d) {
    var u = Repo.obtenerOFallar('USUARIOS', d.id);
    if ((u.rol === ROLES.SUPERADMIN || u.rol === ROLES.ADMINISTRADOR) && ctx.usuario.rol !== ROLES.SUPERADMIN) {
      throw errorApp_('PROHIBIDO', 'Solo el SUPERADMIN puede resetear administradores.');
    }
    var temporal = 'Tmp-' + tokenAleatorio_().substring(0, 10) + '!9a';
    Repo.actualizar('USUARIOS', u.id, { password_hash: Auth.hashPassword(temporal), debe_cambiar_password: true,
      intentos_fallidos: 0, bloqueado_hasta: '' }, ctx, { operacion: 'RESET_PASSWORD_ADMIN', motivo: d.motivo });
    return { password_temporal: temporal };
  })
};
