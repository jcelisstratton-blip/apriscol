// Tipos del esquema public (subconjunto que usa la app). Regenerar con el MCP/CLI de Supabase cuando crezca.

export type Especie = "caprino" | "ovino";
export type SexoAnimal = "hembra" | "macho";
export type Vocacion = "leche" | "carne" | "doble";
export type RolFinca = "propietario" | "administrador" | "ordenador" | "veterinario" | "contador";
export type ModuloApp =
  | "hato" | "genealogia" | "leche" | "carne" | "sanidad" | "reproduccion" | "nutricion" | "ambiente" | "contabilidad" | "ferias";
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
  lote_id: string | null;
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
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Perfil = {
  id: string;
  nombre: string | null;
  telefono: string | null;
  finca_activa_id: string | null;
  libro_resuelto_en: string | null;
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
};

export type Parto = {
  id: string;
  finca_id: string;
  madre_id: string;
  fecha: string;
  tipo: string;
  numero_crias: number;
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
export type TipoEvento = "vacunacion" | "desparasitacion" | "tratamiento" | "cirugia" | "otro";
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

export type { AncestroEndogamia } from "@/lib/endogamia";
import type { AncestroEndogamia } from "@/lib/endogamia";

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.18" };
  public: {
    Tables: {
      animales: Tabla<Animal, "finca_id" | "especie" | "numero_arete" | "sexo">;
      bajas: Tabla<Baja, "finca_id" | "animal_id" | "tipo">;
      fincas: Tabla<Finca, "nombre">;
      finca_miembros: Tabla<Miembro, "finca_id" | "user_id" | "rol">;
      perfiles: Tabla<Perfil, "id">;
      invitaciones: Tabla<Invitacion, "finca_id" | "email" | "rol">;
      razas: Tabla<Raza, "especie" | "nombre">;
      ordenos: Tabla<Ordeno, "finca_id" | "animal_id" | "jornada" | "litros">;
      lactancias: Tabla<Lactancia, "finca_id" | "animal_id" | "numero" | "fecha_parto">;
      partos: Tabla<Parto, "finca_id" | "madre_id">;
      ferias: Tabla<Feria, "finca_id" | "nombre" | "fecha_inicio">;
      participaciones_feria: Tabla<Participacion, "finca_id" | "feria_id" | "animal_id" | "categoria">;
      libro_genealogico: Tabla<LibroAnimal, "numero_registro" | "chip" | "nombre" | "especie" | "sexo">;
      solicitudes_reclamo: Tabla<SolicitudReclamo, "finca_id" | "titular_id">;
      plataforma_admins: Tabla<{ user_id: string; created_at: string }, "user_id">;
      productos_veterinarios: Tabla<ProductoVeterinario, "finca_id" | "nombre">;
      eventos_sanitarios: Tabla<EventoSanitario, "finca_id" | "tipo">;
      evento_sanitario_animales: Tabla<EventoSanitarioAnimal, "evento_id" | "animal_id" | "finca_id">;
      pruebas_sanitarias: Tabla<PruebaSanitaria, "finca_id" | "animal_id" | "prueba">;
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
    };
    Functions: {
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
