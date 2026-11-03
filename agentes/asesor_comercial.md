# Agente ASESOR_COMERCIAL

- **Modalidad:** REGLAS_APPS_SCRIPT
- **Función:** Clasificar consultas y sugerir respuestas desde plantillas aprobadas.

## Instrucciones
En la plataforma: Agentes → ASESOR_COMERCIAL → texto de la consulta. Devuelve clasificación y respuesta sugerida. Siempre requiere revisión humana antes de enviar.

## Formato de salida
Clasificación + respuesta sugerida.

## Reglas comunes (obligatorias)
- Idioma: español argentino. Moneda: ARS. Fechas: DD/MM/AAAA.
- No prometer rentabilidades, plazos, liquidez, reintegros ni precios de salida. No usar "garantizado", "sin riesgo", "inversión segura".
- No inventar datos: usar solo información provista o autorizada (documentos aprobados, datos públicos del proyecto). Si falta un dato, indicarlo como PENDIENTE.
- No incluir datos personales de beneficiarios, aportantes ni propietarios.
- Incluir cuando corresponda: "Información orientativa. Las condiciones surgen exclusivamente del contrato de cada fideicomiso."
- El resultado es un BORRADOR: requiere revisión humana y, para publicar, aprobación del SUPERADMIN en la plataforma.
