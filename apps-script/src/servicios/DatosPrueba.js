/**
 * DatosPrueba.js — Conjunto de datos ficticios claramente identificados (es_prueba = TRUE, prefijo "PRUEBA").
 * No contiene datos personales reales: emails en dominio reservado .invalid y documentos inexistentes.
 */
var DatosPrueba = {
  cargar: function (ctx) {
    if (Repo.buscarPor('PROYECTOS', 'denominacion', 'PRUEBA - Fideicomiso Edificio Demo')) return 'Los datos de prueba ya existen.';
    var P = { es_prueba: true };
    function con(o) { Object.keys(P).forEach(function (k) { o[k] = P[k]; }); return o; }
    var fid = Repo.crear('FIDUCIARIOS', con({ razon_social: 'PRUEBA Fiduciaria SA', cuit: '00-00000000-0', estado: 'ACTIVO' }), ctx);
    var prop = Repo.crear('PROPIETARIOS', con({ nombre: 'PRUEBA Propietario Uno', email: 'propietario@ejemplo.invalid', telefono: '+54 351 000-0001', estado: 'ACTIVO', consentimiento_contacto: true }), ctx);
    var ter = Repo.crear('TERRENOS', con({ propietario_id: prop.id, ubicacion: 'PRUEBA - Barrio Ejemplo, Córdoba', superficie_m2: 600, medidas: '20 x 30',
      zonificacion: 'Residencial (dato ficticio)', estado: 'EVALUACION_JURIDICA', titularidad_verificada: false, origen: 'PRUEBA' }), ctx);
    var f = Repo.crear('PROYECTOS', con({ denominacion: 'PRUEBA - Fideicomiso Edificio Demo', tipo_fideicomiso: 'ORDINARIO', modalidad_oferta: 'PRIVADA',
      fiduciario_id: fid.id, terreno_id: ter.id, objeto: 'Construcción de edificio de 8 unidades (ficticio)', presupuesto_total: 400000000,
      unidades_proyectadas: 8, estado: 'EN_EVALUACION', publico: false, reglas_salida: 'PRUEBA: cesión con conformidad del fiduciario; resolución con reintegro del 80% de lo aportado a los 180 días.',
      fecha_estimada_entrega: sumarMeses_(hoyIso_(), 30) }), ctx);
    var unidades = [];
    for (var i = 1; i <= 4; i++) {
      unidades.push(Repo.crear('UNIDADES', con({ proyecto_id: f.id, codigo: 'U-0' + i, tipo: '2 ambientes', superficie_m2: 48, valor_referencia: 40000000, disponible: true, estado: 'ACTIVO' }), ctx));
    }
    var bens = [1, 2].map(function (n) {
      var c = Repo.crear('CONTRATOS', con({ proyecto_id: f.id, tipo: 'ADHESION', fecha_firma: hoyIso_(), estado: 'BORRADOR',
        condiciones_salida: 'PRUEBA: ver reglas de salida del fideicomiso.' }), ctx);
      var b = Repo.crear('BENEFICIARIOS', con({ proyecto_id: f.id, nombre: 'PRUEBA Beneficiario ' + n, documento: '00.000.00' + n,
        email: 'beneficiario' + n + '@ejemplo.invalid', unidad_id: unidades[n - 1].id, contrato_id: c.id, fecha_adhesion: hoyIso_(),
        estado_contractual: 'VIGENTE', consentimiento_comunicaciones: false, estado: 'ACTIVO' }), ctx);
      Repo.actualizar('UNIDADES', unidades[n - 1].id, { beneficiario_id: b.id, disponible: false }, ctx);
      Finanzas.generarPlan(ctx, { proyecto_id: f.id, beneficiario_id: b.id, valor_total: 40000000, aporte_inicial: 8000000,
        cantidad_cuotas: 24, primer_vencimiento: sumarMeses_(hoyIso_(), 1), plan_id: 'PLAN-PRUEBA-' + n });
      return b;
    });
    Finanzas.registrarAportePreliminar(ctx, { proyecto_id: f.id, aportante_nombre: 'PRUEBA Aportante Preliminar', importe: 5000000,
      destino: 'Estudios de factibilidad y mensura' });
    var obra = Repo.crear('OBRAS', con({ proyecto_id: f.id, nombre: 'PRUEBA - Obra Edificio Demo', presupuesto: 300000000,
      fecha_inicio_prevista: hoyIso_(), fecha_fin_prevista: sumarMeses_(hoyIso_(), 24), avance_fisico: 0, estado: 'PLANIFICADA' }), ctx);
    [['Movimiento de suelos', 10], ['Estructura', 35], ['Albañilería', 25], ['Instalaciones', 20], ['Terminaciones', 10]].forEach(function (e, k) {
      Repo.crear('ETAPAS_OBRA', con({ proyecto_id: f.id, obra_id: obra.id, nombre: e[0], orden: k + 1, peso_porcentual: e[1], avance_certificado: 0,
        fecha_inicio_prevista: sumarMeses_(hoyIso_(), k * 4), fecha_fin_prevista: sumarMeses_(hoyIso_(), k * 4 + 5), estado: 'PLANIFICADA' }), ctx);
    });
    Repo.crear('CONTACTOS_CRM', con({ nombre: 'PRUEBA Contacto Web', email: 'contacto@ejemplo.invalid', fuente: 'WEB', clasificacion: 'BENEFICIARIO_POTENCIAL',
      consentimiento: true, estado: 'NUEVO_CONTACTO' }), ctx);
    return 'Datos de prueba cargados: fideicomiso ' + f.id + ', beneficiarios ' + bens.map(function (b) { return b.id; }).join(', ');
  }
};
