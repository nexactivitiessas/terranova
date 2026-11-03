# Plan de pruebas

## A. Pruebas automatizadas (`npm test`)
Ejecutan el backend real sobre una simulación en memoria de Apps Script (`tests/mocks/gas.js`). Resultado actual: **24/24 OK**.

| # | Prueba | Cubre (punto 28 del prompt) |
|---|---|---|
| 1 | Instalación: hojas, secretos, código de un solo uso, activadores, sin contraseñas en texto plano | Registro de usuarios, seguridad |
| 2 | Código incorrecto y contraseña débil | Registro de usuarios |
| 3 | Errores genéricos, bloqueo por fuerza bruta, logout, desactivación inmediata, auditoría de accesos | Inicio de sesión |
| 4 | Contraseña temporal obligatoria | Registro de usuarios |
| 5 | Recuperación: token por email, uso único, sin enumeración | Recuperación de acceso |
| 6 | Matriz de permisos, alcance por fideicomiso, protección de administradores, campos bloqueados | Permisos |
| 7 | Fechas, enums, integridad referencial, inyección de fórmulas, no mover entre fideicomisos, concurrencia | Integridad de datos |
| 8 | Habilitación comercial (8 requisitos) y transiciones | Creación de fideicomisos |
| 9 | Formularios web, honeypot, titularidad jurídica, embudo | Registro de terrenos |
| 10 | Aporte pendiente → verificación → movimiento idempotente; gastos con control de fondos | Aportes preliminares |
| 11 | Plan exacto e idempotente, pago no acreditado sin verificación, segregación, aplicación a cuotas, recibo, anulación compensatoria | Cuotas, pagos |
| 12 | Sugerencias sin acreditar | Conciliaciones |
| 13 | Portal: aislamiento, ignora ids del navegador, recibo ajeno prohibido, solicitudes | Legajos, portal |
| 14 | Cesión completa: sin aprobación automática, fundamento, documento firmado, transferencia | Cesiones, aprobación humana |
| 15 | Desvinculación: reintegro como egreso, cuotas anuladas, unidad liberada | Desvinculaciones |
| 16 | Avance por certificaciones aprobadas por otro usuario; alertas idempotentes | Avance de obra, alertas |
| 17 | Mora sin intereses no contractuales; alertas sin duplicar | Alertas |
| 18 | Revisor jurídico, aprobación final solo SUPERADMIN, no publicar sin aprobar, enlaces seguros, agentes honestos | Publicación, aprobación humana |
| 19 | Copia, restauración, copia previa, auditoría preservada | Copias de seguridad, restauración |
| 20 | Ediciones directas detectadas/validadas, referencias rotas alertadas, auditoría alterada detectada, onEdit revierte | Integridad |
| 21 | Cola: idempotencia, reintentos, error final, activadores no invocables desde el navegador | Automatizaciones |
| 22 | Indicadores separados por fideicomiso | Dashboard |
| 23 | Datos de prueba solo con habilitación explícita | Datos de prueba |
| 24 | Ninguna función global extra expuesta a google.script.run | Seguridad |

Prueba de interfaz: `node tools/servidor-local.js` + navegador (verificado con Playwright: web pública, formulario de contacto, login,
las 20 vistas del panel sin errores de JavaScript, acción de tablero de obra, ancho móvil sin desplazamiento horizontal).

Fábrica audiovisual: verificada con FFmpeg 6.1 generando YouTube 1920×1080 y Shorts 1080×1920 con subtítulos, portada y manifiesto,
usando un tono de prueba como audio (no hay motor de voz instalado en el entorno de desarrollo). Sin motor de voz ni `--audio`, el proceso se detiene.

## B. Pruebas en Google (manuales, obligatorias tras el despliegue) — PENDIENTES
Registrar fecha, responsable y resultado en REGISTRO_DE_CAMBIOS.md.

1. `instalar()` sin errores; la base existe en Drive y **no está compartida** con nadie.
2. Setup del SUPERADMIN; reintentar el setup → rechazado.
3. Login correcto e incorrecto; 5 fallos → bloqueo; logout.
4. Recuperación de contraseña: llega el email, el enlace funciona una vez.
5. Crear un usuario de cada rol (cuentas de prueba) y verificar el menú y una acción prohibida por rol.
6. Activar datos de prueba en una base de prueba; recorrer: fideicomiso → requisitos → comercialización; plan de cuotas; pago informado desde el portal
   → verificación por otro usuario → recibo; certificación de obra; cesión completa.
7. Editar a mano una celda de BENEFICIARIOS y una `id` → la primera queda auditada tras "Verificar integridad"; la segunda se revierte.
8. Crear copia de seguridad, modificar un dato, **restaurar** y comprobar el valor original.
9. Esperar la ejecución del activador diario y revisar TAREAS (COMPLETADA) y ALERTAS.
10. Revisar el tiempo de respuesta con datos de prueba (registrar en LIMITACIONES_GRATUITAS si supera 3 s).
11. Desde un teléfono Android: web pública, login y portal.
12. `npm run verificar-secretos` antes de cada push.
