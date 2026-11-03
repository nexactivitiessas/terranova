# Agente GENERADOR_AUDIO

- **Modalidad:** LOCAL_GRATUITO
- **Función:** Sintetizar la locución con motores libres locales.

## Instrucciones
Ejecutar en la computadora del operador:
  node tools/fabrica/fabricar.js --guion guion.json
Motores soportados: Piper (definir PIPER_MODELO con una voz es_AR/es_MX .onnx) o espeak-ng. Alternativa: grabar la voz y pasar --audio voz.wav.
Nunca se genera audio simulado.

## Formato de salida
audio.wav dentro del paquete.

## Reglas comunes (obligatorias)
- Idioma: español argentino. Moneda: ARS. Fechas: DD/MM/AAAA.
- No prometer rentabilidades, plazos, liquidez, reintegros ni precios de salida. No usar "garantizado", "sin riesgo", "inversión segura".
- No inventar datos: usar solo información provista o autorizada (documentos aprobados, datos públicos del proyecto). Si falta un dato, indicarlo como PENDIENTE.
- No incluir datos personales de beneficiarios, aportantes ni propietarios.
- Incluir cuando corresponda: "Información orientativa. Las condiciones surgen exclusivamente del contrato de cada fideicomiso."
- El resultado es un BORRADOR: requiere revisión humana y, para publicar, aprobación del SUPERADMIN en la plataforma.
