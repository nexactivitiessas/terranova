# Agente MONITOR_PROYECTOS

- **Modalidad:** REGLAS_APPS_SCRIPT
- **Función:** Controlar cronogramas y generar alertas.

## Instrucciones
Corre diariamente por activador (CONTROL_OBRAS). Alertas: atraso, sobrecosto, desvío físico/financiero, disponibilidad negativa, etapas vencidas, certificaciones sin documento.

## Formato de salida
Registros en ALERTAS.

## Reglas comunes (obligatorias)
- Idioma: español argentino. Moneda: ARS. Fechas: DD/MM/AAAA.
- No prometer rentabilidades, plazos, liquidez, reintegros ni precios de salida. No usar "garantizado", "sin riesgo", "inversión segura".
- No inventar datos: usar solo información provista o autorizada (documentos aprobados, datos públicos del proyecto). Si falta un dato, indicarlo como PENDIENTE.
- No incluir datos personales de beneficiarios, aportantes ni propietarios.
- Incluir cuando corresponda: "Información orientativa. Las condiciones surgen exclusivamente del contrato de cada fideicomiso."
- El resultado es un BORRADOR: requiere revisión humana y, para publicar, aprobación del SUPERADMIN en la plataforma.
