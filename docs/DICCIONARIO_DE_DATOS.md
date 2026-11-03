# Diccionario de datos

> Generado automáticamente por `node tools/generar-diccionario.js` a partir de `apps-script/src/core/Esquema.js`. No editar a mano.

Columnas comunes a todas las hojas: `id` (identificador estable PREFIJO-AAAAMMDD-XXXXXXXXXX), `proyecto_id` (fideicomiso), `estado`, `creado_en`, `actualizado_en`, `usuario_responsable`, `version` (control de concurrencia), `es_prueba`, `huella` (SHA-256 truncado del contenido, detecta ediciones directas).

Banderas: **req** obligatorio · **único** · **sensible** (nunca se envía al navegador) · **PII** dato personal.

| Hoja | Prefijo | Solo agregado | Requiere fideicomiso |
|---|---|---|---|
| CONFIGURACION | CFG | No | No |
| USUARIOS | USR | No | No |
| ROLES | ROL | No | No |
| PERMISOS | PRM | No | No |
| AUDITORIA | AUD | Sí | No |
| PROYECTOS | FID | No | No |
| TERRENOS | TER | No | No |
| PROPIETARIOS | PRO | No | No |
| FIDUCIARIOS | FDR | No | No |
| FIDUCIANTES | FDT | No | Sí |
| BENEFICIARIOS | BEN | No | Sí |
| UNIDADES | UNI | No | Sí |
| CONTRATOS | CTR | No | Sí |
| APORTES_PRELIMINARES | APP | No | Sí |
| MOVIMIENTOS | MOV | Sí | Sí |
| CUOTAS | CUO | No | Sí |
| PAGOS | PAG | No | Sí |
| GASTOS | GAS | No | Sí |
| PRESUPUESTOS | PRE | No | Sí |
| OBRAS | OBR | No | Sí |
| ETAPAS_OBRA | ETA | No | Sí |
| CERTIFICACIONES | CER | No | Sí |
| DOCUMENTOS | DOC | No | Sí |
| CESIONES | CES | No | Sí |
| DESVINCULACIONES | DES | No | Sí |
| CONTACTOS_CRM | CRM | No | No |
| CONVERSACIONES | CNV | Sí | No |
| OPORTUNIDADES | OPO | No | No |
| CAMPAÑAS | CAM | No | No |
| CONTENIDOS | CON | No | No |
| GUIONES | GUI | No | No |
| AUDIOS | AUA | No | No |
| VIDEOS | VID | No | No |
| PUBLICACIONES | PUB | No | No |
| AGENTES | AGT | No | No |
| TAREAS | TAR | No | No |
| ALERTAS | ALE | No | No |
| NOTIFICACIONES | NOT | No | No |
| COPIAS_SEGURIDAD | BAK | No | No |
| MIGRACIONES | MIG | No | No |

## CONFIGURACION

| Columna | Tipo | Detalle | Banderas |
|---|---|---|---|
| id | Texto |  | req, único |
| proyecto_id | Referencia | → PROYECTOS |  |
| estado | Texto |  |  |
| creado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| actualizado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| usuario_responsable | Texto |  |  |
| version | Número |  | req |
| es_prueba | Verdadero/Falso |  |  |
| huella | Texto |  |  |
| clave | Texto |  | req, único |
| valor | Texto |  |  |
| descripcion | Texto |  |  |
| publica | Verdadero/Falso |  |  |

## USUARIOS

| Columna | Tipo | Detalle | Banderas |
|---|---|---|---|
| id | Texto |  | req, único |
| proyecto_id | Referencia | → PROYECTOS |  |
| estado | Texto |  |  |
| creado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| actualizado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| usuario_responsable | Texto |  |  |
| version | Número |  | req |
| es_prueba | Verdadero/Falso |  |  |
| huella | Texto |  |  |
| email | Email |  | req, único, PII |
| nombre | Texto |  | req, PII |
| rol | Texto |  | req |
| password_hash | Texto |  | sensible |
| proyectos_asignados | Referencias (ids separados por coma) | → PROYECTOS |  |
| beneficiario_id | Referencia | → BENEFICIARIOS |  |
| intentos_fallidos | Número |  |  |
| bloqueado_hasta | Fecha y hora ISO 8601 (UTC) |  |  |
| ultimo_acceso | Fecha y hora ISO 8601 (UTC) |  |  |
| reset_hash | Texto |  | sensible |
| reset_expira | Fecha y hora ISO 8601 (UTC) |  | sensible |
| debe_cambiar_password | Verdadero/Falso |  |  |

## ROLES

| Columna | Tipo | Detalle | Banderas |
|---|---|---|---|
| id | Texto |  | req, único |
| proyecto_id | Referencia | → PROYECTOS |  |
| estado | Texto |  |  |
| creado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| actualizado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| usuario_responsable | Texto |  |  |
| version | Número |  | req |
| es_prueba | Verdadero/Falso |  |  |
| huella | Texto |  |  |
| codigo | Texto |  | req, único |
| nombre | Texto |  | req |
| descripcion | Texto |  |  |
| alcance | Lista cerrada | GLOBAL, PROYECTO, PROPIO |  |

## PERMISOS

| Columna | Tipo | Detalle | Banderas |
|---|---|---|---|
| id | Texto |  | req, único |
| proyecto_id | Referencia | → PROYECTOS |  |
| estado | Texto |  |  |
| creado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| actualizado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| usuario_responsable | Texto |  |  |
| version | Número |  | req |
| es_prueba | Verdadero/Falso |  |  |
| huella | Texto |  |  |
| rol | Texto |  | req |
| modulo | Texto |  | req |
| accion | Lista cerrada | leer, crear, editar, aprobar, exportar, administrar | req |
| permitido | Verdadero/Falso |  | req |

## AUDITORIA

| Columna | Tipo | Detalle | Banderas |
|---|---|---|---|
| id | Texto |  | req, único |
| proyecto_id | Referencia | → PROYECTOS |  |
| estado | Texto |  |  |
| creado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| actualizado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| usuario_responsable | Texto |  |  |
| version | Número |  | req |
| es_prueba | Verdadero/Falso |  |  |
| huella | Texto |  |  |
| usuario | Texto |  |  |
| operacion | Texto |  | req |
| hoja | Texto |  |  |
| registro_id | Texto |  |  |
| valor_anterior | JSON |  |  |
| valor_nuevo | JSON |  |  |
| motivo | Texto |  |  |
| resultado | Texto |  |  |
| aprobacion | Texto |  |  |
| origen | Texto |  |  |
| hash_previo | Texto |  |  |
| hash | Texto |  |  |

## PROYECTOS

| Columna | Tipo | Detalle | Banderas |
|---|---|---|---|
| id | Texto |  | req, único |
| proyecto_id | Referencia | → PROYECTOS |  |
| estado | Texto |  |  |
| creado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| actualizado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| usuario_responsable | Texto |  |  |
| version | Número |  | req |
| es_prueba | Verdadero/Falso |  |  |
| huella | Texto |  |  |
| denominacion | Texto |  | req |
| tipo_fideicomiso | Lista cerrada | ORDINARIO, FINANCIERO | req |
| modalidad_oferta | Lista cerrada | PRIVADA, PUBLICA | req |
| fiduciario_id | Referencia | → FIDUCIARIOS |  |
| terreno_id | Referencia | → TERRENOS |  |
| objeto | Texto |  |  |
| fecha_constitucion | Fecha (AAAA-MM-DD; UI DD/MM/AAAA) |  |  |
| plazo_contractual_meses | Número |  |  |
| fecha_estimada_entrega | Fecha (AAAA-MM-DD; UI DD/MM/AAAA) |  |  |
| presupuesto_total | Importe ARS |  |  |
| unidades_proyectadas | Número |  |  |
| estado_juridico | Texto |  |  |
| estado_comercial | Texto |  |  |
| estado_financiero | Texto |  |  |
| estado_constructivo | Texto |  |  |
| publico | Verdadero/Falso |  |  |
| descripcion_publica | Texto |  |  |
| imagen_url | Texto |  |  |
| req_estructura_juridica_revisada | Verdadero/Falso |  |  |
| req_contrato_aprobado | Verdadero/Falso |  |  |
| req_responsables_identificados | Verdadero/Falso |  |  |
| req_presupuesto_validado | Verdadero/Falso |  |  |
| req_cronograma | Verdadero/Falso |  |  |
| req_reglas_aportes | Verdadero/Falso |  |  |
| req_reglas_salida | Verdadero/Falso |  |  |
| req_publicidad_aprobada | Verdadero/Falso |  |  |
| reglas_salida | Texto |  |  |
| reglas_aportes | Texto |  |  |

## TERRENOS

| Columna | Tipo | Detalle | Banderas |
|---|---|---|---|
| id | Texto |  | req, único |
| proyecto_id | Referencia | → PROYECTOS |  |
| estado | Texto |  |  |
| creado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| actualizado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| usuario_responsable | Texto |  |  |
| version | Número |  | req |
| es_prueba | Verdadero/Falso |  |  |
| huella | Texto |  |  |
| propietario_id | Referencia | → PROPIETARIOS |  |
| ubicacion | Texto |  | req |
| direccion | Texto |  |  |
| superficie_m2 | Número |  |  |
| medidas | Texto |  |  |
| zonificacion | Texto |  |  |
| servicios | Texto |  |  |
| situacion_dominial | Texto |  |  |
| documentacion | Texto |  |  |
| valuacion_estimada | Importe ARS |  |  |
| precio_solicitado | Importe ARS |  |  |
| modalidad_negociacion | Texto |  |  |
| responsable_comercial | Texto |  |  |
| observaciones | Texto |  |  |
| titularidad_verificada | Verdadero/Falso |  |  |
| origen | Texto |  |  |

## PROPIETARIOS

| Columna | Tipo | Detalle | Banderas |
|---|---|---|---|
| id | Texto |  | req, único |
| proyecto_id | Referencia | → PROYECTOS |  |
| estado | Texto |  |  |
| creado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| actualizado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| usuario_responsable | Texto |  |  |
| version | Número |  | req |
| es_prueba | Verdadero/Falso |  |  |
| huella | Texto |  |  |
| nombre | Texto |  | req, PII |
| documento | Texto |  | PII |
| email | Email |  | PII |
| telefono | Teléfono |  | PII |
| domicilio | Texto |  | PII |
| consentimiento_contacto | Verdadero/Falso |  |  |
| observaciones | Texto |  |  |

## FIDUCIARIOS

| Columna | Tipo | Detalle | Banderas |
|---|---|---|---|
| id | Texto |  | req, único |
| proyecto_id | Referencia | → PROYECTOS |  |
| estado | Texto |  |  |
| creado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| actualizado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| usuario_responsable | Texto |  |  |
| version | Número |  | req |
| es_prueba | Verdadero/Falso |  |  |
| huella | Texto |  |  |
| razon_social | Texto |  | req |
| cuit | Texto |  |  |
| domicilio | Texto |  |  |
| representante | Texto |  |  |
| email | Email |  |  |
| telefono | Teléfono |  |  |

## FIDUCIANTES

| Columna | Tipo | Detalle | Banderas |
|---|---|---|---|
| id | Texto |  | req, único |
| proyecto_id | Referencia | → PROYECTOS |  |
| estado | Texto |  |  |
| creado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| actualizado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| usuario_responsable | Texto |  |  |
| version | Número |  | req |
| es_prueba | Verdadero/Falso |  |  |
| huella | Texto |  |  |
| nombre | Texto |  | req, PII |
| documento | Texto |  | PII |
| email | Email |  | PII |
| telefono | Teléfono |  | PII |
| tipo_aporte | Texto |  |  |
| contrato_id | Referencia | → CONTRATOS |  |

## BENEFICIARIOS

| Columna | Tipo | Detalle | Banderas |
|---|---|---|---|
| id | Texto |  | req, único |
| proyecto_id | Referencia | → PROYECTOS |  |
| estado | Texto |  |  |
| creado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| actualizado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| usuario_responsable | Texto |  |  |
| version | Número |  | req |
| es_prueba | Verdadero/Falso |  |  |
| huella | Texto |  |  |
| nombre | Texto |  | req, PII |
| documento | Texto |  | req, PII |
| email | Email |  | PII |
| telefono | Teléfono |  | PII |
| domicilio | Texto |  | PII |
| unidad_id | Referencia | → UNIDADES |  |
| contrato_id | Referencia | → CONTRATOS |  |
| fecha_adhesion | Fecha (AAAA-MM-DD; UI DD/MM/AAAA) |  |  |
| estado_contractual | Texto |  |  |
| consentimiento_comunicaciones | Verdadero/Falso |  |  |
| observaciones | Texto |  |  |

## UNIDADES

| Columna | Tipo | Detalle | Banderas |
|---|---|---|---|
| id | Texto |  | req, único |
| proyecto_id | Referencia | → PROYECTOS |  |
| estado | Texto |  |  |
| creado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| actualizado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| usuario_responsable | Texto |  |  |
| version | Número |  | req |
| es_prueba | Verdadero/Falso |  |  |
| huella | Texto |  |  |
| codigo | Texto |  | req |
| tipo | Texto |  |  |
| superficie_m2 | Número |  |  |
| valor_referencia | Importe ARS |  |  |
| beneficiario_id | Referencia | → BENEFICIARIOS |  |
| disponible | Verdadero/Falso |  |  |

## CONTRATOS

| Columna | Tipo | Detalle | Banderas |
|---|---|---|---|
| id | Texto |  | req, único |
| proyecto_id | Referencia | → PROYECTOS |  |
| estado | Texto |  |  |
| creado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| actualizado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| usuario_responsable | Texto |  |  |
| version | Número |  | req |
| es_prueba | Verdadero/Falso |  |  |
| huella | Texto |  |  |
| tipo | Lista cerrada | CONSTITUCION, ADHESION, APORTE_PRELIMINAR, CESION, OTRO | req |
| parte_id | Texto |  |  |
| fecha_firma | Fecha (AAAA-MM-DD; UI DD/MM/AAAA) |  |  |
| documento_id | Referencia | → DOCUMENTOS |  |
| condiciones_salida | Texto |  |  |
| condiciones_aporte | Texto |  |  |
| aprobado_por | Texto |  |  |
| fecha_aprobacion | Fecha (AAAA-MM-DD; UI DD/MM/AAAA) |  |  |

## APORTES_PRELIMINARES

| Columna | Tipo | Detalle | Banderas |
|---|---|---|---|
| id | Texto |  | req, único |
| proyecto_id | Referencia | → PROYECTOS |  |
| estado | Texto |  |  |
| creado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| actualizado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| usuario_responsable | Texto |  |  |
| version | Número |  | req |
| es_prueba | Verdadero/Falso |  |  |
| huella | Texto |  |  |
| aportante_nombre | Texto |  | req, PII |
| aportante_contacto_id | Referencia | → CONTACTOS_CRM |  |
| fecha | Fecha (AAAA-MM-DD; UI DD/MM/AAAA) |  | req |
| importe | Importe ARS |  | req |
| destino | Texto |  |  |
| comprobante_id | Referencia | → DOCUMENTOS |  |
| contrato_id | Referencia | → CONTRATOS |  |
| condicion | Texto |  |  |
| beneficios_pactados | Texto |  |  |
| saldo | Importe ARS |  |  |
| verificado_por | Texto |  |  |
| fecha_verificacion | Fecha y hora ISO 8601 (UTC) |  |  |
| clave_idempotencia | Texto |  | único |

## MOVIMIENTOS

| Columna | Tipo | Detalle | Banderas |
|---|---|---|---|
| id | Texto |  | req, único |
| proyecto_id | Referencia | → PROYECTOS |  |
| estado | Texto |  |  |
| creado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| actualizado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| usuario_responsable | Texto |  |  |
| version | Número |  | req |
| es_prueba | Verdadero/Falso |  |  |
| huella | Texto |  |  |
| fecha | Fecha (AAAA-MM-DD; UI DD/MM/AAAA) |  | req |
| tipo | Lista cerrada | APORTE_PRELIMINAR, APORTE_FIDUCIARIO, CUOTA_BENEFICIARIO, INGRESO_CESION, REINTEGRO, GASTO_PROYECTO, GASTO_PRELIMINAR, AJUSTE_COMPENSATORIO | req |
| sentido | Lista cerrada | INGRESO, EGRESO | req |
| importe | Importe ARS |  | req |
| moneda | Texto |  |  |
| concepto | Texto |  | req |
| origen_hoja | Texto |  |  |
| origen_id | Texto |  |  |
| rectifica_id | Referencia | → MOVIMIENTOS |  |
| clave_idempotencia | Texto |  | único |
| comprobante_id | Referencia | → DOCUMENTOS |  |

## CUOTAS

| Columna | Tipo | Detalle | Banderas |
|---|---|---|---|
| id | Texto |  | req, único |
| proyecto_id | Referencia | → PROYECTOS |  |
| estado | Texto |  |  |
| creado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| actualizado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| usuario_responsable | Texto |  |  |
| version | Número |  | req |
| es_prueba | Verdadero/Falso |  |  |
| huella | Texto |  |  |
| beneficiario_id | Referencia | → BENEFICIARIOS | req |
| unidad_id | Referencia | → UNIDADES |  |
| plan_id | Texto |  | req |
| numero | Número |  | req |
| vencimiento | Fecha (AAAA-MM-DD; UI DD/MM/AAAA) |  | req |
| importe | Importe ARS |  | req |
| pagado | Importe ARS |  |  |
| saldo | Importe ARS |  |  |
| ajuste | Importe ARS |  |  |
| interes_mora | Importe ARS |  |  |
| clave_idempotencia | Texto |  | único |

## PAGOS

| Columna | Tipo | Detalle | Banderas |
|---|---|---|---|
| id | Texto |  | req, único |
| proyecto_id | Referencia | → PROYECTOS |  |
| estado | Texto |  |  |
| creado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| actualizado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| usuario_responsable | Texto |  |  |
| version | Número |  | req |
| es_prueba | Verdadero/Falso |  |  |
| huella | Texto |  |  |
| beneficiario_id | Referencia | → BENEFICIARIOS | req |
| fecha | Fecha (AAAA-MM-DD; UI DD/MM/AAAA) |  | req |
| importe | Importe ARS |  | req |
| medio | Texto |  |  |
| referencia_bancaria | Texto |  |  |
| comprobante_id | Referencia | → DOCUMENTOS |  |
| cuota_ids | Referencias (ids separados por coma) | → CUOTAS |  |
| verificado_por | Texto |  |  |
| fecha_verificacion | Fecha y hora ISO 8601 (UTC) |  |  |
| motivo_rechazo | Texto |  |  |
| movimiento_id | Referencia | → MOVIMIENTOS |  |
| cargado_por_beneficiario | Verdadero/Falso |  |  |
| aplicacion | JSON |  |  |
| clave_idempotencia | Texto |  | único |

## GASTOS

| Columna | Tipo | Detalle | Banderas |
|---|---|---|---|
| id | Texto |  | req, único |
| proyecto_id | Referencia | → PROYECTOS |  |
| estado | Texto |  |  |
| creado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| actualizado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| usuario_responsable | Texto |  |  |
| version | Número |  | req |
| es_prueba | Verdadero/Falso |  |  |
| huella | Texto |  |  |
| fecha | Fecha (AAAA-MM-DD; UI DD/MM/AAAA) |  | req |
| categoria | Texto |  | req |
| es_preliminar | Verdadero/Falso |  |  |
| proveedor | Texto |  |  |
| importe | Importe ARS |  | req |
| comprobante_id | Referencia | → DOCUMENTOS |  |
| obra_id | Referencia | → OBRAS |  |
| etapa_id | Referencia | → ETAPAS_OBRA |  |
| aprobado_por | Texto |  |  |
| movimiento_id | Referencia | → MOVIMIENTOS |  |
| concepto | Texto |  |  |
| clave_idempotencia | Texto |  | único |

## PRESUPUESTOS

| Columna | Tipo | Detalle | Banderas |
|---|---|---|---|
| id | Texto |  | req, único |
| proyecto_id | Referencia | → PROYECTOS |  |
| estado | Texto |  |  |
| creado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| actualizado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| usuario_responsable | Texto |  |  |
| version | Número |  | req |
| es_prueba | Verdadero/Falso |  |  |
| huella | Texto |  |  |
| rubro | Texto |  | req |
| importe | Importe ARS |  | req |
| vigente_desde | Fecha (AAAA-MM-DD; UI DD/MM/AAAA) |  |  |
| validado_por | Texto |  |  |
| obra_id | Referencia | → OBRAS |  |

## OBRAS

| Columna | Tipo | Detalle | Banderas |
|---|---|---|---|
| id | Texto |  | req, único |
| proyecto_id | Referencia | → PROYECTOS |  |
| estado | Texto |  |  |
| creado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| actualizado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| usuario_responsable | Texto |  |  |
| version | Número |  | req |
| es_prueba | Verdadero/Falso |  |  |
| huella | Texto |  |  |
| nombre | Texto |  | req |
| fecha_inicio_prevista | Fecha (AAAA-MM-DD; UI DD/MM/AAAA) |  |  |
| fecha_fin_prevista | Fecha (AAAA-MM-DD; UI DD/MM/AAAA) |  |  |
| fecha_inicio_real | Fecha (AAAA-MM-DD; UI DD/MM/AAAA) |  |  |
| fecha_fin_real | Fecha (AAAA-MM-DD; UI DD/MM/AAAA) |  |  |
| presupuesto | Importe ARS |  |  |
| responsable | Texto |  |  |
| avance_fisico | Número |  |  |
| observaciones | Texto |  |  |

## ETAPAS_OBRA

| Columna | Tipo | Detalle | Banderas |
|---|---|---|---|
| id | Texto |  | req, único |
| proyecto_id | Referencia | → PROYECTOS |  |
| estado | Texto |  |  |
| creado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| actualizado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| usuario_responsable | Texto |  |  |
| version | Número |  | req |
| es_prueba | Verdadero/Falso |  |  |
| huella | Texto |  |  |
| obra_id | Referencia | → OBRAS | req |
| nombre | Texto |  | req |
| orden | Número |  |  |
| peso_porcentual | Número |  | req |
| responsable | Texto |  |  |
| fecha_inicio_prevista | Fecha (AAAA-MM-DD; UI DD/MM/AAAA) |  |  |
| fecha_fin_prevista | Fecha (AAAA-MM-DD; UI DD/MM/AAAA) |  |  |
| fecha_inicio_real | Fecha (AAAA-MM-DD; UI DD/MM/AAAA) |  |  |
| fecha_fin_real | Fecha (AAAA-MM-DD; UI DD/MM/AAAA) |  |  |
| presupuesto | Importe ARS |  |  |
| avance_certificado | Número |  |  |
| desvio | Texto |  |  |
| observaciones | Texto |  |  |

## CERTIFICACIONES

| Columna | Tipo | Detalle | Banderas |
|---|---|---|---|
| id | Texto |  | req, único |
| proyecto_id | Referencia | → PROYECTOS |  |
| estado | Texto |  |  |
| creado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| actualizado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| usuario_responsable | Texto |  |  |
| version | Número |  | req |
| es_prueba | Verdadero/Falso |  |  |
| huella | Texto |  |  |
| obra_id | Referencia | → OBRAS | req |
| etapa_id | Referencia | → ETAPAS_OBRA | req |
| fecha | Fecha (AAAA-MM-DD; UI DD/MM/AAAA) |  | req |
| avance_porcentual | Número |  | req |
| importe_certificado | Importe ARS |  |  |
| profesional | Texto |  | req |
| documento_id | Referencia | → DOCUMENTOS |  |
| fotos | Texto |  |  |
| aprobado_por | Texto |  |  |
| fecha_aprobacion | Fecha y hora ISO 8601 (UTC) |  |  |
| observaciones | Texto |  |  |

## DOCUMENTOS

| Columna | Tipo | Detalle | Banderas |
|---|---|---|---|
| id | Texto |  | req, único |
| proyecto_id | Referencia | → PROYECTOS |  |
| estado | Texto |  |  |
| creado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| actualizado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| usuario_responsable | Texto |  |  |
| version | Número |  | req |
| es_prueba | Verdadero/Falso |  |  |
| huella | Texto |  |  |
| titulo | Texto |  | req |
| tipo | Texto |  |  |
| drive_file_id | Texto |  |  |
| url | Texto |  |  |
| entidad | Texto |  |  |
| entidad_id | Texto |  |  |
| visible_beneficiario | Verdadero/Falso |  |  |
| publico | Verdadero/Falso |  |  |
| aprobado_por | Texto |  |  |

## CESIONES

| Columna | Tipo | Detalle | Banderas |
|---|---|---|---|
| id | Texto |  | req, único |
| proyecto_id | Referencia | → PROYECTOS |  |
| estado | Texto |  |  |
| creado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| actualizado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| usuario_responsable | Texto |  |  |
| version | Número |  | req |
| es_prueba | Verdadero/Falso |  |  |
| huella | Texto |  |  |
| beneficiario_id | Referencia | → BENEFICIARIOS | req |
| unidad_id | Referencia | → UNIDADES |  |
| alternativa | Lista cerrada | CESION_DERECHOS, SUSTITUCION_BENEFICIARIO, RESOLUCION_CONTRACTUAL, REEMBOLSO, OTRA | req |
| motivo | Texto |  | req |
| fecha_solicitud | Fecha (AAAA-MM-DD; UI DD/MM/AAAA) |  | req |
| cuotas_abonadas | Número |  |  |
| total_abonado | Importe ARS |  |  |
| obligaciones_pendientes | Importe ARS |  |  |
| derechos_contractuales | Texto |  |  |
| condiciones_contrato | Texto |  |  |
| cesionarios_potenciales | JSON |  |  |
| escenarios | JSON |  |  |
| responsable | Texto |  |  |
| decision | Lista cerrada | APROBADA, RECHAZADA |  |
| decidido_por | Texto |  |  |
| fecha_decision | Fecha y hora ISO 8601 (UTC) |  |  |
| fundamento_decision | Texto |  |  |
| documento_id | Referencia | → DOCUMENTOS |  |
| nuevo_beneficiario_id | Referencia | → BENEFICIARIOS |  |

## DESVINCULACIONES

| Columna | Tipo | Detalle | Banderas |
|---|---|---|---|
| id | Texto |  | req, único |
| proyecto_id | Referencia | → PROYECTOS |  |
| estado | Texto |  |  |
| creado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| actualizado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| usuario_responsable | Texto |  |  |
| version | Número |  | req |
| es_prueba | Verdadero/Falso |  |  |
| huella | Texto |  |  |
| cesion_id | Referencia | → CESIONES | req |
| beneficiario_id | Referencia | → BENEFICIARIOS | req |
| fecha | Fecha (AAAA-MM-DD; UI DD/MM/AAAA) |  | req |
| tipo | Texto |  |  |
| importe_reintegro | Importe ARS |  |  |
| movimiento_id | Referencia | → MOVIMIENTOS |  |
| aprobado_por | Texto |  |  |
| observaciones | Texto |  |  |

## CONTACTOS_CRM

| Columna | Tipo | Detalle | Banderas |
|---|---|---|---|
| id | Texto |  | req, único |
| proyecto_id | Referencia | → PROYECTOS |  |
| estado | Texto |  |  |
| creado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| actualizado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| usuario_responsable | Texto |  |  |
| version | Número |  | req |
| es_prueba | Verdadero/Falso |  |  |
| huella | Texto |  |  |
| nombre | Texto |  | req, PII |
| email | Email |  | PII |
| telefono | Teléfono |  | PII |
| fuente | Lista cerrada | WEB, WHATSAPP, YOUTUBE, X, INSTAGRAM, FACEBOOK, FORMULARIO, REFERIDO, OTRA | req |
| clasificacion | Lista cerrada | PROPIETARIO_TERRENO, APORTANTE_PRELIMINAR, BENEFICIARIO_POTENCIAL, INVERSOR, CONSULTA_GENERAL | req |
| mensaje | Texto |  |  |
| asesor | Texto |  |  |
| consentimiento | Verdadero/Falso |  |  |
| fecha_consentimiento | Fecha y hora ISO 8601 (UTC) |  |  |
| baja_comunicaciones | Verdadero/Falso |  |  |
| preferencias | JSON |  |  |
| proximo_seguimiento | Fecha (AAAA-MM-DD; UI DD/MM/AAAA) |  |  |

## CONVERSACIONES

| Columna | Tipo | Detalle | Banderas |
|---|---|---|---|
| id | Texto |  | req, único |
| proyecto_id | Referencia | → PROYECTOS |  |
| estado | Texto |  |  |
| creado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| actualizado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| usuario_responsable | Texto |  |  |
| version | Número |  | req |
| es_prueba | Verdadero/Falso |  |  |
| huella | Texto |  |  |
| contacto_id | Referencia | → CONTACTOS_CRM | req |
| canal | Texto |  | req |
| direccion | Lista cerrada | ENTRANTE, SALIENTE | req |
| mensaje | Texto |  | req |
| fecha | Fecha y hora ISO 8601 (UTC) |  | req |
| enviado_por | Texto |  |  |
| id_externo | Texto |  |  |

## OPORTUNIDADES

| Columna | Tipo | Detalle | Banderas |
|---|---|---|---|
| id | Texto |  | req, único |
| proyecto_id | Referencia | → PROYECTOS |  |
| estado | Texto |  |  |
| creado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| actualizado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| usuario_responsable | Texto |  |  |
| version | Número |  | req |
| es_prueba | Verdadero/Falso |  |  |
| huella | Texto |  |  |
| contacto_id | Referencia | → CONTACTOS_CRM | req |
| etapa | Texto |  | req |
| valor_estimado | Importe ARS |  |  |
| probabilidad | Número |  |  |
| asesor | Texto |  |  |
| proxima_accion | Texto |  |  |
| fecha_proxima_accion | Fecha (AAAA-MM-DD; UI DD/MM/AAAA) |  |  |
| motivo_descarte | Texto |  |  |

## CAMPAÑAS

| Columna | Tipo | Detalle | Banderas |
|---|---|---|---|
| id | Texto |  | req, único |
| proyecto_id | Referencia | → PROYECTOS |  |
| estado | Texto |  |  |
| creado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| actualizado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| usuario_responsable | Texto |  |  |
| version | Número |  | req |
| es_prueba | Verdadero/Falso |  |  |
| huella | Texto |  |  |
| nombre | Texto |  | req |
| objetivo | Texto |  |  |
| plataformas | Texto |  |  |
| fecha_inicio | Fecha (AAAA-MM-DD; UI DD/MM/AAAA) |  |  |
| fecha_fin | Fecha (AAAA-MM-DD; UI DD/MM/AAAA) |  |  |
| presupuesto | Importe ARS |  |  |

## CONTENIDOS

| Columna | Tipo | Detalle | Banderas |
|---|---|---|---|
| id | Texto |  | req, único |
| proyecto_id | Referencia | → PROYECTOS |  |
| estado | Texto |  |  |
| creado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| actualizado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| usuario_responsable | Texto |  |  |
| version | Número |  | req |
| es_prueba | Verdadero/Falso |  |  |
| huella | Texto |  |  |
| titulo | Texto |  | req |
| tema | Texto |  |  |
| campania_id | Referencia | → CAMPAÑAS |  |
| formatos | Texto |  |  |
| guion_id | Referencia | → GUIONES |  |
| audio_id | Referencia | → AUDIOS |  |
| video_id | Referencia | → VIDEOS |  |
| portada_url | Texto |  |  |
| subtitulos_url | Texto |  |  |
| revision_juridica | JSON |  |  |
| aprobado_por | Texto |  |  |
| fecha_aprobacion | Fecha y hora ISO 8601 (UTC) |  |  |
| motivo_rechazo | Texto |  |  |

## GUIONES

| Columna | Tipo | Detalle | Banderas |
|---|---|---|---|
| id | Texto |  | req, único |
| proyecto_id | Referencia | → PROYECTOS |  |
| estado | Texto |  |  |
| creado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| actualizado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| usuario_responsable | Texto |  |  |
| version | Número |  | req |
| es_prueba | Verdadero/Falso |  |  |
| huella | Texto |  |  |
| contenido_id | Referencia | → CONTENIDOS | req |
| texto | Texto |  | req |
| formato | Texto |  |  |
| duracion_seg | Número |  |  |
| agente | Texto |  |  |
| revisado_por | Texto |  |  |

## AUDIOS

| Columna | Tipo | Detalle | Banderas |
|---|---|---|---|
| id | Texto |  | req, único |
| proyecto_id | Referencia | → PROYECTOS |  |
| estado | Texto |  |  |
| creado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| actualizado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| usuario_responsable | Texto |  |  |
| version | Número |  | req |
| es_prueba | Verdadero/Falso |  |  |
| huella | Texto |  |  |
| contenido_id | Referencia | → CONTENIDOS | req |
| archivo_url | Texto |  |  |
| motor_tts | Texto |  |  |
| duracion_seg | Número |  |  |

## VIDEOS

| Columna | Tipo | Detalle | Banderas |
|---|---|---|---|
| id | Texto |  | req, único |
| proyecto_id | Referencia | → PROYECTOS |  |
| estado | Texto |  |  |
| creado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| actualizado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| usuario_responsable | Texto |  |  |
| version | Número |  | req |
| es_prueba | Verdadero/Falso |  |  |
| huella | Texto |  |  |
| contenido_id | Referencia | → CONTENIDOS | req |
| formato | Lista cerrada | YOUTUBE_HORIZONTAL, SHORTS_VERTICAL, X, INSTAGRAM_REELS, FACEBOOK | req |
| archivo_url | Texto |  |  |
| duracion_seg | Número |  |  |
| revisado_por | Texto |  |  |

## PUBLICACIONES

| Columna | Tipo | Detalle | Banderas |
|---|---|---|---|
| id | Texto |  | req, único |
| proyecto_id | Referencia | → PROYECTOS |  |
| estado | Texto |  |  |
| creado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| actualizado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| usuario_responsable | Texto |  |  |
| version | Número |  | req |
| es_prueba | Verdadero/Falso |  |  |
| huella | Texto |  |  |
| contenido_id | Referencia | → CONTENIDOS | req |
| plataforma | Texto |  | req |
| fecha_programada | Fecha y hora ISO 8601 (UTC) |  |  |
| fecha_publicada | Fecha y hora ISO 8601 (UTC) |  |  |
| enlace | Texto |  |  |
| publicado_por | Texto |  |  |
| metricas | JSON |  |  |
| modo | Lista cerrada | MANUAL, AUTOMATICO |  |

## AGENTES

| Columna | Tipo | Detalle | Banderas |
|---|---|---|---|
| id | Texto |  | req, único |
| proyecto_id | Referencia | → PROYECTOS |  |
| estado | Texto |  |  |
| creado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| actualizado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| usuario_responsable | Texto |  |  |
| version | Número |  | req |
| es_prueba | Verdadero/Falso |  |  |
| huella | Texto |  |  |
| codigo | Texto |  | req, único |
| nombre | Texto |  | req |
| funcion | Texto |  |  |
| modalidad | Lista cerrada | MANUAL_CLAUDE_CODE, LOCAL_GRATUITO, REGLAS_APPS_SCRIPT | req |
| ejecuta_en | Texto |  |  |
| prompt_archivo | Texto |  |  |
| ultima_ejecucion | Fecha y hora ISO 8601 (UTC) |  |  |

## TAREAS

| Columna | Tipo | Detalle | Banderas |
|---|---|---|---|
| id | Texto |  | req, único |
| proyecto_id | Referencia | → PROYECTOS |  |
| estado | Texto |  |  |
| creado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| actualizado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| usuario_responsable | Texto |  |  |
| version | Número |  | req |
| es_prueba | Verdadero/Falso |  |  |
| huella | Texto |  |  |
| tipo | Texto |  | req |
| payload | JSON |  |  |
| clave_idempotencia | Texto |  | único |
| intentos | Número |  |  |
| ultimo_error | Texto |  |  |
| programada_para | Fecha y hora ISO 8601 (UTC) |  |  |
| resultado | JSON |  |  |
| requiere_aprobacion_de | Texto |  |  |

## ALERTAS

| Columna | Tipo | Detalle | Banderas |
|---|---|---|---|
| id | Texto |  | req, único |
| proyecto_id | Referencia | → PROYECTOS |  |
| estado | Texto |  |  |
| creado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| actualizado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| usuario_responsable | Texto |  |  |
| version | Número |  | req |
| es_prueba | Verdadero/Falso |  |  |
| huella | Texto |  |  |
| tipo | Texto |  | req |
| severidad | Lista cerrada | INFO, ADVERTENCIA, CRITICA | req |
| mensaje | Texto |  | req |
| entidad | Texto |  |  |
| entidad_id | Texto |  |  |
| clave_idempotencia | Texto |  | único |
| resuelta_por | Texto |  |  |
| fecha_resolucion | Fecha y hora ISO 8601 (UTC) |  |  |

## NOTIFICACIONES

| Columna | Tipo | Detalle | Banderas |
|---|---|---|---|
| id | Texto |  | req, único |
| proyecto_id | Referencia | → PROYECTOS |  |
| estado | Texto |  |  |
| creado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| actualizado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| usuario_responsable | Texto |  |  |
| version | Número |  | req |
| es_prueba | Verdadero/Falso |  |  |
| huella | Texto |  |  |
| destinatario | Texto |  | req |
| canal | Lista cerrada | EMAIL, PORTAL, WHATSAPP | req |
| asunto | Texto |  |  |
| mensaje | Texto |  | req |
| enviada_en | Fecha y hora ISO 8601 (UTC) |  |  |
| error | Texto |  |  |
| clave_idempotencia | Texto |  | único |

## COPIAS_SEGURIDAD

| Columna | Tipo | Detalle | Banderas |
|---|---|---|---|
| id | Texto |  | req, único |
| proyecto_id | Referencia | → PROYECTOS |  |
| estado | Texto |  |  |
| creado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| actualizado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| usuario_responsable | Texto |  |  |
| version | Número |  | req |
| es_prueba | Verdadero/Falso |  |  |
| huella | Texto |  |  |
| archivo_id | Texto |  | req |
| nombre | Texto |  |  |
| tipo | Lista cerrada | AUTOMATICA, MANUAL, PRE_RESTAURACION |  |
| hojas | Número |  |  |
| filas | Número |  |  |
| restaurado_en | Fecha y hora ISO 8601 (UTC) |  |  |
| restaurado_por | Texto |  |  |

## MIGRACIONES

| Columna | Tipo | Detalle | Banderas |
|---|---|---|---|
| id | Texto |  | req, único |
| proyecto_id | Referencia | → PROYECTOS |  |
| estado | Texto |  |  |
| creado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| actualizado_en | Fecha y hora ISO 8601 (UTC) |  | req |
| usuario_responsable | Texto |  |  |
| version | Número |  | req |
| es_prueba | Verdadero/Falso |  |  |
| huella | Texto |  |  |
| numero | Número |  | req, único |
| descripcion | Texto |  |  |
| aplicada_en | Fecha y hora ISO 8601 (UTC) |  |  |
