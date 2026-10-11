// Tipos del esquema public (subconjunto que usa la app). Regenerar con el MCP/CLI de Supabase cuando crezca.

export type Especie = "caprino" | "ovino";
export type SexoAnimal = "hembra" | "macho";
export type Vocacion = "leche" | "carne" | "doble";
export type RolFinca = "propietario" | "administrador" | "ordenador" | "veterinario" | "contador";
export type ModuloApp =
  | "hato" | "genealogia" | "leche" | "carne" | "sanidad" | "reproduccion" | "nutricion" | "ambiente" | "contabilidad" | "ferias";
export type Jornada = "manana" | "tarde" | "noche" | "unico";

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
  estado: string;
  fecha_baja: string | null;
  foto_path: string | null;
  notas: string | null;
  client_request_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
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

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.18" };
  public: {
    Tables: {
      animales: Tabla<Animal, "finca_id" | "especie" | "numero_arete" | "sexo">;
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
    };
    Views: {
      v_produccion_diaria: { Row: ProduccionDiaria; Relationships: [] };
      v_lactancias_resumen: { Row: LactanciaResumen; Relationships: [] };
      v_servicios: { Row: ServicioConParto; Relationships: [] };
      v_palmares_animal: { Row: PalmaresAnimal; Relationships: [] };
    };
    Functions: {
      aceptar_invitacion: { Args: { p_token: string }; Returns: string };
      animales_en_retiro: {
        Args: { p_finca: string };
        Returns: { animal_id: string; retiro_leche_hasta: string | null; retiro_carne_hasta: string | null }[];
      };
      coef_endogamia: { Args: { p_animal: string }; Returns: number };
      completitud_pedigri: { Args: { p_animal: string; p_generaciones?: number }; Returns: number };
      simular_endogamia: { Args: { p_macho: string; p_hembra: string }; Returns: number };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
