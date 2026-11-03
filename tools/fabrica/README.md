# Fábrica audiovisual local

Corre en la computadora del operador (no en la nube). Requiere FFmpeg; voz con Piper (`PIPER_MODELO=ruta/voz.onnx`) o espeak-ng, o una locución grabada.

```bash
node tools/fabrica/fabricar.js --guion tools/fabrica/ejemplo-guion.json
```

```bash
node tools/fabrica/fabricar.js --guion guion.json --audio locucion.wav
```

Salida en `tools/fabrica/salida/<contenido>/`: guion, audio, subtítulos SRT, video por formato, portada, textos por red y `manifiesto.json`
(estado PENDIENTE_APROBACION, control técnico y hashes). El guion se revisa con las reglas jurídicas críticas antes de producir.
