# Plataforma Fiduciaria Integral

Sistema para estructurar, administrar y comercializar proyectos inmobiliarios mediante **fideicomisos independientes**.
Incluye web institucional, panel administrativo, portal privado del beneficiario, CRM, captación de terrenos,
pozo preliminar, cuotas y pagos con verificación humana, control de obra, cesiones y desvinculaciones,
fábrica audiovisual local, auditoría encadenada, copias de seguridad y alertas.

**Costo operativo adicional: cero.** Corre sobre Google Apps Script + Google Sheets + Google Drive (cuenta gratuita).
Sin APIs de IA pagas, sin hosting, sin SaaS de terceros. Ver [`docs/LIMITACIONES_GRATUITAS.md`](docs/LIMITACIONES_GRATUITAS.md).

> Nombre, logotipo y colores son provisorios y se cambian desde **Configuración** en el panel.

## Estado

| Área | Estado |
|---|---|
| Backend Apps Script (20 módulos) | Implementado y probado con 24 pruebas automatizadas sobre simulación local |
| Web institucional, panel y portal | Implementados; verificados en navegador con el servidor local |
| Despliegue real en Google | **Pendiente**: requiere la cuenta de Google del propietario (ver instalación) |
| WhatsApp Business Cloud API | Adaptador escrito, **no configurado ni probado** (requiere cuenta Meta y revisión de costos) |
| Publicación automática en redes | **No implementada**: no hay vía gratuita y autorizada; se genera paquete para publicación manual |
| Voz sintética | Local con Piper / espeak-ng (no incluidos); sin motor, el sistema no genera audio |

## Estructura

```
apps-script/src/        Código que se sube a Google Apps Script (clasp)
  core/                 Configuración, esquema, repositorio, auditoría, autenticación, permisos, API, instalación
  servicios/            Lógica de negocio por módulo
  ui/                   Plantillas HTML (web pública, panel/portal, configuración inicial) + CSS compilado
agentes/                Prompts de los agentes manuales (Claude Code) y descripción de modalidades
docs/                   Documentación obligatoria
estilos/                Fuente Tailwind (se compila a ui/Estilos.html)
tests/                  Pruebas automatizadas + simulación en memoria de Apps Script
tools/                  Servidor local de demostración, fábrica audiovisual, diccionario, verificador de secretos
```

## Comandos

```bash
npm install
```

```bash
npm test
```

```bash
npm run build:css
```

```bash
node tools/servidor-local.js
```

```bash
npm run verificar-secretos
```

El servidor local (`http://127.0.0.1:8787`) ejecuta el backend real sobre una simulación en memoria con datos ficticios.
**No es productivo**: los datos se pierden al cerrarlo. Sirve para revisar la interfaz en Laragon/PC sin desplegar.

## Documentación

- [Arquitectura](docs/ARQUITECTURA.md) · [Modelo de datos](docs/MODELO_DE_DATOS.md) · [Diccionario de datos](docs/DICCIONARIO_DE_DATOS.md)
- [Seguridad](docs/SEGURIDAD.md) · [Instalación](docs/MANUAL_DE_INSTALACION.md) · [Integraciones](docs/INTEGRACIONES.md)
- [Manual del administrador](docs/MANUAL_DEL_ADMINISTRADOR.md) · [Manual del beneficiario](docs/MANUAL_DEL_BENEFICIARIO.md)
- [Plan de pruebas](docs/PLAN_DE_PRUEBAS.md) · [Limitaciones gratuitas](docs/LIMITACIONES_GRATUITAS.md) · [Registro de cambios](docs/REGISTRO_DE_CAMBIOS.md)
- [Decisiones pendientes del propietario](docs/DECISIONES_PENDIENTES.md)

## Aviso

El sistema no sustituye la intervención de profesionales (abogados, contadores, escribanos, agrimensores, directores de obra).
No ofrece rentabilidades, plazos ni reintegros garantizados. Las condiciones de cada fideicomiso surgen exclusivamente de su contrato.
