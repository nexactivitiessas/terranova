#!/usr/bin/env node
/**
 * Busca secretos o datos sensibles en los archivos versionados antes de subir a GitHub.
 * Falla (código 1) si encuentra coincidencias.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const archivos = execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(f => f && fs.existsSync(f) && !f.startsWith('node_modules'));
const patrones = [
  [/AIza[0-9A-Za-z_\-]{35}/, 'Clave de API de Google'],
  [/ya29\.[0-9A-Za-z_\-]+/, 'Token OAuth de Google'],
  [/EAA[A-Za-z0-9]{40,}/, 'Token de Meta/WhatsApp'],
  [/sk-[A-Za-z0-9]{20,}/, 'Clave de API tipo sk-'],
  [/-----BEGIN (RSA |EC )?PRIVATE KEY-----/, 'Clave privada'],
  [/"refresh_token"\s*:/, 'refresh_token (¿.clasprc.json?)'],
  [/"scriptId"\s*:\s*"(?!PEGAR_AQUI)[A-Za-z0-9_\-]{20,}"/, 'scriptId real (usar .clasp.json local, no versionado)'],
  [/(password|contrase(ñ|n)a)\s*[:=]\s*(?!['"]password['"])['"][^'"\s]{8,}['"]/i, 'Posible contraseña literal']
];
const permitidos = ['tests/', 'tools/verificar-secretos.js'];
let hallazgos = 0;
for (const f of archivos) {
  if (permitidos.some(p => f.startsWith(p))) continue;
  const txt = fs.readFileSync(f, 'utf8');
  txt.split('\n').forEach((linea, i) => {
    for (const [re, nombre] of patrones) {
      if (re.test(linea)) { hallazgos++; console.log(`${f}:${i + 1}  ${nombre}`); }
    }
  });
}
if (['.clasp.json', 'apps-script/.clasp.json', '.clasprc.json'].some(f => archivos.includes(f))) { hallazgos++; console.log('Archivo de credenciales clasp versionado'); }
console.log(hallazgos ? `\n${hallazgos} posible(s) secreto(s). Revise antes de subir.` : 'Sin secretos detectados en archivos versionados.');
process.exit(hallazgos ? 1 : 0);
