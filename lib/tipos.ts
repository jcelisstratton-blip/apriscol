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
    };
    Views: {
      v_produccion_diaria: { Row: ProduccionDiaria; Relationships: [] };
      v_lactancias_resumen: { Row: LactanciaResumen; Relationships: [] };
      v_servicios: { Row: ServicioConParto; Relationships: [] };
      v_palmares_animal: { Row: PalmaresAnimal; Relationships: [] };
      v_palmares_finca: { Row: PalmaresFinca; Relationships: [] };
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
