/**
 * Permisos.js — Autorización por rol, módulo y acción, con alcance por fideicomiso y por titular.
 *
 * La matriz por defecto se siembra en la hoja PERMISOS durante la instalación; desde ese momento la hoja es
 * la fuente de verdad (editable por el SUPERADMIN). SUPERADMIN siempre tiene acceso total y no puede ser
 * restringido desde la hoja para evitar bloqueos accidentales.
 */
var MODULOS = ['configuracion', 'usuarios', 'auditoria', 'fideicomisos', 'terrenos', 'crm', 'preliminar', 'cuotas',
  'pagos', 'beneficiarios', 'obras', 'finanzas', 'documentos', 'cesiones', 'agentes', 'contenidos', 'publicaciones',
  'alertas', 'reportes', 'tareas', 'respaldos', 'portal'];

var ACCIONES = ['leer', 'crear', 'editar', 'aprobar', 'exportar', 'administrar'];

/** Matriz por defecto: rol -> { modulo: 'acciones separadas por coma' } */
var PERMISOS_DEFECTO = {
  ADMINISTRADOR: { '*': 'leer,crear,editar,aprobar,exportar', usuarios: 'leer,crear,editar', configuracion: 'leer', respaldos: 'leer,crear' },
  ADMINISTRADOR_PROYECTO: { fideicomisos: 'leer,editar', terrenos: 'leer', preliminar: 'leer,crear', cuotas: 'leer,crear',
    pagos: 'leer,crear', beneficiarios: 'leer,crear,editar', obras: 'leer,crear,editar,aprobar', finanzas: 'leer',
    documentos: 'leer,crear', cesiones: 'leer,editar', alertas: 'leer,editar', reportes: 'leer,exportar', tareas: 'leer' },
  CONTADOR: { fideicomisos: 'leer', preliminar: 'leer,crear,aprobar', cuotas: 'leer,crear', pagos: 'leer,crear,aprobar',
    beneficiarios: 'leer', finanzas: 'leer,crear,aprobar,exportar', documentos: 'leer,crear', cesiones: 'leer',
    reportes: 'leer,exportar', alertas: 'leer', obras: 'leer' },
  ASESOR_COMERCIAL: { crm: 'leer,crear,editar', terrenos: 'leer,crear,editar', fideicomisos: 'leer', contenidos: 'leer',
    publicaciones: 'leer', alertas: 'leer', beneficiarios: 'leer' },
  ASESOR_JURIDICO: { fideicomisos: 'leer,editar,aprobar', terrenos: 'leer,editar,aprobar', documentos: 'leer,crear,aprobar',
    cesiones: 'leer,editar,aprobar', contenidos: 'leer,editar,aprobar', beneficiarios: 'leer', preliminar: 'leer' },
  RESPONSABLE_OBRA: { obras: 'leer,crear,editar', documentos: 'leer,crear', fideicomisos: 'leer', alertas: 'leer' },
  ATENCION_BENEFICIARIO: { beneficiarios: 'leer,editar', tareas: 'leer', cuotas: 'leer', pagos: 'leer,crear', cesiones: 'leer,crear,editar',
    documentos: 'leer', crm: 'leer,crear,editar', alertas: 'leer' },
  BENEFICIARIO: { portal: 'leer,crear' },
  VISITANTE: {}
};

var Permisos = {
  _matriz: null,

  /** Construye la matriz efectiva leyendo la hoja PERMISOS (si existe y tiene filas). */
  matriz: function () {
    if (Permisos._matriz) return Permisos._matriz;
    var m = {};
    var filas = [];
    try { filas = Repo.todos('PERMISOS'); } catch (e) { filas = []; }
    if (filas.length) {
      filas.forEach(function (p) {
        if (p.estado === 'ANULADO' || !p.permitido) return;
        m[p.rol] = m[p.rol] || {};
        m[p.rol][p.modulo] = m[p.rol][p.modulo] || {};
        m[p.rol][p.modulo][p.accion] = true;
      });
    } else {
      m = Permisos.expandirDefecto();
    }
    Permisos._matriz = m;
    return m;
  },

  expandirDefecto: function () {
    var m = {};
    Object.keys(PERMISOS_DEFECTO).forEach(function (rol) {
      m[rol] = {};
      var def = PERMISOS_DEFECTO[rol];
      MODULOS.forEach(function (mod) {
        var acc = def[mod] !== undefined ? def[mod] : (mod !== 'portal' ? def['*'] : undefined);
        if (!acc) return;
        m[rol][mod] = {};
        acc.split(',').forEach(function (a) { m[rol][mod][a] = true; });
      });
    });
    return m;
  },

  tiene: function (usuario, modulo, accion) {
    if (!usuario) return false;
    if (usuario.rol === ROLES.SUPERADMIN) return true;
    var m = Permisos.matriz();
    return !!(m[usuario.rol] && m[usuario.rol][modulo] && m[usuario.rol][modulo][accion]);
  },

  exigir: function (usuario, modulo, accion) {
    if (!Permisos.tiene(usuario, modulo, accion)) {
      throw errorApp_('PROHIBIDO', 'No tiene permiso para ' + accion + ' en ' + modulo + '.');
    }
  },

  /** ¿Puede el usuario operar sobre el fideicomiso indicado? */
  alcanceProyecto: function (usuario, proyectoId) {
    if (ROLES_CON_ALCANCE_PROYECTO.indexOf(usuario.rol) < 0) return true;
    if (!proyectoId) return false;
    var asignados = String(usuario.proyectos_asignados || '').split(',');
    return asignados.indexOf(proyectoId) >= 0;
  },

  exigirProyecto: function (usuario, proyectoId) {
    if (!Permisos.alcanceProyecto(usuario, proyectoId)) {
      throw errorApp_('PROHIBIDO', 'No tiene asignado el fideicomiso ' + (proyectoId || '(sin especificar)') + '.');
    }
  },

  /** Filtro de listado según alcance del rol. */
  filtroAlcance: function (usuario) {
    if (ROLES_CON_ALCANCE_PROYECTO.indexOf(usuario.rol) < 0) return null;
    var asignados = String(usuario.proyectos_asignados || '').split(',').filter(String);
    return function (r) { return asignados.indexOf(r.proyecto_id) >= 0 || asignados.indexOf(r.id) >= 0; };
  },

  /** Filas para sembrar la hoja PERMISOS. */
  filasSemilla: function () {
    var m = Permisos.expandirDefecto();
    var filas = [];
    Object.keys(m).forEach(function (rol) {
      Object.keys(m[rol]).forEach(function (mod) {
        Object.keys(m[rol][mod]).forEach(function (acc) {
          filas.push({ rol: rol, modulo: mod, accion: acc, permitido: true, estado: 'ACTIVO' });
        });
      });
    });
    return filas;
  }
};
