/**
 * Notificaciones.js — Envío de notificaciones (email gratuito vía MailApp, portal) y adaptador de WhatsApp.
 *
 * Regla: ninguna integración externa se simula. Si no está configurada, se registra como pendiente
 * y el sistema sigue funcionando en modo degradado.
 */
var Notificar = {
  /** Envía email respetando la cuota diaria gratuita de MailApp. Devuelve true si se envió. */
  email: function (destinatario, asunto, cuerpo) {
    if (!esEmail_(destinatario)) return false;
    var restante = MailApp.getRemainingDailyQuota();
    if (restante < 1) {
      console.warn('Cuota de MailApp agotada; email no enviado a ' + destinatario);
      return false;
    }
    var marca = Configuracion.valor('nombre_comercial');
    MailApp.sendEmail({ to: destinatario, subject: '[' + marca + '] ' + asunto, body: cuerpo, noReply: false });
    return true;
  },

  /** Registra una notificación (idempotente) e intenta enviarla por el canal indicado. */
  enviar: function (ctx, n) {
    var reg = Repo.crear('NOTIFICACIONES', {
      destinatario: n.destinatario, canal: n.canal || 'PORTAL', asunto: n.asunto || '', mensaje: n.mensaje,
      proyecto_id: n.proyecto_id || '', estado: 'PENDIENTE', clave_idempotencia: n.clave_idempotencia || ''
    }, ctx, { sinAuditoria: true });
    if (reg.estado !== 'PENDIENTE') return reg; // ya procesada (idempotencia)
    var ok = false, error = '';
    try {
      if (reg.canal === 'EMAIL') ok = Notificar.email(reg.destinatario, reg.asunto, reg.mensaje);
      else if (reg.canal === 'WHATSAPP') ok = WhatsApp.enviarTexto(reg.destinatario, reg.mensaje).ok;
      else ok = true; // PORTAL: queda disponible para el usuario
      if (!ok) error = 'Canal no disponible o cuota agotada';
    } catch (e) { error = String(e.message).substring(0, 500); }
    return Repo.actualizar('NOTIFICACIONES', reg.id, { estado: ok ? 'ENVIADA' : 'ERROR', enviada_en: ok ? ahoraIso_() : '', error: error },
      ctx, { sinAuditoria: true });
  }
};

/**
 * Adaptador WhatsApp Business Cloud API (oficial de Meta).
 * Estado: NO CONFIGURADO por defecto. Requiere en Script Properties: WHATSAPP_TOKEN, WHATSAPP_PHONE_ID,
 * WHATSAPP_VERIFY_TOKEN y en CONFIGURACION whatsapp_habilitado=true. Ver docs/INTEGRACIONES.md.
 * Limitación conocida: Apps Script no expone encabezados HTTP en doPost, por lo que no puede validarse la firma
 * X-Hub-Signature-256 de Meta. Por eso los mensajes entrantes se registran como NO_VERIFICADOS y nunca disparan
 * acciones sensibles.
 */
var WhatsApp = {
  configurado: function () {
    return Configuracion.valor('whatsapp_habilitado') === 'true' && !!propiedad_(PROP.WHATSAPP_TOKEN) && !!propiedad_(PROP.WHATSAPP_PHONE_ID);
  },

  estado: function () {
    return { configurado: WhatsApp.configurado(), mensaje: WhatsApp.configurado()
      ? 'Credenciales cargadas. Verifique con una prueba real antes de usar en producción.'
      : 'No configurado. Los mensajes se registran en el CRM y se envían manualmente.' };
  },

  enviarTexto: function (telefono, texto) {
    if (!WhatsApp.configurado()) return { ok: false, motivo: 'NO_CONFIGURADO' };
    var contacto = Repo.buscarPor('CONTACTOS_CRM', 'telefono', telefono);
    if (contacto && (contacto.baja_comunicaciones || !contacto.consentimiento)) return { ok: false, motivo: 'SIN_CONSENTIMIENTO' };
    var url = 'https://graph.facebook.com/v20.0/' + propiedad_(PROP.WHATSAPP_PHONE_ID) + '/messages';
    var resp = UrlFetchApp.fetch(url, {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + propiedad_(PROP.WHATSAPP_TOKEN) },
      payload: JSON.stringify({ messaging_product: 'whatsapp', to: String(telefono).replace(/\D/g, ''), type: 'text', text: { body: texto } })
    });
    var code = resp.getResponseCode();
    return { ok: code >= 200 && code < 300, codigo: code };
  },

  verificarWebhook: function (prm) {
    var esperado = propiedad_(PROP.WHATSAPP_VERIFY_TOKEN);
    if (esperado && prm['hub.verify_token'] === esperado) return ContentService.createTextOutput(String(prm['hub.challenge'] || ''));
    return ContentService.createTextOutput('forbidden');
  },

  recibirWebhook: function (e) {
    if (!WhatsApp.configurado() || !e || !e.postData) return { ok: true, ignorado: true };
    var body = JSON.parse(e.postData.contents || '{}');
    var ctx = { actor: 'whatsapp', origen: 'webhook' };
    var registrados = 0;
    (body.entry || []).forEach(function (en) {
      (en.changes || []).forEach(function (ch) {
        var v = ch.value || {};
        (v.messages || []).forEach(function (m) {
          if (Repo.buscarPor('CONVERSACIONES', 'id_externo', m.id)) return; // idempotencia
          var tel = String(m.from || '');
          var c = Repo.buscarPor('CONTACTOS_CRM', 'telefono', tel) || Repo.crear('CONTACTOS_CRM', {
            nombre: (v.contacts && v.contacts[0] && v.contacts[0].profile && v.contacts[0].profile.name) || ('WhatsApp ' + tel),
            telefono: tel, fuente: 'WHATSAPP', clasificacion: 'CONSULTA_GENERAL', estado: 'NUEVO_CONTACTO', consentimiento: false
          }, ctx);
          Repo.crear('CONVERSACIONES', { contacto_id: c.id, canal: 'WHATSAPP', direccion: 'ENTRANTE',
            mensaje: (m.text && m.text.body) || '[' + m.type + ']', fecha: ahoraIso_(), id_externo: m.id, estado: 'NO_VERIFICADO' }, ctx, { sinAuditoria: true });
          registrados++;
        });
      });
    });
    return { ok: true, registrados: registrados };
  }
};
