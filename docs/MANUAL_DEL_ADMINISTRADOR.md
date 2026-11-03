# Manual del administrador

Ingreso: `URL?p=app`. El menú muestra solo los módulos permitidos para su rol. El selector superior filtra por fideicomiso.
Cada tabla tiene búsqueda, paginación y **Exportar CSV**; al hacer clic en una fila se abre el panel con el detalle, la edición y las acciones del registro.

## Roles
| Rol | Uso típico |
|---|---|
| SUPERADMIN | Todo. Crea administradores, restaura copias, aprueba contenidos y tareas. |
| ADMINISTRADOR | Operación general; no gestiona administradores ni restaura. |
| ADMINISTRADOR_PROYECTO | Solo los fideicomisos asignados. |
| CONTADOR | Verifica pagos y aportes, aprueba gastos, rectifica movimientos, concilia. |
| ASESOR_COMERCIAL | CRM y terrenos. |
| ASESOR_JURIDICO | Verifica titularidad, requisitos jurídicos, decide cesiones, aprueba guiones. |
| RESPONSABLE_OBRA | Presenta certificaciones de sus obras. |
| ATENCION_BENEFICIARIO | Legajos, solicitudes, carga de pagos informados. |
| BENEFICIARIO | Portal privado. |

La matriz detallada está en la hoja PERMISOS (editable por el SUPERADMIN desde Auditoría → Permisos).

## Flujos principales

### Fideicomiso
1. **Fideicomisos → Nuevo**: queda EN_EVALUACION.
2. Avance de estado con motivo: Preparación preliminar → Constitución jurídica → Lanzamiento.
3. **Marcar requisito comercial** (8 requisitos, cada uno con su respaldo). Sin los 8, el sistema impide pasar a COMERCIALIZACIÓN.
4. **Publicar en la web** solo con publicidad aprobada. Complete `descripcion_publica` e `imagen_url`.
Fideicomisos financieros u oferta pública generan una alerta crítica: consulte el régimen regulatorio aplicable.

### Terrenos
Los formularios web ingresan como NUEVO_CONTACTO con titularidad **no verificada**. El asesor jurídico registra la verificación
con su respaldo; recién entonces puede aprobarse el terreno.

### Pozo preliminar y gastos
Registrar el aporte (queda pendiente) → el contador lo **verifica contra el extracto** y se acredita en el libro del fideicomiso.
Un aporte preliminar no otorga participación ni devolución salvo que el instrumento lo establezca (complete condición y beneficios).
Los gastos se registran pendientes y se aprueban solo si hay saldo en ese fideicomiso.

### Cuotas y pagos
1. Beneficiarios → **Generar plan de cuotas** (valor total, aporte inicial, cantidad, primer vencimiento). Repetirlo no duplica.
2. Pagos → **Nuevo** o el beneficiario lo informa desde el portal: queda PENDIENTE_VERIFICACION.
3. Otro usuario autorizado **verifica contra el extracto** indicando la referencia: se acredita, se genera el movimiento y se aplica a las cuotas más antiguas.
4. Errores: **Anular** genera un asiento compensatorio; nada se borra. Recibo imprimible desde el pago acreditado.
5. **Conciliación**: pegue líneas `fecha;importe;referencia` del extracto para obtener sugerencias.
6. Cuotas → Morosidad, Proyección de recaudación, Calendario.

### Obras
Cree la obra y sus etapas con peso porcentual (suman 100). El responsable presenta certificaciones con profesional y documento;
otro usuario las aprueba. El avance físico se calcula solo de certificaciones aprobadas. El tablero compara físico, financiero y plazo.

### Cesiones y desvinculaciones
Iniciada (por el beneficiario o el personal) → En análisis → cesionarios potenciales, escenarios (con la cláusula de origen) y borrador preliminar
→ Pendiente de decisión → **decisión con fundamento** → **formalización con el instrumento firmado**.
Cesión: transfiere unidad y cuotas impagas al cesionario. Resolución/reembolso: registra el reintegro como egreso, anula cuotas pendientes y libera la unidad.

### Contenidos
Tema → … → Guion (revisión automática) → Guion aprobado (jurídico) → Audio, imágenes, edición, subtítulos (fábrica local) → Revisión técnica
→ **Aprobación final del SUPERADMIN** → Programar → publicar manualmente → registrar el enlace.

## Operación diaria
- **Alertas**: revisar y resolver indicando cómo.
- **Cola de tareas**: tareas en ERROR se pueden reintentar; "Ejecutar trabajo ahora" corre un proceso manualmente.
- **Auditoría → Verificar integridad**: muestra ediciones externas, inconsistencias y estado de la cadena de auditoría.

## Copias de seguridad
Automáticas semanales (retención configurable) y manuales. **Restaurar** (solo SUPERADMIN): elegir la copia, hojas, motivo y escribir RESTAURAR.
Antes se crea una copia PRE_RESTAURACION. La auditoría nunca se restaura. Practique una restauración en el entorno de prueba.

## Edición directa en Google Sheets
Posible para el propietario, pero toda edición queda auditada; las que rompen integridad se revierten o generan alertas.
No edite PAGOS, CUOTAS ni MOVIMIENTOS a mano: use los flujos de la aplicación.
