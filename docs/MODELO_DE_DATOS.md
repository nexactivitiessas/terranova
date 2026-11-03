# Modelo de datos

Base: un archivo de Google Sheets privado ("BASE MAESTRA") con una hoja por entidad. Definición única en
`apps-script/src/core/Esquema.js`; el detalle columna por columna está en [DICCIONARIO_DE_DATOS.md](DICCIONARIO_DE_DATOS.md) (generado).

## Principios
- **Identificador estable** `PREFIJO-AAAAMMDD-XXXXXXXXXX` en la columna `id`. Nunca se usa el número de fila.
- **Columnas comunes**: `id, proyecto_id, estado, creado_en, actualizado_en, usuario_responsable, version, es_prueba, huella`.
- **Pertenencia**: toda hoja financiera/contractual exige `proyecto_id` (fideicomiso). Las hojas globales (usuarios, CRM, contenidos, etc.) lo admiten opcional.
- **Integridad referencial** verificada al escribir (`ref:` / `refs:`) y diariamente por el control de integridad.
- **Concurrencia optimista**: `version` se incrementa en cada cambio; una edición con versión vieja se rechaza.
- **Sin borrado**: `estado = ANULADO` con motivo. Correcciones contables por asientos compensatorios.
- **Columnas solo se agregan** (migraciones aditivas). Renombrar o borrar columnas rompe la integridad.
- Las columnas no numéricas tienen formato texto para que Sheets no convierta fechas, teléfonos o códigos.

## Decisión: PROYECTOS = fideicomisos
El listado de hojas solicitado no incluye una hoja FIDEICOMISOS; cada fila de **PROYECTOS** es un fideicomiso
(unidad jurídica y contable independiente, prefijo `FID`). La obra física de ese fideicomiso vive en **OBRAS**.

## Relaciones principales

```
PROPIETARIOS 1─n TERRENOS ─1 PROYECTOS(fideicomiso) ─1 FIDUCIARIOS
PROYECTOS 1─n UNIDADES 1─1 BENEFICIARIOS ─1 CONTRATOS ─1 DOCUMENTOS
BENEFICIARIOS 1─n CUOTAS ; BENEFICIARIOS 1─n PAGOS ─1 MOVIMIENTOS
PROYECTOS 1─n APORTES_PRELIMINARES ─1 MOVIMIENTOS ; PROYECTOS 1─n GASTOS ─1 MOVIMIENTOS
PROYECTOS 1─n OBRAS 1─n ETAPAS_OBRA 1─n CERTIFICACIONES
BENEFICIARIOS 1─n CESIONES 1─0..1 DESVINCULACIONES ; CESIONES ─ nuevo_beneficiario_id
CONTACTOS_CRM 1─n OPORTUNIDADES ; CONTACTOS_CRM 1─n CONVERSACIONES
CAMPAÑAS 1─n CONTENIDOS 1─n GUIONES/AUDIOS/VIDEOS ; CONTENIDOS 1─n PUBLICACIONES
USUARIOS ─ beneficiario_id (portal) ; USUARIOS ─ proyectos_asignados (alcance)
```

## Clasificación de recursos (MOVIMIENTOS.tipo)
`APORTE_PRELIMINAR`, `APORTE_FIDUCIARIO`, `CUOTA_BENEFICIARIO`, `INGRESO_CESION`, `REINTEGRO`, `GASTO_PROYECTO`,
`GASTO_PRELIMINAR`, `AJUSTE_COMPENSATORIO`. El saldo de cada fideicomiso es la suma de sus movimientos.

## Hojas técnicas adicionales
- **MIGRACIONES**: versión de esquema aplicada.
- Las alertas, notificaciones y tareas usan `clave_idempotencia` única para evitar duplicados.

## Estados
Definidos en `ESTADOS` (`core/Config.js`): fideicomiso (10 estados del ciclo de vida con transiciones controladas),
terreno (10), embudo comercial (11 + descartado), pago, cuota, cesión, contenido (flujo de 14 pasos), tarea, certificación.

## Edición directa de Google Sheets
Permitida para administradores autorizados, con estas salvaguardas:
- Hojas sensibles protegidas con advertencia (AUDITORIA, MOVIMIENTOS, USUARIOS, PAGOS, CUOTAS, PERMISOS).
- onEdit revierte cambios a IDs, campos técnicos, encabezados, hojas de solo agregado y referencias inexistentes.
- El control diario detecta filas cuya huella no coincide: si son válidas, las versiona y audita; si no, genera alerta CRÍTICA.
- **Advertencia**: la edición directa puede alterar datos contables y contractuales. Use la aplicación para operaciones con efecto económico.
