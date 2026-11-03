#!/usr/bin/env node
/** Genera docs/DICCIONARIO_DE_DATOS.md desde el esquema real (apps-script/src/core/Esquema.js). */
const fs = require('fs');
const path = require('path');
const { cargarBackend } = require('../tests/cargar');
const g = cargarBackend();
const tipos = { texto: 'Texto', numero: 'Número', moneda: 'Importe ARS', fecha: 'Fecha (AAAA-MM-DD; UI DD/MM/AAAA)', fechahora: 'Fecha y hora ISO 8601 (UTC)',
  bool: 'Verdadero/Falso', email: 'Email', telefono: 'Teléfono', json: 'JSON', enum: 'Lista cerrada', ref: 'Referencia', refs: 'Referencias (ids separados por coma)' };
let md = '# Diccionario de datos\n\n> Generado automáticamente por `node tools/generar-diccionario.js` a partir de `apps-script/src/core/Esquema.js`. No editar a mano.\n\n';
md += 'Columnas comunes a todas las hojas: `id` (identificador estable PREFIJO-AAAAMMDD-XXXXXXXXXX), `proyecto_id` (fideicomiso), `estado`, `creado_en`, `actualizado_en`, `usuario_responsable`, `version` (control de concurrencia), `es_prueba`, `huella` (SHA-256 truncado del contenido, detecta ediciones directas).\n\n';
md += 'Banderas: **req** obligatorio · **único** · **sensible** (nunca se envía al navegador) · **PII** dato personal.\n\n';
md += '| Hoja | Prefijo | Solo agregado | Requiere fideicomiso |\n|---|---|---|---|\n';
g.esquemaHojas_().forEach(h => { md += `| ${h} | ${g.ESQUEMA[h].prefijo} | ${g.HOJAS_SOLO_AGREGADO.includes(h) ? 'Sí' : 'No'} | ${g.HOJAS_GLOBALES.includes(h) ? 'No' : 'Sí'} |\n`; });
g.esquemaHojas_().forEach(h => {
  md += `\n## ${h}\n\n| Columna | Tipo | Detalle | Banderas |\n|---|---|---|---|\n`;
  g.esquemaColumnas_(h).forEach(c => {
    const det = c.opciones ? c.opciones.join(', ') : c.ref ? '→ ' + c.ref : '';
    const fl = [c.req && 'req', c.unico && 'único', c.sensible && 'sensible', c.pii && 'PII'].filter(Boolean).join(', ');
    md += `| ${c.nombre} | ${tipos[c.tipo] || c.tipo} | ${det} | ${fl} |\n`;
  });
});
fs.writeFileSync(path.join(__dirname, '..', 'docs', 'DICCIONARIO_DE_DATOS.md'), md);
console.log('Diccionario generado: ' + g.esquemaHojas_().length + ' hojas');
