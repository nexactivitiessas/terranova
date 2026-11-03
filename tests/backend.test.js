/**
 * Pruebas automatizadas del backend (Node + simulación de Apps Script).
 * Ejecutar: npm test
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { sistemaInstalado, escenarioBase, PASS_SA } = require('./utilidades');
const { cargarBackend } = require('./cargar');

const err = (r) => (r.ok ? 'OK' : r.error.codigo);

test('Instalación: crea todas las hojas con encabezados, secretos fuera del código y código de un solo uso', () => {
  const s = sistemaInstalado();
  const est = s.g.__estado;
  const libro = Object.values(est.libros)[0];
  for (const hoja of Object.keys(s.g.ESQUEMA)) {
    const h = libro.getSheetByName(hoja);
    assert.ok(h, 'falta hoja ' + hoja);
    assert.deepEqual(h.datos[0].slice(0, 3), ['id', 'proyecto_id', 'estado']);
  }
  assert.ok(est.props.AUTH_PEPPER && est.props.AUTH_PEPPER.length >= 64);
  assert.equal(est.props.SETUP_CODE_HASH, undefined, 'el código debe eliminarse tras usarse');
  // La contraseña no aparece en texto plano en ninguna celda
  const todo = JSON.stringify(libro.hojas.map(h => h.datos));
  assert.ok(!todo.includes(PASS_SA));
  assert.match(todo, /v1\$600\$/);
  // No se puede crear otro superadmin
  const r = s.g.api({ accion: 'setup.crearSuperadmin', datos: { codigo: 'XXXX-XXXX-XXXX', email: 'otro@ejemplo.invalid', nombre: 'x', password: PASS_SA } });
  assert.equal(err(r), 'PROHIBIDO');
  assert.equal(est.triggers.length, 4);
});

test('Instalación: rechaza código incorrecto y contraseña débil', () => {
  const g = cargarBackend();
  g.instalar();
  const codigo = g.generarCodigoInstalacion().match(/: ([A-Z0-9-]{14}) /)[1];
  assert.equal(err(g.api({ accion: 'setup.crearSuperadmin', datos: { codigo: 'AAAA-BBBB-CCCC', email: 'a@ejemplo.invalid', nombre: 'A', password: PASS_SA } })), 'NO_AUTORIZADO');
  assert.equal(err(g.api({ accion: 'setup.crearSuperadmin', datos: { codigo, email: 'a@ejemplo.invalid', nombre: 'A', password: 'corta' } })), 'PASSWORD_DEBIL');
  assert.equal(err(g.api({ accion: 'setup.crearSuperadmin', datos: { codigo, email: 'a@ejemplo.invalid', nombre: 'A', password: PASS_SA } })), 'OK');
});

test('Autenticación: errores genéricos, bloqueo por fuerza bruta, cierre de sesión y usuario desactivado', () => {
  const s = sistemaInstalado();
  assert.equal(err(s.login('noexiste@ejemplo.invalid', 'x')), 'CREDENCIALES');
  assert.equal(err(s.login('superadmin@ejemplo.invalid', 'mal')), 'CREDENCIALES');
  assert.equal(err(s.llamar('token-invalido', 'auth.yo')), 'SESION');
  const c = s.crearUsuario('CONTADOR');
  for (let i = 0; i < 5; i++) s.login(c.email, 'incorrecta');
  assert.equal(err(s.login(c.email, c.password)), 'BLOQUEADO');
  // Cierre de sesión
  const a = s.crearUsuario('ASESOR_COMERCIAL');
  assert.equal(err(s.llamar(a.token, 'auth.yo')), 'OK');
  s.g.api({ accion: 'auth.logout', datos: { token: a.token } });
  assert.equal(err(s.llamar(a.token, 'auth.yo')), 'SESION');
  // Desactivación inmediata
  const j = s.crearUsuario('ASESOR_JURIDICO');
  s.ok(s.sa, 'usuarios.actualizar', { id: j.usuario.id, estado: 'INACTIVO', motivo: 'prueba' });
  assert.equal(err(s.llamar(j.token, 'auth.yo')), 'SESION');
  // Auditoría de accesos
  const ops = s.g.Repo.todos('AUDITORIA').map(x => x.operacion);
  assert.ok(ops.includes('LOGIN') && ops.includes('LOGIN_FALLIDO'));
});

test('Autenticación: contraseña temporal obliga a cambiarla', () => {
  const s = sistemaInstalado();
  const u = s.ok(s.sa, 'usuarios.crear', { email: 'temp@ejemplo.invalid', nombre: 'PRUEBA temp', rol: 'CONTADOR' });
  const l = s.login('temp@ejemplo.invalid', u.password_temporal);
  assert.equal(err(s.llamar(l.datos.token, 'finanzas.morosidad', {})), 'CAMBIO_PASSWORD_REQUERIDO');
});

test('Recuperación de acceso: token por email, uso único y respuesta que no revela existencia', () => {
  const s = sistemaInstalado();
  const r1 = s.g.api({ accion: 'auth.solicitarRecuperacion', datos: { email: 'nadie@ejemplo.invalid' } });
  const r2 = s.g.api({ accion: 'auth.solicitarRecuperacion', datos: { email: 'superadmin@ejemplo.invalid' } });
  assert.equal(r1.datos.mensaje, r2.datos.mensaje);
  const correo = s.g.__estado.correos.at(-1);
  const token = correo.body.match(/reset=([a-f0-9]+)/)[1];
  assert.equal(err(s.g.api({ accion: 'auth.confirmarRecuperacion', datos: { token: 'x'.repeat(64), password: 'Otra-Clave#2026abc' } })), 'TOKEN_INVALIDO');
  assert.equal(err(s.g.api({ accion: 'auth.confirmarRecuperacion', datos: { token, password: 'Otra-Clave#2026abc' } })), 'OK');
  assert.equal(err(s.g.api({ accion: 'auth.confirmarRecuperacion', datos: { token, password: 'Otra-Clave#2026abd' } })), 'TOKEN_INVALIDO');
  assert.equal(err(s.login('superadmin@ejemplo.invalid', 'Otra-Clave#2026abc')), 'OK');
});

test('Permisos: matriz por rol, alcance por fideicomiso y protección de administradores', () => {
  const s = sistemaInstalado();
  const A = escenarioBase(s);
  const B = s.ok(s.sa, 'fideicomisos.crear', { denominacion: 'PRUEBA Fideicomiso B', tipo_fideicomiso: 'ORDINARIO', modalidad_oferta: 'PRIVADA' });
  const com = s.crearUsuario('ASESOR_COMERCIAL');
  assert.equal(err(s.llamar(com.token, 'finanzas.saldo', { proyecto_id: A.f.id })), 'PROHIBIDO');
  assert.equal(err(s.llamar(com.token, 'datos.listar', { hoja: 'CONTACTOS_CRM' })), 'OK');
  assert.equal(err(s.llamar(com.token, 'usuarios.crear', { email: 'x@ejemplo.invalid', nombre: 'x', rol: 'ADMINISTRADOR' })), 'PROHIBIDO');
  const adm = s.crearUsuario('ADMINISTRADOR');
  assert.equal(err(s.llamar(adm.token, 'usuarios.crear', { email: 'y@ejemplo.invalid', nombre: 'y', rol: 'ADMINISTRADOR' })), 'PROHIBIDO');
  // Administrador de proyecto: solo ve su fideicomiso
  const ap = s.crearUsuario('ADMINISTRADOR_PROYECTO', { proyectos_asignados: A.f.id });
  const lista = s.ok(ap.token, 'datos.listar', { hoja: 'BENEFICIARIOS' });
  assert.ok(lista.registros.every(r => r.proyecto_id === A.f.id));
  assert.equal(err(s.llamar(ap.token, 'fideicomisos.resumen', { proyecto_id: B.id })), 'PROHIBIDO');
  assert.equal(err(s.llamar(ap.token, 'fideicomisos.resumen', { proyecto_id: A.f.id })), 'OK');
  // Campos protegidos no se editan por CRUD genérico
  assert.equal(err(s.llamar(s.sa, 'datos.actualizar', { hoja: 'PROYECTOS', id: A.f.id, cambios: { estado: 'COMERCIALIZACION' } })), 'PROHIBIDO');
  assert.equal(err(s.llamar(s.sa, 'datos.crear', { hoja: 'PAGOS', registro: { beneficiario_id: A.b.id, importe: 1 } })), 'PROHIBIDO');
  // Nadie puede desactivarse a sí mismo
  const yo = s.ok(s.sa, 'auth.yo');
  assert.equal(err(s.llamar(s.sa, 'usuarios.actualizar', { id: yo.usuario.id, estado: 'INACTIVO' })), 'PROHIBIDO');
});

test('Validación: fechas DD/MM/AAAA, enums, integridad referencial e inyección de fórmulas', () => {
  const s = sistemaInstalado();
  const A = escenarioBase(s);
  assert.equal(err(s.llamar(s.sa, 'datos.crear', { hoja: 'BENEFICIARIOS', registro: { proyecto_id: 'FID-INEXISTENTE', nombre: 'x', documento: '1' } })), 'INTEGRIDAD');
  assert.equal(err(s.llamar(s.sa, 'datos.crear', { hoja: 'BENEFICIARIOS', registro: { nombre: 'x', documento: '1' } })), 'INTEGRIDAD');
  assert.equal(err(s.llamar(s.sa, 'datos.crear', { hoja: 'BENEFICIARIOS', registro: { proyecto_id: A.f.id, nombre: 'x', documento: '1', fecha_adhesion: '31/02/2026' } })), 'VALIDACION');
  const b = s.ok(s.sa, 'datos.crear', { hoja: 'BENEFICIARIOS', registro: { proyecto_id: A.f.id, nombre: '=HYPERLINK("http://malicioso")', documento: '2', fecha_adhesion: '15/03/2026' } });
  assert.equal(b.fecha_adhesion, '2026-03-15');
  assert.ok(b.nombre.startsWith("'="), 'debe neutralizar fórmulas');
  // No se mueve un registro entre fideicomisos
  const B = s.ok(s.sa, 'fideicomisos.crear', { denominacion: 'PRUEBA B', tipo_fideicomiso: 'ORDINARIO', modalidad_oferta: 'PRIVADA' });
  assert.equal(err(s.llamar(s.sa, 'datos.actualizar', { hoja: 'BENEFICIARIOS', id: A.b.id, cambios: { proyecto_id: B.id } })), 'PROHIBIDO');
  // Concurrencia optimista
  assert.equal(err(s.llamar(s.sa, 'datos.actualizar', { hoja: 'BENEFICIARIOS', id: A.b.id, version: 99, cambios: { telefono: '+54 351 1234567' } })), 'CONFLICTO');
});

test('Fideicomisos: habilitación comercial bloquea COMERCIALIZACION hasta cumplir los 8 requisitos', () => {
  const s = sistemaInstalado();
  const { f } = escenarioBase(s);
  const pasos = ['PREPARACION_PRELIMINAR', 'CONSTITUCION_JURIDICA', 'LANZAMIENTO'];
  assert.equal(err(s.llamar(s.sa, 'fideicomisos.cambiarEstado', { proyecto_id: f.id, estado: 'EJECUCION', motivo: 'x' })), 'TRANSICION');
  pasos.forEach(e => s.ok(s.sa, 'fideicomisos.cambiarEstado', { proyecto_id: f.id, estado: e, motivo: 'Acta PRUEBA' }));
  const r = s.llamar(s.sa, 'fideicomisos.cambiarEstado', { proyecto_id: f.id, estado: 'COMERCIALIZACION', motivo: 'x' });
  assert.equal(err(r), 'HABILITACION_COMERCIAL');
  assert.equal(r.error.detalles.length, 8);
  s.g.REQUISITOS_COMERCIALIZACION.forEach(q => s.ok(s.sa, 'fideicomisos.marcarRequisito', { proyecto_id: f.id, requisito: q.campo, valor: true, motivo: 'Documento PRUEBA' }));
  assert.equal(s.ok(s.sa, 'fideicomisos.cambiarEstado', { proyecto_id: f.id, estado: 'COMERCIALIZACION', motivo: 'Habilitado' }).estado, 'COMERCIALIZACION');
});

test('Web pública y terrenos: formulario no verifica titularidad; aprobar exige verificación jurídica', () => {
  const s = sistemaInstalado();
  assert.equal(err(s.g.api({ accion: 'publico.terreno', datos: { nombre: 'PRUEBA Dueño', email: 'd@ejemplo.invalid', ubicacion: 'X', consentimiento: true, sitio_web: 'bot' } })), 'VALIDACION');
  assert.equal(err(s.g.api({ accion: 'publico.terreno', datos: { nombre: 'PRUEBA Dueño', email: 'd@ejemplo.invalid', ubicacion: 'X' } })), 'VALIDACION');
  assert.equal(err(s.g.api({ accion: 'publico.terreno', datos: { nombre: 'PRUEBA Dueño', email: 'd@ejemplo.invalid', ubicacion: 'Barrio PRUEBA', superficie_m2: 500, consentimiento: true } })), 'OK');
  const t = s.g.Repo.todos('TERRENOS')[0];
  assert.equal(t.titularidad_verificada, false);
  assert.equal(t.estado, 'NUEVO_CONTACTO');
  assert.equal(err(s.llamar(s.sa, 'terrenos.cambiarEstado', { terreno_id: t.id, estado: 'APROBADO' })), 'VALIDACION');
  const com = s.crearUsuario('ASESOR_COMERCIAL');
  assert.equal(err(s.llamar(com.token, 'terrenos.verificarTitularidad', { terreno_id: t.id, valor: true, motivo: 'x' })), 'PROHIBIDO');
  const jur = s.crearUsuario('ASESOR_JURIDICO');
  s.ok(jur.token, 'terrenos.verificarTitularidad', { terreno_id: t.id, valor: true, motivo: 'Informe de dominio PRUEBA' });
  assert.equal(s.ok(jur.token, 'terrenos.cambiarEstado', { terreno_id: t.id, estado: 'APROBADO', motivo: 'ok' }).estado, 'APROBADO');
  assert.equal(s.g.Repo.todos('CONTACTOS_CRM')[0].clasificacion, 'PROPIETARIO_TERRENO');
  // Contacto web genera oportunidad en el embudo
  s.g.api({ accion: 'publico.contacto', datos: { nombre: 'PRUEBA Interesado', email: 'i@ejemplo.invalid', interes: 'BENEFICIARIO_POTENCIAL', consentimiento: true } });
  assert.equal(s.ok(s.sa, 'crm.embudo').porEtapa.NUEVO_CONTACTO, 2);
});

test('Pozo preliminar: aporte pendiente hasta verificación, movimiento idempotente y separado por tipo', () => {
  const s = sistemaInstalado();
  const { f } = escenarioBase(s);
  const a = s.ok(s.sa, 'preliminar.registrar', { proyecto_id: f.id, aportante_nombre: 'PRUEBA Aportante', importe: 500000, destino: 'Mensura' });
  assert.equal(a.estado, 'PENDIENTE_VERIFICACION');
  assert.equal(s.ok(s.sa, 'finanzas.saldo', { proyecto_id: f.id }).saldo, 0);
  s.ok(s.sa, 'preliminar.verificar', { aporte_id: a.id });
  assert.equal(err(s.llamar(s.sa, 'preliminar.verificar', { aporte_id: a.id })), 'TRANSICION');
  const saldo = s.ok(s.sa, 'finanzas.saldo', { proyecto_id: f.id });
  assert.equal(saldo.saldo, 500000);
  assert.equal(saldo.porTipo.APORTE_PRELIMINAR, 500000);
  assert.equal(s.g.Repo.todos('MOVIMIENTOS').length, 1);
  // Gasto preliminar categorizado y con control de fondos
  assert.equal(err(s.llamar(s.sa, 'finanzas.registrarGasto', { proyecto_id: f.id, categoria: 'CUALQUIERA', es_preliminar: true, importe: 1 })), 'VALIDACION');
  const g1 = s.ok(s.sa, 'finanzas.registrarGasto', { proyecto_id: f.id, categoria: 'MENSURA', es_preliminar: true, importe: 200000, proveedor: 'PRUEBA Agrimensor' });
  s.ok(s.sa, 'finanzas.aprobarGasto', { gasto_id: g1.id });
  const g2 = s.ok(s.sa, 'finanzas.registrarGasto', { proyecto_id: f.id, categoria: 'PLANOS', es_preliminar: true, importe: 999999 });
  assert.equal(err(s.llamar(s.sa, 'finanzas.aprobarGasto', { gasto_id: g2.id })), 'FONDOS_INSUFICIENTES');
  assert.equal(s.ok(s.sa, 'finanzas.saldo', { proyecto_id: f.id }).saldo, 300000);
});

test('Cuotas y pagos: plan exacto e idempotente, pago informado no acredita, verificación por otro usuario, anulación compensatoria', () => {
  const s = sistemaInstalado();
  const { f, b } = escenarioBase(s);
  const params = { proyecto_id: f.id, beneficiario_id: b.id, valor_total: 1000000, aporte_inicial: 100000, cantidad_cuotas: 7, primer_vencimiento: '31/01/2026' };
  const p1 = s.ok(s.sa, 'cuotas.generarPlan', params, 'PLAN-X');
  const p2 = s.ok(s.sa, 'cuotas.generarPlan', params, 'PLAN-X');
  assert.equal(p2.reutilizado, true);
  assert.equal(p1.cuotas.length, 8);
  assert.equal(Math.round(p1.cuotas.reduce((t, c) => t + c.importe, 0) * 100) / 100, 1000000);
  assert.equal(p1.cuotas[2].vencimiento, '2026-02-28', 'ajuste a fin de mes');
  // Atención al beneficiario carga un pago: queda pendiente
  const at = s.crearUsuario('ATENCION_BENEFICIARIO');
  const pago = s.ok(at.token, 'pagos.registrar', { beneficiario_id: b.id, importe: 250000, referencia_bancaria: 'TRX-PRUEBA-1' }, 'IDEM-1');
  const pagoBis = s.ok(at.token, 'pagos.registrar', { beneficiario_id: b.id, importe: 250000 }, 'IDEM-1');
  assert.equal(pagoBis.id, pago.id, 'idempotencia de carga');
  assert.equal(pago.estado, 'PENDIENTE_VERIFICACION');
  assert.equal(s.ok(s.sa, 'finanzas.saldo', { proyecto_id: f.id }).saldo, 0);
  // Segregación: un contador que carga no puede verificar su propio pago
  const cont = s.crearUsuario('CONTADOR');
  const propio = s.ok(cont.token, 'pagos.registrar', { beneficiario_id: b.id, importe: 10 });
  assert.equal(err(s.llamar(cont.token, 'pagos.verificar', { pago_id: propio.id, referencia_verificada: 'x' })), 'SEGREGACION');
  assert.equal(err(s.llamar(cont.token, 'pagos.verificar', { pago_id: pago.id })), 'VALIDACION');
  s.ok(cont.token, 'pagos.verificar', { pago_id: pago.id, referencia_verificada: 'Extracto PRUEBA 01' });
  assert.equal(err(s.llamar(cont.token, 'pagos.verificar', { pago_id: pago.id, referencia_verificada: 'x' })), 'TRANSICION');
  let cuenta = s.ok(s.sa, 'cuotas.estadoCuenta', { beneficiario_id: b.id });
  assert.equal(cuenta.totales.pagado, 250000);
  assert.equal(cuenta.cuotas[0].estado, 'PAGADA');
  assert.equal(cuenta.cuotas[1].estado, 'PAGADA');
  assert.equal(cuenta.cuotas[2].estado, 'PAGADA_PARCIAL');
  const recibo = s.ok(s.sa, 'pagos.recibo', { pago_id: pago.id });
  assert.equal(recibo.importe, 250000);
  // MOVIMIENTOS es de solo agregado
  const mov = s.g.Repo.todos('MOVIMIENTOS')[0];
  assert.throws(() => s.g.Repo.actualizar('MOVIMIENTOS', mov.id, { importe: 1 }, {}), /solo agregado/);
  // Anulación: movimiento compensatorio y cuotas restauradas
  s.ok(s.sa, 'pagos.anular', { pago_id: pago.id, motivo: 'Rebote bancario PRUEBA' });
  assert.equal(s.ok(s.sa, 'finanzas.saldo', { proyecto_id: f.id }).saldo, 0);
  assert.equal(s.g.Repo.todos('MOVIMIENTOS').length, 2);
  cuenta = s.ok(s.sa, 'cuotas.estadoCuenta', { beneficiario_id: b.id });
  assert.equal(cuenta.totales.pagado, 0);
});

test('Conciliación: sugiere coincidencias pero no acredita', () => {
  const s = sistemaInstalado();
  const { f, b } = escenarioBase(s);
  const at = s.crearUsuario('ATENCION_BENEFICIARIO');
  const p = s.ok(at.token, 'pagos.registrar', { beneficiario_id: b.id, importe: 12345.67, referencia_bancaria: 'REF-77', fecha: '01/11/2026' });
  const r = s.ok(s.sa, 'finanzas.conciliar', { proyecto_id: f.id, extracto: [{ fecha: '02/11/2026', importe: 12345.67, referencia: 'REF-77' }, { importe: 1 }] });
  assert.equal(r[0].sugerencia.pago_id, p.id);
  assert.equal(r[0].sugerencia.confianza, 100);
  assert.equal(r[1].sugerencia, null);
  assert.equal(s.g.Repo.obtener('PAGOS', p.id).estado, 'PENDIENTE_VERIFICACION');
});

test('Portal del beneficiario: aislamiento estricto de la información', () => {
  const s = sistemaInstalado();
  const A = escenarioBase(s);
  const b2 = s.ok(s.sa, 'datos.crear', { hoja: 'BENEFICIARIOS', registro: { proyecto_id: A.f.id, nombre: 'PRUEBA Otro', documento: '00.000.002' } });
  s.ok(s.sa, 'cuotas.generarPlan', { proyecto_id: A.f.id, beneficiario_id: b2.id, valor_total: 1000, cantidad_cuotas: 2, primer_vencimiento: '01/12/2026' });
  const ben = s.crearUsuario('BENEFICIARIO', { beneficiario_id: A.b.id });
  const res = s.ok(ben.token, 'portal.resumen', { beneficiario_id: b2.id });
  assert.equal(res.beneficiario.id, A.b.id, 'ignora el id enviado por el navegador');
  assert.equal(err(s.llamar(ben.token, 'datos.listar', { hoja: 'BENEFICIARIOS' })), 'PROHIBIDO');
  assert.equal(err(s.llamar(ben.token, 'cuotas.estadoCuenta', { beneficiario_id: b2.id })), 'PROHIBIDO');
  // Pago informado desde el portal queda pendiente; recibo ajeno prohibido
  const pi = s.ok(ben.token, 'portal.informarPago', { importe: 500, referencia_bancaria: 'X1' });
  assert.equal(pi.estado, 'PENDIENTE_VERIFICACION');
  const at = s.crearUsuario('ATENCION_BENEFICIARIO');
  const ajeno = s.ok(at.token, 'pagos.registrar', { beneficiario_id: b2.id, importe: 500 });
  s.ok(s.sa, 'pagos.verificar', { pago_id: ajeno.id, referencia_verificada: 'E1' });
  assert.equal(err(s.llamar(ben.token, 'portal.recibo', { pago_id: ajeno.id })), 'PROHIBIDO');
  s.ok(ben.token, 'portal.solicitud', { asunto: 'Consulta PRUEBA', mensaje: 'Detalle' });
  const legajo = s.ok(s.sa, 'beneficiarios.legajo', { beneficiario_id: A.b.id });
  assert.equal(legajo.solicitudes.length, 1);
  assert.equal(legajo.tiene_usuario_portal, true);
});

test('Cesiones: flujo completo sin aprobación automática, con fundamento y respaldo documental', () => {
  const s = sistemaInstalado();
  const { f, b } = escenarioBase(s);
  s.ok(s.sa, 'cuotas.generarPlan', { proyecto_id: f.id, beneficiario_id: b.id, valor_total: 1200, cantidad_cuotas: 3, primer_vencimiento: '01/12/2026' });
  const ben = s.crearUsuario('BENEFICIARIO', { beneficiario_id: b.id });
  const c = s.ok(ben.token, 'portal.solicitarCesion', { alternativa: 'CESION_DERECHOS', motivo: 'Mudanza PRUEBA' });
  assert.equal(c.estado, 'INICIADA');
  assert.equal(err(s.llamar(ben.token, 'portal.solicitarCesion', { alternativa: 'REEMBOLSO', motivo: 'x' })), 'DUPLICADO');
  assert.equal(err(s.llamar(s.sa, 'cesiones.decidir', { cesion_id: c.id, decision: 'APROBADA', fundamento: 'x'.repeat(30) })), 'TRANSICION');
  s.ok(s.sa, 'cesiones.avanzar', { cesion_id: c.id, estado: 'EN_ANALISIS' });
  s.ok(s.sa, 'cesiones.registrarCesionario', { cesion_id: c.id, nombre: 'PRUEBA Cesionario', oferta: 1000 });
  const esc = s.ok(s.sa, 'cesiones.calcularEscenario', { cesion_id: c.id, clausula: 'Cl. 10 PRUEBA', porcentaje_reintegro: 80 });
  assert.match(esc.advertencia, /no vinculante/);
  const docp = s.ok(s.sa, 'cesiones.documentoPreliminar', { cesion_id: c.id });
  assert.match(docp.texto, /NO VINCULANTE/);
  s.ok(s.sa, 'cesiones.avanzar', { cesion_id: c.id, estado: 'PENDIENTE_DECISION' });
  assert.equal(err(s.llamar(s.sa, 'cesiones.decidir', { cesion_id: c.id, decision: 'APROBADA', fundamento: 'corto' })), 'VALIDACION');
  const com = s.crearUsuario('ASESOR_COMERCIAL');
  assert.equal(err(s.llamar(com.token, 'cesiones.decidir', { cesion_id: c.id, decision: 'APROBADA', fundamento: 'x'.repeat(30) })), 'PROHIBIDO');
  const jur = s.crearUsuario('ASESOR_JURIDICO');
  s.ok(jur.token, 'cesiones.decidir', { cesion_id: c.id, decision: 'APROBADA', fundamento: 'Cumple cláusula 10 del contrato PRUEBA' });
  assert.equal(err(s.llamar(jur.token, 'cesiones.formalizar', { cesion_id: c.id, nuevo_nombre: 'PRUEBA Nuevo', nuevo_documento: '9' })), 'VALIDACION');
  const doc = s.ok(s.sa, 'datos.crear', { hoja: 'DOCUMENTOS', registro: { proyecto_id: f.id, titulo: 'Instrumento de cesión PRUEBA firmado' } });
  const r = s.ok(jur.token, 'cesiones.formalizar', { cesion_id: c.id, documento_id: doc.id, nuevo_nombre: 'PRUEBA Nuevo', nuevo_documento: '00.000.009', importe_ingreso_cesion: 100 });
  assert.equal(s.g.Repo.obtener('BENEFICIARIOS', b.id).estado, 'CEDIDO');
  const nuevas = s.g.Repo.todos('CUOTAS', q => q.beneficiario_id === r.nuevo_beneficiario_id);
  assert.equal(nuevas.length, 3);
  assert.equal(s.ok(s.sa, 'finanzas.saldo', { proyecto_id: f.id }).porTipo.INGRESO_CESION, 100);
  assert.equal(err(s.llamar(jur.token, 'cesiones.formalizar', { cesion_id: c.id, documento_id: doc.id })), 'TRANSICION');
});

test('Desvinculación: reintegro registrado como egreso y cuotas pendientes anuladas', () => {
  const s = sistemaInstalado();
  const { f, b, u } = escenarioBase(s);
  s.ok(s.sa, 'preliminar.verificar', { aporte_id: s.ok(s.sa, 'preliminar.registrar', { proyecto_id: f.id, aportante_nombre: 'PRUEBA', importe: 10000 }).id });
  s.ok(s.sa, 'cuotas.generarPlan', { proyecto_id: f.id, beneficiario_id: b.id, valor_total: 3000, cantidad_cuotas: 3, primer_vencimiento: '01/12/2026' });
  const c = s.ok(s.sa, 'cesiones.iniciar', { beneficiario_id: b.id, alternativa: 'RESOLUCION_CONTRACTUAL', motivo: 'PRUEBA' });
  s.ok(s.sa, 'cesiones.avanzar', { cesion_id: c.id, estado: 'EN_ANALISIS' });
  s.ok(s.sa, 'cesiones.avanzar', { cesion_id: c.id, estado: 'PENDIENTE_DECISION' });
  s.ok(s.sa, 'cesiones.decidir', { cesion_id: c.id, decision: 'APROBADA', fundamento: 'Resolución acordada según contrato PRUEBA' });
  const doc = s.ok(s.sa, 'datos.crear', { hoja: 'DOCUMENTOS', registro: { proyecto_id: f.id, titulo: 'Acta de resolución PRUEBA' } });
  s.ok(s.sa, 'cesiones.formalizar', { cesion_id: c.id, documento_id: doc.id, importe_reintegro: 800 });
  assert.equal(s.ok(s.sa, 'finanzas.saldo', { proyecto_id: f.id }).saldo, 9200);
  assert.ok(s.g.Repo.todos('CUOTAS', q => q.beneficiario_id === b.id).every(q => q.estado === 'ANULADA'));
  assert.equal(s.g.Repo.obtener('UNIDADES', u.id).disponible, true);
  assert.equal(s.g.Repo.todos('DESVINCULACIONES').length, 1);
});

test('Obras: el avance surge solo de certificaciones aprobadas por otro usuario y genera alertas', () => {
  const s = sistemaInstalado();
  const { f } = escenarioBase(s);
  const o = s.ok(s.sa, 'datos.crear', { hoja: 'OBRAS', registro: { proyecto_id: f.id, nombre: 'PRUEBA Obra', presupuesto: 1000, fecha_inicio_prevista: '01/01/2026', fecha_fin_prevista: '31/12/2026' } });
  const e1 = s.ok(s.sa, 'datos.crear', { hoja: 'ETAPAS_OBRA', registro: { proyecto_id: f.id, obra_id: o.id, nombre: 'Estructura', peso_porcentual: 60, orden: 1 } });
  s.ok(s.sa, 'datos.crear', { hoja: 'ETAPAS_OBRA', registro: { proyecto_id: f.id, obra_id: o.id, nombre: 'Terminaciones', peso_porcentual: 40, orden: 2, fecha_fin_prevista: '01/02/2026' } });
  assert.equal(err(s.llamar(s.sa, 'datos.actualizar', { hoja: 'OBRAS', id: o.id, cambios: { avance_fisico: 90 } })), 'PROHIBIDO');
  const ro = s.crearUsuario('RESPONSABLE_OBRA', { proyectos_asignados: f.id });
  const cert = s.ok(ro.token, 'obras.presentarCertificacion', { etapa_id: e1.id, avance_porcentual: 50, profesional: 'Ing. PRUEBA' });
  assert.equal(err(s.llamar(ro.token, 'obras.decidirCertificacion', { certificacion_id: cert.id })), 'PROHIBIDO');
  s.ok(s.sa, 'obras.decidirCertificacion', { certificacion_id: cert.id });
  const t = s.ok(s.sa, 'obras.tablero', { obra_id: o.id });
  assert.equal(t.avance_fisico, 30);
  const r = s.g.Obras.controlar({ actor: 'prueba' });
  assert.ok(r.alertas >= 2);
  const tipos = s.g.Repo.todos('ALERTAS').map(a => a.tipo);
  assert.ok(tipos.includes('OBRA_ATRASADA') && tipos.includes('ETAPA_VENCIDA') && tipos.includes('CERTIFICACION_SIN_DOCUMENTO'));
  const n = s.g.Repo.todos('ALERTAS').length;
  s.g.Obras.controlar({ actor: 'prueba' });
  assert.equal(s.g.Repo.todos('ALERTAS').length, n, 'alertas idempotentes por día');
});

test('Mora: cuotas vencidas generan alertas sin calcular intereses si el contrato no los define', () => {
  const s = sistemaInstalado();
  const { f, b } = escenarioBase(s);
  s.ok(s.sa, 'cuotas.generarPlan', { proyecto_id: f.id, beneficiario_id: b.id, valor_total: 3000, cantidad_cuotas: 3, primer_vencimiento: '01/01/2025' });
  s.g.Finanzas.actualizarMora({ actor: 'prueba' });
  const cuotas = s.g.Repo.todos('CUOTAS');
  assert.ok(cuotas.every(c => c.estado === 'VENCIDA' && Number(c.interes_mora) === 0));
  assert.equal(s.ok(s.sa, 'finanzas.morosidad', { proyecto_id: f.id })[0].cuotas, 3);
  assert.equal(s.g.Repo.todos('ALERTAS', a => a.tipo === 'MORA').length, 3);
  s.g.Finanzas.actualizarMora({ actor: 'prueba' });
  assert.equal(s.g.Repo.todos('ALERTAS', a => a.tipo === 'MORA').length, 3);
});

test('Contenidos: revisor jurídico, aprobación humana obligatoria y nunca se publica lo no aprobado', () => {
  const s = sistemaInstalado();
  const rev = s.ok(s.sa, 'contenidos.revisarTexto', { texto: 'Rentabilidad garantizada del 30% anual, sin riesgo.' });
  assert.equal(rev.apto, false);
  assert.ok(rev.criticas >= 2);
  const c = s.ok(s.sa, 'contenidos.crear', { titulo: 'PRUEBA ¿Qué es un fideicomiso?' });
  assert.equal(err(s.llamar(s.sa, 'publicaciones.programar', { contenido_id: c.id, plataforma: 'YOUTUBE' })), 'NO_APROBADO');
  ['INVESTIGACION', 'PLANIFICACION', 'GUION'].forEach(e => s.ok(s.sa, 'contenidos.avanzar', { contenido_id: c.id, estado: e }));
  const g1 = s.ok(s.sa, 'contenidos.guardarGuion', { contenido_id: c.id, texto: 'Ganancia segura garantizada.' });
  assert.equal(g1.revision.apto, false);
  const jur = s.crearUsuario('ASESOR_JURIDICO');
  assert.equal(err(s.llamar(jur.token, 'contenidos.avanzar', { contenido_id: c.id, estado: 'GUION_APROBADO' })), 'REVISION_JURIDICA');
  s.ok(s.sa, 'contenidos.guardarGuion', { contenido_id: c.id, texto: 'Explicamos cómo funciona un fideicomiso inmobiliario. Información orientativa: las condiciones surgen del contrato.' });
  s.ok(jur.token, 'contenidos.avanzar', { contenido_id: c.id, estado: 'GUION_APROBADO' });
  assert.equal(err(s.llamar(s.sa, 'contenidos.avanzar', { contenido_id: c.id, estado: 'EDICION' })), 'TRANSICION');
  ['AUDIO', 'IMAGENES', 'EDICION', 'SUBTITULOS', 'REVISION_TECNICA', 'PENDIENTE_APROBACION_FINAL']
    .forEach(e => s.ok(s.sa, 'contenidos.avanzar', { contenido_id: c.id, estado: e }));
  assert.equal(err(s.llamar(jur.token, 'contenidos.aprobarFinal', { contenido_id: c.id })), 'PROHIBIDO');
  s.ok(s.sa, 'contenidos.aprobarFinal', { contenido_id: c.id });
  const p = s.ok(s.sa, 'publicaciones.programar', { contenido_id: c.id, plataforma: 'YOUTUBE', fecha_programada: '2026-12-01T12:00:00Z' });
  assert.equal(err(s.llamar(s.sa, 'publicaciones.registrarPublicada', { publicacion_id: p.id, enlace: 'javascript:alert(1)' })), 'VALIDACION');
  s.ok(s.sa, 'publicaciones.registrarPublicada', { publicacion_id: p.id, enlace: 'https://youtube.com/watch?v=PRUEBA' });
  assert.equal(s.g.Repo.obtener('CONTENIDOS', c.id).estado, 'PUBLICADO');
  // Agentes: modalidad declarada con honestidad
  const ag = s.ok(s.sa, 'agentes.ejecutar', { codigo: 'GUIONISTA' });
  assert.equal(ag.ejecutado, false);
  assert.match(ag.instrucciones, /manualmente con Claude Code/);
  assert.equal(s.ok(s.sa, 'agentes.ejecutar', { codigo: 'ASESOR_COMERCIAL', texto: 'Tengo un lote para ofrecer' }).resultado.clasificacion, 'PROPIETARIO_TERRENO');
});

test('Copias de seguridad y restauración: restaura datos, crea copia previa y preserva la auditoría', () => {
  const s = sistemaInstalado();
  const { f, b } = escenarioBase(s);
  const bak = s.ok(s.sa, 'respaldos.crear');
  s.ok(s.sa, 'datos.actualizar', { hoja: 'BENEFICIARIOS', id: b.id, cambios: { nombre: 'PRUEBA Cambiado' } });
  const auditAntes = s.g.Repo.todos('AUDITORIA').length;
  const adm = s.crearUsuario('ADMINISTRADOR');
  assert.equal(err(s.llamar(adm.token, 'respaldos.restaurar', { respaldo_id: bak.id, confirmacion: 'RESTAURAR', motivo: 'x' })), 'PROHIBIDO');
  assert.equal(err(s.llamar(s.sa, 'respaldos.restaurar', { respaldo_id: bak.id, motivo: 'x' })), 'VALIDACION');
  const r = s.ok(s.sa, 'respaldos.restaurar', { respaldo_id: bak.id, confirmacion: 'RESTAURAR', motivo: 'Prueba de recuperación', hojas: ['BENEFICIARIOS'] });
  assert.equal(s.g.Repo.obtener('BENEFICIARIOS', b.id).nombre, 'PRUEBA Beneficiario');
  assert.ok(r.copia_previa);
  assert.ok(s.g.Repo.todos('AUDITORIA').length > auditAntes, 'la auditoría no se restaura, solo crece');
  assert.equal(s.g.Repo.todos('COPIAS_SEGURIDAD').length, 2);
  assert.equal(s.g.Auditoria.verificarCadena().ok, true);
  assert.ok(f.id);
});

test('Integridad: detecta ediciones directas, valida, versiona y alerta inconsistencias; cadena de auditoría', () => {
  const s = sistemaInstalado();
  const { b } = escenarioBase(s);
  const libro = Object.values(s.g.__estado.libros)[0];
  const h = libro.getSheetByName('BENEFICIARIOS');
  const enc = h.datos[0];
  const fila = h.datos.findIndex(r => r[0] === b.id);
  // Edición válida
  h.datos[fila][enc.indexOf('telefono')] = '+54 351 5550000';
  // Edición inválida (referencia rota) en otra hoja
  const hu = libro.getSheetByName('UNIDADES');
  hu.datos[1][hu.datos[0].indexOf('beneficiario_id')] = 'BEN-NO-EXISTE';
  s.g.dbInvalidar_();
  const inf = s.g.Integridad.verificar({ actor: 'prueba' });
  assert.equal(inf.ediciones_externas, 1);
  assert.ok(inf.inconsistencias.some(i => i.hoja === 'UNIDADES'));
  assert.equal(s.g.Repo.obtener('BENEFICIARIOS', b.id).version, 2);
  assert.ok(s.g.Repo.todos('AUDITORIA').some(a => a.operacion === 'EDICION_EXTERNA_VALIDADA'));
  assert.ok(s.g.Repo.todos('ALERTAS').some(a => a.tipo === 'INCONSISTENCIA_DATOS'));
  assert.equal(inf.auditoria.ok, true);
  // Alteración de la auditoría
  const ha = libro.getSheetByName('AUDITORIA');
  ha.datos[3][ha.datos[0].indexOf('motivo')] = 'alterado';
  s.g.dbInvalidar_();
  assert.equal(s.g.Auditoria.verificarCadena().ok, false);
  // Disparador onEdit: revierte cambio de id
  const trig = s.g.__estado.triggers.find(t => t.getHandlerFunction() === 'alEditarHoja');
  const rango = h.getRange(fila + 1, 1);
  const original = rango.getValue();
  rango.setValue('BEN-MANUAL');
  s.g.alEditarHoja({ triggerUid: trig.getUniqueId(), range: rango, value: 'BEN-MANUAL', oldValue: original });
  assert.equal(rango.getValue(), original);
});

test('Cola de tareas: idempotencia, reintentos, errores y activadores legítimos', () => {
  const s = sistemaInstalado();
  const ctx = { actor: 'prueba' };
  const t1 = s.g.Tareas.encolar(ctx, 'CONTROL_OBRAS', {}, 'CO-1');
  const t2 = s.g.Tareas.encolar(ctx, 'CONTROL_OBRAS', {}, 'CO-1');
  assert.equal(t1.id, t2.id);
  s.g.MANEJADORES_TAREA.FALLA = () => { throw new Error('falla simulada'); };
  const tf = s.g.Tareas.encolar(ctx, 'FALLA', {}, 'F-1');
  for (let i = 0; i < 5; i++) s.g.Tareas.procesar(ctx);
  assert.equal(s.g.Repo.obtener('TAREAS', t1.id).estado, 'COMPLETADA');
  const fin = s.g.Repo.obtener('TAREAS', tf.id);
  assert.equal(fin.estado, 'ERROR');
  assert.equal(fin.intentos, 5);
  assert.ok(s.g.Repo.todos('ALERTAS').some(a => a.tipo === 'TAREA_FALLIDA'));
  s.ok(s.sa, 'tareas.reintentar', { tarea_id: tf.id });
  assert.equal(s.g.Repo.obtener('TAREAS', tf.id).estado, 'PENDIENTE');
  // Activadores: invocación sin triggerUid válido no ejecuta nada
  assert.match(s.g.trabajoDiario(), /Solo ejecutable/);
  assert.match(s.g.trabajoDiario({ triggerUid: 'falso' }), /Solo ejecutable/);
  const trig = s.g.__estado.triggers.find(t => t.getHandlerFunction() === 'trabajoDiario');
  const r = s.g.trabajoDiario({ triggerUid: trig.getUniqueId() });
  assert.ok(r.procesadas >= 6);
  const r2 = s.g.trabajoDiario({ triggerUid: trig.getUniqueId() });
  assert.equal(r2.procesadas, 0, 'las tareas diarias no se duplican');
});

test('Dashboard: indicadores por fideicomiso sin mezclar recursos y filtro por proyecto', () => {
  const s = sistemaInstalado();
  const A = escenarioBase(s);
  const B = s.ok(s.sa, 'fideicomisos.crear', { denominacion: 'PRUEBA B', tipo_fideicomiso: 'ORDINARIO', modalidad_oferta: 'PRIVADA' });
  s.ok(s.sa, 'preliminar.verificar', { aporte_id: s.ok(s.sa, 'preliminar.registrar', { proyecto_id: A.f.id, aportante_nombre: 'PRUEBA', importe: 100 }).id });
  s.ok(s.sa, 'preliminar.verificar', { aporte_id: s.ok(s.sa, 'preliminar.registrar', { proyecto_id: B.id, aportante_nombre: 'PRUEBA', importe: 900 }).id });
  const k = s.ok(s.sa, 'dashboard.indicadores', {});
  assert.equal(k.porFideicomiso.length, 2);
  assert.equal(k.porFideicomiso.find(x => x.id === A.f.id).saldo, 100);
  assert.equal(k.porFideicomiso.find(x => x.id === B.id).saldo, 900);
  assert.equal(s.ok(s.sa, 'dashboard.indicadores', { proyecto_id: B.id }).porFideicomiso.length, 1);
});

test('Datos de prueba: solo con habilitación explícita y claramente identificados', () => {
  const s = sistemaInstalado();
  assert.match(s.g.cargarDatosPrueba(), /Deshabilitado/);
  s.ok(s.sa, 'configuracion.guardar', { clave: 'permitir_datos_prueba', valor: 'true' });
  assert.match(s.g.cargarDatosPrueba(), /cargados/);
  const f = s.g.Repo.todos('PROYECTOS')[0];
  assert.equal(f.es_prueba, true);
  assert.ok(s.g.Repo.todos('BENEFICIARIOS').every(b => b.nombre.startsWith('PRUEBA') && b.email.endsWith('.invalid')));
});

test('Superficie expuesta: solo las funciones públicas previstas son invocables por google.script.run', () => {
  const g = cargarBackend();
  const permitidas = ['doGet', 'doPost', 'api', 'instalar', 'migrar', 'generarCodigoInstalacion', 'instalarActivadores',
    'cargarDatosPrueba', 'trabajoDiario', 'trabajoHorario', 'trabajoSemanal', 'alEditarHoja'];
  const expuestas = Object.keys(g).filter(k => typeof g[k] === 'function' && !k.endsWith('_') && /^[a-z]/.test(k));
  const sobrantes = expuestas.filter(k => !permitidas.includes(k));
  assert.deepEqual(sobrantes, [], 'funciones globales expuestas: ' + sobrantes.join(', '));
});
