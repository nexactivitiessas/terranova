# Centro de agentes

Los agentes NO son servicios de IA autónomos en la nube. Hay tres modalidades, registradas en la hoja AGENTES:

| Modalidad | Dónde corre | Agentes |
|---|---|---|
| REGLAS_APPS_SCRIPT | Google Apps Script (nube, gratis) | Revisor jurídico, Asesor comercial, Atención al beneficiario, Analista financiero, Monitor de proyectos |
| MANUAL_CLAUDE_CODE | Sesión manual de un operador con Claude Code Pro | Investigador, Estratega, Guionista, Publicador |
| LOCAL_GRATUITO | Computadora local con FFmpeg + TTS libre | Generador de audio, Productor audiovisual, Editor |

Uso manual con Claude Code: abrir el repositorio y pedir, por ejemplo,
`Actuá como el agente descrito en agentes/guionista.md y escribí un guion sobre <tema>`.
El resultado se carga en la plataforma, donde pasa por revisión y aprobación humana.
