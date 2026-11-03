# Seguridad

## Superadministrador inicial
- `instalar()` genera un **código de instalación de un solo uso**, visible solo en el registro de ejecución del propietario; se guarda su hash.
- En `?p=setup` el propietario ingresa ese código y define una contraseña **nueva** (no la compartida en conversaciones o documentos).
- La contraseña nunca queda en código, HTML, GitHub ni Sheets: solo el hash. Al crearse la cuenta, el código se elimina.

## Contraseñas
- Hash `v1$600$sal$hash`: 600 iteraciones de HMAC-SHA256 con sal aleatoria por usuario y *pepper* de 256 bits en Script Properties
  (una filtración de la hoja sola no permite verificar contraseñas). Comparación en tiempo constante.
- Política: ≥12 caracteres, mayúscula, minúscula, número y símbolo; no puede contener el usuario.
- Usuarios creados por un administrador reciben contraseña temporal aleatoria que deben cambiar antes de operar.
- Limitación: Apps Script no ofrece bcrypt/argon2 nativo; 600 iteraciones es un compromiso con el tiempo de ejecución. Ver mejora en DECISIONES_PENDIENTES.

## Sesiones
- Token aleatorio de 256 bits; en CacheService solo su SHA-256. Inactividad 60 min, máximo absoluto 6 h. Cierre de sesión borra el token.
- Cada solicitud relee el usuario: desactivar o cambiar de rol tiene efecto inmediato.
- El token se guarda en `sessionStorage` (por pestaña) y viaja como parámetro, no como cookie → **no hay superficie CSRF**.

## Fuerza bruta y abuso
- 5 intentos fallidos → bloqueo de 15 min por cuenta; además límite por email en CacheService.
- Mensaje genérico ante email inexistente (tiempo similar) para evitar enumeración. Recuperación con respuesta idéntica exista o no la cuenta.
- Formularios públicos: honeypot, consentimiento obligatorio, límite por email y global por minuto.

## Autorización
- Matriz rol × módulo × acción en la hoja PERMISOS (sembrada desde `PERMISOS_DEFECTO`), SUPERADMIN siempre total.
- Alcance por fideicomiso para ADMINISTRADOR_PROYECTO y RESPONSABLE_OBRA (`proyectos_asignados`).
- Beneficiario: solo acciones `portal.*`; el legajo se toma de la sesión, nunca del navegador.
- Segregación de funciones: quien carga un pago o presenta una certificación no puede aprobarla (salvo SUPERADMIN).
- Solo SUPERADMIN crea/modifica administradores, restaura copias, aprueba contenidos y tareas que requieren aprobación.
- Campos con efecto económico/contractual bloqueados en el CRUD genérico; solo cambian por su flujo.

## Entradas y salidas
- Validación de tipos, fechas reales, enums, emails, teléfonos, longitudes, referencias y unicidad en el servidor.
- Neutralización de inyección de fórmulas (`=`, `+`, `-`, `@`) al guardar en Sheets y en CSV exportados.
- XSS: toda salida dinámica pasa por `esc()`; plantillas con `<?= ?>` (escapado contextual); URLs solo `https://`.
- Columnas `sensible` (hash de contraseña, token de recuperación) nunca se envían al navegador ni a la auditoría.
- `X-Frame-Options` por defecto (no embebible).

## Superficie expuesta
Apps Script permite llamar desde el navegador a cualquier función global pública. Solo son públicas:
`doGet, doPost, api, instalar, migrar, generarCodigoInstalacion, instalarActivadores, cargarDatosPrueba, trabajoDiario, trabajoHorario, trabajoSemanal, alEditarHoja`.
Todas son idempotentes y no exponen secretos; los activadores exigen un `triggerUid` real y `cargarDatosPrueba` exige `permitir_datos_prueba=true`.
Una prueba automatizada falla si aparece otra función pública.

## Auditoría
Solo agregado, con cadena de hashes (`hash_previo` → `hash`) y cabeza en Script Properties. Detecta modificación, reordenamiento o eliminación de asientos.
Registra accesos, fallos de login, cambios con valor anterior/nuevo, motivos, aprobaciones, exportaciones, restauraciones, ediciones directas y errores internos.

## Secretos
- Script Properties: `SPREADSHEET_ID, AUTH_PEPPER, SETUP_CODE_HASH, BACKUP_FOLDER_ID, DRIVE_FOLDER_ID, WHATSAPP_*, AUDIT_ULTIMO_HASH`.
- `.clasp.json` y `.clasprc.json` excluidos por `.gitignore`. `npm run verificar-secretos` revisa los archivos versionados.
- Nunca versionar datos reales; los datos de prueba usan prefijo PRUEBA y dominio `.invalid`.

## Riesgos residuales conocidos
- El propietario (editor de la hoja) puede alterar datos directamente: queda detectado y auditado, no impedido.
- La web corre como el propietario: proteger su cuenta Google con verificación en dos pasos es **imprescindible**.
- doPost no puede validar la firma de Meta (Apps Script no expone encabezados): mensajes entrantes de WhatsApp se marcan NO_VERIFICADO.
- CacheService puede expulsar entradas antes de tiempo (cierres de sesión inesperados).
