# Manual de instalación

Requisitos: una cuenta de Google (preferentemente exclusiva de la empresa, con **verificación en dos pasos**), Node.js 18+ y Git.
Todo lo usado es gratuito.

## 1. Obtener el código
```bash
git clone <URL-del-repositorio> terranova
```
```bash
cd terranova
```
```bash
npm install
```
```bash
npm test
```

En Windows con Laragon puede clonarse en `C:\laragon\www\terranova`. Laragon no es necesario para producción (el servidor es Google);
sirve para la demo local: `node tools/servidor-local.js` y abrir `http://127.0.0.1:8787`.

## 2. Crear el proyecto Apps Script
1. Ingresar a https://script.google.com con la cuenta de la empresa → **Nuevo proyecto** → nombrarlo.
2. Configuración del proyecto → copiar el **ID de secuencia de comandos**.
3. Activar la API de Apps Script para clasp: https://script.google.com/home/usersettings → Activado.

## 3. Subir el código con clasp
```bash
npm install -g @google/clasp
```
```bash
clasp login
```
```bash
cd apps-script
```
```bash
copy .clasp.json.example .clasp.json
```
(En Linux/macOS: `cp .clasp.json.example .clasp.json`.) Editar `.clasp.json` y pegar el ID. Luego:
```bash
clasp push
```
`.clasp.json` y `~/.clasprc.json` **no se suben a GitHub** (están en `.gitignore`).

## 4. Instalar
1. En el editor de Apps Script, elegir la función `instalar` y **Ejecutar**. Autorizar los permisos solicitados
   (Sheets, Drive, envío de email, activadores, conexiones externas para el adaptador de WhatsApp).
2. `instalar()` crea en Drive la carpeta "DATOS PRIVADOS" con la BASE MAESTRA, carpetas de respaldos y documentos, el secreto de autenticación,
   las 40 hojas, roles, permisos, configuración, agentes y activadores.
3. En **Registro de ejecución** aparece `CÓDIGO DE INSTALACIÓN: XXXX-XXXX-XXXX`. No compartirlo.

## 5. Publicar la aplicación web
1. **Implementar → Nueva implementación → Aplicación web**.
2. Ejecutar como: **Yo**. Quién tiene acceso: **Cualquier persona**.
3. Copiar la URL `/exec`. Esa es la web pública; el panel es `URL?p=app` y la configuración inicial `URL?p=setup`.

## 6. Crear el SUPERADMIN
Abrir `URL?p=setup`, ingresar el código, nombre, email y una contraseña **nueva** de alta seguridad. El código deja de servir.

## 7. Configurar
En el panel → **Configuración**: nombre comercial, eslogan, colores, logo e imagen de portada (URLs https públicas), WhatsApp y email públicos,
`email_alertas`, días de aviso de vencimiento. `tasa_mora_diaria` solo si el contrato la prevé.

## 8. Verificar (obligatorio antes de operar)
Seguir la sección "Pruebas en Google" de [PLAN_DE_PRUEBAS.md](PLAN_DE_PRUEBAS.md): login, permisos, alta de fideicomiso, pago con verificación,
copia de seguridad y **restauración de prueba**.

## Actualizaciones
```bash
npm test
```
```bash
npm run build:css
```
```bash
cd apps-script && clasp push
```
Luego ejecutar `migrar()` en el editor si cambió el esquema, y en **Implementar → Administrar implementaciones** editar la implementación
existente seleccionando "Nueva versión" (así la URL no cambia).

## Datos de prueba (solo en un entorno de prueba)
Poner `permitir_datos_prueba = true` en CONFIGURACION y ejecutar `cargarDatosPrueba()`. Volver a `false` después.
Recomendación: un segundo proyecto Apps Script con su propia base para pruebas.
