import "server-only";
import { cache } from "react";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { AjustesCompletos, AjustesEspecie, RangoGestacion } from "@/lib/ajustes";
import type { Especie } from "@/lib/tipos";

/**
 * Los ajustes de la finca activa. Cada finca tiene siempre sus filas (las crea la base al nacer la finca); si por cualquier razón faltaran,
 * un miembro las pide con los valores de fábrica. Una consulta por petición.
 */
export const obtenerAjustes = cache(async (): Promise<AjustesCompletos> => {
  const { finca } = await obtenerContexto();
  const supabase = await crearClienteServidor();
  const leer = () =>
    Promise.all([
      supabase.from("finca_ajustes").select("*").eq("finca_id", finca.id).maybeSingle(),
      supabase.from("finca_ajustes_especie").select("*").eq("finca_id", finca.id),
    ]);

  let [general, porEspecie] = await leer();
  if (!general.data || (porEspecie.data ?? []).length < 2) {
    await supabase.rpc("asegurar_ajustes_finca", { p_finca: finca.id });
    [general, porEspecie] = await leer();
  }
  if (!general.data || (porEspecie.data ?? []).length < 2) throw new Error("No se pudieron leer los ajustes de la finca.");

  const filas = new Map<Especie, AjustesEspecie>((porEspecie.data ?? []).map((f) => [f.especie, f]));
  return { general: general.data, especie: { caprino: filas.get("caprino")!, ovino: filas.get("ovino")! } };
});

/** Rango biológico de la gestación de cada especie y su valor de fábrica, del catálogo `parametros_especie`. */
export const obtenerRangosGestacion = cache(async (): Promise<Record<Especie, RangoGestacion>> => {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from("parametros_especie").select("especie, gestacion_dias, gestacion_min, gestacion_max");
  const filas = new Map((data ?? []).map((p) => [p.especie, { min: p.gestacion_min, max: p.gestacion_max, defecto: p.gestacion_dias }]));
  const caprino = filas.get("caprino");
  const ovino = filas.get("ovino");
  if (!caprino || !ovino) throw new Error("No se pudo leer el rango de gestación de las especies.");
  return { caprino, ovino };
});
