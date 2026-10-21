export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      analisis_leche: {
        Row: {
          animal_id: string | null
          client_request_id: string | null
          created_at: string
          created_by: string | null
          crioscopia_c: number | null
          fecha: string
          finca_id: string
          grasa_pct: number | null
          id: string
          laboratorio: string | null
          lactosa_pct: number | null
          muestra: string | null
          observaciones: string | null
          proteina_pct: number | null
          rcs_miles_ml: number | null
          residuos_antibioticos: string | null
          solidos_totales_pct: number | null
          soporte_path: string | null
          updated_at: string
        }
        Insert: {
          animal_id?: string | null
          client_request_id?: string | null
          created_at?: string
          created_by?: string | null
          crioscopia_c?: number | null
          fecha?: string
          finca_id: string
          grasa_pct?: number | null
          id?: string
          laboratorio?: string | null
          lactosa_pct?: number | null
          muestra?: string | null
          observaciones?: string | null
          proteina_pct?: number | null
          rcs_miles_ml?: number | null
          residuos_antibioticos?: string | null
          solidos_totales_pct?: number | null
          soporte_path?: string | null
          updated_at?: string
        }
        Update: {
          animal_id?: string | null
          client_request_id?: string | null
          created_at?: string
          created_by?: string | null
          crioscopia_c?: number | null
          fecha?: string
          finca_id?: string
          grasa_pct?: number | null
          id?: string
          laboratorio?: string | null
          lactosa_pct?: number | null
          muestra?: string | null
          observaciones?: string | null
          proteina_pct?: number | null
          rcs_miles_ml?: number | null
          residuos_antibioticos?: string | null
          solidos_totales_pct?: number | null
          soporte_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "analisis_leche_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "animales"
            referencedColumns: ["id", "finca_id"]
          },
          {
            foreignKeyName: "analisis_leche_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_pediluvio_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "analisis_leche_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_podologia_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "analisis_leche_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_repro_hembras"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "analisis_leche_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
        ]
      }
      animales: {
        Row: {
          ceba_pospuesto_hasta: string | null
          chip: string | null
          client_request_id: string | null
          color: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          especie: Database["public"]["Enums"]["especie"]
          estado: string
          fecha_baja: string | null
          fecha_compra: string | null
          fecha_nacimiento: string | null
          fecha_nacimiento_aprox: boolean
          finca_id: string
          foto_path: string | null
          id: string
          libro_id: string | null
          lote_ceba_id: string | null
          lote_id: string | null
          madre_externa: string | null
          madre_id: string | null
          marcas: string | null
          nombre: string | null
          notas: string | null
          numero_arete: string
          origen: string
          padre_externo: string | null
          padre_id: string | null
          partos_previos: number | null
          peso_nacer_kg: number | null
          rasgos: string | null
          raza_id: number | null
          sexo: Database["public"]["Enums"]["sexo_animal"]
          tipo_parto_origen: number | null
          turnos_ordeno: string[] | null
          updated_at: string
          uso_macho: string | null
          valor_compra: number | null
          vocacion: Database["public"]["Enums"]["vocacion_animal"]
        }
        Insert: {
          ceba_pospuesto_hasta?: string | null
          chip?: string | null
          client_request_id?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          especie: Database["public"]["Enums"]["especie"]
          estado?: string
          fecha_baja?: string | null
          fecha_compra?: string | null
          fecha_nacimiento?: string | null
          fecha_nacimiento_aprox?: boolean
          finca_id: string
          foto_path?: string | null
          id?: string
          libro_id?: string | null
          lote_ceba_id?: string | null
          lote_id?: string | null
          madre_externa?: string | null
          madre_id?: string | null
          marcas?: string | null
          nombre?: string | null
          notas?: string | null
          numero_arete: string
          origen?: string
          padre_externo?: string | null
          padre_id?: string | null
          partos_previos?: number | null
          peso_nacer_kg?: number | null
          rasgos?: string | null
          raza_id?: number | null
          sexo: Database["public"]["Enums"]["sexo_animal"]
          tipo_parto_origen?: number | null
          turnos_ordeno?: string[] | null
          updated_at?: string
          uso_macho?: string | null
          valor_compra?: number | null
          vocacion?: Database["public"]["Enums"]["vocacion_animal"]
        }
        Update: {
          ceba_pospuesto_hasta?: string | null
          chip?: string | null
          client_request_id?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          especie?: Database["public"]["Enums"]["especie"]
          estado?: string
          fecha_baja?: string | null
          fecha_compra?: string | null
          fecha_nacimiento?: string | null
          fecha_nacimiento_aprox?: boolean
          finca_id?: string
          foto_path?: string | null
          id?: string
          libro_id?: string | null
          lote_ceba_id?: string | null
          lote_id?: string | null
          madre_externa?: string | null
          madre_id?: string | null
          marcas?: string | null
          nombre?: string | null
          notas?: string | null
          numero_arete?: string
          origen?: string
          padre_externo?: string | null
          padre_id?: string | null
          partos_previos?: number | null
          peso_nacer_kg?: number | null
          rasgos?: string | null
          raza_id?: number | null
          sexo?: Database["public"]["Enums"]["sexo_animal"]
          tipo_parto_origen?: number | null
          turnos_ordeno?: string[] | null
          updated_at?: string
          uso_macho?: string | null
          valor_compra?: number | null
          vocacion?: Database["public"]["Enums"]["vocacion_animal"]
        }
        Relationships: [
          {
            foreignKeyName: "animales_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animales_libro_id_fkey"
            columns: ["libro_id"]
            isOneToOne: false
            referencedRelation: "libro_genealogico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animales_lote_ceba_fk"
            columns: ["lote_ceba_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "lotes_ceba"
            referencedColumns: ["id", "finca_id"]
          },
          {
            foreignKeyName: "animales_lote_fk"
            columns: ["lote_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "lotes"
            referencedColumns: ["id", "finca_id"]
          },
          {
            foreignKeyName: "animales_madre_fk"
            columns: ["madre_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "animales"
            referencedColumns: ["id", "finca_id"]
          },
          {
            foreignKeyName: "animales_madre_fk"
            columns: ["madre_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_pediluvio_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "animales_madre_fk"
            columns: ["madre_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_podologia_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "animales_madre_fk"
            columns: ["madre_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_repro_hembras"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "animales_padre_fk"
            columns: ["padre_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "animales"
            referencedColumns: ["id", "finca_id"]
          },
          {
            foreignKeyName: "animales_padre_fk"
            columns: ["padre_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_pediluvio_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "animales_padre_fk"
            columns: ["padre_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_podologia_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "animales_padre_fk"
            columns: ["padre_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_repro_hembras"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "animales_raza_id_fkey"
            columns: ["raza_id"]
            isOneToOne: false
            referencedRelation: "razas"
            referencedColumns: ["id"]
          },
        ]
      }
      bajas: {
        Row: {
          animal_id: string
          cobrado_en: string | null
          cobro_vence: string | null
          comprador: string | null
          created_at: string
          created_by: string | null
          destino: string | null
          destino_consumo: boolean
          detalle: string | null
          fecha: string
          finca_id: string
          guia_movilizacion: string | null
          id: string
          motivo: string | null
          peso_kg: number | null
          tercero_id: string | null
          tipo: string
          updated_at: string
          valor: number | null
        }
        Insert: {
          animal_id: string
          cobrado_en?: string | null
          cobro_vence?: string | null
          comprador?: string | null
          created_at?: string
          created_by?: string | null
          destino?: string | null
          destino_consumo?: boolean
          detalle?: string | null
          fecha?: string
          finca_id: string
          guia_movilizacion?: string | null
          id?: string
          motivo?: string | null
          peso_kg?: number | null
          tercero_id?: string | null
          tipo: string
          updated_at?: string
          valor?: number | null
        }
        Update: {
          animal_id?: string
          cobrado_en?: string | null
          cobro_vence?: string | null
          comprador?: string | null
          created_at?: string
          created_by?: string | null
          destino?: string | null
          destino_consumo?: boolean
          detalle?: string | null
          fecha?: string
          finca_id?: string
          guia_movilizacion?: string | null
          id?: string
          motivo?: string | null
          peso_kg?: number | null
          tercero_id?: string | null
          tipo?: string
          updated_at?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bajas_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "animales"
            referencedColumns: ["id", "finca_id"]
          },
          {
            foreignKeyName: "bajas_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_pediluvio_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "bajas_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_podologia_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "bajas_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_repro_hembras"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "bajas_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bajas_tercero_fk"
            columns: ["tercero_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "finca_terceros"
            referencedColumns: ["id", "finca_id"]
          },
        ]
      }
      canales: {
        Row: {
          animal_id: string
          client_request_id: string | null
          conformacion: string | null
          created_at: string
          created_by: string | null
          engrasamiento: number | null
          fecha: string
          finca_id: string
          grasa_dorsal_mm: number | null
          grasa_visceral: string | null
          id: string
          observaciones: string | null
          peso_canal_caliente_kg: number
          peso_canal_fria_kg: number | null
          peso_vivo_kg: number | null
          planta: string | null
          tipo_baja: string | null
          updated_at: string
        }
        Insert: {
          animal_id: string
          client_request_id?: string | null
          conformacion?: string | null
          created_at?: string
          created_by?: string | null
          engrasamiento?: number | null
          fecha?: string
          finca_id: string
          grasa_dorsal_mm?: number | null
          grasa_visceral?: string | null
          id?: string
          observaciones?: string | null
          peso_canal_caliente_kg: number
          peso_canal_fria_kg?: number | null
          peso_vivo_kg?: number | null
          planta?: string | null
          tipo_baja?: string | null
          updated_at?: string
        }
        Update: {
          animal_id?: string
          client_request_id?: string | null
          conformacion?: string | null
          created_at?: string
          created_by?: string | null
          engrasamiento?: number | null
          fecha?: string
          finca_id?: string
          grasa_dorsal_mm?: number | null
          grasa_visceral?: string | null
          id?: string
          observaciones?: string | null
          peso_canal_caliente_kg?: number
          peso_canal_fria_kg?: number | null
          peso_vivo_kg?: number | null
          planta?: string | null
          tipo_baja?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "canales_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "animales"
            referencedColumns: ["id", "finca_id"]
          },
          {
            foreignKeyName: "canales_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_pediluvio_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "canales_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_podologia_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "canales_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_repro_hembras"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "canales_baja_fk"
            columns: ["animal_id", "tipo_baja"]
            isOneToOne: false
            referencedRelation: "bajas"
            referencedColumns: ["animal_id", "tipo"]
          },
          {
            foreignKeyName: "canales_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
        ]
      }
      celos: {
        Row: {
          created_at: string
          created_by: string | null
          fecha: string
          finca_id: string
          hembra_id: string
          id: string
          observaciones: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          fecha?: string
          finca_id: string
          hembra_id: string
          id?: string
          observaciones?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          fecha?: string
          finca_id?: string
          hembra_id?: string
          id?: string
          observaciones?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "celos_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "celos_hembra_fk"
            columns: ["hembra_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "animales"
            referencedColumns: ["id", "finca_id"]
          },
          {
            foreignKeyName: "celos_hembra_fk"
            columns: ["hembra_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_pediluvio_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "celos_hembra_fk"
            columns: ["hembra_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_podologia_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "celos_hembra_fk"
            columns: ["hembra_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_repro_hembras"
            referencedColumns: ["animal_id", "finca_id"]
          },
        ]
      }
      comisiones_referido: {
        Row: {
          created_at: string
          desde: string
          finca_id: string | null
          id: string
          meses: number
          plan: string
          porcentaje: number
          referido_id: string
          referidor_id: string
        }
        Insert: {
          created_at?: string
          desde?: string
          finca_id?: string | null
          id?: string
          meses: number
          plan: string
          porcentaje: number
          referido_id: string
          referidor_id: string
        }
        Update: {
          created_at?: string
          desde?: string
          finca_id?: string | null
          id?: string
          meses?: number
          plan?: string
          porcentaje?: number
          referido_id?: string
          referidor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comisiones_referido_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
        ]
      }
      consumo_lote: {
        Row: {
          alimento: string | null
          client_request_id: string | null
          costo: number | null
          created_at: string
          created_by: string | null
          fecha: string
          finca_id: string
          id: string
          kg_alimento: number
          lote_id: string
          observaciones: string | null
          updated_at: string
        }
        Insert: {
          alimento?: string | null
          client_request_id?: string | null
          costo?: number | null
          created_at?: string
          created_by?: string | null
          fecha?: string
          finca_id: string
          id?: string
          kg_alimento: number
          lote_id: string
          observaciones?: string | null
          updated_at?: string
        }
        Update: {
          alimento?: string | null
          client_request_id?: string | null
          costo?: number | null
          created_at?: string
          created_by?: string | null
          fecha?: string
          finca_id?: string
          id?: string
          kg_alimento?: number
          lote_id?: string
          observaciones?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consumo_lote_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumo_lote_lote_fk"
            columns: ["lote_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "lotes_ceba"
            referencedColumns: ["id", "finca_id"]
          },
        ]
      }
      controles_calidad: {
        Row: {
          analisis_id: string | null
          animal_id: string | null
          created_at: string
          created_by: string | null
          despacho_id: string | null
          detalle: string | null
          estado: string
          fecha: string | null
          finca_id: string
          id: string
          motivo: string | null
          resultado: string | null
          soporte_path: string | null
          tipo: string
          updated_at: string
          valor: number | null
        }
        Insert: {
          analisis_id?: string | null
          animal_id?: string | null
          created_at?: string
          created_by?: string | null
          despacho_id?: string | null
          detalle?: string | null
          estado: string
          fecha?: string | null
          finca_id: string
          id?: string
          motivo?: string | null
          resultado?: string | null
          soporte_path?: string | null
          tipo: string
          updated_at?: string
          valor?: number | null
        }
        Update: {
          analisis_id?: string | null
          animal_id?: string | null
          created_at?: string
          created_by?: string | null
          despacho_id?: string | null
          detalle?: string | null
          estado?: string
          fecha?: string | null
          finca_id?: string
          id?: string
          motivo?: string | null
          resultado?: string | null
          soporte_path?: string | null
          tipo?: string
          updated_at?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "controles_calidad_analisis_fk"
            columns: ["analisis_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "analisis_leche"
            referencedColumns: ["id", "finca_id"]
          },
          {
            foreignKeyName: "controles_calidad_analisis_fk"
            columns: ["analisis_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_analisis_leche_ultimo"
            referencedColumns: ["id", "finca_id"]
          },
          {
            foreignKeyName: "controles_calidad_analisis_fk"
            columns: ["analisis_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_rcs_leche_ultimo"
            referencedColumns: ["id", "finca_id"]
          },
          {
            foreignKeyName: "controles_calidad_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "animales"
            referencedColumns: ["id", "finca_id"]
          },
          {
            foreignKeyName: "controles_calidad_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_pediluvio_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "controles_calidad_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_podologia_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "controles_calidad_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_repro_hembras"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "controles_calidad_despacho_fk"
            columns: ["despacho_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "despachos_leche"
            referencedColumns: ["id", "finca_id"]
          },
          {
            foreignKeyName: "controles_calidad_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
        ]
      }
      controles_frio: {
        Row: {
          client_request_id: string | null
          created_at: string
          created_by: string | null
          equipo: string | null
          fecha: string
          finca_id: string
          hora: string | null
          id: string
          momento: string
          observaciones: string | null
          temperatura_c: number
          updated_at: string
        }
        Insert: {
          client_request_id?: string | null
          created_at?: string
          created_by?: string | null
          equipo?: string | null
          fecha?: string
          finca_id: string
          hora?: string | null
          id?: string
          momento: string
          observaciones?: string | null
          temperatura_c: number
          updated_at?: string
        }
        Update: {
          client_request_id?: string | null
          created_at?: string
          created_by?: string | null
          equipo?: string | null
          fecha?: string
          finca_id?: string
          hora?: string | null
          id?: string
          momento?: string
          observaciones?: string | null
          temperatura_c?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "controles_frio_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
        ]
      }
      crias: {
        Row: {
          animal_id: string | null
          created_at: string
          finca_id: string
          id: string
          notas: string | null
          parto_id: string
          peso_nacer_kg: number | null
          sexo: Database["public"]["Enums"]["sexo_animal"] | null
          updated_at: string
          vivo: boolean
        }
        Insert: {
          animal_id?: string | null
          created_at?: string
          finca_id: string
          id?: string
          notas?: string | null
          parto_id: string
          peso_nacer_kg?: number | null
          sexo?: Database["public"]["Enums"]["sexo_animal"] | null
          updated_at?: string
          vivo?: boolean
        }
        Update: {
          animal_id?: string | null
          created_at?: string
          finca_id?: string
          id?: string
          notas?: string | null
          parto_id?: string
          peso_nacer_kg?: number | null
          sexo?: Database["public"]["Enums"]["sexo_animal"] | null
          updated_at?: string
          vivo?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "crias_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "animales"
            referencedColumns: ["id", "finca_id"]
          },
          {
            foreignKeyName: "crias_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_pediluvio_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "crias_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_podologia_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "crias_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_repro_hembras"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "crias_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crias_parto_fk"
            columns: ["parto_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "partos"
            referencedColumns: ["id", "finca_id"]
          },
        ]
      }
      despachos_leche: {
        Row: {
          client_request_id: string | null
          cobrado_en: string | null
          cobro_vence: string | null
          comprador: string | null
          created_at: string
          created_by: string | null
          destino_tipo: string
          fecha: string
          finca_id: string
          guia: string | null
          id: string
          litros: number
          observaciones: string | null
          precio_litro: number | null
          tanque: string | null
          temperatura_c: number | null
          tercero_id: string | null
          updated_at: string
          valor_total: number | null
        }
        Insert: {
          client_request_id?: string | null
          cobrado_en?: string | null
          cobro_vence?: string | null
          comprador?: string | null
          created_at?: string
          created_by?: string | null
          destino_tipo: string
          fecha?: string
          finca_id: string
          guia?: string | null
          id?: string
          litros: number
          observaciones?: string | null
          precio_litro?: number | null
          tanque?: string | null
          temperatura_c?: number | null
          tercero_id?: string | null
          updated_at?: string
          valor_total?: number | null
        }
        Update: {
          client_request_id?: string | null
          cobrado_en?: string | null
          cobro_vence?: string | null
          comprador?: string | null
          created_at?: string
          created_by?: string | null
          destino_tipo?: string
          fecha?: string
          finca_id?: string
          guia?: string | null
          id?: string
          litros?: number
          observaciones?: string | null
          precio_litro?: number | null
          tanque?: string | null
          temperatura_c?: number | null
          tercero_id?: string | null
          updated_at?: string
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "despachos_leche_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despachos_tercero_fk"
            columns: ["tercero_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "finca_terceros"
            referencedColumns: ["id", "finca_id"]
          },
        ]
      }
      diagnosticos_gestacion: {
        Row: {
          created_at: string
          created_by: string | null
          fecha: string
          finca_id: string
          hembra_id: string
          id: string
          metodo: string
          observaciones: string | null
          resultado: string
          servicio_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          fecha?: string
          finca_id: string
          hembra_id: string
          id?: string
          metodo?: string
          observaciones?: string | null
          resultado: string
          servicio_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          fecha?: string
          finca_id?: string
          hembra_id?: string
          id?: string
          metodo?: string
          observaciones?: string | null
          resultado?: string
          servicio_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "diagnosticos_gestacion_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnosticos_hembra_fk"
            columns: ["hembra_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "animales"
            referencedColumns: ["id", "finca_id"]
          },
          {
            foreignKeyName: "diagnosticos_hembra_fk"
            columns: ["hembra_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_pediluvio_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "diagnosticos_hembra_fk"
            columns: ["hembra_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_podologia_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "diagnosticos_hembra_fk"
            columns: ["hembra_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_repro_hembras"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "diagnosticos_servicio_fk"
            columns: ["servicio_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "servicios"
            referencedColumns: ["id", "finca_id"]
          },
          {
            foreignKeyName: "diagnosticos_servicio_fk"
            columns: ["servicio_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_servicios"
            referencedColumns: ["id", "finca_id"]
          },
        ]
      }
      empadronamiento_hembras: {
        Row: {
          created_at: string
          created_by: string | null
          empadronamiento_id: string
          endogamia: number
          excepcion: boolean
          finca_id: string
          hembra_id: string
          id: string
          macho_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          empadronamiento_id: string
          endogamia: number
          excepcion?: boolean
          finca_id: string
          hembra_id: string
          id?: string
          macho_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          empadronamiento_id?: string
          endogamia?: number
          excepcion?: boolean
          finca_id?: string
          hembra_id?: string
          id?: string
          macho_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "emp_hembras_animal_fk"
            columns: ["hembra_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "animales"
            referencedColumns: ["id", "finca_id"]
          },
          {
            foreignKeyName: "emp_hembras_animal_fk"
            columns: ["hembra_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_pediluvio_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "emp_hembras_animal_fk"
            columns: ["hembra_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_podologia_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "emp_hembras_animal_fk"
            columns: ["hembra_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_repro_hembras"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "emp_hembras_lote_fk"
            columns: ["empadronamiento_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "empadronamientos"
            referencedColumns: ["id", "finca_id"]
          },
          {
            foreignKeyName: "emp_hembras_lote_fk"
            columns: ["empadronamiento_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_empadronamientos"
            referencedColumns: ["id", "finca_id"]
          },
          {
            foreignKeyName: "emp_hembras_macho_fk"
            columns: ["empadronamiento_id", "macho_id"]
            isOneToOne: false
            referencedRelation: "empadronamiento_machos"
            referencedColumns: ["empadronamiento_id", "macho_id"]
          },
        ]
      }
      empadronamiento_machos: {
        Row: {
          created_at: string
          created_by: string | null
          empadronamiento_id: string
          externo: boolean
          finca_id: string
          macho_id: string
          num_hembras: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          empadronamiento_id: string
          externo?: boolean
          finca_id: string
          macho_id: string
          num_hembras?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          empadronamiento_id?: string
          externo?: boolean
          finca_id?: string
          macho_id?: string
          num_hembras?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "emp_machos_lote_fk"
            columns: ["empadronamiento_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "empadronamientos"
            referencedColumns: ["id", "finca_id"]
          },
          {
            foreignKeyName: "emp_machos_lote_fk"
            columns: ["empadronamiento_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_empadronamientos"
            referencedColumns: ["id", "finca_id"]
          },
        ]
      }
      empadronamientos: {
        Row: {
          cc_min: number
          cerrado_en: string | null
          client_request_id: string | null
          created_at: string
          created_by: string | null
          edad_min_meses: number
          especie: Database["public"]["Enums"]["especie"]
          fecha_base: string | null
          fecha_fin_prevista: string
          fecha_inicio: string
          finca_id: string
          hembras_por_macho: number | null
          id: string
          nombre: string
          observaciones: string | null
          peso_min_kg: number
          updated_at: string
        }
        Insert: {
          cc_min?: number
          cerrado_en?: string | null
          client_request_id?: string | null
          created_at?: string
          created_by?: string | null
          edad_min_meses: number
          especie: Database["public"]["Enums"]["especie"]
          fecha_base?: string | null
          fecha_fin_prevista: string
          fecha_inicio?: string
          finca_id: string
          hembras_por_macho?: number | null
          id?: string
          nombre: string
          observaciones?: string | null
          peso_min_kg: number
          updated_at?: string
        }
        Update: {
          cc_min?: number
          cerrado_en?: string | null
          client_request_id?: string | null
          created_at?: string
          created_by?: string | null
          edad_min_meses?: number
          especie?: Database["public"]["Enums"]["especie"]
          fecha_base?: string | null
          fecha_fin_prevista?: string
          fecha_inicio?: string
          finca_id?: string
          hembras_por_macho?: number | null
          id?: string
          nombre?: string
          observaciones?: string | null
          peso_min_kg?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "empadronamientos_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluaciones_famacha: {
        Row: {
          animal_id: string
          created_at: string
          created_by: string | null
          fecha: string
          finca_id: string
          id: string
          observaciones: string | null
          puntaje: number
          updated_at: string
        }
        Insert: {
          animal_id: string
          created_at?: string
          created_by?: string | null
          fecha: string
          finca_id: string
          id?: string
          observaciones?: string | null
          puntaje: number
          updated_at?: string
        }
        Update: {
          animal_id?: string
          created_at?: string
          created_by?: string | null
          fecha?: string
          finca_id?: string
          id?: string
          observaciones?: string | null
          puntaje?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluaciones_famacha_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "famacha_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "animales"
            referencedColumns: ["id", "finca_id"]
          },
          {
            foreignKeyName: "famacha_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_pediluvio_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "famacha_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_podologia_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "famacha_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_repro_hembras"
            referencedColumns: ["animal_id", "finca_id"]
          },
        ]
      }
      evento_sanitario_animales: {
        Row: {
          animal_id: string
          evento_id: string
          finca_id: string
        }
        Insert: {
          animal_id: string
          evento_id: string
          finca_id: string
        }
        Update: {
          animal_id?: string
          evento_id?: string
          finca_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "esa_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "animales"
            referencedColumns: ["id", "finca_id"]
          },
          {
            foreignKeyName: "esa_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_pediluvio_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "esa_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_podologia_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "esa_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_repro_hembras"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "esa_evento_fk"
            columns: ["evento_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "eventos_sanitarios"
            referencedColumns: ["id", "finca_id"]
          },
          {
            foreignKeyName: "esa_evento_fk"
            columns: ["evento_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_eventos_animal"
            referencedColumns: ["id", "finca_id"]
          },
          {
            foreignKeyName: "esa_evento_fk"
            columns: ["evento_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_eventos_sanitarios"
            referencedColumns: ["id", "finca_id"]
          },
          {
            foreignKeyName: "evento_sanitario_animales_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
        ]
      }
      eventos_sanitarios: {
        Row: {
          client_request_id: string | null
          costo: number | null
          created_at: string
          created_by: string | null
          diagnostico: string | null
          dosis: number | null
          fecha: string
          fecha_vencimiento: string | null
          fin_retiro_carne: string | null
          fin_retiro_leche: string | null
          finca_id: string
          id: string
          lote_producto: string | null
          observaciones: string | null
          producto_id: string | null
          producto_nombre: string | null
          proxima_fecha: string | null
          responsable: string | null
          retiro_carne_dias: number
          retiro_leche_dias: number
          tipo: string
          unidad_dosis: string | null
          updated_at: string
          via: string | null
        }
        Insert: {
          client_request_id?: string | null
          costo?: number | null
          created_at?: string
          created_by?: string | null
          diagnostico?: string | null
          dosis?: number | null
          fecha?: string
          fecha_vencimiento?: string | null
          fin_retiro_carne?: string | null
          fin_retiro_leche?: string | null
          finca_id: string
          id?: string
          lote_producto?: string | null
          observaciones?: string | null
          producto_id?: string | null
          producto_nombre?: string | null
          proxima_fecha?: string | null
          responsable?: string | null
          retiro_carne_dias?: number
          retiro_leche_dias?: number
          tipo: string
          unidad_dosis?: string | null
          updated_at?: string
          via?: string | null
        }
        Update: {
          client_request_id?: string | null
          costo?: number | null
          created_at?: string
          created_by?: string | null
          diagnostico?: string | null
          dosis?: number | null
          fecha?: string
          fecha_vencimiento?: string | null
          fin_retiro_carne?: string | null
          fin_retiro_leche?: string | null
          finca_id?: string
          id?: string
          lote_producto?: string | null
          observaciones?: string | null
          producto_id?: string | null
          producto_nombre?: string | null
          proxima_fecha?: string | null
          responsable?: string | null
          retiro_carne_dias?: number
          retiro_leche_dias?: number
          tipo?: string
          unidad_dosis?: string | null
          updated_at?: string
          via?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eventos_sanitarios_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_sanitarios_producto_fk"
            columns: ["producto_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "productos_veterinarios"
            referencedColumns: ["id", "finca_id"]
          },
        ]
      }
      ferias: {
        Row: {
          created_at: string
          created_by: string | null
          departamento: string | null
          fecha_fin: string | null
          fecha_inicio: string
          finca_id: string
          id: string
          municipio: string | null
          nivel: string
          nombre: string
          notas: string | null
          organizador: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          departamento?: string | null
          fecha_fin?: string | null
          fecha_inicio: string
          finca_id: string
          id?: string
          municipio?: string | null
          nivel?: string
          nombre: string
          notas?: string | null
          organizador?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          departamento?: string | null
          fecha_fin?: string | null
          fecha_inicio?: string
          finca_id?: string
          id?: string
          municipio?: string | null
          nivel?: string
          nombre?: string
          notas?: string | null
          organizador?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ferias_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
        ]
      }
      finca_ajustes: {
        Row: {
          cc_venta_max: number
          cc_venta_min: number
          ccs_limite_miles_ml: number
          created_at: string
          dx_prenez_dia_desde: number
          dx_prenez_dia_hasta: number
          factor_prestacional: number
          finca_id: string
          gdp_minima_g: number
          meses_lluvia: number[]
          ms_mantenimiento_pct: number
          ms_produccion_max_pct: number
          ms_produccion_min_pct: number
          pediluvio_dias: number
          pediluvio_dias_lluvia: number
          podologia_inspeccion_dias: number
          secado_dias_antes_parto: number
          servicio_cc_min: number
          servicio_edad_min_meses: number
          servicio_peso_adulto_pct: number
          stock_autonomia_dias: number
          ultimo_tercio_dia: number
          updated_at: string
          updated_by: string | null
          vacuna_clostridiosis_dias: number | null
          vacuna_rabia_dias: number | null
        }
        Insert: {
          cc_venta_max?: number
          cc_venta_min?: number
          ccs_limite_miles_ml?: number
          created_at?: string
          dx_prenez_dia_desde?: number
          dx_prenez_dia_hasta?: number
          factor_prestacional?: number
          finca_id: string
          gdp_minima_g?: number
          meses_lluvia?: number[]
          ms_mantenimiento_pct?: number
          ms_produccion_max_pct?: number
          ms_produccion_min_pct?: number
          pediluvio_dias?: number
          pediluvio_dias_lluvia?: number
          podologia_inspeccion_dias?: number
          secado_dias_antes_parto?: number
          servicio_cc_min?: number
          servicio_edad_min_meses?: number
          servicio_peso_adulto_pct?: number
          stock_autonomia_dias?: number
          ultimo_tercio_dia?: number
          updated_at?: string
          updated_by?: string | null
          vacuna_clostridiosis_dias?: number | null
          vacuna_rabia_dias?: number | null
        }
        Update: {
          cc_venta_max?: number
          cc_venta_min?: number
          ccs_limite_miles_ml?: number
          created_at?: string
          dx_prenez_dia_desde?: number
          dx_prenez_dia_hasta?: number
          factor_prestacional?: number
          finca_id?: string
          gdp_minima_g?: number
          meses_lluvia?: number[]
          ms_mantenimiento_pct?: number
          ms_produccion_max_pct?: number
          ms_produccion_min_pct?: number
          pediluvio_dias?: number
          pediluvio_dias_lluvia?: number
          podologia_inspeccion_dias?: number
          secado_dias_antes_parto?: number
          servicio_cc_min?: number
          servicio_edad_min_meses?: number
          servicio_peso_adulto_pct?: number
          stock_autonomia_dias?: number
          ultimo_tercio_dia?: number
          updated_at?: string
          updated_by?: string | null
          vacuna_clostridiosis_dias?: number | null
          vacuna_rabia_dias?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "finca_ajustes_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: true
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
        ]
      }
      finca_ajustes_especie: {
        Row: {
          created_at: string
          especie: Database["public"]["Enums"]["especie"]
          finca_id: string
          gestacion_dias: number
          grasa_max_pct: number | null
          grasa_min_pct: number | null
          peso_adulto_hembra_kg: number | null
          peso_faena_max_kg: number | null
          peso_faena_min_kg: number | null
          proteina_max_pct: number | null
          proteina_min_pct: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          especie: Database["public"]["Enums"]["especie"]
          finca_id: string
          gestacion_dias: number
          grasa_max_pct?: number | null
          grasa_min_pct?: number | null
          peso_adulto_hembra_kg?: number | null
          peso_faena_max_kg?: number | null
          peso_faena_min_kg?: number | null
          proteina_max_pct?: number | null
          proteina_min_pct?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          especie?: Database["public"]["Enums"]["especie"]
          finca_id?: string
          gestacion_dias?: number
          grasa_max_pct?: number | null
          grasa_min_pct?: number | null
          peso_adulto_hembra_kg?: number | null
          peso_faena_max_kg?: number | null
          peso_faena_min_kg?: number | null
          proteina_max_pct?: number | null
          proteina_min_pct?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finca_ajustes_especie_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
        ]
      }
      finca_miembros: {
        Row: {
          created_at: string
          finca_id: string
          rol: Database["public"]["Enums"]["rol_finca"]
          user_id: string
        }
        Insert: {
          created_at?: string
          finca_id: string
          rol: Database["public"]["Enums"]["rol_finca"]
          user_id: string
        }
        Update: {
          created_at?: string
          finca_id?: string
          rol?: Database["public"]["Enums"]["rol_finca"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finca_miembros_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
        ]
      }
      finca_modulos: {
        Row: {
          activo: boolean
          finca_id: string
          modulo: Database["public"]["Enums"]["modulo_app"]
        }
        Insert: {
          activo?: boolean
          finca_id: string
          modulo: Database["public"]["Enums"]["modulo_app"]
        }
        Update: {
          activo?: boolean
          finca_id?: string
          modulo?: Database["public"]["Enums"]["modulo_app"]
        }
        Relationships: [
          {
            foreignKeyName: "finca_modulos_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
        ]
      }
      finca_productos: {
        Row: {
          activo: boolean
          automatico: boolean
          clave: string | null
          created_at: string
          finca_id: string
          id: string
          linea: string | null
          nombre: string
          orden: number
          precio_habitual: number | null
          rubro: string | null
          tipo: string
          unidad: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          automatico?: boolean
          clave?: string | null
          created_at?: string
          finca_id: string
          id?: string
          linea?: string | null
          nombre: string
          orden?: number
          precio_habitual?: number | null
          rubro?: string | null
          tipo: string
          unidad?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          automatico?: boolean
          clave?: string | null
          created_at?: string
          finca_id?: string
          id?: string
          linea?: string | null
          nombre?: string
          orden?: number
          precio_habitual?: number | null
          rubro?: string | null
          tipo?: string
          unidad?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finca_productos_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
        ]
      }
      finca_terceros: {
        Row: {
          activo: boolean
          created_at: string
          finca_id: string
          id: string
          nombre: string
          tipo: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          finca_id: string
          id?: string
          nombre: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          finca_id?: string
          id?: string
          nombre?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finca_terceros_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
        ]
      }
      fincas: {
        Row: {
          created_at: string
          created_by: string | null
          departamento: string | null
          especies: Database["public"]["Enums"]["especie"][]
          id: string
          latitud: number | null
          longitud: number | null
          municipio: string | null
          nombre: string
          plan: string
          plan_vence_en: string | null
          proposito: Database["public"]["Enums"]["vocacion_animal"]
          umbral_endogamia: number
          updated_at: string
          vereda: string | null
          zona_horaria: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          departamento?: string | null
          especies?: Database["public"]["Enums"]["especie"][]
          id?: string
          latitud?: number | null
          longitud?: number | null
          municipio?: string | null
          nombre: string
          plan?: string
          plan_vence_en?: string | null
          proposito?: Database["public"]["Enums"]["vocacion_animal"]
          umbral_endogamia?: number
          updated_at?: string
          vereda?: string | null
          zona_horaria?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          departamento?: string | null
          especies?: Database["public"]["Enums"]["especie"][]
          id?: string
          latitud?: number | null
          longitud?: number | null
          municipio?: string | null
          nombre?: string
          plan?: string
          plan_vence_en?: string | null
          proposito?: Database["public"]["Enums"]["vocacion_animal"]
          umbral_endogamia?: number
          updated_at?: string
          vereda?: string | null
          zona_horaria?: string
        }
        Relationships: []
      }
      gastos: {
        Row: {
          animal_id: string | null
          cantidad: number | null
          client_request_id: string | null
          created_at: string
          created_by: string | null
          descripcion: string
          destino_tipo: string
          especie: string | null
          fecha: string
          finca_id: string
          id: string
          lote_id: string | null
          monto: number
          observaciones: string | null
          pagado_en: string | null
          producto_id: string | null
          proveedor: string | null
          rubro: string
          soporte_path: string | null
          tercero_id: string | null
          ubicacion_id: string | null
          unidad: string | null
          updated_at: string
          vence: string | null
        }
        Insert: {
          animal_id?: string | null
          cantidad?: number | null
          client_request_id?: string | null
          created_at?: string
          created_by?: string | null
          descripcion: string
          destino_tipo?: string
          especie?: string | null
          fecha: string
          finca_id: string
          id?: string
          lote_id?: string | null
          monto: number
          observaciones?: string | null
          pagado_en?: string | null
          producto_id?: string | null
          proveedor?: string | null
          rubro: string
          soporte_path?: string | null
          tercero_id?: string | null
          ubicacion_id?: string | null
          unidad?: string | null
          updated_at?: string
          vence?: string | null
        }
        Update: {
          animal_id?: string | null
          cantidad?: number | null
          client_request_id?: string | null
          created_at?: string
          created_by?: string | null
          descripcion?: string
          destino_tipo?: string
          especie?: string | null
          fecha?: string
          finca_id?: string
          id?: string
          lote_id?: string | null
          monto?: number
          observaciones?: string | null
          pagado_en?: string | null
          producto_id?: string | null
          proveedor?: string | null
          rubro?: string
          soporte_path?: string | null
          tercero_id?: string | null
          ubicacion_id?: string | null
          unidad?: string | null
          updated_at?: string
          vence?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gastos_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "animales"
            referencedColumns: ["id", "finca_id"]
          },
          {
            foreignKeyName: "gastos_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_pediluvio_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "gastos_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_podologia_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "gastos_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_repro_hembras"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "gastos_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_lote_fk"
            columns: ["lote_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "lotes_ceba"
            referencedColumns: ["id", "finca_id"]
          },
          {
            foreignKeyName: "gastos_producto_fk"
            columns: ["producto_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "finca_productos"
            referencedColumns: ["id", "finca_id"]
          },
          {
            foreignKeyName: "gastos_tercero_fk"
            columns: ["tercero_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "finca_terceros"
            referencedColumns: ["id", "finca_id"]
          },
          {
            foreignKeyName: "gastos_ubicacion_fk"
            columns: ["ubicacion_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "ubicaciones"
            referencedColumns: ["id", "finca_id"]
          },
          {
            foreignKeyName: "gastos_ubicacion_fk"
            columns: ["ubicacion_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_ubicaciones"
            referencedColumns: ["id", "finca_id"]
          },
        ]
      }
      intentos_reclamo: {
        Row: {
          created_at: string
          encontrado: boolean
          id: number
          titular_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          encontrado: boolean
          id?: never
          titular_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          encontrado?: boolean
          id?: never
          titular_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intentos_reclamo_titular_id_fkey"
            columns: ["titular_id"]
            isOneToOne: false
            referencedRelation: "libro_titulares"
            referencedColumns: ["id"]
          },
        ]
      }
      invitaciones: {
        Row: {
          aceptada_en: string | null
          aceptada_por: string | null
          created_at: string
          email: string
          expira_en: string
          finca_id: string
          id: string
          invitado_por: string | null
          rol: Database["public"]["Enums"]["rol_finca"]
          token: string
        }
        Insert: {
          aceptada_en?: string | null
          aceptada_por?: string | null
          created_at?: string
          email: string
          expira_en?: string
          finca_id: string
          id?: string
          invitado_por?: string | null
          rol: Database["public"]["Enums"]["rol_finca"]
          token?: string
        }
        Update: {
          aceptada_en?: string | null
          aceptada_por?: string | null
          created_at?: string
          email?: string
          expira_en?: string
          finca_id?: string
          id?: string
          invitado_por?: string | null
          rol?: Database["public"]["Enums"]["rol_finca"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitaciones_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
        ]
      }
      lactancias: {
        Row: {
          animal_id: string
          created_at: string
          created_by: string | null
          fecha_parto: string
          fecha_secado: string | null
          finca_id: string
          id: string
          notas: string | null
          numero: number
          parto_id: string | null
          updated_at: string
        }
        Insert: {
          animal_id: string
          created_at?: string
          created_by?: string | null
          fecha_parto: string
          fecha_secado?: string | null
          finca_id: string
          id?: string
          notas?: string | null
          numero: number
          parto_id?: string | null
          updated_at?: string
        }
        Update: {
          animal_id?: string
          created_at?: string
          created_by?: string | null
          fecha_parto?: string
          fecha_secado?: string | null
          finca_id?: string
          id?: string
          notas?: string | null
          numero?: number
          parto_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lactancias_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "animales"
            referencedColumns: ["id", "finca_id"]
          },
          {
            foreignKeyName: "lactancias_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_pediluvio_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "lactancias_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_podologia_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "lactancias_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_repro_hembras"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "lactancias_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lactancias_parto_fk"
            columns: ["parto_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "partos"
            referencedColumns: ["id", "finca_id"]
          },
        ]
      }
      libro_genealogico: {
        Row: {
          chip: string
          color: string | null
          composicion: string | null
          concepcion: string | null
          created_at: string
          criadero: string | null
          criador_id: string | null
          datos_origen: Json
          departamento_dane: string | null
          entidad: string
          especie: Database["public"]["Enums"]["especie"]
          estado: string
          fecha_baja: string | null
          fecha_nacimiento: string | null
          fecha_solicitud: string | null
          foto_origen: string | null
          id: string
          libro: string | null
          madre_chip_origen: string | null
          madre_id: string | null
          marcas: string | null
          municipio_dane: string | null
          nombre: string
          notas_importacion: string[]
          numero_registro: string
          observaciones: string | null
          padre_chip_origen: string | null
          padre_id: string | null
          prefijo: string | null
          puntaje_fundador: number | null
          rasgos: string | null
          raza_id: number | null
          sexo: Database["public"]["Enums"]["sexo_animal"]
          titular_id: string | null
          updated_at: string
        }
        Insert: {
          chip: string
          color?: string | null
          composicion?: string | null
          concepcion?: string | null
          created_at?: string
          criadero?: string | null
          criador_id?: string | null
          datos_origen?: Json
          departamento_dane?: string | null
          entidad?: string
          especie: Database["public"]["Enums"]["especie"]
          estado?: string
          fecha_baja?: string | null
          fecha_nacimiento?: string | null
          fecha_solicitud?: string | null
          foto_origen?: string | null
          id?: string
          libro?: string | null
          madre_chip_origen?: string | null
          madre_id?: string | null
          marcas?: string | null
          municipio_dane?: string | null
          nombre: string
          notas_importacion?: string[]
          numero_registro: string
          observaciones?: string | null
          padre_chip_origen?: string | null
          padre_id?: string | null
          prefijo?: string | null
          puntaje_fundador?: number | null
          rasgos?: string | null
          raza_id?: number | null
          sexo: Database["public"]["Enums"]["sexo_animal"]
          titular_id?: string | null
          updated_at?: string
        }
        Update: {
          chip?: string
          color?: string | null
          composicion?: string | null
          concepcion?: string | null
          created_at?: string
          criadero?: string | null
          criador_id?: string | null
          datos_origen?: Json
          departamento_dane?: string | null
          entidad?: string
          especie?: Database["public"]["Enums"]["especie"]
          estado?: string
          fecha_baja?: string | null
          fecha_nacimiento?: string | null
          fecha_solicitud?: string | null
          foto_origen?: string | null
          id?: string
          libro?: string | null
          madre_chip_origen?: string | null
          madre_id?: string | null
          marcas?: string | null
          municipio_dane?: string | null
          nombre?: string
          notas_importacion?: string[]
          numero_registro?: string
          observaciones?: string | null
          padre_chip_origen?: string | null
          padre_id?: string | null
          prefijo?: string | null
          puntaje_fundador?: number | null
          rasgos?: string | null
          raza_id?: number | null
          sexo?: Database["public"]["Enums"]["sexo_animal"]
          titular_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "libro_genealogico_criador_id_fkey"
            columns: ["criador_id"]
            isOneToOne: false
            referencedRelation: "libro_titulares"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "libro_genealogico_madre_id_fkey"
            columns: ["madre_id"]
            isOneToOne: false
            referencedRelation: "libro_genealogico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "libro_genealogico_padre_id_fkey"
            columns: ["padre_id"]
            isOneToOne: false
            referencedRelation: "libro_genealogico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "libro_genealogico_raza_id_fkey"
            columns: ["raza_id"]
            isOneToOne: false
            referencedRelation: "razas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "libro_genealogico_titular_id_fkey"
            columns: ["titular_id"]
            isOneToOne: false
            referencedRelation: "libro_titulares"
            referencedColumns: ["id"]
          },
        ]
      }
      libro_titulares: {
        Row: {
          created_at: string
          documento_hash: string
          documento_tipo: string
          documento_ultimos4: string
          entidad: string
          id: string
          persona_juridica: boolean
        }
        Insert: {
          created_at?: string
          documento_hash: string
          documento_tipo: string
          documento_ultimos4: string
          entidad?: string
          id?: string
          persona_juridica?: boolean
        }
        Update: {
          created_at?: string
          documento_hash?: string
          documento_tipo?: string
          documento_ultimos4?: string
          entidad?: string
          id?: string
          persona_juridica?: boolean
        }
        Relationships: []
      }
      lotes: {
        Row: {
          created_at: string
          descripcion: string | null
          finca_id: string
          id: string
          nombre: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descripcion?: string | null
          finca_id: string
          id?: string
          nombre: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descripcion?: string | null
          finca_id?: string
          id?: string
          nombre?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lotes_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
        ]
      }
      lotes_ceba: {
        Row: {
          cerrado_en: string | null
          client_request_id: string | null
          created_at: string
          created_by: string | null
          fecha_inicio: string
          finca_id: string
          id: string
          nombre: string
          observaciones: string | null
          peso_meta_kg: number | null
          updated_at: string
        }
        Insert: {
          cerrado_en?: string | null
          client_request_id?: string | null
          created_at?: string
          created_by?: string | null
          fecha_inicio?: string
          finca_id: string
          id?: string
          nombre: string
          observaciones?: string | null
          peso_meta_kg?: number | null
          updated_at?: string
        }
        Update: {
          cerrado_en?: string | null
          client_request_id?: string | null
          created_at?: string
          created_by?: string | null
          fecha_inicio?: string
          finca_id?: string
          id?: string
          nombre?: string
          observaciones?: string | null
          peso_meta_kg?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lotes_ceba_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
        ]
      }
      mantenimiento_ordeno: {
        Row: {
          client_request_id: string | null
          created_at: string
          created_by: string | null
          equipo: string | null
          fecha: string
          finca_id: string
          id: string
          observaciones: string | null
          presion_kpa: number | null
          proxima_fecha: string | null
          responsable: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          client_request_id?: string | null
          created_at?: string
          created_by?: string | null
          equipo?: string | null
          fecha?: string
          finca_id: string
          id?: string
          observaciones?: string | null
          presion_kpa?: number | null
          proxima_fecha?: string | null
          responsable?: string | null
          tipo: string
          updated_at?: string
        }
        Update: {
          client_request_id?: string | null
          created_at?: string
          created_by?: string | null
          equipo?: string | null
          fecha?: string
          finca_id?: string
          id?: string
          observaciones?: string | null
          presion_kpa?: number | null
          proxima_fecha?: string | null
          responsable?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mantenimiento_ordeno_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
        ]
      }
      movimientos_animales: {
        Row: {
          animal_id: string
          created_at: string
          created_by: string | null
          desde: string
          finca_id: string
          hasta: string | null
          id: string
          motivo: string
          observaciones: string | null
          ubicacion_id: string
        }
        Insert: {
          animal_id: string
          created_at?: string
          created_by?: string | null
          desde: string
          finca_id: string
          hasta?: string | null
          id?: string
          motivo?: string
          observaciones?: string | null
          ubicacion_id: string
        }
        Update: {
          animal_id?: string
          created_at?: string
          created_by?: string | null
          desde?: string
          finca_id?: string
          hasta?: string | null
          id?: string
          motivo?: string
          observaciones?: string | null
          ubicacion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "animales"
            referencedColumns: ["id", "finca_id"]
          },
          {
            foreignKeyName: "movimientos_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_pediluvio_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "movimientos_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_podologia_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "movimientos_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_repro_hembras"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "movimientos_animales_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_ubicacion_fk"
            columns: ["ubicacion_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "ubicaciones"
            referencedColumns: ["id", "finca_id"]
          },
          {
            foreignKeyName: "movimientos_ubicacion_fk"
            columns: ["ubicacion_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_ubicaciones"
            referencedColumns: ["id", "finca_id"]
          },
        ]
      }
      ordenos: {
        Row: {
          animal_id: string
          client_request_id: string | null
          cmt: string | null
          created_at: string
          created_by: string | null
          descartada: boolean
          fecha: string
          finca_id: string
          grasa_pct: number | null
          id: string
          jornada: string
          lactancia_id: string | null
          litros: number
          motivo_descarte: string | null
          observaciones: string | null
          proteina_pct: number | null
          rcs_miles_ml: number | null
          updated_at: string
        }
        Insert: {
          animal_id: string
          client_request_id?: string | null
          cmt?: string | null
          created_at?: string
          created_by?: string | null
          descartada?: boolean
          fecha?: string
          finca_id: string
          grasa_pct?: number | null
          id?: string
          jornada: string
          lactancia_id?: string | null
          litros: number
          motivo_descarte?: string | null
          observaciones?: string | null
          proteina_pct?: number | null
          rcs_miles_ml?: number | null
          updated_at?: string
        }
        Update: {
          animal_id?: string
          client_request_id?: string | null
          cmt?: string | null
          created_at?: string
          created_by?: string | null
          descartada?: boolean
          fecha?: string
          finca_id?: string
          grasa_pct?: number | null
          id?: string
          jornada?: string
          lactancia_id?: string | null
          litros?: number
          motivo_descarte?: string | null
          observaciones?: string | null
          proteina_pct?: number | null
          rcs_miles_ml?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ordenos_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "animales"
            referencedColumns: ["id", "finca_id"]
          },
          {
            foreignKeyName: "ordenos_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_pediluvio_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "ordenos_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_podologia_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "ordenos_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_repro_hembras"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "ordenos_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordenos_lactancia_fk"
            columns: ["lactancia_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "lactancias"
            referencedColumns: ["id", "finca_id"]
          },
          {
            foreignKeyName: "ordenos_lactancia_fk"
            columns: ["lactancia_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_lactancias_resumen"
            referencedColumns: ["lactancia_id", "finca_id"]
          },
        ]
      }
      pagos_personal: {
        Row: {
          cantidad: number
          client_request_id: string | null
          costo_total: number | null
          created_at: string
          created_by: string | null
          factor: number
          fecha: string
          finca_id: string
          id: string
          observaciones: string | null
          pagado_en: string | null
          periodo_desde: string | null
          periodo_hasta: string | null
          personal_id: string
          soporte_pila: string | null
          updated_at: string
          valor_base: number
          valor_pago: number | null
        }
        Insert: {
          cantidad: number
          client_request_id?: string | null
          costo_total?: number | null
          created_at?: string
          created_by?: string | null
          factor?: number
          fecha: string
          finca_id: string
          id?: string
          observaciones?: string | null
          pagado_en?: string | null
          periodo_desde?: string | null
          periodo_hasta?: string | null
          personal_id: string
          soporte_pila?: string | null
          updated_at?: string
          valor_base: number
          valor_pago?: number | null
        }
        Update: {
          cantidad?: number
          client_request_id?: string | null
          costo_total?: number | null
          created_at?: string
          created_by?: string | null
          factor?: number
          fecha?: string
          finca_id?: string
          id?: string
          observaciones?: string | null
          pagado_en?: string | null
          periodo_desde?: string | null
          periodo_hasta?: string | null
          personal_id?: string
          soporte_pila?: string | null
          updated_at?: string
          valor_base?: number
          valor_pago?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pagos_personal_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_personal_persona_fk"
            columns: ["personal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "personal"
            referencedColumns: ["id", "finca_id"]
          },
        ]
      }
      parametros_especie: {
        Row: {
          ciclo_estral_dias: number
          especie: Database["public"]["Enums"]["especie"]
          gestacion_dias: number
          gestacion_max: number
          gestacion_min: number
          grasa_max_pct: number | null
          grasa_min_pct: number | null
          peso_faena_max_kg: number | null
          peso_faena_min_kg: number | null
          proteina_max_pct: number | null
          proteina_min_pct: number | null
        }
        Insert: {
          ciclo_estral_dias: number
          especie: Database["public"]["Enums"]["especie"]
          gestacion_dias: number
          gestacion_max: number
          gestacion_min: number
          grasa_max_pct?: number | null
          grasa_min_pct?: number | null
          peso_faena_max_kg?: number | null
          peso_faena_min_kg?: number | null
          proteina_max_pct?: number | null
          proteina_min_pct?: number | null
        }
        Update: {
          ciclo_estral_dias?: number
          especie?: Database["public"]["Enums"]["especie"]
          gestacion_dias?: number
          gestacion_max?: number
          gestacion_min?: number
          grasa_max_pct?: number | null
          grasa_min_pct?: number | null
          peso_faena_max_kg?: number | null
          peso_faena_min_kg?: number | null
          proteina_max_pct?: number | null
          proteina_min_pct?: number | null
        }
        Relationships: []
      }
      participaciones_feria: {
        Row: {
          animal_id: string
          categoria: string
          client_request_id: string | null
          created_at: string
          created_by: string | null
          feria_id: string
          finca_id: string
          foto_path: string | null
          id: string
          observaciones: string | null
          premio_descripcion: string | null
          premio_en_dinero: number | null
          puesto: number | null
          puntaje: number | null
          resultado: string
          updated_at: string
        }
        Insert: {
          animal_id: string
          categoria: string
          client_request_id?: string | null
          created_at?: string
          created_by?: string | null
          feria_id: string
          finca_id: string
          foto_path?: string | null
          id?: string
          observaciones?: string | null
          premio_descripcion?: string | null
          premio_en_dinero?: number | null
          puesto?: number | null
          puntaje?: number | null
          resultado?: string
          updated_at?: string
        }
        Update: {
          animal_id?: string
          categoria?: string
          client_request_id?: string | null
          created_at?: string
          created_by?: string | null
          feria_id?: string
          finca_id?: string
          foto_path?: string | null
          id?: string
          observaciones?: string | null
          premio_descripcion?: string | null
          premio_en_dinero?: number | null
          puesto?: number | null
          puntaje?: number | null
          resultado?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "participaciones_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "animales"
            referencedColumns: ["id", "finca_id"]
          },
          {
            foreignKeyName: "participaciones_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_pediluvio_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "participaciones_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_podologia_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "participaciones_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_repro_hembras"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "participaciones_feria_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participaciones_feria_fk"
            columns: ["feria_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "ferias"
            referencedColumns: ["id", "finca_id"]
          },
        ]
      }
      partos: {
        Row: {
          client_request_id: string | null
          complicaciones: string | null
          created_at: string
          created_by: string | null
          fecha: string
          finca_id: string
          id: string
          madre_id: string
          numero_crias: number
          servicio_id: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          client_request_id?: string | null
          complicaciones?: string | null
          created_at?: string
          created_by?: string | null
          fecha?: string
          finca_id: string
          id?: string
          madre_id: string
          numero_crias?: number
          servicio_id?: string | null
          tipo?: string
          updated_at?: string
        }
        Update: {
          client_request_id?: string | null
          complicaciones?: string | null
          created_at?: string
          created_by?: string | null
          fecha?: string
          finca_id?: string
          id?: string
          madre_id?: string
          numero_crias?: number
          servicio_id?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partos_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partos_madre_fk"
            columns: ["madre_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "animales"
            referencedColumns: ["id", "finca_id"]
          },
          {
            foreignKeyName: "partos_madre_fk"
            columns: ["madre_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_pediluvio_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "partos_madre_fk"
            columns: ["madre_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_podologia_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "partos_madre_fk"
            columns: ["madre_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_repro_hembras"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "partos_servicio_fk"
            columns: ["servicio_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "servicios"
            referencedColumns: ["id", "finca_id"]
          },
          {
            foreignKeyName: "partos_servicio_fk"
            columns: ["servicio_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_servicios"
            referencedColumns: ["id", "finca_id"]
          },
        ]
      }
      perfiles: {
        Row: {
          codigo_referido: string | null
          created_at: string
          exenta_vigencia: boolean
          finca_activa_id: string | null
          id: string
          libro_resuelto_en: string | null
          nombre: string | null
          referido_por: string | null
          telefono: string | null
          updated_at: string
        }
        Insert: {
          codigo_referido?: string | null
          created_at?: string
          exenta_vigencia?: boolean
          finca_activa_id?: string | null
          id: string
          libro_resuelto_en?: string | null
          nombre?: string | null
          referido_por?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          codigo_referido?: string | null
          created_at?: string
          exenta_vigencia?: boolean
          finca_activa_id?: string | null
          id?: string
          libro_resuelto_en?: string | null
          nombre?: string | null
          referido_por?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "perfiles_finca_activa_fk"
            columns: ["finca_activa_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
        ]
      }
      personal: {
        Row: {
          activo: boolean
          cargo: string | null
          correo: string | null
          created_at: string
          fecha_ingreso: string | null
          fecha_retiro: string | null
          finca_id: string
          forma_pago: string
          id: string
          nombre: string
          observaciones: string | null
          rol: Database["public"]["Enums"]["rol_finca"] | null
          updated_at: string
          valor_base: number
          vinculacion: string
        }
        Insert: {
          activo?: boolean
          cargo?: string | null
          correo?: string | null
          created_at?: string
          fecha_ingreso?: string | null
          fecha_retiro?: string | null
          finca_id: string
          forma_pago: string
          id?: string
          nombre: string
          observaciones?: string | null
          rol?: Database["public"]["Enums"]["rol_finca"] | null
          updated_at?: string
          valor_base: number
          vinculacion: string
        }
        Update: {
          activo?: boolean
          cargo?: string | null
          correo?: string | null
          created_at?: string
          fecha_ingreso?: string | null
          fecha_retiro?: string | null
          finca_id?: string
          forma_pago?: string
          id?: string
          nombre?: string
          observaciones?: string | null
          rol?: Database["public"]["Enums"]["rol_finca"] | null
          updated_at?: string
          valor_base?: number
          vinculacion?: string
        }
        Relationships: [
          {
            foreignKeyName: "personal_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
        ]
      }
      pesajes: {
        Row: {
          animal_id: string
          client_request_id: string | null
          condicion_corporal: number | null
          created_at: string
          created_by: string | null
          fecha: string
          finca_id: string
          id: string
          observaciones: string | null
          peso_kg: number
          tipo: string
          updated_at: string
        }
        Insert: {
          animal_id: string
          client_request_id?: string | null
          condicion_corporal?: number | null
          created_at?: string
          created_by?: string | null
          fecha?: string
          finca_id: string
          id?: string
          observaciones?: string | null
          peso_kg: number
          tipo?: string
          updated_at?: string
        }
        Update: {
          animal_id?: string
          client_request_id?: string | null
          condicion_corporal?: number | null
          created_at?: string
          created_by?: string | null
          fecha?: string
          finca_id?: string
          id?: string
          observaciones?: string | null
          peso_kg?: number
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pesajes_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "animales"
            referencedColumns: ["id", "finca_id"]
          },
          {
            foreignKeyName: "pesajes_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_pediluvio_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "pesajes_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_podologia_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "pesajes_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_repro_hembras"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "pesajes_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
        ]
      }
      plataforma_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      productos_veterinarios: {
        Row: {
          activo: boolean
          created_at: string
          finca_id: string
          id: string
          nombre: string
          registro_ica: string | null
          retiro_carne_dias: number
          retiro_leche_dias: number
          tipo: string
          unidad_dosis: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          finca_id: string
          id?: string
          nombre: string
          registro_ica?: string | null
          retiro_carne_dias?: number
          retiro_leche_dias?: number
          tipo?: string
          unidad_dosis?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          finca_id?: string
          id?: string
          nombre?: string
          registro_ica?: string | null
          retiro_carne_dias?: number
          retiro_leche_dias?: number
          tipo?: string
          unidad_dosis?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "productos_veterinarios_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
        ]
      }
      programa_sanitario_animales: {
        Row: {
          animal_id: string
          evento_id: string | null
          finca_id: string
          programa_id: string
        }
        Insert: {
          animal_id: string
          evento_id?: string | null
          finca_id: string
          programa_id: string
        }
        Update: {
          animal_id?: string
          evento_id?: string | null
          finca_id?: string
          programa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "programa_sanitario_animales_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "psa_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "animales"
            referencedColumns: ["id", "finca_id"]
          },
          {
            foreignKeyName: "psa_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_pediluvio_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "psa_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_podologia_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "psa_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_repro_hembras"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "psa_evento_fk"
            columns: ["evento_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "eventos_sanitarios"
            referencedColumns: ["id", "finca_id"]
          },
          {
            foreignKeyName: "psa_evento_fk"
            columns: ["evento_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_eventos_animal"
            referencedColumns: ["id", "finca_id"]
          },
          {
            foreignKeyName: "psa_evento_fk"
            columns: ["evento_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_eventos_sanitarios"
            referencedColumns: ["id", "finca_id"]
          },
          {
            foreignKeyName: "psa_programa_fk"
            columns: ["programa_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "programas_sanitarios"
            referencedColumns: ["id", "finca_id"]
          },
          {
            foreignKeyName: "psa_programa_fk"
            columns: ["programa_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_programas_sanitarios"
            referencedColumns: ["id", "finca_id"]
          },
        ]
      }
      programas_sanitarios: {
        Row: {
          cancelado_en: string | null
          client_request_id: string | null
          created_at: string
          created_by: string | null
          dosis: number | null
          fecha_programada: string
          finca_id: string
          id: string
          observaciones: string | null
          producto_id: string | null
          producto_nombre: string | null
          retiro_carne_dias: number
          retiro_leche_dias: number
          tipo: string
          unidad_dosis: string | null
          updated_at: string
          via: string | null
        }
        Insert: {
          cancelado_en?: string | null
          client_request_id?: string | null
          created_at?: string
          created_by?: string | null
          dosis?: number | null
          fecha_programada: string
          finca_id: string
          id?: string
          observaciones?: string | null
          producto_id?: string | null
          producto_nombre?: string | null
          retiro_carne_dias?: number
          retiro_leche_dias?: number
          tipo: string
          unidad_dosis?: string | null
          updated_at?: string
          via?: string | null
        }
        Update: {
          cancelado_en?: string | null
          client_request_id?: string | null
          created_at?: string
          created_by?: string | null
          dosis?: number | null
          fecha_programada?: string
          finca_id?: string
          id?: string
          observaciones?: string | null
          producto_id?: string | null
          producto_nombre?: string | null
          retiro_carne_dias?: number
          retiro_leche_dias?: number
          tipo?: string
          unidad_dosis?: string | null
          updated_at?: string
          via?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "programas_sanitarios_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programas_sanitarios_producto_fk"
            columns: ["producto_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "productos_veterinarios"
            referencedColumns: ["id", "finca_id"]
          },
        ]
      }
      pruebas_sanitarias: {
        Row: {
          animal_id: string
          client_request_id: string | null
          created_at: string
          created_by: string | null
          fecha: string
          finca_id: string
          id: string
          laboratorio: string | null
          observaciones: string | null
          prueba: string
          resultado: string
          soporte_path: string | null
          updated_at: string
        }
        Insert: {
          animal_id: string
          client_request_id?: string | null
          created_at?: string
          created_by?: string | null
          fecha?: string
          finca_id: string
          id?: string
          laboratorio?: string | null
          observaciones?: string | null
          prueba: string
          resultado?: string
          soporte_path?: string | null
          updated_at?: string
        }
        Update: {
          animal_id?: string
          client_request_id?: string | null
          created_at?: string
          created_by?: string | null
          fecha?: string
          finca_id?: string
          id?: string
          laboratorio?: string | null
          observaciones?: string | null
          prueba?: string
          resultado?: string
          soporte_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pruebas_sanitarias_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "animales"
            referencedColumns: ["id", "finca_id"]
          },
          {
            foreignKeyName: "pruebas_sanitarias_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_pediluvio_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "pruebas_sanitarias_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_podologia_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "pruebas_sanitarias_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_repro_hembras"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "pruebas_sanitarias_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
        ]
      }
      razas: {
        Row: {
          aptitud: Database["public"]["Enums"]["vocacion_animal"] | null
          especie: Database["public"]["Enums"]["especie"]
          id: number
          nombre: string
        }
        Insert: {
          aptitud?: Database["public"]["Enums"]["vocacion_animal"] | null
          especie: Database["public"]["Enums"]["especie"]
          id?: never
          nombre: string
        }
        Update: {
          aptitud?: Database["public"]["Enums"]["vocacion_animal"] | null
          especie?: Database["public"]["Enums"]["especie"]
          id?: never
          nombre?: string
        }
        Relationships: []
      }
      razas_alias: {
        Row: {
          alias: string
          especie: Database["public"]["Enums"]["especie"]
          raza_id: number
        }
        Insert: {
          alias: string
          especie: Database["public"]["Enums"]["especie"]
          raza_id: number
        }
        Update: {
          alias?: string
          especie?: Database["public"]["Enums"]["especie"]
          raza_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "razas_alias_raza_id_fkey"
            columns: ["raza_id"]
            isOneToOne: false
            referencedRelation: "razas"
            referencedColumns: ["id"]
          },
        ]
      }
      reglas_ceba: {
        Row: {
          created_at: string
          created_by: string | null
          dias_entre_pesajes: number
          especie: Database["public"]["Enums"]["especie"]
          finca_id: string
          hembra_dias_entre_pesajes: number
          hembra_meses_proxima: number
          hembra_meses_toca: number
          hembra_partos_proxima: number
          hembra_partos_toca: number
          macho_meses_proxima: number
          macho_meses_toca: number
          reproductor_meses_viejo: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dias_entre_pesajes?: number
          especie: Database["public"]["Enums"]["especie"]
          finca_id: string
          hembra_dias_entre_pesajes?: number
          hembra_meses_proxima?: number
          hembra_meses_toca?: number
          hembra_partos_proxima?: number
          hembra_partos_toca?: number
          macho_meses_proxima?: number
          macho_meses_toca?: number
          reproductor_meses_viejo?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dias_entre_pesajes?: number
          especie?: Database["public"]["Enums"]["especie"]
          finca_id?: string
          hembra_dias_entre_pesajes?: number
          hembra_meses_proxima?: number
          hembra_meses_toca?: number
          hembra_partos_proxima?: number
          hembra_partos_toca?: number
          macho_meses_proxima?: number
          macho_meses_toca?: number
          reproductor_meses_viejo?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reglas_ceba_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
        ]
      }
      sementales_externos: {
        Row: {
          chip: string
          condiciones: string | null
          created_at: string
          created_by: string | null
          especie: Database["public"]["Enums"]["especie"]
          fecha_nacimiento: string | null
          finca_id: string
          hato_origen: string
          id: string
          nombre: string
          prestamo_desde: string
          prestamo_hasta: string
          propietario: string | null
          raza: string | null
          raza_id: number
          sanidad: string | null
          telefono: string | null
          updated_at: string
        }
        Insert: {
          chip: string
          condiciones?: string | null
          created_at?: string
          created_by?: string | null
          especie: Database["public"]["Enums"]["especie"]
          fecha_nacimiento?: string | null
          finca_id: string
          hato_origen: string
          id?: string
          nombre: string
          prestamo_desde: string
          prestamo_hasta: string
          propietario?: string | null
          raza?: string | null
          raza_id: number
          sanidad?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          chip?: string
          condiciones?: string | null
          created_at?: string
          created_by?: string | null
          especie?: Database["public"]["Enums"]["especie"]
          fecha_nacimiento?: string | null
          finca_id?: string
          hato_origen?: string
          id?: string
          nombre?: string
          prestamo_desde?: string
          prestamo_hasta?: string
          propietario?: string | null
          raza?: string | null
          raza_id?: number
          sanidad?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sementales_externos_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sementales_externos_raza_fk"
            columns: ["raza_id", "especie"]
            isOneToOne: false
            referencedRelation: "razas"
            referencedColumns: ["id", "especie"]
          },
        ]
      }
      servicios: {
        Row: {
          client_request_id: string | null
          created_at: string
          created_by: string | null
          fecha: string
          finca_id: string
          hembra_id: string
          id: string
          macho_externo: string | null
          macho_id: string | null
          observaciones: string | null
          responsable: string | null
          semen_lote: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          client_request_id?: string | null
          created_at?: string
          created_by?: string | null
          fecha?: string
          finca_id: string
          hembra_id: string
          id?: string
          macho_externo?: string | null
          macho_id?: string | null
          observaciones?: string | null
          responsable?: string | null
          semen_lote?: string | null
          tipo: string
          updated_at?: string
        }
        Update: {
          client_request_id?: string | null
          created_at?: string
          created_by?: string | null
          fecha?: string
          finca_id?: string
          hembra_id?: string
          id?: string
          macho_externo?: string | null
          macho_id?: string | null
          observaciones?: string | null
          responsable?: string | null
          semen_lote?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "servicios_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicios_hembra_fk"
            columns: ["hembra_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "animales"
            referencedColumns: ["id", "finca_id"]
          },
          {
            foreignKeyName: "servicios_hembra_fk"
            columns: ["hembra_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_pediluvio_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "servicios_hembra_fk"
            columns: ["hembra_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_podologia_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "servicios_hembra_fk"
            columns: ["hembra_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_repro_hembras"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "servicios_macho_fk"
            columns: ["macho_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "animales"
            referencedColumns: ["id", "finca_id"]
          },
          {
            foreignKeyName: "servicios_macho_fk"
            columns: ["macho_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_pediluvio_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "servicios_macho_fk"
            columns: ["macho_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_podologia_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "servicios_macho_fk"
            columns: ["macho_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_repro_hembras"
            referencedColumns: ["animal_id", "finca_id"]
          },
        ]
      }
      solicitudes_plan: {
        Row: {
          atendida_en: string | null
          created_at: string
          estado: string
          finca_id: string
          id: string
          periodo: string
          plan_actual: string
          plan_nuevo: string
          user_id: string
        }
        Insert: {
          atendida_en?: string | null
          created_at?: string
          estado?: string
          finca_id: string
          id?: string
          periodo?: string
          plan_actual: string
          plan_nuevo: string
          user_id: string
        }
        Update: {
          atendida_en?: string | null
          created_at?: string
          estado?: string
          finca_id?: string
          id?: string
          periodo?: string
          plan_actual?: string
          plan_nuevo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitudes_plan_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitudes_reclamo: {
        Row: {
          animales_disponibles: number
          animales_importados: number | null
          created_at: string
          estado: string
          finca_id: string
          id: string
          mensaje: string | null
          motivo_rechazo: string | null
          resuelta_en: string | null
          resuelta_por: string | null
          solicitante_id: string
          titular_id: string
          updated_at: string
        }
        Insert: {
          animales_disponibles?: number
          animales_importados?: number | null
          created_at?: string
          estado?: string
          finca_id: string
          id?: string
          mensaje?: string | null
          motivo_rechazo?: string | null
          resuelta_en?: string | null
          resuelta_por?: string | null
          solicitante_id?: string
          titular_id: string
          updated_at?: string
        }
        Update: {
          animales_disponibles?: number
          animales_importados?: number | null
          created_at?: string
          estado?: string
          finca_id?: string
          id?: string
          mensaje?: string | null
          motivo_rechazo?: string | null
          resuelta_en?: string | null
          resuelta_por?: string | null
          solicitante_id?: string
          titular_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitudes_reclamo_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitudes_reclamo_titular_id_fkey"
            columns: ["titular_id"]
            isOneToOne: false
            referencedRelation: "libro_titulares"
            referencedColumns: ["id"]
          },
        ]
      }
      ubicaciones: {
        Row: {
          activa: boolean
          agua: boolean
          area_m2: number | null
          capacidad: number | null
          created_at: string
          created_by: string | null
          dias_descanso_min: number
          dias_ocupacion_max: number
          finca_id: string
          id: string
          nombre: string
          observaciones: string | null
          piso: string | null
          tipo: string
          updated_at: string
          uso: string
        }
        Insert: {
          activa?: boolean
          agua?: boolean
          area_m2?: number | null
          capacidad?: number | null
          created_at?: string
          created_by?: string | null
          dias_descanso_min?: number
          dias_ocupacion_max?: number
          finca_id: string
          id?: string
          nombre: string
          observaciones?: string | null
          piso?: string | null
          tipo: string
          updated_at?: string
          uso?: string
        }
        Update: {
          activa?: boolean
          agua?: boolean
          area_m2?: number | null
          capacidad?: number | null
          created_at?: string
          created_by?: string | null
          dias_descanso_min?: number
          dias_ocupacion_max?: number
          finca_id?: string
          id?: string
          nombre?: string
          observaciones?: string | null
          piso?: string | null
          tipo?: string
          updated_at?: string
          uso?: string
        }
        Relationships: [
          {
            foreignKeyName: "ubicaciones_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
        ]
      }
      ventas: {
        Row: {
          cantidad: number
          client_request_id: string | null
          cobrado_en: string | null
          cobro_vence: string | null
          created_at: string
          created_by: string | null
          fecha: string
          finca_id: string
          id: string
          observaciones: string | null
          precio_unitario: number
          producto_id: string
          tercero_id: string | null
          unidad: string | null
          updated_at: string
          valor_total: number | null
        }
        Insert: {
          cantidad: number
          client_request_id?: string | null
          cobrado_en?: string | null
          cobro_vence?: string | null
          created_at?: string
          created_by?: string | null
          fecha: string
          finca_id: string
          id?: string
          observaciones?: string | null
          precio_unitario: number
          producto_id: string
          tercero_id?: string | null
          unidad?: string | null
          updated_at?: string
          valor_total?: number | null
        }
        Update: {
          cantidad?: number
          client_request_id?: string | null
          cobrado_en?: string | null
          cobro_vence?: string | null
          created_at?: string
          created_by?: string | null
          fecha?: string
          finca_id?: string
          id?: string
          observaciones?: string | null
          precio_unitario?: number
          producto_id?: string
          tercero_id?: string | null
          unidad?: string | null
          updated_at?: string
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ventas_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_producto_fk"
            columns: ["producto_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "finca_productos"
            referencedColumns: ["id", "finca_id"]
          },
          {
            foreignKeyName: "ventas_tercero_fk"
            columns: ["tercero_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "finca_terceros"
            referencedColumns: ["id", "finca_id"]
          },
        ]
      }
    }
    Views: {
      v_analisis_leche_ultimo: {
        Row: {
          animal_id: string | null
          client_request_id: string | null
          created_at: string | null
          created_by: string | null
          fecha: string | null
          finca_id: string | null
          grasa_pct: number | null
          id: string | null
          laboratorio: string | null
          muestra: string | null
          observaciones: string | null
          proteina_pct: number | null
          rcs_miles_ml: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analisis_leche_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "animales"
            referencedColumns: ["id", "finca_id"]
          },
          {
            foreignKeyName: "analisis_leche_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_pediluvio_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "analisis_leche_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_podologia_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "analisis_leche_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_repro_hembras"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "analisis_leche_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
        ]
      }
      v_canales: {
        Row: {
          animal_id: string | null
          client_request_id: string | null
          conformacion: string | null
          created_at: string | null
          created_by: string | null
          engrasamiento: number | null
          fecha: string | null
          finca_id: string | null
          grasa_dorsal_mm: number | null
          grasa_visceral: string | null
          id: string | null
          merma_oreo_pct: number | null
          observaciones: string | null
          peso_canal_caliente_kg: number | null
          peso_canal_fria_kg: number | null
          peso_vivo_kg: number | null
          planta: string | null
          rendimiento_caliente_pct: number | null
          rendimiento_frio_pct: number | null
          tipo_baja: string | null
          updated_at: string | null
        }
        Insert: {
          animal_id?: string | null
          client_request_id?: string | null
          conformacion?: string | null
          created_at?: string | null
          created_by?: string | null
          engrasamiento?: number | null
          fecha?: string | null
          finca_id?: string | null
          grasa_dorsal_mm?: number | null
          grasa_visceral?: string | null
          id?: string | null
          merma_oreo_pct?: never
          observaciones?: string | null
          peso_canal_caliente_kg?: number | null
          peso_canal_fria_kg?: number | null
          peso_vivo_kg?: number | null
          planta?: string | null
          rendimiento_caliente_pct?: never
          rendimiento_frio_pct?: never
          tipo_baja?: string | null
          updated_at?: string | null
        }
        Update: {
          animal_id?: string | null
          client_request_id?: string | null
          conformacion?: string | null
          created_at?: string | null
          created_by?: string | null
          engrasamiento?: number | null
          fecha?: string | null
          finca_id?: string | null
          grasa_dorsal_mm?: number | null
          grasa_visceral?: string | null
          id?: string | null
          merma_oreo_pct?: never
          observaciones?: string | null
          peso_canal_caliente_kg?: number | null
          peso_canal_fria_kg?: number | null
          peso_vivo_kg?: number | null
          planta?: string | null
          rendimiento_caliente_pct?: never
          rendimiento_frio_pct?: never
          tipo_baja?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "canales_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "animales"
            referencedColumns: ["id", "finca_id"]
          },
          {
            foreignKeyName: "canales_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_pediluvio_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "canales_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_podologia_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "canales_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_repro_hembras"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "canales_baja_fk"
            columns: ["animal_id", "tipo_baja"]
            isOneToOne: false
            referencedRelation: "bajas"
            referencedColumns: ["animal_id", "tipo"]
          },
          {
            foreignKeyName: "canales_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
        ]
      }
      v_cuarentena_alerta: {
        Row: {
          animal_id: string | null
          desde: string | null
          dias: number | null
          finca_id: string | null
          situacion: string | null
          ubicacion_id: string | null
        }
        Relationships: []
      }
      v_empadronamientos: {
        Row: {
          cc_min: number | null
          cerrado_en: string | null
          client_request_id: string | null
          created_at: string | null
          created_by: string | null
          edad_min_meses: number | null
          especie: Database["public"]["Enums"]["especie"] | null
          excepciones: number | null
          fecha_base: string | null
          fecha_fin_prevista: string | null
          fecha_inicio: string | null
          finca_id: string | null
          hembras: number | null
          hembras_por_macho: number | null
          id: string | null
          machos: number | null
          nombre: string | null
          observaciones: string | null
          peso_min_kg: number | null
          updated_at: string | null
        }
        Insert: {
          cc_min?: number | null
          cerrado_en?: string | null
          client_request_id?: string | null
          created_at?: string | null
          created_by?: string | null
          edad_min_meses?: number | null
          especie?: Database["public"]["Enums"]["especie"] | null
          excepciones?: never
          fecha_base?: string | null
          fecha_fin_prevista?: string | null
          fecha_inicio?: string | null
          finca_id?: string | null
          hembras?: never
          hembras_por_macho?: number | null
          id?: string | null
          machos?: never
          nombre?: string | null
          observaciones?: string | null
          peso_min_kg?: number | null
          updated_at?: string | null
        }
        Update: {
          cc_min?: number | null
          cerrado_en?: string | null
          client_request_id?: string | null
          created_at?: string | null
          created_by?: string | null
          edad_min_meses?: number | null
          especie?: Database["public"]["Enums"]["especie"] | null
          excepciones?: never
          fecha_base?: string | null
          fecha_fin_prevista?: string | null
          fecha_inicio?: string | null
          finca_id?: string | null
          hembras?: never
          hembras_por_macho?: number | null
          id?: string | null
          machos?: never
          nombre?: string | null
          observaciones?: string | null
          peso_min_kg?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "empadronamientos_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
        ]
      }
      v_eventos_animal: {
        Row: {
          animal_id: string | null
          created_at: string | null
          diagnostico: string | null
          dosis: number | null
          fecha: string | null
          fin_retiro_carne: string | null
          fin_retiro_leche: string | null
          finca_id: string | null
          id: string | null
          producto_nombre: string | null
          proxima_fecha: string | null
          retiro_carne_dias: number | null
          retiro_leche_dias: number | null
          tipo: string | null
          unidad_dosis: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eventos_sanitarios_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
        ]
      }
      v_eventos_sanitarios: {
        Row: {
          animales: number | null
          created_at: string | null
          diagnostico: string | null
          dosis: number | null
          fecha: string | null
          fin_retiro_carne: string | null
          fin_retiro_leche: string | null
          finca_id: string | null
          id: string | null
          primer_animal: string | null
          primer_animal_id: string | null
          producto_id: string | null
          producto_nombre: string | null
          proxima_fecha: string | null
          responsable: string | null
          retiro_carne_dias: number | null
          retiro_leche_dias: number | null
          tipo: string | null
          unidad_dosis: string | null
        }
        Insert: {
          animales?: never
          created_at?: string | null
          diagnostico?: string | null
          dosis?: number | null
          fecha?: string | null
          fin_retiro_carne?: string | null
          fin_retiro_leche?: string | null
          finca_id?: string | null
          id?: string | null
          primer_animal?: never
          primer_animal_id?: never
          producto_id?: string | null
          producto_nombre?: string | null
          proxima_fecha?: string | null
          responsable?: string | null
          retiro_carne_dias?: number | null
          retiro_leche_dias?: number | null
          tipo?: string | null
          unidad_dosis?: string | null
        }
        Update: {
          animales?: never
          created_at?: string | null
          diagnostico?: string | null
          dosis?: number | null
          fecha?: string | null
          fin_retiro_carne?: string | null
          fin_retiro_leche?: string | null
          finca_id?: string | null
          id?: string | null
          primer_animal?: never
          primer_animal_id?: never
          producto_id?: string | null
          producto_nombre?: string | null
          proxima_fecha?: string | null
          responsable?: string | null
          retiro_carne_dias?: number | null
          retiro_leche_dias?: number | null
          tipo?: string | null
          unidad_dosis?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eventos_sanitarios_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_sanitarios_producto_fk"
            columns: ["producto_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "productos_veterinarios"
            referencedColumns: ["id", "finca_id"]
          },
        ]
      }
      v_famacha_animal: {
        Row: {
          animal_id: string | null
          desparasitado_en: string | null
          evaluacion_id: string | null
          finca_id: string | null
          puntaje: number | null
          ultima_fecha: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evaluaciones_famacha_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "famacha_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "animales"
            referencedColumns: ["id", "finca_id"]
          },
          {
            foreignKeyName: "famacha_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_pediluvio_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "famacha_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_podologia_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "famacha_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_repro_hembras"
            referencedColumns: ["animal_id", "finca_id"]
          },
        ]
      }
      v_lactancias_resumen: {
        Row: {
          animal_id: string | null
          dias_con_registro: number | null
          dias_lactancia: number | null
          fecha_parto: string | null
          fecha_secado: string | null
          finca_id: string | null
          lactancia_id: string | null
          litros_total: number | null
          numero: number | null
          pico_diario: number | null
          promedio_diario: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lactancias_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "animales"
            referencedColumns: ["id", "finca_id"]
          },
          {
            foreignKeyName: "lactancias_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_pediluvio_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "lactancias_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_podologia_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "lactancias_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_repro_hembras"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "lactancias_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
        ]
      }
      v_palmares_animal: {
        Row: {
          animal_id: string | null
          campeonatos: number | null
          finca_id: string | null
          mejor_puesto: number | null
          participaciones: number | null
          premios: number | null
        }
        Relationships: [
          {
            foreignKeyName: "participaciones_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "animales"
            referencedColumns: ["id", "finca_id"]
          },
          {
            foreignKeyName: "participaciones_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_pediluvio_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "participaciones_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_podologia_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "participaciones_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_repro_hembras"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "participaciones_feria_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
        ]
      }
      v_palmares_finca: {
        Row: {
          animales_premiados: number | null
          campeonatos: number | null
          dinero: number | null
          finca_id: string | null
          participaciones: number | null
          premios: number | null
        }
        Relationships: [
          {
            foreignKeyName: "participaciones_feria_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
        ]
      }
      v_pediluvio_animal: {
        Row: {
          animal_id: string | null
          finca_id: string | null
          ultima_fecha: string | null
        }
        Insert: {
          animal_id?: string | null
          finca_id?: string | null
          ultima_fecha?: never
        }
        Update: {
          animal_id?: string | null
          finca_id?: string | null
          ultima_fecha?: never
        }
        Relationships: [
          {
            foreignKeyName: "animales_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
        ]
      }
      v_podologia_animal: {
        Row: {
          animal_id: string | null
          finca_id: string | null
          ultima_fecha: string | null
        }
        Insert: {
          animal_id?: string | null
          finca_id?: string | null
          ultima_fecha?: never
        }
        Update: {
          animal_id?: string | null
          finca_id?: string | null
          ultima_fecha?: never
        }
        Relationships: [
          {
            foreignKeyName: "animales_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
        ]
      }
      v_produccion_diaria: {
        Row: {
          animal_id: string | null
          dias_en_leche: number | null
          fecha: string | null
          finca_id: string | null
          lactancia_id: string | null
          litros_descartados: number | null
          litros_tanque: number | null
          litros_total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ordenos_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "animales"
            referencedColumns: ["id", "finca_id"]
          },
          {
            foreignKeyName: "ordenos_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_pediluvio_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "ordenos_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_podologia_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "ordenos_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_repro_hembras"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "ordenos_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordenos_lactancia_fk"
            columns: ["lactancia_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "lactancias"
            referencedColumns: ["id", "finca_id"]
          },
          {
            foreignKeyName: "ordenos_lactancia_fk"
            columns: ["lactancia_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_lactancias_resumen"
            referencedColumns: ["lactancia_id", "finca_id"]
          },
        ]
      }
      v_programas_sanitarios: {
        Row: {
          animales: number | null
          aplicados: number | null
          cancelado_en: string | null
          client_request_id: string | null
          created_at: string | null
          created_by: string | null
          dosis: number | null
          estado: string | null
          fecha_programada: string | null
          finca_id: string | null
          id: string | null
          observaciones: string | null
          producto_id: string | null
          producto_nombre: string | null
          retiro_carne_dias: number | null
          retiro_leche_dias: number | null
          tipo: string | null
          unidad_dosis: string | null
          updated_at: string | null
          via: string | null
        }
        Insert: {
          animales?: never
          aplicados?: never
          cancelado_en?: string | null
          client_request_id?: string | null
          created_at?: string | null
          created_by?: string | null
          dosis?: number | null
          estado?: never
          fecha_programada?: string | null
          finca_id?: string | null
          id?: string | null
          observaciones?: string | null
          producto_id?: string | null
          producto_nombre?: string | null
          retiro_carne_dias?: number | null
          retiro_leche_dias?: number | null
          tipo?: string | null
          unidad_dosis?: string | null
          updated_at?: string | null
          via?: string | null
        }
        Update: {
          animales?: never
          aplicados?: never
          cancelado_en?: string | null
          client_request_id?: string | null
          created_at?: string | null
          created_by?: string | null
          dosis?: number | null
          estado?: never
          fecha_programada?: string | null
          finca_id?: string | null
          id?: string | null
          observaciones?: string | null
          producto_id?: string | null
          producto_nombre?: string | null
          retiro_carne_dias?: number | null
          retiro_leche_dias?: number | null
          tipo?: string | null
          unidad_dosis?: string | null
          updated_at?: string | null
          via?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "programas_sanitarios_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programas_sanitarios_producto_fk"
            columns: ["producto_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "productos_veterinarios"
            referencedColumns: ["id", "finca_id"]
          },
        ]
      }
      v_rcs_leche_ultimo: {
        Row: {
          animal_id: string | null
          client_request_id: string | null
          created_at: string | null
          created_by: string | null
          fecha: string | null
          finca_id: string | null
          grasa_pct: number | null
          id: string | null
          laboratorio: string | null
          muestra: string | null
          observaciones: string | null
          proteina_pct: number | null
          rcs_miles_ml: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analisis_leche_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "animales"
            referencedColumns: ["id", "finca_id"]
          },
          {
            foreignKeyName: "analisis_leche_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_pediluvio_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "analisis_leche_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_podologia_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "analisis_leche_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_repro_hembras"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "analisis_leche_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
        ]
      }
      v_repro_hembras: {
        Row: {
          animal_id: string | null
          diagnostico: string | null
          empadronamiento_id: string | null
          empadronamiento_macho_id: string | null
          empadronamiento_nombre: string | null
          en_lactancia: boolean | null
          especie: Database["public"]["Enums"]["especie"] | null
          estado: string | null
          fecha_diagnostico: string | null
          fecha_prevista_parto: string | null
          finca_id: string | null
          partos_previos: number | null
          partos_registrados: number | null
          partos_totales: number | null
          servicio_id: string | null
          ultimo_parto: string | null
          ultimo_servicio: string | null
        }
        Relationships: [
          {
            foreignKeyName: "animales_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
        ]
      }
      v_sanidad_pendiente: {
        Row: {
          animal_id: string | null
          evento_id: string | null
          finca_id: string | null
          producto_id: string | null
          producto_nombre: string | null
          proxima_fecha: string | null
          tipo: string | null
        }
        Relationships: [
          {
            foreignKeyName: "esa_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "animales"
            referencedColumns: ["id", "finca_id"]
          },
          {
            foreignKeyName: "esa_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_pediluvio_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "esa_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_podologia_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "esa_animal_fk"
            columns: ["animal_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_repro_hembras"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "evento_sanitario_animales_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
        ]
      }
      v_servicios: {
        Row: {
          client_request_id: string | null
          created_at: string | null
          created_by: string | null
          fecha: string | null
          fecha_prevista_parto: string | null
          finca_id: string | null
          gestacion_dias: number | null
          hembra_id: string | null
          id: string | null
          macho_externo: string | null
          macho_id: string | null
          observaciones: string | null
          responsable: string | null
          semen_lote: string | null
          tipo: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "servicios_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicios_hembra_fk"
            columns: ["hembra_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "animales"
            referencedColumns: ["id", "finca_id"]
          },
          {
            foreignKeyName: "servicios_hembra_fk"
            columns: ["hembra_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_pediluvio_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "servicios_hembra_fk"
            columns: ["hembra_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_podologia_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "servicios_hembra_fk"
            columns: ["hembra_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_repro_hembras"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "servicios_macho_fk"
            columns: ["macho_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "animales"
            referencedColumns: ["id", "finca_id"]
          },
          {
            foreignKeyName: "servicios_macho_fk"
            columns: ["macho_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_pediluvio_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "servicios_macho_fk"
            columns: ["macho_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_podologia_animal"
            referencedColumns: ["animal_id", "finca_id"]
          },
          {
            foreignKeyName: "servicios_macho_fk"
            columns: ["macho_id", "finca_id"]
            isOneToOne: false
            referencedRelation: "v_repro_hembras"
            referencedColumns: ["animal_id", "finca_id"]
          },
        ]
      }
      v_ubicaciones: {
        Row: {
          activa: boolean | null
          agua: boolean | null
          area_m2: number | null
          capacidad: number | null
          created_at: string | null
          created_by: string | null
          dias_descanso: number | null
          dias_descanso_min: number | null
          dias_ocupacion: number | null
          dias_ocupacion_max: number | null
          estado: string | null
          finca_id: string | null
          hacinada: boolean | null
          id: string | null
          nombre: string | null
          observaciones: string | null
          ocupado_desde: string | null
          ocupantes: number | null
          piso: string | null
          tipo: string | null
          ultimo_retiro: string | null
          updated_at: string | null
          uso: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ubicaciones_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      aceptar_invitacion: { Args: { p_token: string }; Returns: string }
      admin_activar_plan_finca: {
        Args: { p_finca: string; p_periodo?: string; p_plan: string }
        Returns: string
      }
      admin_asignar_plan: {
        Args: { p_correo: string; p_plan: string }
        Returns: number
      }
      admin_asignar_plan_finca: {
        Args: { p_finca: string; p_plan: string }
        Returns: number
      }
      admin_fijar_vigencia_finca: {
        Args: { p_fecha: string; p_finca: string }
        Returns: undefined
      }
      admin_listar_comisiones: {
        Args: never
        Returns: {
          desde: string
          meses: number
          plan: string
          porcentaje: number
          referido: string
          referidor: string
        }[]
      }
      admin_listar_fincas: {
        Args: never
        Returns: {
          animales_activos: number
          creada_en: string
          departamento: string
          id: string
          miembros: number
          municipio: string
          nombre: string
          propietario_email: string
          propietario_nombre: string
        }[]
      }
      admin_listar_reclamos: {
        Args: { p_estado?: string }
        Returns: {
          animales_total: number
          animales_vivos: number
          creada_en: string
          criaderos: string[]
          documento_tipo: string
          documento_ultimos4: string
          estado: string
          finca_id: string
          finca_nombre: string
          id: string
          mensaje: string
          motivo_rechazo: string
          persona_juridica: boolean
          solicitante_email: string
          solicitante_nombre: string
        }[]
      }
      admin_listar_solicitudes_plan: {
        Args: never
        Returns: {
          correo: string
          creada_en: string
          finca: string
          id: string
          nombre: string
          periodo: string
          plan_actual: string
          plan_nuevo: string
        }[]
      }
      admin_marcar_cuenta_pruebas: {
        Args: { p_correo: string; p_exenta: boolean }
        Returns: number
      }
      admin_reabrir_traer_animales: {
        Args: { p_email: string }
        Returns: boolean
      }
      admin_resumen: { Args: never; Returns: Json }
      admin_revertir_importacion: {
        Args: { p_solicitud: string }
        Returns: number
      }
      admin_solicitudes_plan: {
        Args: never
        Returns: {
          correo: string
          creada_en: string
          finca: string
          finca_id: string
          id: string
          nombre: string
          numero_finca: number
          periodo: string
          plan_actual: string
          plan_nuevo: string
        }[]
      }
      admin_vigencias: {
        Args: never
        Returns: {
          cuenta_pruebas: boolean
          estado: string
          finca_id: string
          nombre: string
          plan: string
          plan_vence_en: string
          propietario_email: string
        }[]
      }
      ancestros_comunes: {
        Args: { p_hembra: string; p_macho: string; p_max_gen?: number }
        Returns: {
          gen_hembra: number
          gen_macho: number
          nombre: string
        }[]
      }
      animales_en_retiro: {
        Args: { p_finca: string }
        Returns: {
          animal_id: string
          retiro_carne_hasta: string
          retiro_leche_hasta: string
        }[]
      }
      animales_endogamia: {
        Args: { p_finca: string; p_min?: number }
        Returns: {
          animal_id: string
          especie: string
          estado: string
          f: number
          nombre: string
          numero_arete: string
          sexo: string
        }[]
      }
      asegurar_ajustes_finca: { Args: { p_finca: string }; Returns: undefined }
      canales_resumen: {
        Args: { p_finca: string }
        Returns: {
          merma_prom: number
          n: number
          peso_caliente_prom: number
          rendimiento_caliente_prom: number
          rendimiento_frio_prom: number
        }[]
      }
      candidatos_ceba: {
        Args: { p_animal?: string; p_finca: string }
        Returns: {
          advertencias: string[]
          animal_id: string
          edad_meses: number
          en_lactancia: boolean
          especie: string
          estado_repro: string
          fecha_ultimo_peso: string
          gdp_reciente_g: number
          motivos: string[]
          nivel: string
          partos_totales: number
          peso_ultimo: number
          retiro_carne_hasta: string
          sexo: string
          uso_macho: string
        }[]
      }
      ceba_animales: {
        Args: { p_finca: string }
        Returns: {
          animal_id: string
          fecha_primero: string
          fecha_ultimo: string
          gdp_reciente_g: number
          gdp_total_g: number
          lote_id: string
          n_pesajes: number
          peso_primero: number
          peso_ultimo: number
        }[]
      }
      ceba_lotes: {
        Args: { p_finca: string }
        Returns: {
          animales: number
          costo_alimento: number
          gdp_g: number
          kg_alimento: number
          kg_ganados: number
          listos: number
          lote_id: string
          pesados: number
          peso_promedio: number
        }[]
      }
      cerrar_empadronamiento: {
        Args: { p_base?: string; p_cierre: string; p_lote: string }
        Returns: Json
      }
      coef_endogamia: { Args: { p_animal: string }; Returns: number }
      coef_endogamia_libro: { Args: { p_libro: string }; Returns: number }
      completitud_pedigri: {
        Args: { p_animal: string; p_generaciones?: number }
        Returns: number
      }
      completitud_pedigri_libro: {
        Args: { p_generaciones?: number; p_libro: string }
        Returns: number
      }
      costos_depreciacion: {
        Args: { p_desde: string; p_finca: string; p_hasta: string }
        Returns: {
          animales: number
          con_valor: number
          perdida: number
          tipo: string
        }[]
      }
      costos_detalle: {
        Args: {
          p_desde: string
          p_finca: string
          p_hasta: string
          p_limite?: number
          p_rubro?: string
          p_salto?: number
        }
        Returns: {
          animal_id: string
          descripcion: string
          destino_tipo: string
          especie: string
          fecha: string
          lote_id: string
          monto: number
          origen: string
          origen_id: string
          pagado: boolean
          proveedor: string
          rubro: string
          ubicacion_id: string
          vence: string
        }[]
      }
      costos_indicadores: {
        Args: { p_desde: string; p_finca: string; p_hasta: string }
        Returns: {
          animales_activos: number
          ingresos_animales: number
          ingresos_leche: number
          litros: number
          por_pagar: number
          total_costos: number
          vencido: number
        }[]
      }
      costos_pagina: {
        Args: {
          p_desde: string
          p_finca: string
          p_hasta: string
          p_limite?: number
          p_rubro?: string
          p_salto?: number
        }
        Returns: {
          animal_id: string
          descripcion: string
          destino_tipo: string
          especie: string
          fecha: string
          lote_id: string
          monto: number
          origen: string
          origen_id: string
          pagado: boolean
          proveedor: string
          rubro: string
          total: number
          ubicacion_id: string
          vence: string
        }[]
      }
      costos_por_animal: {
        Args: { p_desde: string; p_finca: string; p_hasta: string }
        Returns: {
          animal_id: string
          directo: number
          especie: string
          estado: string
          nombre: string
          numero_arete: string
          repartido: number
          sexo: string
          total: number
          valor_compra: number
        }[]
      }
      costos_por_mes: {
        Args: { p_desde: string; p_finca: string; p_hasta: string }
        Returns: {
          costos: number
          ingresos_animales: number
          ingresos_leche: number
          litros: number
          mes: string
        }[]
      }
      costos_por_rubro: {
        Args: { p_desde: string; p_finca: string; p_hasta: string }
        Returns: {
          de_ceba: number
          de_gastos: number
          de_sanidad: number
          movimientos: number
          por_pagar: number
          rubro: string
          total: number
        }[]
      }
      costos_posible_doble_conteo: {
        Args: { p_desde: string; p_finca: string; p_hasta: string }
        Returns: {
          compras: number
          consumo: number
          origen_consumo: string
          rubro: string
        }[]
      }
      editar_movimiento: {
        Args: {
          p_desde: string
          p_id: string
          p_motivo: string
          p_observaciones: string
          p_ubicacion: string
        }
        Returns: undefined
      }
      empadronamiento_candidatas: {
        Args: { p_lote: string }
        Returns: {
          animal_id: string
          cc: number
          cc_ok: string
          edad_meses: number
          edad_ok: string
          estado_repro: string
          fecha_cc: string
          fecha_peso: string
          nombre: string
          numero_arete: string
          otro_lote: string
          peso_kg: number
          peso_ok: string
        }[]
      }
      empadronamiento_candidatas_criterios: {
        Args: {
          p_cc_min: number
          p_edad_min: number
          p_especie: Database["public"]["Enums"]["especie"]
          p_excluir_lote?: string
          p_finca: string
          p_peso_min: number
        }
        Returns: {
          animal_id: string
          cc: number
          cc_ok: string
          edad_meses: number
          edad_ok: string
          estado_repro: string
          fecha_cc: string
          fecha_peso: string
          nombre: string
          numero_arete: string
          otro_lote: string
          peso_kg: number
          peso_ok: string
        }[]
      }
      empadronamiento_endogamia: {
        Args: { p_hembras: string[]; p_lote: string; p_macho: string }
        Returns: {
          f: number
          hembra_id: string
          sobre_umbral: boolean
        }[]
      }
      empadronamiento_endogamia_previa: {
        Args: { p_finca: string; p_hembras: string[]; p_macho: string }
        Returns: {
          f: number
          hembra_id: string
          sobre_umbral: boolean
        }[]
      }
      estado_vigencia_finca: { Args: { p_finca: string }; Returns: string }
      explicar_cruza: {
        Args: { p_hembra: string; p_macho: string }
        Returns: {
          ancestro_chip: string
          ancestro_nombre: string
          ancestro_sexo: string
          aporte: number
          ruta_madre: Json
          ruta_padre: Json
        }[]
      }
      explicar_endogamia: {
        Args: { p_animal: string }
        Returns: {
          ancestro_chip: string
          ancestro_nombre: string
          ancestro_sexo: string
          aporte: number
          ruta_madre: Json
          ruta_padre: Json
        }[]
      }
      guardar_evento_sanitario: {
        Args: {
          p_animales: string[]
          p_datos: Json
          p_evento: string
          p_finca: string
        }
        Returns: string
      }
      guardar_programa_sanitario: {
        Args: {
          p_animales: string[]
          p_datos: Json
          p_finca: string
          p_programa: string
        }
        Returns: string
      }
      importar_animales_lote: {
        Args: { p_filas: Json; p_finca: string }
        Returns: Json
      }
      importar_libro_lote: {
        Args: { p_entidad?: string; p_lote: Json }
        Returns: Json
      }
      leche_balance: {
        Args: { p_desde: string; p_finca: string; p_hasta: string }
        Returns: {
          descartada: number
          despachada: number
          producida: number
          valor_despachado: number
        }[]
      }
      marcar_cobro_venta: {
        Args: {
          p_fecha: string
          p_finca: string
          p_id: string
          p_origen: string
        }
        Returns: undefined
      }
      mis_referidos: {
        Args: never
        Returns: {
          desde: string
          meses: number
          nombre: string
          plan: string
          porcentaje: number
          registrado_en: string
        }[]
      }
      mover_animales: {
        Args: {
          p_animales: string[]
          p_fecha: string
          p_finca: string
          p_motivo: string
          p_observaciones: string
          p_ubicacion: string
        }
        Returns: number
      }
      produccion_habitual: {
        Args: { p_finca: string; p_hoy?: string }
        Returns: {
          animal_id: string
          dias: number
          jornada: string
          litros_habitual: number
        }[]
      }
      produccion_historial: {
        Args: {
          p_animal?: string
          p_desde: string
          p_finca: string
          p_hasta: string
        }
        Returns: {
          animales: number
          fecha: string
          jornada: string
          litros_descartados: number
          litros_tanque: number
          ordenos: number
        }[]
      }
      produccion_por_animal: {
        Args: { p_desde: string; p_finca: string; p_hasta: string }
        Returns: {
          animal_id: string
          dias: number
          litros_descartados: number
          litros_tanque: number
          ordenos: number
        }[]
      }
      produccion_tendencia: {
        Args: { p_finca: string; p_hoy?: string }
        Returns: {
          animal_id: string
          dias_base: number
          dias_recientes: number
          litros_base: number
          litros_recientes: number
          nivel: string
          variacion: number
        }[]
      }
      recordar_precio_producto: {
        Args: { p_finca: string; p_precio: number; p_producto: string }
        Returns: undefined
      }
      registrar_animal: {
        Args: { p_animal: Json; p_fecha_ultimo_parto?: string; p_finca: string }
        Returns: string
      }
      registrar_parto: {
        Args: { p_crias: Json; p_finca: string; p_parto: Json }
        Returns: Json
      }
      reglas_ceba_efectivas: {
        Args: { p_finca: string }
        Returns: {
          dias_entre_pesajes: number
          especie: Database["public"]["Enums"]["especie"]
          hembra_dias_entre_pesajes: number
          hembra_meses_proxima: number
          hembra_meses_toca: number
          hembra_partos_proxima: number
          hembra_partos_toca: number
          macho_meses_proxima: number
          macho_meses_toca: number
          personalizada: boolean
          reproductor_meses_viejo: number
        }[]
      }
      resolver_padres_libro: { Args: { p_entidad?: string }; Returns: Json }
      restablecer_ajustes_finca: {
        Args: { p_finca: string; p_grupo: string }
        Returns: undefined
      }
      simular_endogamia: {
        Args: { p_hembra: string; p_macho: string }
        Returns: number
      }
      simular_endogamia_libro: {
        Args: { p_hembra: string; p_macho: string }
        Returns: number
      }
      solicitar_mejora_plan: {
        Args: { p_finca: string; p_periodo?: string; p_plan: string }
        Returns: undefined
      }
      solicitar_renovacion_plan: {
        Args: { p_finca: string; p_periodo?: string }
        Returns: undefined
      }
      traer_animales_libro: {
        Args: { p_chip: string; p_documento: string; p_finca: string }
        Returns: Json
      }
      ventas_detalle: {
        Args: {
          p_desde: string
          p_finca: string
          p_hasta: string
          p_linea?: string
        }
        Returns: {
          cantidad: number
          cobrado: boolean
          cobro_vence: string
          fecha: string
          linea: string
          origen: string
          origen_id: string
          producto: string
          tercero: string
          unidad: string
          valor: number
        }[]
      }
      ventas_pagina: {
        Args: {
          p_desde: string
          p_finca: string
          p_hasta: string
          p_limite?: number
          p_linea?: string
          p_salto?: number
        }
        Returns: {
          cantidad: number
          cobrado: boolean
          cobro_vence: string
          fecha: string
          linea: string
          origen: string
          origen_id: string
          producto: string
          tercero: string
          total: number
          unidad: string
          valor: number
        }[]
      }
      ventas_por_linea: {
        Args: { p_desde: string; p_finca: string; p_hasta: string }
        Returns: {
          linea: string
          movimientos: number
          por_cobrar: number
          total: number
          vencido: number
        }[]
      }
    }
    Enums: {
      especie: "caprino" | "ovino"
      modulo_app:
        | "hato"
        | "genealogia"
        | "leche"
        | "carne"
        | "sanidad"
        | "reproduccion"
        | "nutricion"
        | "ambiente"
        | "contabilidad"
        | "ferias"
        | "corrales"
      rol_finca:
        | "propietario"
        | "administrador"
        | "ordenador"
        | "veterinario"
        | "contador"
      sexo_animal: "hembra" | "macho"
      vocacion_animal: "leche" | "carne" | "doble"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      especie: ["caprino", "ovino"],
      modulo_app: [
        "hato",
        "genealogia",
        "leche",
        "carne",
        "sanidad",
        "reproduccion",
        "nutricion",
        "ambiente",
        "contabilidad",
        "ferias",
        "corrales",
      ],
      rol_finca: [
        "propietario",
        "administrador",
        "ordenador",
        "veterinario",
        "contador",
      ],
      sexo_animal: ["hembra", "macho"],
      vocacion_animal: ["leche", "carne", "doble"],
    },
  },
} as const
