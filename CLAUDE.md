# CLAUDE.md — Instrucciones permanentes para sesiones de desarrollo

## Proyecto
Plataforma Fiduciaria Integral: Google Apps Script (V8) + Google Sheets como base de datos + HtmlService para la web.
Idioma de código, UI y documentación: **español argentino**. Moneda ARS. Zona horaria America/Argentina/Cordoba. Fechas DD/MM/AAAA en la UI, AAAA-MM-DD almacenadas.

## Reglas no negociables
1. **Costo adicional cero.** No agregar dependencias pagas, APIs de IA, hosting, ni SaaS. Toda integración externa va en un adaptador independiente con modo degradado.
2. **Seguridad en el backend.** Toda acción se declara en un `ACC_*` con `accion(modulo, permiso, fn)` y valida permisos/alcance (`Permisos.exigirProyecto`) en el servidor.
3. **Funciones globales privadas.** Toda función top-level nueva termina en `_` salvo los puntos de entrada listados en la prueba "Superficie expuesta" (`tests/backend.test.js`). google.script.run puede invocar cualquier función pública: nunca expongas helpers.
4. **Nunca secretos en el repo.** Van en Script Properties (`PROP` en `core/Config.js`). Ejecutar `npm run verificar-secretos` antes de cada commit.
5. **Trazabilidad.** No hay borrado físico (`Repo.anular`). `AUDITORIA`, `MOVIMIENTOS`, `CONVERSACIONES` son de solo agregado; las correcciones son movimientos compensatorios (`Movimientos.rectificar`).
6. **Fideicomisos separados.** Todo registro financiero lleva `proyecto_id`; nunca sumar importes de fideicomisos distintos sin identificarlos.
7. **Aprobación humana** para acreditar pagos/aportes, aprobar certificaciones, decidir cesiones, aprobar contenidos (SUPERADMIN) y publicar.
8. **No simular**: no inventar datos, no afirmar que una integración funciona si no fue probada contra el servicio real.
9. **Idempotencia**: operaciones reintentables usan `clave_idempotencia`.
10. Respetar cuotas de Apps Script: lotes (`APP.LOTE_MAX`), tiempo máximo (`APP.TIEMPO_MAX_EJECUCION_MS`), un `dbTabla_` por hoja por ejecución.

## Cómo agregar un campo o una hoja
1. Editar `apps-script/src/core/Esquema.js` (solo agregar; nunca renombrar/borrar columnas existentes).
2. Si es una hoja nueva: agregarla a `HOJAS_API` (Datos.js) con su módulo y campos bloqueados.
3. Incrementar `APP.VERSION_ESQUEMA` y documentar en `docs/REGISTRO_DE_CAMBIOS.md`.
4. `node tools/generar-diccionario.js` y `npm test`. En producción, ejecutar `migrar()` desde el editor.

## Cómo agregar una acción
Declararla en el `ACC_*` del servicio con el módulo/permiso correcto, agregar la prueba en `tests/backend.test.js`
(incluido un caso de rol sin permiso) y, si corresponde, la acción en la vista de `ui/AppJs.html`.

## Comandos
- `npm test` — pruebas (Node + simulación de Apps Script en `tests/mocks/gas.js`).
- `npm run build:css` — compila Tailwind e incrusta en `ui/Estilos.html` (obligatorio tras cambiar clases en HTML).
- `node tools/servidor-local.js` — demo local con datos ficticios.
- `cd apps-script && clasp push` — despliegue (requiere `.clasp.json` local, no versionado).

## Orden de carga
En Apps Script los archivos se evalúan en orden; `core/Api.js` define `accion_` usada al cargar los servicios. Mantener `filePushOrder` de `.clasp.json.example`.

## Límites del simulador
`tests/mocks/gas.js` no reproduce cuotas, permisos de Drive, tiempos reales ni el comportamiento exacto de Sheets con tipos. Toda fase debe validarse además en el despliegue real (ver `docs/PLAN_DE_PRUEBAS.md`, sección "Pruebas en Google").
