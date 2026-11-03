const { cargarBackend } = require('./cargar');

const PASS_SA = 'Prueba-Segura#2026xyz';

/** Instala el sistema en memoria y crea el SUPERADMIN. Devuelve helpers. */
function sistemaInstalado() {
  const g = cargarBackend();
  g.instalar();
  const msg = g.generarCodigoInstalacion();
  const codigo = msg.match(/: ([A-Z0-9-]{14}) /)[1];
  const r = g.api({ accion: 'setup.crearSuperadmin', datos: { codigo, email: 'superadmin@ejemplo.invalid', nombre: 'PRUEBA Superadmin', password: PASS_SA } });
  if (!r.ok) throw new Error('No se creó el superadmin: ' + JSON.stringify(r.error));
  const login = (email, password) => g.api({ accion: 'auth.login', datos: { email, password } });
  const sa = login('superadmin@ejemplo.invalid', PASS_SA);
  if (!sa.ok) throw new Error('Login SA falló ' + JSON.stringify(sa.error));
  const llamar = (token, accion, datos, idempotencia) => g.api({ accion, token, datos: datos || {}, idempotencia });
  const ok = (token, accion, datos, idem) => {
    const res = llamar(token, accion, datos, idem);
    if (!res.ok) throw new Error(accion + ' → ' + res.error.codigo + ': ' + res.error.mensaje);
    return res.datos;
  };
  /** Crea un usuario con rol y devuelve su token tras cambiar la contraseña temporal. */
  const crearUsuario = (rol, extra = {}) => {
    const email = rol.toLowerCase() + (extra.sufijo || '') + '@ejemplo.invalid';
    const u = ok(sa.datos.token, 'usuarios.crear', Object.assign({ email, nombre: 'PRUEBA ' + rol, rol }, extra));
    const l = login(email, u.password_temporal);
    if (!l.ok) throw new Error('login ' + rol + ' ' + JSON.stringify(l.error));
    const password = 'Nueva-Clave#' + rol.length + 'Segura9';
    ok(l.datos.token, 'auth.cambiarPassword', { actual: u.password_temporal, nueva: password });
    return { token: l.datos.token, usuario: u.usuario, email, password };
  };
  return { g, sa: sa.datos.token, login, llamar, ok, crearUsuario, PASS_SA };
}

/** Crea un fideicomiso con beneficiario listo para operar. */
function escenarioBase(s) {
  const f = s.ok(s.sa, 'fideicomisos.crear', { denominacion: 'PRUEBA Fideicomiso A', tipo_fideicomiso: 'ORDINARIO', modalidad_oferta: 'PRIVADA',
    reglas_salida: 'PRUEBA: reintegro 80% a 180 días' });
  const u = s.ok(s.sa, 'datos.crear', { hoja: 'UNIDADES', registro: { proyecto_id: f.id, codigo: 'U-01', valor_referencia: 1000000 } });
  const c = s.ok(s.sa, 'datos.crear', { hoja: 'CONTRATOS', registro: { proyecto_id: f.id, tipo: 'ADHESION', condiciones_salida: 'PRUEBA: cláusula 10' } });
  const b = s.ok(s.sa, 'datos.crear', { hoja: 'BENEFICIARIOS', registro: { proyecto_id: f.id, nombre: 'PRUEBA Beneficiario', documento: '00.000.001',
    email: 'ben@ejemplo.invalid', unidad_id: u.id, contrato_id: c.id } });
  return { f, u, c, b };
}

module.exports = { sistemaInstalado, escenarioBase, PASS_SA };
