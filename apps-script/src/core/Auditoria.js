/**
 * Auditoria.js — Registro de auditoría de solo agregado con encadenamiento de hashes.
 *
 * Cada asiento guarda hash_previo y hash = SHA256(hash_previo + contenido). Si alguien edita o borra
 * una fila directamente en Google Sheets, verificarCadena() detecta la ruptura de la cadena.
 */
var Auditoria = {
  registrar: function (ctx, ev) {
    return dbConLock_(function () {
      var previo = propiedad_(PROP.AUDIT_ULTIMO_HASH) || 'GENESIS';
      var reg = {
        id: nuevoId_('AUD'),
        proyecto_id: ev.proyecto_id || '',
        estado: ev.resultado || 'OK',
        creado_en: ahoraIso_(),
        usuario: ctx && ctx.usuario ? ctx.usuario.email : (ctx && ctx.actor) || 'sistema',
        operacion: limpiarTexto_(ev.operacion, 80),
        hoja: ev.hoja || '',
        registro_id: ev.registro_id || '',
        valor_anterior: ev.valor_anterior ? JSON.stringify(ev.valor_anterior).substring(0, 20000) : '',
        valor_nuevo: ev.valor_nuevo ? JSON.stringify(ev.valor_nuevo).substring(0, 20000) : '',
        motivo: limpiarTexto_(ev.motivo || '', 1000),
        resultado: ev.resultado || 'OK',
        aprobacion: ev.aprobacion || '',
        origen: (ctx && ctx.origen) || 'app',
        hash_previo: previo
      };
      reg.actualizado_en = reg.creado_en;
      reg.version = 1;
      reg.usuario_responsable = reg.usuario;
      reg.hash = Auditoria.calcularHash(reg);
      var h = dbHoja_('AUDITORIA');
      var enc = dbTabla_('AUDITORIA').encabezados;
      reg.huella = huellaRegistro_('AUDITORIA', reg);
      h.appendRow(dbFilaAArray_(enc, reg));
      dbInvalidar_('AUDITORIA');
      fijarPropiedad_(PROP.AUDIT_ULTIMO_HASH, reg.hash);
      return reg;
    });
  },

  calcularHash: function (r) {
    return sha256Hex_([r.hash_previo, r.id, r.creado_en, r.usuario, r.operacion, r.hoja, r.registro_id,
      r.valor_anterior, r.valor_nuevo, r.motivo, r.resultado, r.aprobacion].join('|'));
  },

  /** Recorre la auditoría en orden de inserción y verifica la cadena. */
  verificarCadena: function () {
    var filas = dbTabla_('AUDITORIA').filas.slice().sort(function (a, b) { return a._fila - b._fila; });
    var previo = 'GENESIS';
    for (var i = 0; i < filas.length; i++) {
      var r = filas[i];
      if (r.hash_previo !== previo) return { ok: false, registro: r.id, motivo: 'Cadena rota (falta o se reordenó un asiento)' };
      if (Auditoria.calcularHash(r) !== r.hash) return { ok: false, registro: r.id, motivo: 'Contenido alterado' };
      previo = r.hash;
    }
    var cabeza = propiedad_(PROP.AUDIT_ULTIMO_HASH) || 'GENESIS';
    if (filas.length && cabeza !== previo) return { ok: false, registro: null, motivo: 'Se eliminaron asientos finales' };
    return { ok: true, asientos: filas.length };
  }
};
