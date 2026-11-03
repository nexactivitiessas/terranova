# Arquitectura

## Vista general

```
Navegador (web pública / panel / portal)          Computadora local del operador
  HTML5 + Tailwind compilado + JS                    tools/fabrica (FFmpeg + Piper/espeak-ng)
        │ google.script.run.api({accion, token, datos, idempotencia})      Claude Code (agentes manuales)
        ▼
Google Apps Script (V8) — Web App "ejecutar como propietario"
  Api.js  → despachador único: sesión → permiso de módulo → acción → respuesta uniforme {ok, datos|error}
  Servicios (Fideicomisos, Comercial, Finanzas, Beneficiarios, Obras, Cesiones, Contenidos, Sistema, Dashboard)
  Núcleo: Repo (Db.js) · Auditoria · Auth · Permisos · Esquema · Instalación/migraciones
  Activadores instalables: diario, horario, semanal, onEdit de la hoja
        │
        ▼
Google Sheets (BASE MAESTRA privada) · Google Drive (respaldos, documentos) · MailApp (avisos)
        │ (opcional, apagado por defecto)
        ▼
WhatsApp Business Cloud API (adaptador)
```

## Decisiones principales

| Decisión | Motivo |
|---|---|
| Web App de Apps Script como único servidor (público y privado) | Costo cero; HTTPS y hosting de Google; el prompt prohíbe GitHub Pages para producción. |
| Ejecutar como el propietario, acceso "cualquiera" | Permite que visitantes y beneficiarios sin cuenta Google usen la app; la autorización se hace en el backend con sesiones propias. La hoja nunca se comparte. |
| Un solo despachador `api()` | Superficie expuesta mínima; validación de sesión y permisos centralizada; errores uniformes con código de incidente. |
| Funciones globales privadas (`_`) | Apps Script permite invocar cualquier función global desde el navegador; se verifica con una prueba automatizada. |
| Sesiones en CacheService con token aleatorio y hash | Sin cookies (no hay CSRF), expiración deslizante de 60 min y absoluta de 6 h. Estado/rol revalidados en cada solicitud. |
| Esquema declarativo + migraciones aditivas | Las hojas son editables por el propietario; nunca se reordenan columnas ni se usan números de fila como ID. |
| Huella por fila + onEdit + cadena de hashes en auditoría | Detecta ediciones directas en Sheets, las valida, versiona y alerta; detecta alteraciones de la auditoría. |
| Cola de tareas con idempotencia | Reintentos seguros sin duplicar pagos, movimientos ni alertas; respeta el límite de 6 min por ejecución. |
| Tailwind compilado e incrustado | Sin CDN en producción, carga rápida y sin dependencias externas en tiempo de ejecución. |
| Agentes en tres modalidades | Honestidad sobre dónde corre cada agente: reglas en la nube, manual con Claude Code, o local. |

## Módulos (20) y dónde están

| # | Módulo | Backend | UI |
|---|---|---|---|
| 1 | Web institucional | `Comercial.js` (Publico) | `ui/Publico.html` |
| 2 | Panel superadmin | `Api.js`, `Configuracion.js` | `ui/App.html`, `ui/AppJs.html` |
| 3 | Usuarios y permisos | `Auth.js`, `Permisos.js`, `Datos.js` | Usuarios |
| 4 | CRM inmobiliario | `Comercial.js` (Crm) | CRM comercial |
| 5 | Captación de terrenos | `Comercial.js` (Terrenos) | Terrenos |
| 6 | Fideicomisos | `Fideicomisos.js` | Fideicomisos |
| 7 | Pozo preliminar | `Finanzas.js` | Pozo preliminar |
| 8 | Aportes y cuotas | `Finanzas.js` | Cuotas / Pagos |
| 9 | Beneficiarios | `Beneficiarios.js` | Beneficiarios |
| 10 | Proyectos y obras | `Obras.js` | Obras |
| 11 | Control financiero | `Finanzas.js` | Finanzas |
| 12 | Gestión documental | `Datos.js` (DOCUMENTOS, CONTRATOS) | Documentos |
| 13 | Cesiones y desvinculaciones | `Cesiones.js` | Cesiones y salidas |
| 14 | Portal del beneficiario | `Beneficiarios.js` (Portal) | Mi fideicomiso |
| 15 | Centro de agentes | `Contenidos.js` (Agentes), `/agentes` | Agentes |
| 16 | Fábrica audiovisual | `Contenidos.js` + `tools/fabrica` | Fábrica de contenidos |
| 17 | Publicaciones | `Contenidos.js` | Calendario editorial |
| 18 | Alertas | `Sistema.js` (Alertas, Automatizaciones) | Alertas |
| 19 | Auditoría y trazabilidad | `Auditoria.js`, `Sistema.js` (Integridad) | Auditoría |
| 20 | Reportes | `Dashboard.js`, `datos.exportar` | Tablero, Exportar CSV |

## Flujo de una solicitud
1. El navegador llama `api({accion, token, datos})`.
2. `Auth.usuarioDeSesion` valida el token (hash en CacheService) y relee el usuario (activo, rol actual).
3. Si el usuario tiene contraseña temporal, solo puede cambiarla.
4. `Permisos.exigir(usuario, modulo, permiso)`; dentro del servicio, `Permisos.exigirProyecto` para roles con alcance por fideicomiso; el portal toma el beneficiario solo de la sesión.
5. `Repo` valida tipos, integridad referencial, unicidad y versión; escribe bajo `LockService`; registra auditoría encadenada.
6. Respuesta `{ok, datos}` o `{ok:false, error:{codigo, mensaje}}`; errores inesperados devuelven un código de incidente y se auditan.

## Automatizaciones (activadores instalables)
- **Diario 06:00**: mora, recordatorios de cuotas (solo con consentimiento), control de obras, seguimiento comercial y de cesiones, integridad.
- **Horario**: procesa la cola de tareas pendientes.
- **Semanal (lunes 07:00)**: copia de seguridad y reporte por email.
- **onEdit de la hoja**: audita ediciones directas y revierte cambios prohibidos de una celda (IDs, campos técnicos, hojas de solo agregado, referencias inválidas).

Los activadores verifican `triggerUid` contra los activadores reales del proyecto, por lo que no pueden dispararse desde el navegador.
