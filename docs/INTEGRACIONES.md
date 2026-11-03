# Integraciones

Regla: cada integración tiene un adaptador independiente, funciona en modo degradado si no está configurada y **no se declara operativa sin una prueba real**.

| Integración | Estado | Costo | Modo degradado |
|---|---|---|---|
| Google Sheets / Drive / MailApp | Implementada; probada en simulación. **Pendiente prueba real.** | Gratis dentro de cuotas | — |
| WhatsApp Business Cloud API (Meta) | Adaptador escrito (`Notificaciones.js → WhatsApp`). **No configurado ni probado.** | Ver abajo | Mensajes registrados en CONVERSACIONES y enviados manualmente; enlace `wa.me` en la web |
| Publicación en YouTube / X / Instagram / Facebook | **No implementada** | — | Paquete completo para publicación manual + registro del enlace |
| Voz sintética | Local: Piper o espeak-ng (`tools/fabrica`) | Gratis (software libre) | Locución grabada con `--audio` |
| Edición de video | Local: FFmpeg (`tools/fabrica`) | Gratis | — |
| IA generativa | Solo manual vía Claude Code Pro (herramienta de desarrollo) | Suscripción existente | Plantillas y reglas en Apps Script |

## WhatsApp Business Cloud API
Antes de habilitar:
1. **Verificar costos vigentes** en https://developers.facebook.com/docs/whatsapp/pricing — Meta cobra por mensaje según categoría
   (marketing, utilidad, autenticación) y país; las respuestas dentro de la ventana de atención iniciada por el cliente han sido gratuitas,
   pero las condiciones cambian. Los recordatorios de cuotas por plantilla probablemente tengan costo: por eso el sistema usa email por defecto.
2. Crear app en Meta for Developers, número de WhatsApp Business, token permanente de usuario del sistema.
3. Script Properties: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_VERIFY_TOKEN` (valor aleatorio propio).
4. Webhook en Meta: URL `/exec` de la aplicación y el verify token. Suscribir el campo `messages`.
5. CONFIGURACION `whatsapp_habilitado = true`. Probar con un número propio y registrar el resultado en REGISTRO_DE_CAMBIOS.

Limitaciones:
- Apps Script no expone los encabezados HTTP en `doPost`, por lo que **no se puede validar la firma `X-Hub-Signature-256`**. Los mensajes entrantes se guardan como `NO_VERIFICADO` y nunca disparan acciones sensibles.
- Solo se envía a contactos con consentimiento y sin baja (`baja_comunicaciones`).
- No usar librerías o servicios no oficiales (riesgo de bloqueo de la cuenta).

## Redes sociales
Las APIs oficiales de publicación requieren apps aprobadas, revisiones y, en algunos casos, planes pagos (por ejemplo, la API de X).
Hasta que exista una vía gratuita, oficial y aprobada por el propietario, la publicación es manual. Agregar una integración implica:
adaptador nuevo en `servicios/`, credenciales en Script Properties, verificación de términos y cuotas, y prueba real documentada.

## Email (MailApp)
Usado para recuperación de contraseña, recordatorios (solo con consentimiento), alertas críticas y reporte semanal.
Cuota diaria limitada (ver LIMITACIONES_GRATUITAS); el sistema consulta la cuota restante antes de enviar.
