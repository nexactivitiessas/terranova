/**
 * Configuracion.js — Configuración global (marca, colores, contacto) y menú por rol.
 * Los valores viven en la hoja CONFIGURACION. Solo las claves con publica=TRUE llegan a la web institucional.
 */
var CONFIG_DEFECTO = [
  { clave: 'nombre_comercial', valor: 'Plataforma Fiduciaria Integral', publica: true, descripcion: 'Nombre visible de la empresa' },
  { clave: 'eslogan', valor: 'Desarrollos inmobiliarios mediante fideicomisos, con transparencia y trazabilidad.', publica: true, descripcion: 'Frase principal de la portada' },
  { clave: 'logo_url', valor: '', publica: true, descripcion: 'URL pública del logotipo (Drive compartido o imagen)' },
  { clave: 'imagen_portada_url', valor: '', publica: true, descripcion: 'Fotografía o render de portada (URL pública https)' },
  { clave: 'color_primario', valor: '#0f3d3e', publica: true, descripcion: 'Color principal (hex)' },
  { clave: 'color_secundario', valor: '#c8a96a', publica: true, descripcion: 'Color de acento (hex)' },
  { clave: 'whatsapp_publico', valor: '', publica: true, descripcion: 'Número de WhatsApp en formato internacional, sin +' },
  { clave: 'email_publico', valor: '', publica: true, descripcion: 'Email de contacto público' },
  { clave: 'direccion_publica', valor: '', publica: true, descripcion: 'Dirección comercial' },
  { clave: 'aviso_legal', valor: 'La información publicada es orientativa y no constituye oferta pública. Las condiciones de cada fideicomiso surgen exclusivamente de su contrato. No se garantizan rentabilidades, plazos ni precios.', publica: true, descripcion: 'Texto legal al pie' },
  { clave: 'email_alertas', valor: '', publica: false, descripcion: 'Email que recibe alertas críticas' },
  { clave: 'dias_aviso_vencimiento', valor: '5', publica: false, descripcion: 'Días de anticipación para recordar cuotas' },
  { clave: 'tasa_mora_diaria', valor: '0', publica: false, descripcion: 'Tasa diaria de mora (%) SOLO si el contrato la prevé. 0 = no calcular' },
  { clave: 'umbral_desvio_fisico_financiero', valor: '10', publica: false, descripcion: 'Puntos porcentuales de diferencia que disparan alerta' },
  { clave: 'retencion_respaldos', valor: '30', publica: false, descripcion: 'Cantidad de copias de seguridad automáticas a conservar' },
  { clave: 'whatsapp_habilitado', valor: 'false', publica: false, descripcion: 'Habilita el adaptador de WhatsApp Cloud API (requiere credenciales en Script Properties)' }
];

var Configuracion = {
  _cache: null,
  todas: function () {
    if (Configuracion._cache) return Configuracion._cache;
    var m = {};
    CONFIG_DEFECTO.forEach(function (c) { m[c.clave] = c.valor; });
    try { Repo.todos('CONFIGURACION').forEach(function (c) { m[c.clave] = c.valor; }); } catch (e) { /* no instalado */ }
    Configuracion._cache = m;
    return m;
  },
  valor: function (clave) { return Configuracion.todas()[clave]; },
  numero: function (clave) { return Number(Configuracion.valor(clave)) || 0; },

  marcaPublica: function () {
    var pub = {};
    var todas = Configuracion.todas();
    var publicas = {};
    CONFIG_DEFECTO.forEach(function (c) { publicas[c.clave] = c.publica; });
    try { Repo.todos('CONFIGURACION').forEach(function (c) { publicas[c.clave] = !!c.publica; }); } catch (e) { /* */ }
    Object.keys(todas).forEach(function (k) { if (publicas[k]) pub[k] = todas[k]; });
    // Colores: solo hex válidos (evita inyección de CSS)
    ['color_primario', 'color_secundario'].forEach(function (k) {
      if (!/^#[0-9a-fA-F]{6}$/.test(pub[k] || '')) pub[k] = k === 'color_primario' ? '#0f3d3e' : '#c8a96a';
    });
    return pub;
  },

  guardar: function (ctx, clave, valor) {
    var existente = Repo.buscarPor('CONFIGURACION', 'clave', clave);
    Configuracion._cache = null;
    if (existente) return Repo.actualizar('CONFIGURACION', existente.id, { valor: valor }, ctx);
    var def = CONFIG_DEFECTO.filter(function (c) { return c.clave === clave; })[0] || {};
    return Repo.crear('CONFIGURACION', { clave: clave, valor: valor, publica: !!def.publica, descripcion: def.descripcion || '', estado: 'ACTIVO' }, ctx);
  }
};

/** Menú lateral según permisos efectivos del usuario. */
var MENU_ITEMS = [
  { id: 'dashboard', titulo: 'Tablero', modulo: 'reportes', icono: 'chart' },
  { id: 'fideicomisos', titulo: 'Fideicomisos', modulo: 'fideicomisos', icono: 'building' },
  { id: 'terrenos', titulo: 'Terrenos', modulo: 'terrenos', icono: 'map' },
  { id: 'crm', titulo: 'CRM comercial', modulo: 'crm', icono: 'users' },
  { id: 'preliminar', titulo: 'Pozo preliminar', modulo: 'preliminar', icono: 'coins' },
  { id: 'beneficiarios', titulo: 'Beneficiarios', modulo: 'beneficiarios', icono: 'id' },
  { id: 'cuotas', titulo: 'Cuotas', modulo: 'cuotas', icono: 'calendar' },
  { id: 'pagos', titulo: 'Pagos', modulo: 'pagos', icono: 'check' },
  { id: 'finanzas', titulo: 'Finanzas', modulo: 'finanzas', icono: 'ledger' },
  { id: 'obras', titulo: 'Obras', modulo: 'obras', icono: 'crane' },
  { id: 'cesiones', titulo: 'Cesiones y salidas', modulo: 'cesiones', icono: 'swap' },
  { id: 'documentos', titulo: 'Documentos', modulo: 'documentos', icono: 'file' },
  { id: 'contenidos', titulo: 'Fábrica de contenidos', modulo: 'contenidos', icono: 'film' },
  { id: 'publicaciones', titulo: 'Publicaciones', modulo: 'publicaciones', icono: 'send' },
  { id: 'agentes', titulo: 'Agentes', modulo: 'agentes', icono: 'robot' },
  { id: 'alertas', titulo: 'Alertas', modulo: 'alertas', icono: 'bell' },
  { id: 'tareas', titulo: 'Cola de tareas', modulo: 'tareas', icono: 'queue' },
  { id: 'usuarios', titulo: 'Usuarios', modulo: 'usuarios', icono: 'lock' },
  { id: 'auditoria', titulo: 'Auditoría', modulo: 'auditoria', icono: 'eye' },
  { id: 'respaldos', titulo: 'Copias de seguridad', modulo: 'respaldos', icono: 'save' },
  { id: 'configuracion', titulo: 'Configuración', modulo: 'configuracion', icono: 'gear' },
  { id: 'portal', titulo: 'Mi fideicomiso', modulo: 'portal', icono: 'home', soloBeneficiario: true }
];

var Menu = {
  para: function (usuario) {
    return MENU_ITEMS.filter(function (it) {
      if (it.soloBeneficiario) return usuario.rol === ROLES.BENEFICIARIO;
      return Permisos.tiene(usuario, it.modulo, 'leer');
    }).map(function (it) { return { id: it.id, titulo: it.titulo, icono: it.icono, modulo: it.modulo }; });
  }
};
