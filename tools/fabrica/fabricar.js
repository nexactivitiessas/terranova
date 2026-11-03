#!/usr/bin/env node
/**
 * Fábrica audiovisual LOCAL (gratuita): guion → audio → subtítulos → videos por formato → portada → control técnico → paquete.
 *
 * Requisitos en la computadora del operador (no en la nube):
 *   - FFmpeg y ffprobe (obligatorio).
 *   - Voz: Piper (recomendado, voces neuronales libres) o espeak-ng. Alternativa: --audio con una locución grabada.
 *     Si no hay motor de voz ni --audio, el proceso se detiene: NO se genera audio simulado.
 *
 * Uso:
 *   node tools/fabrica/fabricar.js --guion tools/fabrica/ejemplo-guion.json [--audio voz.wav] [--salida tools/fabrica/salida]
 *
 * El paquete queda en estado PENDIENTE_APROBACION: debe revisarse y aprobarse en la plataforma antes de publicarse.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync, spawnSync } = require('child_process');

const FORMATOS = {
  YOUTUBE_HORIZONTAL: { w: 1920, h: 1080, fuente: 54 },
  SHORTS_VERTICAL: { w: 1080, h: 1920, fuente: 64 },
  INSTAGRAM_REELS: { w: 1080, h: 1920, fuente: 64 },
  X: { w: 1280, h: 720, fuente: 42 },
  FACEBOOK: { w: 1080, h: 1080, fuente: 56 }
};

function args() {
  const a = {}; const v = process.argv.slice(2);
  for (let i = 0; i < v.length; i++) if (v[i].startsWith('--')) a[v[i].slice(2)] = v[i + 1] && !v[i + 1].startsWith('--') ? v[++i] : true;
  return a;
}
function existe(cmd) { return spawnSync(process.platform === 'win32' ? 'where' : 'which', [cmd]).status === 0; }
function ff(argsFf) { execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...argsFf], { stdio: 'inherit' }); }
function probe(archivo) {
  return JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', archivo], { encoding: 'utf8' }));
}
function slug(s) { return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60); }
function sha256(f) { return crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'); }
function tiempoSrt(s) {
  const ms = Math.round(s * 1000); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, se = Math.floor(ms / 1000) % 60, r = ms % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(se).padStart(2, '0')},${String(r).padStart(3, '0')}`;
}

/** Revisión jurídica mínima local (mismas reglas críticas que la plataforma). */
const CRITICAS = [/rentabilidad(es)?\s+(garantizad|asegurad|fij)/i, /\bgarantiz(a|amos|ado|ada)\b/i, /sin\s+riesgos?|riesgo\s+cero/i,
  /ganancia\s+segura|inversi[oó]n\s+segura/i, /devoluci[oó]n\s+(asegurad|garantizad)/i, /entrega\s+(asegurad|garantizad)/i];

function generarAudio(texto, destino, opciones) {
  if (opciones.audio) { ff(['-i', opciones.audio, '-ac', '1', '-ar', '44100', destino]); return 'archivo provisto: ' + path.basename(opciones.audio); }
  if (existe('piper') && process.env.PIPER_MODELO) {
    const r = spawnSync('piper', ['--model', process.env.PIPER_MODELO, '--output_file', destino], { input: texto });
    if (r.status !== 0) throw new Error('Piper falló: ' + r.stderr);
    return 'piper:' + path.basename(process.env.PIPER_MODELO);
  }
  const espeak = existe('espeak-ng') ? 'espeak-ng' : existe('espeak') ? 'espeak' : null;
  if (espeak) {
    const r = spawnSync(espeak, ['-v', 'es-419', '-s', '160', '-w', destino, texto]);
    if (r.status !== 0) throw new Error(espeak + ' falló: ' + r.stderr);
    return espeak + ':es-419';
  }
  throw new Error('No hay motor de voz disponible. Instale Piper (y defina PIPER_MODELO) o espeak-ng, o use --audio con una locución grabada. No se genera audio simulado.');
}

/** Subtítulos: frases distribuidas proporcionalmente a su longitud sobre la duración real del audio. */
function generarSrt(texto, duracion, destino) {
  const frases = texto.replace(/\s+/g, ' ').match(/[^.!?¿¡]+[.!?]*|[¿¡][^?!]+[?!]/g).map(f => f.trim()).filter(Boolean);
  const bloques = [];
  frases.forEach(f => { // máx. ~42 caracteres por línea, 2 líneas por bloque
    const palabras = f.split(' '); let actual = '';
    palabras.forEach(p => { if ((actual + ' ' + p).trim().length > 80) { bloques.push(actual.trim()); actual = p; } else actual += ' ' + p; });
    if (actual.trim()) bloques.push(actual.trim());
  });
  const total = bloques.reduce((s, b) => s + b.length, 0);
  let t = 0;
  const srt = bloques.map((b, i) => {
    const d = duracion * b.length / total; const ini = t; t += d;
    return `${i + 1}\n${tiempoSrt(ini)} --> ${tiempoSrt(Math.min(t, duracion))}\n${b}\n`;
  }).join('\n');
  fs.writeFileSync(destino, srt, 'utf8');
  return bloques.length;
}

function generarVideo(fmt, cfg, imagenes, audio, srt, duracion, destino, colores) {
  const filtros = [];
  const entradas = [];
  if (imagenes.length) {
    const porImagen = duracion / imagenes.length;
    imagenes.forEach(img => entradas.push('-loop', '1', '-t', porImagen.toFixed(3), '-i', img));
    imagenes.forEach((_, i) => filtros.push(`[${i}:v]scale=${cfg.w}:${cfg.h}:force_original_aspect_ratio=increase,crop=${cfg.w}:${cfg.h},setsar=1,fps=30,format=yuv420p[v${i}]`));
    filtros.push(imagenes.map((_, i) => `[v${i}]`).join('') + `concat=n=${imagenes.length}:v=1:a=0[base]`);
  } else {
    entradas.push('-f', 'lavfi', '-t', duracion.toFixed(3), '-i', `color=c=${colores.fondo}:s=${cfg.w}x${cfg.h}:r=30`);
    filtros.push('[0:v]format=yuv420p[base]');
  }
  const idxAudio = imagenes.length || 1;
  entradas.push('-i', audio);
  const srtEsc = srt.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
  const margen = Math.round(cfg.h * 0.08);
  filtros.push(`[base]subtitles='${srtEsc}':force_style='FontName=Inter,FontSize=${Math.round(cfg.fuente / 3)},PrimaryColour=&H00FFFFFF,OutlineColour=&H80000000,BorderStyle=3,Outline=2,Alignment=2,MarginV=${Math.round(margen / 3)}'[v]`);
  ff([...entradas, '-filter_complex', filtros.join(';'), '-map', '[v]', '-map', `${idxAudio}:a`, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
    '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', destino]);
}

/** Agente EDITOR: control técnico objetivo del archivo final. */
function controlTecnico(archivo, cfg, duracionAudio) {
  const p = probe(archivo);
  const v = p.streams.find(s => s.codec_type === 'video'); const a = p.streams.find(s => s.codec_type === 'audio');
  const dur = Number(p.format.duration);
  const obs = [];
  if (!v || v.width !== cfg.w || v.height !== cfg.h) obs.push(`Resolución ${v && v.width}x${v && v.height} distinta de ${cfg.w}x${cfg.h}`);
  if (!a) obs.push('Sin pista de audio');
  if (Math.abs(dur - duracionAudio) > 1.5) obs.push(`Duración ${dur.toFixed(1)}s difiere del audio ${duracionAudio.toFixed(1)}s`);
  return { ok: obs.length === 0, duracion_seg: Math.round(dur * 10) / 10, resolucion: v ? `${v.width}x${v.height}` : null, observaciones: obs };
}

function main() {
  const a = args();
  if (!a.guion) { console.error('Indique --guion archivo.json'); process.exit(2); }
  for (const c of ['ffmpeg', 'ffprobe']) if (!existe(c)) { console.error(`Falta ${c}. Instálelo (https://ffmpeg.org) y vuelva a intentar.`); process.exit(2); }
  const g = JSON.parse(fs.readFileSync(a.guion, 'utf8'));
  const base = path.dirname(path.resolve(a.guion));
  const texto = (g.texto || '').trim();
  if (!texto) throw new Error('El guion no tiene texto.');
  const criticas = CRITICAS.filter(re => re.test(texto)).map(re => texto.match(re)[0]);
  if (criticas.length && !a.forzar) {
    console.error('Revisión jurídica: frases críticas detectadas → ' + criticas.join(' | ') + '\nCorrija el guion (o pase --forzar SOLO con aprobación de asesoría jurídica).');
    process.exit(3);
  }
  const formatos = (g.formatos || ['YOUTUBE_HORIZONTAL', 'SHORTS_VERTICAL']).filter(f => FORMATOS[f]);
  const dir = path.resolve(a.salida || path.join(__dirname, 'salida'), (g.contenido_id ? g.contenido_id + '-' : '') + slug(g.titulo || 'contenido'));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'guion.txt'), texto + '\n', 'utf8');

  console.log('1/5 Audio…');
  const audio = path.join(dir, 'audio.wav');
  const motor = generarAudio(texto, audio, { audio: a.audio });
  const duracion = Number(probe(audio).format.duration);

  console.log('2/5 Subtítulos…');
  const srt = path.join(dir, 'subtitulos.srt');
  const bloques = generarSrt(texto, duracion, srt);

  const imagenes = (g.imagenes || []).map(i => path.resolve(base, i)).filter(i => fs.existsSync(i));
  if ((g.imagenes || []).length !== imagenes.length) console.warn('Aviso: algunas imágenes no existen y se omitieron.');
  const colores = { fondo: g.color_fondo || '0x0f3d3e' };

  console.log('3/5 Videos: ' + formatos.join(', '));
  const videos = {};
  formatos.forEach(f => {
    const destino = path.join(dir, `video_${f.toLowerCase()}.mp4`);
    generarVideo(f, FORMATOS[f], imagenes, audio, srt, duracion, destino, colores);
    videos[f] = { archivo: path.basename(destino), control: controlTecnico(destino, FORMATOS[f], duracion), sha256: sha256(destino) };
  });

  console.log('4/5 Portada…');
  const primero = path.join(dir, videos[formatos[0]].archivo);
  ff(['-ss', String(Math.min(1, duracion / 2)), '-i', primero, '-frames:v', '1', '-q:v', '3', path.join(dir, 'portada.jpg')]);

  console.log('5/5 Paquete…');
  const textos = {
    YOUTUBE: `${g.titulo}\n\n${g.descripcion || ''}\n\nInformación orientativa. Las condiciones de cada fideicomiso surgen exclusivamente de su contrato.`,
    X: `${g.titulo} ${g.hashtags || ''}`.slice(0, 270),
    INSTAGRAM: `${g.titulo}\n\n${g.descripcion || ''}\n\n${g.hashtags || ''}`,
    FACEBOOK: `${g.titulo}\n\n${g.descripcion || ''}`
  };
  fs.writeFileSync(path.join(dir, 'textos_publicacion.json'), JSON.stringify(textos, null, 2));
  const manifiesto = {
    titulo: g.titulo, contenido_id: g.contenido_id || null, proyecto_id: g.proyecto_id || null, generado_en: new Date().toISOString(),
    estado: 'PENDIENTE_APROBACION', aviso: 'No publicar hasta que el SUPERADMIN apruebe el contenido en la plataforma.',
    audio: { archivo: 'audio.wav', motor_tts: motor, duracion_seg: Math.round(duracion * 10) / 10, sha256: sha256(audio) },
    subtitulos: { archivo: 'subtitulos.srt', bloques }, portada: 'portada.jpg', videos,
    revision_juridica_local: criticas.length ? { criticas, forzado: true } : { criticas: [] }
  };
  fs.writeFileSync(path.join(dir, 'manifiesto.json'), JSON.stringify(manifiesto, null, 2));
  const fallas = Object.values(videos).filter(v => !v.control.ok);
  console.log(`\nPaquete listo en ${dir}`);
  console.log(fallas.length ? 'Control técnico con observaciones: revise manifiesto.json' : 'Control técnico: OK');
  console.log('Siguiente paso: subir los archivos a Drive, registrar AUDIOS/VIDEOS en la plataforma y solicitar la aprobación final.');
}

try { main(); } catch (e) { console.error('Error: ' + e.message); process.exit(1); }
