# Limitaciones de las herramientas gratuitas

> Valores de referencia para cuentas personales gratuitas de Google. **Verificar los vigentes** en
> https://developers.google.com/apps-script/guides/services/quotas antes de operar: Google puede modificarlos.

## Google Apps Script (cuenta gratuita)
| Límite | Referencia | Cómo lo maneja el sistema |
|---|---|---|
| Tiempo por ejecución | 6 min | Lotes y corte a los 4,5 min (`APP.TIEMPO_MAX_EJECUCION_MS`); la cola continúa en la próxima hora |
| Tiempo total de activadores | 90 min/día | Trabajos diarios livianos e idempotentes |
| Activadores por usuario y script | 20 | Se usan 4 |
| Destinatarios de email | 100/día | Se consulta la cuota; recordatorios limitados por lote |
| Llamadas UrlFetch | 20.000/día | Solo el adaptador de WhatsApp |
| Ejecuciones simultáneas | ~30 | LockService serializa escrituras; uso pensado para un equipo chico |
| CacheService | 100 KB por valor, 6 h máximo | Sesiones pequeñas; vencimiento absoluto 6 h |
| Script Properties | ~500 KB total | Solo secretos e IDs |

## Google Sheets
- Máximo 10 millones de celdas por archivo. Con ~40 hojas y ~25 columnas promedio, alcanza para cientos de miles de filas en total,
  pero el rendimiento se degrada antes: cada solicitud lee la hoja completa que necesita.
- **Umbral práctico estimado**: decenas de miles de filas en las hojas más grandes (AUDITORIA, CUOTAS). Al acercarse:
  archivar auditoría antigua en otro archivo, o separar una base por fideicomiso.
- Latencia: cada operación tarda típicamente 1–3 s. No es una base transaccional; LockService evita escrituras simultáneas.

## Drive
15 GB compartidos entre Gmail, Drive y Fotos de la cuenta gratuita. Videos y copias de seguridad consumen espacio:
la retención de copias automáticas es configurable (`retencion_respaldos`). Guardar videos finales fuera de la cuenta principal si crece.

## Web App de Apps Script
- La URL es de `script.google.com`. Dominio propio: no hay mapeo directo gratuito; se puede enlazar desde un dominio propio.
- Se muestra un aviso de Google en apps de cuentas personales ("Esta aplicación fue creada por un usuario de Google…").
- Sin control de encabezados HTTP ni cookies propias; sin IP del visitante (el límite antiabuso es por email y global).
- No apta para alto tráfico; adecuada para un sitio institucional y operación interna de una empresa chica/mediana.

## GitHub
- Repositorio privado gratuito: código y documentación. **Nunca datos de clientes ni secretos.**
- GitHub Pages: solo documentación o demostraciones no comerciales (no se usa como producción).

## Claude Code Pro
Herramienta de desarrollo y asistencia manual. **No** es una API disponible para visitantes ni un motor de agentes autónomos en producción.

## Software local
FFmpeg, Piper y espeak-ng son libres. Requieren una computadora del operador encendida: la fábrica audiovisual no corre en la nube.
