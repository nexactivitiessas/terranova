# Decisiones e intervenciones pendientes del propietario

## Necesarias para el despliegue
1. **Cuenta de Google** de la empresa (recomendado: exclusiva, con verificación en dos pasos) donde se instalará todo.
2. **Repositorio GitHub privado**: crear el repositorio y subir este código (ver instrucciones en el informe de la sesión).
3. **Contraseña del SUPERADMIN**: definirla usted en `?p=setup`. Debe ser nueva, distinta de cualquiera compartida en conversaciones o documentos.

## Jurídicas y financieras (no se resuelven técnicamente)
4. Estructura de cada fideicomiso (ordinario/financiero, oferta privada/pública) y su encuadre regulatorio — con asesoría profesional.
5. Modelos de contrato: adhesión, aporte preliminar, cesión, resolución. El sistema guarda las **reglas de salida** y **condiciones de aporte** como texto aprobado.
6. Si los aportes preliminares otorgan algún derecho, beneficio o devolución, y en qué condiciones.
7. Tasa de mora e índice de ajuste de cuotas: el sistema **no** los aplica hasta que se configuren según contrato
   (`tasa_mora_diaria`; el ajuste por índice — p. ej. CAC — está pendiente de definir la fórmula contractual).
8. **Cuentas bancarias receptoras** (titularidad del fideicomiso), procedimiento de conciliación y responsables. No hay cobros online.
9. Textos legales: aviso legal, política de privacidad y consentimiento (Ley 25.326 de Protección de Datos Personales) — revisión por abogado.

## Comerciales y de marca
10. Nombre comercial definitivo, logotipo, colores, fotografías/renders (con derechos de uso), datos de contacto públicos.
11. Si se habilita WhatsApp Business Cloud API, previa revisión de costos de Meta.

## Técnicas (con recomendación)
12. Hash de contraseñas: 600 iteraciones por limitación de tiempo de Apps Script. Recomendado medir en producción y subir si el login tarda < 1 s.
13. Base de pruebas separada de la productiva (recomendado: segundo proyecto Apps Script).
14. Dominio propio: solo como enlace a la URL de Apps Script (sin costo de hosting).
