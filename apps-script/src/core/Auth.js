/**
 * Auth.js — Autenticación, sesiones, protección contra fuerza bruta y recuperación de acceso.
 *
 * Contraseñas: hash iterado HMAC-SHA256 con sal aleatoria por usuario + "pepper" en Script Properties.
 * Formato almacenado: v1$<iteraciones>$<sal>$<hash>. Nunca se guarda texto plano.
 * Sesiones: token aleatorio de 256 bits; en CacheService solo se guarda el SHA-256 del token.
 * Los tokens viajan como parámetro explícito de google.script.run (no hay cookies), lo que neutraliza CSRF.
 */
var Auth = {
  pepper: function () {
    var p = propiedad_(PROP.PEPPER);
    if (!p) throw errorApp_('NO_INSTALADO', 'Falta el secreto de autenticación. Ejecute instalar().');
    return p;
  },

  hashPassword: function (password, sal, iteraciones) {
    sal = sal || tokenAleatorio_().substring(0, 32);
    iteraciones = iteraciones || APP.HASH_ITERACIONES;
    var clave = Auth.pepper() + sal;
    var h = bytesAHex_(Utilities.computeHmacSha256Signature(String(password), clave));
    for (var i = 1; i < iteraciones; i++) {
      h = bytesAHex_(Utilities.computeHmacSha256Signature(h + String(password), clave));
    }
    return 'v1$' + iteraciones + '$' + sal + '$' + h;
  },

  verificarPassword: function (password, almacenado) {
    if (!almacenado) return false;
    var p = String(almacenado).split('$');
    if (p.length !== 4 || p[0] !== 'v1') return false;
    return igualdadSegura_(Auth.hashPassword(password, p[2], Number(p[1])), almacenado);
  },

  validarPoliticaPassword: function (password, email) {
    var s = String(password || '');
    var errores = [];
    if (s.length < APP.PASSWORD_MIN) errores.push('mínimo ' + APP.PASSWORD_MIN + ' caracteres');
    if (!/[a-z]/.test(s)) errores.push('una minúscula');
    if (!/[A-Z]/.test(s)) errores.push('una mayúscula');
    if (!/\d/.test(s)) errores.push('un número');
    if (!/[^A-Za-z0-9]/.test(s)) errores.push('un símbolo');
    var usuario = String(email || '').split('@')[0].toLowerCase();
    if (usuario.length >= 4 && s.toLowerCase().indexOf(usuario) >= 0) errores.push('no debe contener su usuario');
    if (errores.length) throw errorApp_('PASSWORD_DEBIL', 'La contraseña debe tener: ' + errores.join(', ') + '.');
  },

  // ---------- Configuración inicial ----------
  existeSuperadmin: function () {
    return Repo.todos('USUARIOS', function (u) { return u.rol === ROLES.SUPERADMIN && u.estado === 'ACTIVO'; }).length > 0;
  },

  /** Crea la cuenta inicial. Solo funciona si no existe un SUPERADMIN y el código de instalación es correcto. */
  crearSuperadminInicial: function (datos) {
    return dbConLock_(function () {
      if (Auth.existeSuperadmin()) throw errorApp_('PROHIBIDO', 'La configuración inicial ya fue completada.');
      var hashCodigo = propiedad_(PROP.SETUP_CODE_HASH);
      if (!hashCodigo) throw errorApp_('PROHIBIDO', 'No hay un código de instalación vigente. Ejecute generarCodigoInstalacion().');
      Auth.limitarIntentos('setup', 5);
      if (!igualdadSegura_(sha256Hex_(String(datos.codigo || '').trim().toUpperCase()), hashCodigo)) {
        throw errorApp_('NO_AUTORIZADO', 'Código de instalación incorrecto.');
      }
      Auth.validarPoliticaPassword(datos.password, datos.email);
      var ctx = { actor: 'instalacion', origen: 'setup' };
      var u = Repo.crear('USUARIOS', {
        email: datos.email, nombre: datos.nombre, rol: ROLES.SUPERADMIN, estado: 'ACTIVO',
        password_hash: Auth.hashPassword(datos.password), intentos_fallidos: 0
      }, ctx, { motivo: 'Configuración inicial del superadministrador' });
      PropertiesService.getScriptProperties().deleteProperty(PROP.SETUP_CODE_HASH);
      return { id: u.id, email: u.email };
    });
  },

  // ---------- Protección contra fuerza bruta ----------
  /** Limita intentos por clave (email, acción) usando CacheService. Ventana de 15 min. */
  limitarIntentos: function (clave, maximo) {
    var cache = CacheService.getScriptCache();
    var k = 'rl_' + sha256Hex_(clave).substring(0, 40);
    var n = Number(cache.get(k) || 0) + 1;
    cache.put(k, String(n), APP.LOGIN_BLOQUEO_MIN * 60);
    if (n > maximo) throw errorApp_('DEMASIADOS_INTENTOS', 'Demasiados intentos. Espere ' + APP.LOGIN_BLOQUEO_MIN + ' minutos.');
  },

  // ---------- Inicio y cierre de sesión ----------
  login: function (email, password, meta) {
    email = String(email || '').trim().toLowerCase();
    var generico = errorApp_('CREDENCIALES', 'Email o contraseña incorrectos.');
    Auth.limitarIntentos('login:' + email, APP.LOGIN_MAX_INTENTOS * 2);
    var u = Repo.buscarPor('USUARIOS', 'email', email);
    if (!u) { Auth.hashPassword(password, 'x'.repeat(32)); throw generico; } // tiempo similar: evita enumeración
    if (u.bloqueado_hasta && Date.parse(u.bloqueado_hasta) > Date.now()) {
      throw errorApp_('BLOQUEADO', 'Cuenta bloqueada temporalmente por intentos fallidos. Intente más tarde.');
    }
    var ctx = { actor: email, origen: 'login' };
    if (u.estado !== 'ACTIVO' || !Auth.verificarPassword(password, u.password_hash)) {
      var intentos = (Number(u.intentos_fallidos) || 0) + 1;
      var cambios = { intentos_fallidos: intentos };
      if (intentos >= APP.LOGIN_MAX_INTENTOS) {
        cambios.bloqueado_hasta = new Date(Date.now() + APP.LOGIN_BLOQUEO_MIN * 60000).toISOString();
        cambios.intentos_fallidos = 0;
      }
      Repo.actualizar('USUARIOS', u.id, cambios, ctx, { sinAuditoria: true });
      Auditoria.registrar(ctx, { operacion: 'LOGIN_FALLIDO', hoja: 'USUARIOS', registro_id: u.id, resultado: 'RECHAZADO',
        motivo: cambios.bloqueado_hasta ? 'Bloqueo por fuerza bruta' : '' });
      throw generico;
    }
    Repo.actualizar('USUARIOS', u.id, { intentos_fallidos: 0, bloqueado_hasta: '', ultimo_acceso: ahoraIso_() }, ctx, { sinAuditoria: true });
    var token = tokenAleatorio_();
    var sesion = { uid: u.id, creada: Date.now(), abs: Date.now() + APP.SESION_TTL_SEG * 1000 };
    CacheService.getScriptCache().put('ses_' + sha256Hex_(token), JSON.stringify(sesion), APP.SESION_INACTIVIDAD_SEG);
    Auditoria.registrar({ usuario: u, origen: 'login' }, { operacion: 'LOGIN', hoja: 'USUARIOS', registro_id: u.id, resultado: 'OK' });
    return { token: token, usuario: Auth.perfil(u) };
  },

  perfil: function (u) {
    return { id: u.id, email: u.email, nombre: u.nombre, rol: u.rol, beneficiario_id: u.beneficiario_id,
      proyectos_asignados: u.proyectos_asignados ? String(u.proyectos_asignados).split(',') : [],
      debe_cambiar_password: !!u.debe_cambiar_password };
  },

  /** Resuelve el usuario de una sesión. Revalida estado y rol contra USUARIOS en cada solicitud. */
  usuarioDeSesion: function (token) {
    if (!token || typeof token !== 'string' || token.length < 32) throw errorApp_('SESION', 'Sesión inválida. Inicie sesión.');
    var cache = CacheService.getScriptCache();
    var k = 'ses_' + sha256Hex_(token);
    var raw = cache.get(k);
    if (!raw) throw errorApp_('SESION', 'Su sesión expiró. Inicie sesión nuevamente.');
    var s = JSON.parse(raw);
    if (Date.now() > s.abs) { cache.remove(k); throw errorApp_('SESION', 'Su sesión expiró. Inicie sesión nuevamente.'); }
    var u = Repo.obtener('USUARIOS', s.uid);
    if (!u || u.estado !== 'ACTIVO') { cache.remove(k); throw errorApp_('SESION', 'Usuario inactivo.'); }
    var restante = Math.max(1, Math.min(APP.SESION_INACTIVIDAD_SEG, Math.floor((s.abs - Date.now()) / 1000)));
    cache.put(k, raw, restante); // expiración deslizante
    return u;
  },

  logout: function (token) {
    if (token) CacheService.getScriptCache().remove('ses_' + sha256Hex_(token));
    return true;
  },

  cambiarPassword: function (u, actual, nueva) {
    Auth.limitarIntentos('cambio:' + u.id, 5);
    if (!Auth.verificarPassword(actual, u.password_hash)) throw errorApp_('CREDENCIALES', 'La contraseña actual es incorrecta.');
    Auth.validarPoliticaPassword(nueva, u.email);
    Repo.actualizar('USUARIOS', u.id, { password_hash: Auth.hashPassword(nueva), debe_cambiar_password: false },
      { usuario: u }, { operacion: 'CAMBIO_PASSWORD' });
    return true;
  },

  // ---------- Recuperación de acceso ----------
  solicitarRecuperacion: function (email, urlBase) {
    email = String(email || '').trim().toLowerCase();
    Auth.limitarIntentos('reset:' + email, 3);
    var u = Repo.buscarPor('USUARIOS', 'email', email);
    if (u && u.estado === 'ACTIVO') {
      var token = tokenAleatorio_();
      Repo.actualizar('USUARIOS', u.id, {
        reset_hash: sha256Hex_(token),
        reset_expira: new Date(Date.now() + APP.RESET_TTL_MIN * 60000).toISOString()
      }, { actor: email, origen: 'recuperacion' }, { operacion: 'SOLICITUD_RECUPERACION' });
      var enlace = (urlBase || '') + '?p=app#reset=' + token;
      Notificar.email(u.email, 'Recuperación de acceso',
        'Recibimos una solicitud para restablecer su contraseña.\n\nEnlace válido por ' + APP.RESET_TTL_MIN +
        ' minutos:\n' + enlace + '\n\nSi usted no lo solicitó, ignore este mensaje.');
    }
    return { mensaje: 'Si el email corresponde a una cuenta activa, recibirá instrucciones.' };
  },

  confirmarRecuperacion: function (token, nueva) {
    Auth.limitarIntentos('reset-confirm', 30);
    var h = sha256Hex_(String(token || ''));
    var u = Repo.buscarPor('USUARIOS', 'reset_hash', h);
    if (!u || !u.reset_expira || Date.parse(u.reset_expira) < Date.now()) {
      throw errorApp_('TOKEN_INVALIDO', 'El enlace de recuperación es inválido o expiró.');
    }
    Auth.validarPoliticaPassword(nueva, u.email);
    Repo.actualizar('USUARIOS', u.id, { password_hash: Auth.hashPassword(nueva), reset_hash: '', reset_expira: '',
      intentos_fallidos: 0, bloqueado_hasta: '' }, { actor: u.email, origen: 'recuperacion' }, { operacion: 'RECUPERACION_COMPLETADA' });
    return true;
  }
};
