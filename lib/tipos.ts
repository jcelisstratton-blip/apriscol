// Tipos del esquema public (subconjunto que usa la app). Regenerar con el MCP/CLI de Supabase cuando crezca.

export type Especie = "caprino" | "ovino";
export type SexoAnimal = "hembra" | "macho";
export type Vocacion = "leche" | "carne" | "doble";
export type RolFinca = "propietario" | "administrador" | "ordenador" | "veterinario" | "contador";
export type ModuloApp =
  | "hato" | "genealogia" | "leche" | "carne" | "sanidad" | "reproduccion" | "nutricion" | "ambiente" | "contabilidad" | "ferias" | "corrales";
export type PlanId = "cria" | "hato" | "profesional" | "hacienda";
export type UsoMacho = "reproductor" | "carne";
export type Jornada = "manana" | "tarde" | "noche" | "unico";
export type TipoBaja = "venta" | "sacrificio" | "muerte" | "perdida";
export type MotivoBaja = "edad" | "partos" | "baja_produccion" | "sanidad" | "reproductivo" | "accidente" | "otro";

type Tabla<R, Req extends keyof R = never> = {
  Row: R;
  Insert: Pick<R, Req> & Partial<Omit<R, Req>>;
  Update: Partial<R>;
  Relationships: [];
};

export type Animal = {
  id: string;
  finca_id: string;
  especie: Especie;
  numero_arete: string;
  nombre: string | null;
  sexo: SexoAnimal;
  raza_id: number | null;
  fecha_nacimiento: string | null;
  fecha_nacimiento_aprox: boolean;
  padre_id: string | null;
  madre_id: string | null;
  padre_externo: string | null;
  madre_externa: string | null;
  origen: string;
  tipo_parto_origen: number | null;
  peso_nacer_kg: number | null;
  /** Lo que costó el animal (compra o reposición), para medir la pérdida por saca y mortalidad. */
  valor_compra: number | null;
  /** Cuándo se compró (solo animales comprados); sin fecha, la compra cuenta el día en que se registró. */
  fecha_compra: string | null;
  lote_id: string | null;
  lote_ceba_id: string | null;
  /** Partos que ya había tenido antes de registrarlos aquí (nulo = no se sabe). */
  partos_previos: number | null;
  /** «Recordármelo después»: hasta esa fecha el animal no aparece como candidato a ceba. */
  ceba_pospuesto_hasta: string | null;
  vocacion: Vocacion;
  /** Solo machos: para qué es. `null` = por definir. */
  uso_macho: UsoMacho | null;
  /** Turnos en que se ordeña. `null` = sin programar (todos); lista vacía = no se ordeña por ahora. */
  turnos_ordeno: string[] | null;
  estado: string;
  fecha_baja: string | null;
  foto_path: string | null;
  notas: string | null;
  chip: string | null;
  color: string | null;
  rasgos: string | null;
  marcas: string | null;
  libro_id: string | null;
  client_request_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type Baja = {
  id: string;
  finca_id: string;
  animal_id: string;
  tipo: TipoBaja;
  motivo: MotivoBaja | null;
  fecha: string;
  destino: string | null;
  comprador: string | null;
  /** Quién compró, elegido de la lista de compradores. */
  tercero_id: string | null;
  /** Cuándo se cobró; nulo = por cobrar. */
  cobrado_en: string | null;
  cobro_vence: string | null;
  destino_consumo: boolean;
  peso_kg: number | null;
  valor: number | null;
  guia_movilizacion: string | null;
  detalle: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Finca = {
  id: string;
  nombre: string;
  departamento: string | null;
  municipio: string | null;
  vereda: string | null;
  latitud: number | null;
  longitud: number | null;
  especies: Especie[];
  proposito: Vocacion;
  umbral_endogamia: number;
  zona_horaria: string;
  plan: PlanId;
  /** Último día pagado del plan (null: sin vencimiento registrado). */
  plan_vence_en: string | null;
  /** Logo opcional (ruta en el bucket `logos-fincas`); se ve con `urlLogo`. */
  logo_path: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type SolicitudPlan = {
  id: string; finca: string; correo: string; nombre: string; plan_actual: PlanId; plan_nuevo: PlanId; periodo: "mensual" | "anual"; creada_en: string;
};

export type FilaSolicitudPlan = {
  id: string; finca_id: string; user_id: string; plan_actual: PlanId; plan_nuevo: PlanId; periodo: "mensual" | "anual";
  estado: "pendiente" | "activada" | "cancelada"; created_at: string; atendida_en: string | null;
};

export type Perfil = {
  id: string;
  nombre: string | null;
  telefono: string | null;
  finca_activa_id: string | null;
  libro_resuelto_en: string | null;
  /** Su código de referidos y, si llegó por el enlace de alguien, quién lo refirió. */
  codigo_referido: string | null;
  referido_por: string | null;
  /** Cuenta de pruebas: nunca se bloquea por vigencia (solo la cambia el superadmin). */
  exenta_vigencia: boolean;
  created_at: string;
  updated_at: string;
};

export type Miembro = { finca_id: string; user_id: string; rol: RolFinca; created_at: string };

export type Invitacion = {
  id: string;
  finca_id: string;
  email: string;
  rol: RolFinca;
  token: string;
  invitado_por: string | null;
  expira_en: string;
  aceptada_en: string | null;
  aceptada_por: string | null;
  created_at: string;
};

export type Raza = { id: number; especie: Especie; nombre: string; aptitud: Vocacion | null };

export type Ordeno = {
  id: string;
  finca_id: string;
  animal_id: string;
  lactancia_id: string | null;
  fecha: string;
  jornada: Jornada;
  litros: number;
  descartada: boolean;
  motivo_descarte: string | null;
  rcs_miles_ml: number | null;
  grasa_pct: number | null;
  proteina_pct: number | null;
  cmt: string | null;
  observaciones: string | null;
  client_request_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Lactancia = {
  id: string;
  finca_id: string;
  animal_id: string;
  numero: number;
  fecha_parto: string;
  fecha_secado: string | null;
  parto_id: string | null;
  notas: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ProduccionDiaria = {
  finca_id: string | null;
  animal_id: string | null;
  fecha: string | null;
  lactancia_id: string | null;
  litros_tanque: number | null;
  litros_descartados: number | null;
  litros_total: number | null;
  dias_en_leche: number | null;
};

export type LactanciaResumen = {
  lactancia_id: string | null;
  finca_id: string | null;
  animal_id: string | null;
  numero: number | null;
  fecha_parto: string | null;
  fecha_secado: string | null;
  dias_lactancia: number | null;
  dias_con_registro: number | null;
  litros_total: number | null;
  promedio_diario: number | null;
  pico_diario: number | null;
};

export type ServicioConParto = {
  id: string | null;
  finca_id: string | null;
  hembra_id: string | null;
  fecha: string | null;
  tipo: string | null;
  fecha_prevista_parto: string | null;
  gestacion_dias: number | null;
  macho_id: string | null;
  macho_externo: string | null;
  semen_lote: string | null;
  responsable: string | null;
  observaciones: string | null;
  client_request_id: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type Parto = {
  id: string;
  finca_id: string;
  madre_id: string;
  servicio_id: string | null;
  fecha: string;
  tipo: TipoParto;
  numero_crias: number;
  complicaciones: string | null;
  client_request_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type NivelFeria = "local" | "regional" | "nacional" | "internacional";
export type ResultadoFeria =
  | "gran_campeon" | "campeon" | "subcampeon" | "reservado_campeon" | "mejor_ejemplar" | "mencion_honor" | "participacion" | "otro";

export type Feria = {
  id: string;
  finca_id: string;
  nombre: string;
  nivel: NivelFeria;
  departamento: string | null;
  municipio: string | null;
  fecha_inicio: string;
  fecha_fin: string | null;
  organizador: string | null;
  notas: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Participacion = {
  id: string;
  finca_id: string;
  feria_id: string;
  animal_id: string;
  categoria: string;
  resultado: ResultadoFeria;
  puesto: number | null;
  puntaje: number | null;
  premio_descripcion: string | null;
  premio_en_dinero: number | null;
  foto_path: string | null;
  observaciones: string | null;
  client_request_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PalmaresAnimal = {
  finca_id: string | null;
  animal_id: string | null;
  participaciones: number | null;
  premios: number | null;
  campeonatos: number | null;
  mejor_puesto: number | null;
};

// ───────────────────────── Sanidad ─────────────────────────
export type TipoProducto = "vacuna" | "desparasitante" | "antibiotico" | "antiinflamatorio" | "vitamina" | "otro";
export type TipoEvento = "vacunacion" | "desparasitacion" | "tratamiento" | "cirugia" | "podologia" | "pediluvio" | "otro";
export type ViaAplicacion = "oral" | "subcutanea" | "intramuscular" | "intravenosa" | "topica" | "intramamaria" | "otra";
export type TipoPrueba = "cae" | "brucelosis" | "cmt" | "mastitis_cultivo" | "paratuberculosis" | "otra";
export type ResultadoPrueba = "negativo" | "positivo" | "sospechoso" | "pendiente";

export type ProductoVeterinario = {
  id: string;
  finca_id: string;
  nombre: string;
  tipo: TipoProducto;
  registro_ica: string | null;
  retiro_leche_dias: number;
  retiro_carne_dias: number;
  unidad_dosis: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type EventoSanitario = {
  id: string;
  finca_id: string;
  fecha: string;
  tipo: TipoEvento;
  producto_id: string | null;
  producto_nombre: string | null;
  lote_producto: string | null;
  fecha_vencimiento: string | null;
  dosis: number | null;
  unidad_dosis: string | null;
  via: ViaAplicacion | null;
  responsable: string | null;
  costo: number | null;
  retiro_leche_dias: number;
  retiro_carne_dias: number;
  fin_retiro_leche: string;
  fin_retiro_carne: string;
  diagnostico: string | null;
  observaciones: string | null;
  proxima_fecha: string | null;
  client_request_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type EventoSanitarioAnimal = { evento_id: string; animal_id: string; finca_id: string };

export type PruebaSanitaria = {
  id: string;
  finca_id: string;
  animal_id: string;
  prueba: TipoPrueba;
  fecha: string;
  resultado: ResultadoPrueba;
  laboratorio: string | null;
  soporte_path: string | null;
  observaciones: string | null;
  client_request_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

// ───────────────────────── Costos y gastos ─────────────────────────
export type RubroGasto =
  | "concentrado" | "forraje" | "sales_suplementos" | "leche_maternizada"
  | "vacunas_desparasitantes" | "tratamientos" | "pruebas_laboratorio" | "podologia" | "bioseguridad"
  | "material_reproductivo" | "asistencia_veterinaria"
  | "identificacion" | "fletes"
  | "mano_obra" | "arriendo" | "servicios_publicos" | "combustible" | "mantenimiento" | "otros";
/** Un rubro de costo: los de un gasto y la compra de animales, que entra sola desde el valor de compra de cada animal. */
export type RubroCosto = RubroGasto | "compra_animales";
export type DestinoGasto = "finca" | "especie" | "ubicacion" | "lote" | "animal";

/** Un egreso del aprisco: qué se compró, a quién, cuánto, a quién se carga y si ya se pagó. */
export type Gasto = {
  id: string;
  finca_id: string;
  fecha: string;
  rubro: RubroGasto;
  descripcion: string;
  proveedor: string | null;
  /** Proveedor elegido de la lista; `proveedor` guarda su nombre para lo que se escribió antes. */
  tercero_id: string | null;
  /** Producto del catálogo de compras. Nulo en los gastos escritos a mano («otro»). */
  producto_id: string | null;
  cantidad: number | null;
  unidad: string | null;
  monto: number;
  destino_tipo: DestinoGasto;
  especie: Especie | null;
  ubicacion_id: string | null;
  lote_id: string | null;
  animal_id: string | null;
  vence: string | null;
  pagado_en: string | null;
  soporte_path: string | null;
  observaciones: string | null;
  client_request_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};
/** De dónde viene una línea de costo: un gasto registrado, el costo de un tratamiento (Sanidad), el del alimento de un lote (Ceba) o la compra de un animal. */
export type OrigenCosto = "gasto" | "sanidad" | "ceba" | "compra" | "nomina";
export type CostoLinea = {
  origen: OrigenCosto;
  origen_id: string;
  fecha: string;
  rubro: RubroCosto;
  descripcion: string;
  proveedor: string | null;
  monto: number;
  destino_tipo: DestinoGasto | "evento" | "adquisicion";
  especie: string | null;
  ubicacion_id: string | null;
  lote_id: string | null;
  animal_id: string | null;
  pagado: boolean;
  vence: string | null;
};

// ───────────────────────── Catálogos y ventas ─────────────────────────
export type TipoTercero = "proveedor" | "comprador" | "ambos";
/** A quién se le compra o a quién se le vende. Se crea una vez y se elige siempre. */
export type Tercero = { id: string; finca_id: string; nombre: string; tipo: TipoTercero; activo: boolean; created_at: string; updated_at: string };

export type LineaVenta = "leche" | "animales" | "carne" | "derivados" | "subproductos" | "otros";
export type TipoCatalogo = "compra" | "venta";
/** Algo que se compra (con su rubro) o se vende (con su línea), con su unidad y el último precio. */
export type Producto = {
  id: string;
  finca_id: string;
  clave: string | null;
  tipo: TipoCatalogo;
  nombre: string;
  rubro: Exclude<RubroGasto, "mano_obra"> | null;
  linea: LineaVenta | null;
  unidad: string | null;
  precio_habitual: number | null;
  automatico: boolean;
  activo: boolean;
  orden: number;
  created_at: string;
  updated_at: string;
};

/** Una venta registrada a mano (carne, queso, abono…). La leche y los animales vendidos entran solos desde Leche y desde la baja. */
export type Venta = {
  id: string;
  finca_id: string;
  fecha: string;
  producto_id: string;
  cantidad: number;
  unidad: string | null;
  precio_unitario: number;
  /** Generada por la base: cantidad × precio. */
  valor_total: number;
  tercero_id: string | null;
  cobrado_en: string | null;
  cobro_vence: string | null;
  observaciones: string | null;
  client_request_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};
/** Cómo está vinculada una persona: contrato de trabajo (lleva factor prestacional) o prestación de servicios (se exige el PILA). */
export type Vinculacion = "laboral" | "servicios";
export type FormaPago = "mensual" | "jornal" | "por_servicio";
/** Una persona que trabaja en la finca. */
export type Persona = {
  id: string;
  finca_id: string;
  nombre: string;
  cargo: string | null;
  vinculacion: Vinculacion;
  forma_pago: FormaPago;
  /** Salario mensual, valor del jornal u honorario por servicio, según la forma de pago. */
  valor_base: number;
  fecha_ingreso: string | null;
  fecha_retiro: string | null;
  activo: boolean;
  observaciones: string | null;
  /** Con qué correo se invitó a la app y qué rol de acceso tiene; nulos si trabaja en la finca pero no usa la app. */
  correo: string | null;
  rol: Exclude<RolFinca, "propietario"> | null;
  created_at: string;
  updated_at: string;
};
/** Un pago al personal. `valor_pago` y `costo_total` los genera la base; `factor` lo fija un disparador al registrarlo. */
export type PagoPersonal = {
  id: string;
  finca_id: string;
  personal_id: string;
  fecha: string;
  periodo_desde: string | null;
  periodo_hasta: string | null;
  cantidad: number;
  valor_base: number;
  factor: number;
  valor_pago: number;
  costo_total: number;
  pagado_en: string | null;
  soporte_pila: string | null;
  observaciones: string | null;
  client_request_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};
/** De dónde viene una línea de venta: una venta registrada, la leche despachada o un animal vendido o sacrificado. */
export type OrigenVenta = "venta" | "leche" | "animal";
export type VentaLinea = {
  origen: OrigenVenta;
  origen_id: string;
  fecha: string;
  linea: LineaVenta;
  producto: string;
  cantidad: number;
  unidad: string | null;
  valor: number;
  tercero: string | null;
  cobrado: boolean;
  cobro_vence: string | null;
};

/** Una evaluación FAMACHA: el color de la mucosa del ojo (1 a 5) de un animal en una fecha. */
export type EvaluacionFamacha = {
  id: string;
  finca_id: string;
  animal_id: string;
  fecha: string;
  puntaje: number;
  observaciones: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};
/** La última evaluación FAMACHA de un animal activo y cuándo se le desparasitó desde entonces (vista `v_famacha_animal`). */
export type FamachaAnimal = { animal_id: string; finca_id: string; evaluacion_id: string; ultima_fecha: string; puntaje: number; desparasitado_en: string | null };

/** Un evento con cuántos animales lo recibieron (vista `v_eventos_sanitarios`). */
export type EventoResumen = {
  id: string | null;
  finca_id: string | null;
  fecha: string | null;
  tipo: TipoEvento | null;
  producto_id: string | null;
  producto_nombre: string | null;
  dosis: number | null;
  unidad_dosis: string | null;
  retiro_leche_dias: number | null;
  retiro_carne_dias: number | null;
  fin_retiro_leche: string | null;
  fin_retiro_carne: string | null;
  proxima_fecha: string | null;
  responsable: string | null;
  diagnostico: string | null;
  created_at: string | null;
  animales: number | null;
  primer_animal_id: string | null;
  primer_animal: string | null;
};

/** Un evento visto desde un animal (vista `v_eventos_animal`). */
export type EventoDeAnimal = {
  animal_id: string | null;
  id: string | null;
  finca_id: string | null;
  fecha: string | null;
  tipo: TipoEvento | null;
  producto_nombre: string | null;
  dosis: number | null;
  unidad_dosis: string | null;
  retiro_leche_dias: number | null;
  retiro_carne_dias: number | null;
  fin_retiro_leche: string | null;
  fin_retiro_carne: string | null;
  proxima_fecha: string | null;
  diagnostico: string | null;
  created_at: string | null;
};

/** Próxima dosis de un animal que aún no se ha aplicado (vista `v_sanidad_pendiente`). */
// ───────────────────────── Corrales, instalaciones y rotación ─────────────────────────
export type TipoUbicacion = "corral" | "potrero";
export type UsoUbicacion = "general" | "ordeno" | "maternidad" | "crias" | "cuarentena" | "alta_produccion" | "secas" | "reproductoras" | "ceba" | "reemplazos";
export type PisoUbicacion = "elevado" | "emparrillado" | "tierra" | "cemento" | "pasto" | "otro";
export type MotivoMovimiento = "ingreso" | "traslado" | "rotacion" | "cuarentena" | "maternidad" | "otro";
export type EstadoUbicacion = "ocupado" | "vacio" | "debe_salir" | "descanso" | "listo";

/** Un corral (bajo techo) o un potrero (pastoreo) de la finca. */
export type Ubicacion = {
  id: string;
  finca_id: string;
  tipo: TipoUbicacion;
  nombre: string;
  uso: UsoUbicacion;
  capacidad: number | null;
  area_m2: number | null;
  piso: PisoUbicacion | null;
  agua: boolean;
  dias_ocupacion_max: number;
  dias_descanso_min: number;
  activa: boolean;
  observaciones: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};
/** Una ubicación con sus ocupantes y su estado de ocupación o de rotación (vista `v_ubicaciones`). */
export type UbicacionVista = Ubicacion & {
  ocupantes: number;
  ocupado_desde: string | null;
  ultimo_retiro: string | null;
  dias_ocupacion: number | null;
  dias_descanso: number | null;
  hacinada: boolean;
  estado: EstadoUbicacion;
};
export type MovimientoAnimal = {
  id: string;
  finca_id: string;
  animal_id: string;
  ubicacion_id: string;
  desde: string;
  hasta: string | null;
  motivo: MotivoMovimiento;
  observaciones: string | null;
  created_by: string | null;
  created_at: string;
};
export type CuarentenaAlerta = { finca_id: string; animal_id: string; situacion: "en_cuarentena" | "falta_cuarentena"; desde: string; dias: number; ubicacion_id: string | null };

/** Una programación sanitaria: qué se va a aplicar, cuándo y a cuántos animales (el estado se calcula en la vista). */
export type ProgramaSanitario = {
  id: string;
  finca_id: string;
  tipo: TipoEvento;
  fecha_programada: string;
  producto_id: string | null;
  producto_nombre: string | null;
  dosis: number | null;
  unidad_dosis: string | null;
  via: ViaAplicacion | null;
  retiro_leche_dias: number;
  retiro_carne_dias: number;
  observaciones: string | null;
  cancelado_en: string | null;
  client_request_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};
export type EstadoPrograma = "abierto" | "completado" | "cancelado";
export type ProgramaSanitarioResumen = ProgramaSanitario & { animales: number; aplicados: number; estado: EstadoPrograma };
export type ProgramaSanitarioAnimal = { programa_id: string; animal_id: string; finca_id: string; evento_id: string | null };

export type SanidadPendiente = {
  finca_id: string | null;
  animal_id: string | null;
  evento_id: string | null;
  tipo: TipoEvento | null;
  producto_id: string | null;
  producto_nombre: string | null;
  proxima_fecha: string | null;
};

export type PalmaresFinca = {
  finca_id: string | null;
  participaciones: number | null;
  premios: number | null;
  campeonatos: number | null;
  dinero: number | null;
  animales_premiados: number | null;
};

export type LibroAnimal = {
  id: string;
  entidad: string;
  numero_registro: string;
  chip: string;
  nombre: string;
  prefijo: string | null;
  especie: Especie;
  sexo: SexoAnimal;
  raza_id: number | null;
  composicion: string | null;
  libro: string | null;
  concepcion: string | null;
  fecha_nacimiento: string | null;
  fecha_solicitud: string | null;
  color: string | null;
  rasgos: string | null;
  marcas: string | null;
  puntaje_fundador: number | null;
  padre_id: string | null;
  madre_id: string | null;
  padre_chip_origen: string | null;
  madre_chip_origen: string | null;
  criadero: string | null;
  departamento_dane: string | null;
  municipio_dane: string | null;
  estado: "vivo" | "baja";
  fecha_baja: string | null;
  observaciones: string | null;
  notas_importacion: string[];
};

export type EstadoReclamo = "pendiente" | "aprobada" | "rechazada" | "cancelada";

export type SolicitudReclamo = {
  id: string;
  finca_id: string;
  titular_id: string;
  solicitante_id: string;
  estado: EstadoReclamo;
  mensaje: string | null;
  animales_disponibles: number;
  animales_importados: number | null;
  motivo_rechazo: string | null;
  resuelta_por: string | null;
  resuelta_en: string | null;
  created_at: string;
  updated_at: string;
};

export type ReclamoAdmin = {
  id: string;
  estado: EstadoReclamo;
  creada_en: string;
  finca_id: string;
  finca_nombre: string;
  solicitante_nombre: string;
  solicitante_email: string;
  documento_tipo: string;
  documento_ultimos4: string;
  persona_juridica: boolean;
  animales_total: number;
  animales_vivos: number;
  criaderos: string[];
  mensaje: string | null;
  motivo_rechazo: string | null;
};

export type RespuestaTraer =
  | { encontrado: false }
  | { encontrado: true; importados: number; padres_enlazados?: number; madres_enlazadas?: number };

// ───────────────────────── Leche: calidad, frío, despachos y equipo ─────────────────────────
export type MomentoFrio = "tras_ordeno" | "almacenada" | "despacho";
export type DestinoLeche = "industria" | "queseria" | "venta_directa" | "otro";
export type ResiduosAntibioticos = "negativo" | "positivo";
export type TipoMantenimiento = "lavado_alcalino" | "lavado_acido" | "presion_vacio" | "pulsadores" | "revision" | "otro";

export type AnalisisLeche = {
  id: string;
  finca_id: string;
  /** Nulo cuando el análisis es de la leche mezclada (tanque o lote). */
  animal_id: string | null;
  muestra: string | null;
  fecha: string;
  grasa_pct: number | null;
  proteina_pct: number | null;
  rcs_miles_ml: number | null;
  solidos_totales_pct: number | null;
  lactosa_pct: number | null;
  /** Punto de congelación en °C (siempre negativo): la leche pura congela hacia -0,530 a -0,550. */
  crioscopia_c: number | null;
  residuos_antibioticos: ResiduosAntibioticos | null;
  /** Ruta del documento con los resultados (bucket «soportes»). */
  soporte_path: string | null;
  laboratorio: string | null;
  observaciones: string | null;
  client_request_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** Lo que exponen las vistas «último análisis» (sin cristoscopia, residuos, sólidos, lactosa ni soporte). */
export type AnalisisLecheTanque = Omit<AnalisisLeche, "solidos_totales_pct" | "lactosa_pct" | "crioscopia_c" | "residuos_antibioticos" | "soporte_path">;

export type ControlFrio = {
  id: string;
  finca_id: string;
  fecha: string;
  hora: string | null;
  momento: MomentoFrio;
  temperatura_c: number;
  equipo: string | null;
  observaciones: string | null;
  client_request_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type DespachoLeche = {
  id: string;
  finca_id: string;
  fecha: string;
  litros: number;
  destino_tipo: DestinoLeche;
  comprador: string | null;
  /** Quién compró, elegido de la lista de compradores. */
  tercero_id: string | null;
  /** Cuándo se cobró; nulo = por cobrar. */
  cobrado_en: string | null;
  cobro_vence: string | null;
  tanque: string | null;
  guia: string | null;
  precio_litro: number | null;
  /** Generada por la base: litros × precio por litro. */
  valor_total: number | null;
  temperatura_c: number | null;
  observaciones: string | null;
  client_request_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type MantenimientoOrdeno = {
  id: string;
  finca_id: string;
  fecha: string;
  tipo: TipoMantenimiento;
  equipo: string | null;
  presion_kpa: number | null;
  responsable: string | null;
  proxima_fecha: string | null;
  observaciones: string | null;
  client_request_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

// ───────────────────────── Carne: pesajes, lotes de ceba y consumo ─────────────────────────
export type TipoPesaje = "destete" | "control" | "pre_beneficio";

export type LoteCeba = {
  id: string;
  finca_id: string;
  nombre: string;
  fecha_inicio: string;
  peso_meta_kg: number | null;
  cerrado_en: string | null;
  observaciones: string | null;
  client_request_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Pesaje = {
  id: string;
  finca_id: string;
  animal_id: string;
  fecha: string;
  peso_kg: number;
  /** Condición corporal (1 a 5, de medio en medio). Se anota al pesar. */
  condicion_corporal: number | null;
  tipo: TipoPesaje;
  observaciones: string | null;
  client_request_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ConsumoLote = {
  id: string;
  finca_id: string;
  lote_id: string;
  fecha: string;
  kg_alimento: number;
  alimento: string | null;
  costo: number | null;
  observaciones: string | null;
  client_request_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** Una fila de `ceba_animales`: pesos y ganancia diaria (g/día) de un animal. */
export type CebaAnimal = {
  animal_id: string;
  lote_id: string | null;
  n_pesajes: number;
  peso_primero: number | null;
  fecha_primero: string | null;
  peso_ultimo: number | null;
  fecha_ultimo: string | null;
  gdp_total_g: number | null;
  gdp_reciente_g: number | null;
};

/** Una fila de `ceba_lotes`: lo que lleva un lote de ceba. */
export type CebaLote = {
  lote_id: string;
  animales: number;
  pesados: number;
  peso_promedio: number | null;
  gdp_g: number | null;
  kg_ganados: number;
  kg_alimento: number;
  costo_alimento: number;
  listos: number;
};

/** Las reglas de ceba de una especie (`reglas_ceba_efectivas`): las de la finca o, si no guardó nada, las sugeridas. */
export type ReglaCeba = {
  especie: Especie;
  hembra_partos_proxima: number;
  hembra_partos_toca: number;
  hembra_meses_proxima: number;
  hembra_meses_toca: number;
  macho_meses_proxima: number;
  macho_meses_toca: number;
  reproductor_meses_viejo: number;
  dias_entre_pesajes: number;
  hembra_dias_entre_pesajes: number;
  personalizada: boolean;
};

export type NivelCeba = "proxima" | "toca";
export type MotivoCeba = "partos" | "edad" | "definir_uso" | "reproductor_viejo" | "carne_sin_lote";
export type AdvertenciaCeba = "gestante" | "probable_gestante" | "lactancia" | "retiro_carne" | "sin_pesar";

/** Una fila de `candidatos_ceba`: un animal que conviene pasar a ceba (o que está por llegar a ese punto) y por qué. */
export type CandidatoCeba = {
  animal_id: string;
  sexo: SexoAnimal;
  especie: Especie;
  edad_meses: number | null;
  partos_totales: number | null;
  uso_macho: UsoMacho | null;
  nivel: NivelCeba;
  motivos: MotivoCeba[];
  advertencias: AdvertenciaCeba[];
  estado_repro: EstadoRepro | null;
  en_lactancia: boolean;
  retiro_carne_hasta: string | null;
  peso_ultimo: number | null;
  fecha_ultimo_peso: string | null;
  gdp_reciente_g: number | null;
};

// ───────────────────────── Carne: canales (rendimiento) ─────────────────────────
export type Conformacion = "E" | "U" | "R" | "O" | "P";
export type GrasaVisceral = "baja" | "media" | "alta";

export type Canal = {
  id: string;
  finca_id: string;
  animal_id: string;
  /** Siempre «sacrificio»: la canal es de un animal con baja por sacrificio. La pone la base. */
  tipo_baja: string;
  fecha: string;
  peso_vivo_kg: number | null;
  peso_canal_caliente_kg: number;
  peso_canal_fria_kg: number | null;
  conformacion: Conformacion | null;
  engrasamiento: number | null;
  grasa_dorsal_mm: number | null;
  grasa_visceral: GrasaVisceral | null;
  planta: string | null;
  observaciones: string | null;
  client_request_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** Una fila de `v_canales`: la canal con su rendimiento (canal ÷ peso vivo) y la merma de oreo, calculados por la base. */
export type CanalVista = Canal & {
  rendimiento_caliente_pct: number | null;
  rendimiento_frio_pct: number | null;
  merma_oreo_pct: number | null;
};

export type CanalesResumen = {
  n: number;
  peso_caliente_prom: number | null;
  rendimiento_caliente_prom: number | null;
  rendimiento_frio_prom: number | null;
  merma_prom: number | null;
};

// ───────────────────────── Controles de calidad (con constancia) ─────────────────────────
export type TipoControl = "residuos_antibioticos" | "crioscopia" | "composicion" | "celulas_somaticas" | "condicion_corporal" | "inspeccion_postmortem";
export type EstadoControl = "realizado" | "no_realizado";
export type ResultadoControl = "conforme" | "no_conforme";

export type ControlCalidad = {
  id: string;
  finca_id: string;
  /** Un control es de un despacho de leche o de un animal que sale para consumo (uno de los dos). */
  despacho_id: string | null;
  animal_id: string | null;
  tipo: TipoControl;
  estado: EstadoControl;
  analisis_id: string | null;
  fecha: string | null;
  resultado: ResultadoControl | null;
  /** Condición corporal, de 1 a 5. */
  valor: number | null;
  detalle: string | null;
  motivo: string | null;
  soporte_path: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

// ───────────────────────── Reproducción: servicios, gestación, partos y crías ─────────────────────────
export type TipoServicio = "monta_natural" | "inseminacion" | "transferencia_embrionaria";
export type MetodoDiagnostico = "ecografia" | "palpacion" | "otro";
export type ResultadoDiagnostico = "gestante" | "vacia" | "dudoso";
export type TipoParto = "normal" | "asistido" | "cesarea" | "aborto";
/** Dónde está una hembra en su ciclo: sin datos, vacía, servida (esperando diagnóstico) o gestante. */
export type EstadoRepro = "sin_datos" | "vacia" | "servida" | "gestante";

export type Servicio = {
  id: string;
  finca_id: string;
  hembra_id: string;
  fecha: string;
  tipo: TipoServicio;
  macho_id: string | null;
  macho_externo: string | null;
  semen_lote: string | null;
  responsable: string | null;
  observaciones: string | null;
  client_request_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type DiagnosticoGestacion = {
  id: string;
  finca_id: string;
  hembra_id: string;
  servicio_id: string | null;
  fecha: string;
  metodo: MetodoDiagnostico;
  resultado: ResultadoDiagnostico;
  observaciones: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Cria = {
  id: string;
  finca_id: string;
  parto_id: string;
  animal_id: string | null;
  sexo: SexoAnimal | null;
  peso_nacer_kg: number | null;
  vivo: boolean;
  notas: string | null;
  created_at: string;
  updated_at: string;
};

/** Una fila de `v_repro_hembras`: el estado reproductivo de una hembra activa y sus partos (calculados por la base). */
export type ReproHembra = {
  animal_id: string;
  finca_id: string;
  especie: Especie;
  ultimo_parto: string | null;
  partos_registrados: number;
  partos_previos: number | null;
  /** Partos previos + los registrados aquí. Nulo si no se sabe cuántos tuvo antes. */
  partos_totales: number | null;
  servicio_id: string | null;
  ultimo_servicio: string | null;
  fecha_prevista_parto: string | null;
  diagnostico: ResultadoDiagnostico | null;
  fecha_diagnostico: string | null;
  estado: EstadoRepro;
  en_lactancia: boolean;
  /** Empadronamiento abierto en el que está la hembra (nulo si no está en ninguno). */
  empadronamiento_id: string | null;
  empadronamiento_nombre: string | null;
  empadronamiento_macho_id: string | null;
};

/** Un empadronamiento (temporada de monta) con sus conteos: `v_empadronamientos`. */
export type Empadronamiento = {
  id: string;
  finca_id: string;
  especie: Especie;
  nombre: string;
  fecha_inicio: string;
  fecha_fin_prevista: string;
  /** Fecha de cierre real; nulo mientras siga abierto. */
  cerrado_en: string | null;
  /** Fecha desde la que se contó la gestación al cerrar. */
  fecha_base: string | null;
  edad_min_meses: number;
  peso_min_kg: number;
  cc_min: number;
  observaciones: string | null;
  client_request_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  machos: number;
  hembras: number;
  excepciones: number;
  /** Hembras por semental que fijó la temporada (nulo = el recomendado según especie y edad). */
  hembras_por_macho: number | null;
};

/** `num_hembras`: cuántas hembras tendrá este semental en la temporada (tope exacto); nulo solo en filas antiguas. */
export type EmpadronamientoMacho = {
  finca_id: string;
  empadronamiento_id: string;
  /** El animal del hato o, si `externo`, el id del semental de otro hato (`sementales_externos`). */
  macho_id: string;
  num_hembras: number | null;
  externo: boolean;
  created_by: string | null;
  created_at: string;
};

/** Un semental prestado por otro hato para una temporada de monta: sus datos y las condiciones del préstamo. */
export type SementalExterno = {
  id: string;
  finca_id: string;
  especie: Especie;
  /** Chip o identificación del animal. */
  chip: string;
  nombre: string;
  hato_origen: string;
  propietario: string | null;
  telefono: string | null;
  /** La raza sale de `razas` y va ligada a la especie del semental. */
  raza_id: number;
  /** Texto libre antiguo; la raza vigente es `raza_id`. */
  raza: string | null;
  fecha_nacimiento: string | null;
  prestamo_desde: string;
  prestamo_hasta: string;
  sanidad: string | null;
  condiciones: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type EmpadronamientoHembra = {
  id: string;
  finca_id: string;
  empadronamiento_id: string;
  hembra_id: string;
  macho_id: string;
  /** Endogamia de la pareja cuando se asignó. */
  endogamia: number;
  /** Se asignó aunque la pareja llegaba al umbral. */
  excepcion: boolean;
  created_by: string | null;
  created_at: string;
};

export type CriterioEmp = "ok" | "no" | "sin_dato";

/** Una hembra que podría entrar al empadronamiento (`empadronamiento_candidatas`): sus datos y si cumple cada criterio. */
export type CandidataEmp = {
  animal_id: string;
  numero_arete: string;
  nombre: string | null;
  edad_meses: number | null;
  peso_kg: number | null;
  fecha_peso: string | null;
  cc: number | null;
  fecha_cc: string | null;
  estado_repro: EstadoRepro | null;
  otro_lote: string | null;
  edad_ok: CriterioEmp;
  peso_ok: CriterioEmp;
  cc_ok: CriterioEmp;
};

export type { AncestroEndogamia } from "@/lib/endogamia";
import type { AncestroEndogamia } from "@/lib/endogamia";
import type { AjustesEspecie, AjustesFinca } from "@/lib/ajustes";

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.18" };
  public: {
    Tables: {
      animales: Tabla<Animal, "finca_id" | "especie" | "numero_arete" | "sexo">;
      bajas: Tabla<Baja, "finca_id" | "animal_id" | "tipo">;
      fincas: Tabla<Finca, "nombre">;
      solicitudes_plan: Tabla<FilaSolicitudPlan>;
      finca_miembros: Tabla<Miembro, "finca_id" | "user_id" | "rol">;
      perfiles: Tabla<Perfil, "id">;
      invitaciones: Tabla<Invitacion, "finca_id" | "email" | "rol">;
      razas: Tabla<Raza, "especie" | "nombre">;
      ordenos: Tabla<Ordeno, "finca_id" | "animal_id" | "jornada" | "litros">;
      lactancias: Tabla<Lactancia, "finca_id" | "animal_id" | "numero" | "fecha_parto">;
      partos: Tabla<Parto, "finca_id" | "madre_id">;
      parametros_especie: Tabla<
        {
          especie: Especie;
          gestacion_dias: number;
          ciclo_estral_dias: number;
          gestacion_min: number;
          gestacion_max: number;
          grasa_min_pct: number | null;
          grasa_max_pct: number | null;
          proteina_min_pct: number | null;
          proteina_max_pct: number | null;
          peso_faena_min_kg: number | null;
          peso_faena_max_kg: number | null;
        },
        "especie"
      >;
      finca_ajustes: Tabla<AjustesFinca, "finca_id">;
      finca_ajustes_especie: Tabla<AjustesEspecie, "finca_id" | "especie" | "gestacion_dias">;
      servicios: Tabla<Servicio, "finca_id" | "hembra_id" | "tipo">;
      diagnosticos_gestacion: Tabla<DiagnosticoGestacion, "finca_id" | "hembra_id" | "resultado">;
      crias: Tabla<Cria, "finca_id" | "parto_id">;
      ferias: Tabla<Feria, "finca_id" | "nombre" | "fecha_inicio">;
      participaciones_feria: Tabla<Participacion, "finca_id" | "feria_id" | "animal_id" | "categoria">;
      libro_genealogico: Tabla<LibroAnimal, "numero_registro" | "chip" | "nombre" | "especie" | "sexo">;
      solicitudes_reclamo: Tabla<SolicitudReclamo, "finca_id" | "titular_id">;
      plataforma_admins: Tabla<{ user_id: string; created_at: string }, "user_id">;
      productos_veterinarios: Tabla<ProductoVeterinario, "finca_id" | "nombre">;
      eventos_sanitarios: Tabla<EventoSanitario, "finca_id" | "tipo">;
      evento_sanitario_animales: Tabla<EventoSanitarioAnimal, "evento_id" | "animal_id" | "finca_id">;
      pruebas_sanitarias: Tabla<PruebaSanitaria, "finca_id" | "animal_id" | "prueba">;
      gastos: Tabla<Gasto, "finca_id" | "fecha" | "rubro" | "descripcion" | "monto">;
      finca_terceros: Tabla<Tercero, "finca_id" | "nombre">;
      finca_productos: Tabla<Producto, "finca_id" | "tipo" | "nombre">;
      ventas: Tabla<Venta, "finca_id" | "fecha" | "producto_id" | "cantidad" | "precio_unitario">;
      personal: Tabla<Persona, "finca_id" | "nombre" | "vinculacion" | "forma_pago" | "valor_base">;
      pagos_personal: Tabla<PagoPersonal, "finca_id" | "personal_id" | "fecha" | "cantidad" | "valor_base">;
      evaluaciones_famacha: Tabla<EvaluacionFamacha, "finca_id" | "animal_id" | "fecha" | "puntaje">;
      analisis_leche: Tabla<AnalisisLeche, "finca_id">;
      controles_frio: Tabla<ControlFrio, "finca_id" | "momento" | "temperatura_c">;
      despachos_leche: Tabla<Omit<DespachoLeche, "valor_total">, "finca_id" | "litros" | "destino_tipo">;
      mantenimiento_ordeno: Tabla<MantenimientoOrdeno, "finca_id" | "tipo">;
      lotes_ceba: Tabla<LoteCeba, "finca_id" | "nombre">;
      reglas_ceba: Tabla<Omit<ReglaCeba, "personalizada"> & { finca_id: string; created_by: string | null; created_at: string; updated_at: string }, "finca_id" | "especie">;
      pesajes: Tabla<Pesaje, "finca_id" | "animal_id" | "peso_kg">;
      empadronamientos: Tabla<Omit<Empadronamiento, "machos" | "hembras" | "excepciones">, "finca_id" | "especie" | "nombre" | "fecha_fin_prevista" | "edad_min_meses" | "peso_min_kg">;
      ubicaciones: Tabla<Ubicacion, "finca_id" | "tipo" | "nombre">;
      movimientos_animales: Tabla<MovimientoAnimal, "finca_id" | "animal_id" | "ubicacion_id" | "desde">;
      programas_sanitarios: Tabla<ProgramaSanitario, "finca_id" | "tipo" | "fecha_programada">;
      programa_sanitario_animales: Tabla<ProgramaSanitarioAnimal, "programa_id" | "animal_id" | "finca_id">;
      empadronamiento_machos: Tabla<EmpadronamientoMacho, "finca_id" | "empadronamiento_id" | "macho_id">;
      sementales_externos: Tabla<SementalExterno, "finca_id" | "especie" | "chip" | "nombre" | "hato_origen" | "raza_id" | "prestamo_desde" | "prestamo_hasta">;
      empadronamiento_hembras: Tabla<EmpadronamientoHembra, "finca_id" | "empadronamiento_id" | "hembra_id" | "macho_id" | "endogamia">;
      consumo_lote: Tabla<ConsumoLote, "finca_id" | "lote_id" | "kg_alimento">;
      canales: Tabla<Omit<Canal, "tipo_baja">, "finca_id" | "animal_id" | "peso_canal_caliente_kg">;
      controles_calidad: Tabla<ControlCalidad, "finca_id" | "tipo" | "estado">;
    };
    Views: {
      v_produccion_diaria: { Row: ProduccionDiaria; Relationships: [] };
      v_lactancias_resumen: { Row: LactanciaResumen; Relationships: [] };
      v_servicios: { Row: ServicioConParto; Relationships: [] };
      v_palmares_animal: { Row: PalmaresAnimal; Relationships: [] };
      v_palmares_finca: { Row: PalmaresFinca; Relationships: [] };
      v_eventos_sanitarios: { Row: EventoResumen; Relationships: [] };
      v_eventos_animal: { Row: EventoDeAnimal; Relationships: [] };
      v_sanidad_pendiente: { Row: SanidadPendiente; Relationships: [] };
      v_analisis_leche_ultimo: { Row: AnalisisLecheTanque; Relationships: [] };
      v_rcs_leche_ultimo: { Row: AnalisisLecheTanque; Relationships: [] };
      v_canales: { Row: CanalVista; Relationships: [] };
      v_repro_hembras: { Row: ReproHembra; Relationships: [] };
      v_empadronamientos: { Row: Empadronamiento; Relationships: [] };
      v_programas_sanitarios: { Row: ProgramaSanitarioResumen; Relationships: [] };
      v_ubicaciones: { Row: UbicacionVista; Relationships: [] };
      v_cuarentena_alerta: { Row: CuarentenaAlerta; Relationships: [] };
      v_famacha_animal: { Row: FamachaAnimal; Relationships: [] };
      v_podologia_animal: { Row: { animal_id: string; finca_id: string; ultima_fecha: string | null }; Relationships: [] };
      v_pediluvio_animal: { Row: { animal_id: string; finca_id: string; ultima_fecha: string | null }; Relationships: [] };
    };
    Functions: {
      registrar_animal: { Args: { p_finca: string; p_animal: unknown; p_fecha_ultimo_parto?: string | null }; Returns: string };
      registrar_parto: { Args: { p_finca: string; p_parto: unknown; p_crias: unknown }; Returns: unknown };
      eliminar_parto: { Args: { p_finca: string; p_parto: string }; Returns: string };
      eliminar_empadronamiento: { Args: { p_finca: string; p_lote: string }; Returns: undefined };
      agregar_semental_externo: { Args: { p_finca: string; p_lote: string; p_externo: unknown; p_num_hembras: number }; Returns: string };
      quitar_semental: { Args: { p_finca: string; p_lote: string; p_macho: string }; Returns: undefined };
      registrar_persona: { Args: { p_finca: string; p_persona: unknown; p_email?: string | null; p_rol?: string | null }; Returns: unknown };
      importar_animales_lote: {
        Args: { p_finca: string; p_filas: unknown };
        Returns: { animales: number; con_padres: number; con_parto: number; con_servicio: number; con_ubicacion: number };
      };
      mover_animales: {
        Args: { p_finca: string; p_ubicacion: string | null; p_animales: string[]; p_fecha: string; p_motivo: string; p_observaciones: string };
        Returns: number;
      };
      editar_movimiento: {
        Args: { p_id: string; p_ubicacion: string; p_desde: string; p_motivo: string; p_observaciones: string };
        Returns: undefined;
      };
      costos_detalle: {
        Args: { p_finca: string; p_desde: string | null; p_hasta: string | null; p_rubro?: string | null; p_limite?: number; p_salto?: number };
        Returns: CostoLinea[];
      };
      costos_pagina: {
        Args: { p_finca: string; p_desde: string | null; p_hasta: string | null; p_rubro?: string | null; p_limite?: number; p_salto?: number };
        Returns: (CostoLinea & { total: number })[];
      };
      ventas_pagina: {
        Args: { p_finca: string; p_desde: string | null; p_hasta: string | null; p_linea?: string | null; p_limite?: number; p_salto?: number };
        Returns: (VentaLinea & { total: number })[];
      };
      ventas_detalle: {
        Args: { p_finca: string; p_desde: string | null; p_hasta: string | null; p_linea?: string | null };
        Returns: VentaLinea[];
      };
      ventas_por_linea: {
        Args: { p_finca: string; p_desde: string | null; p_hasta: string | null };
        Returns: { linea: LineaVenta; total: number; por_cobrar: number; vencido: number; movimientos: number }[];
      };
      marcar_cobro_venta: { Args: { p_finca: string; p_origen: OrigenVenta; p_id: string; p_fecha: string | null }; Returns: undefined };
      recordar_precio_producto: { Args: { p_finca: string; p_producto: string; p_precio: number }; Returns: undefined };
      costos_posible_doble_conteo: {
        Args: { p_finca: string; p_desde: string | null; p_hasta: string | null };
        Returns: { rubro: RubroCosto; compras: number; consumo: number; origen_consumo: "sanidad" | "ceba" | "nomina" }[];
      };
      costos_por_rubro: {
        Args: { p_finca: string; p_desde: string | null; p_hasta: string | null };
        Returns: { rubro: RubroCosto; total: number; por_pagar: number; de_gastos: number; de_sanidad: number; de_ceba: number; movimientos: number }[];
      };
      costos_por_mes: {
        Args: { p_finca: string; p_desde: string | null; p_hasta: string | null };
        Returns: { mes: string; costos: number; ingresos_leche: number; ingresos_animales: number; litros: number }[];
      };
      costos_indicadores: {
        Args: { p_finca: string; p_desde: string | null; p_hasta: string | null };
        Returns: { total_costos: number; por_pagar: number; vencido: number; ingresos_leche: number; ingresos_animales: number; litros: number; animales_activos: number }[];
      };
      costos_por_animal: {
        Args: { p_finca: string; p_desde: string | null; p_hasta: string | null };
        Returns: { animal_id: string; numero_arete: string; nombre: string | null; especie: string; sexo: string; estado: string; directo: number; repartido: number; total: number; valor_compra: number | null }[];
      };
      costos_depreciacion: {
        Args: { p_finca: string; p_desde: string | null; p_hasta: string | null };
        Returns: { tipo: "saca" | "mortalidad"; animales: number; con_valor: number; perdida: number }[];
      };
      guardar_programa_sanitario: {
        Args: { p_finca: string; p_programa: string | null; p_datos: Record<string, unknown>; p_animales: string[] };
        Returns: string;
      };
      aceptar_invitacion: { Args: { p_token: string }; Returns: string };
      produccion_tendencia: {
        Args: { p_finca: string; p_hoy?: string | null };
        Returns: {
          animal_id: string;
          litros_base: number | null;
          litros_recientes: number | null;
          dias_base: number;
          dias_recientes: number;
          variacion: number | null;
          nivel: "normal" | "alerta" | "critico" | "sin_datos";
        }[];
      };
      produccion_habitual: {
        Args: { p_finca: string; p_hoy?: string | null };
        Returns: { animal_id: string; jornada: string; litros_habitual: number; dias: number }[];
      };
      animales_en_retiro: {
        Args: { p_finca: string };
        Returns: { animal_id: string; retiro_leche_hasta: string | null; retiro_carne_hasta: string | null }[];
      };
      produccion_historial: {
        Args: { p_finca: string; p_desde: string; p_hasta: string; p_animal?: string | null };
        Returns: { fecha: string; jornada: string; litros_tanque: number; litros_descartados: number; ordenos: number; animales: number }[];
      };
      produccion_por_animal: {
        Args: { p_finca: string; p_desde: string; p_hasta: string };
        Returns: { animal_id: string; litros_tanque: number; litros_descartados: number; ordenos: number; dias: number }[];
      };
      ceba_animales: { Args: { p_finca: string }; Returns: CebaAnimal[] };
      ceba_lotes: { Args: { p_finca: string }; Returns: CebaLote[] };
      reglas_ceba_efectivas: { Args: { p_finca: string }; Returns: ReglaCeba[] };
      empadronamiento_candidatas: { Args: { p_lote: string }; Returns: CandidataEmp[] };
      empadronamiento_endogamia: {
        Args: { p_lote: string; p_macho: string; p_hembras: string[] };
        Returns: { hembra_id: string; f: number; sobre_umbral: boolean }[];
      };
      empadronamiento_candidatas_criterios: {
        Args: { p_finca: string; p_especie: Especie; p_edad_min: number; p_peso_min: number; p_cc_min: number; p_excluir_lote?: string | null };
        Returns: CandidataEmp[];
      };
      empadronamiento_endogamia_previa: {
        Args: { p_finca: string; p_macho: string; p_hembras: string[] };
        Returns: { hembra_id: string; f: number; sobre_umbral: boolean }[];
      };
      cerrar_empadronamiento: {
        Args: { p_lote: string; p_cierre: string; p_base?: string | null };
        Returns: { hembras: number; servicios_creados: number };
      };
      candidatos_ceba: { Args: { p_finca: string; p_animal?: string }; Returns: CandidatoCeba[] };
      canales_resumen: { Args: { p_finca: string }; Returns: CanalesResumen[] };
      leche_balance: {
        Args: { p_finca: string; p_desde: string; p_hasta: string };
        Returns: { producida: number; descartada: number; despachada: number; valor_despachado: number }[];
      };
      guardar_evento_sanitario: {
        Args: { p_finca: string; p_evento: string | null; p_datos: Record<string, unknown>; p_animales: string[] };
        Returns: string;
      };
      coef_endogamia: { Args: { p_animal: string }; Returns: number };
      completitud_pedigri: { Args: { p_animal: string; p_generaciones?: number }; Returns: number };
      simular_endogamia: { Args: { p_macho: string; p_hembra: string }; Returns: number };
      coef_endogamia_libro: { Args: { p_libro: string }; Returns: number };
      simular_endogamia_libro: { Args: { p_macho: string; p_hembra: string }; Returns: number };
      completitud_pedigri_libro: { Args: { p_libro: string; p_generaciones?: number }; Returns: number };
      admin_resumen: { Args: Record<string, never>; Returns: Record<string, number> };
      asegurar_ajustes_finca: { Args: { p_finca: string }; Returns: undefined };
      restablecer_ajustes_finca: { Args: { p_finca: string; p_grupo: string }; Returns: undefined };
      solicitar_mejora_plan: { Args: { p_finca: string; p_plan: PlanId; p_periodo?: "mensual" | "anual" }; Returns: undefined };
      solicitar_renovacion_plan: { Args: { p_finca: string; p_periodo?: "mensual" | "anual" }; Returns: undefined };
      admin_activar_plan_finca: { Args: { p_finca: string; p_plan: PlanId; p_periodo?: "mensual" | "anual" }; Returns: string };
      admin_fijar_vigencia_finca: { Args: { p_finca: string; p_fecha: string | null }; Returns: undefined };
      admin_vigencias: { Args: Record<string, never>; Returns: { finca_id: string; nombre: string; propietario_email: string; plan: PlanId; plan_vence_en: string | null; estado: "vigente" | "por_vencer" | "gracia" | "bloqueada"; cuenta_pruebas: boolean }[] };
      admin_marcar_cuenta_pruebas: { Args: { p_correo: string; p_exenta: boolean }; Returns: number };
      estado_vigencia_finca: { Args: { p_finca: string }; Returns: string | null };
      admin_asignar_plan_finca: { Args: { p_finca: string; p_plan: PlanId }; Returns: number };
      admin_solicitudes_plan: { Args: Record<string, never>; Returns: (SolicitudPlan & { finca_id: string; numero_finca: number })[] };
      mis_referidos: { Args: Record<string, never>; Returns: { nombre: string; registrado_en: string; plan: string | null; porcentaje: number | null; meses: number | null; desde: string | null }[] };
      admin_listar_comisiones: { Args: Record<string, never>; Returns: { referidor: string; referido: string; plan: string; porcentaje: number; meses: number; desde: string }[] };
      admin_listar_fincas: {
        Args: Record<string, never>;
        Returns: {
          id: string; nombre: string; departamento: string | null; municipio: string | null; propietario_email: string;
          propietario_nombre: string; animales_activos: number; miembros: number; creada_en: string;
        }[];
      };
      explicar_endogamia: { Args: { p_animal: string }; Returns: AncestroEndogamia[] };
      explicar_cruza: { Args: { p_macho: string; p_hembra: string }; Returns: AncestroEndogamia[] };
      animales_endogamia: {
        Args: { p_finca: string; p_min?: number | null };
        Returns: { animal_id: string; numero_arete: string; nombre: string | null; sexo: SexoAnimal; especie: Especie; estado: string; f: number }[];
      };
      ancestros_comunes: {
        Args: { p_macho: string; p_hembra: string; p_max_gen?: number };
        Returns: { nombre: string; gen_macho: number; gen_hembra: number }[];
      };
      traer_animales_libro: { Args: { p_finca: string; p_documento: string; p_chip: string }; Returns: RespuestaTraer };
      admin_revertir_importacion: { Args: { p_solicitud: string }; Returns: number };
      admin_listar_reclamos: { Args: { p_estado?: string | null }; Returns: ReclamoAdmin[] };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
