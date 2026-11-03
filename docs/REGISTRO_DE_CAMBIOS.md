# Registro de cambios

Formato: versión — fecha (DD/MM/AAAA) — cambios. Versión de esquema en `APP.VERSION_ESQUEMA`.

## 0.1.0 — 03/11/2026 — Esquema v1
### Agregado
- Fases 1–5: repositorio, arquitectura, modelo de datos (40 hojas), backend Apps Script, autenticación (setup con código de un solo uso,
  hash iterado con sal y pepper, sesiones, bloqueo por fuerza bruta, recuperación), permisos por rol, módulo y fideicomiso.
- Fases 6–14 (primera versión funcional): panel administrativo, web institucional, terrenos y CRM, fideicomisos con habilitación comercial,
  pozo preliminar, libro de movimientos por fideicomiso, cuotas, pagos con verificación y segregación, conciliación asistida,
  beneficiarios y portal, obras con certificaciones, cesiones y desvinculaciones, centro de agentes, fábrica audiovisual local, calendario editorial.
- Auditoría de solo agregado con cadena de hashes; huella por fila para detectar ediciones directas; onEdit con reversión.
- Cola de tareas idempotente con reintentos; activadores diario/horario/semanal; copias de seguridad con retención y restauración.
- 24 pruebas automatizadas; servidor local de demostración; verificador de secretos; diccionario de datos generado.

### Pendiente
- Fase 15: WhatsApp (adaptador sin configurar) y redes sociales (manual).
- Fase 16–17: pruebas en Google y despliegue real (requieren la cuenta del propietario).

### Pruebas en Google
| Fecha | Responsable | Prueba | Resultado |
|---|---|---|---|
| — | — | — | Aún no realizadas |
