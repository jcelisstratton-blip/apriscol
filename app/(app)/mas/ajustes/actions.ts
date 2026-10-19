"use server";

import { revalidatePath } from "next/cache";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { mensajeAmigable } from "@/lib/mensaje-amigable";
import { obtenerRangosGestacion } from "@/lib/ajustes-servidor";
import { GRUPOS_AJUSTES, leerCampo, mensajeRango, PARES_ORDENADOS, type AjustesEspecie, type AjustesFinca, type CampoAjuste, type GrupoAjustes } from "@/lib/ajustes";
import type { Especie } from "@/lib/tipos";

export type EstadoAjustes = { error?: string; ok?: boolean } | undefined;

const SOLO_PROPIETARIO = "Solo el propietario puede cambiar los ajustes de la finca.";

/**
 * Guarda un grupo de ajustes (reproducción, leche…). Solo el propietario. Los campos generales llegan con su nombre y los de cada especie como
 * `<nombre>__<especie>`; vacío en un campo opcional = «sin definir». Se valida aquí con la misma lista que dibuja el formulario y la base
 * lo vuelve a exigir (checks, rango de gestación y RLS).
 */
export async function guardarAjustes(_: EstadoAjustes, form: FormData): Promise<EstadoAjustes> {
  const { finca, rol } = await obtenerContexto();
  if (rol !== "propietario") return { error: SOLO_PROPIETARIO };

  const grupo = GRUPOS_AJUSTES.find((g) => g.id === form.get("grupo"));
  if (!grupo) return { error: "Ese grupo de ajustes no existe." };
  const rangos = await obtenerRangosGestacion();

  const general: Record<string, number | number[] | null> = {};
  const porEspecie: Record<Especie, Record<string, number | null>> = { caprino: {}, ovino: {} };
  const valores = new Map<string, number | null>(); // por clave (y clave__especie) para revisar los pares

  const leer = (campo: CampoAjuste<string>, nombre: string, min = campo.min, max = campo.max): number | null | { error: string } => {
    const n = leerCampo(String(form.get(nombre) ?? ""), campo);
    if (n === undefined) return { error: campo.decimales === 0 ? `${campo.etiqueta}: escribe un número entero.` : `${campo.etiqueta}: escribe un número.` };
    if (n !== null && (n < min || n > max)) return { error: mensajeRango(campo, min, max) };
    return n;
  };

  for (const campo of grupo.general) {
    const r = leer(campo, campo.clave);
    if (typeof r === "object" && r !== null) return r;
    general[campo.clave] = r;
    valores.set(campo.clave, r);
  }
  if (grupo.id === "sanidad") {
    const meses = form.getAll("meses_lluvia").map(Number);
    if (meses.some((m) => !Number.isInteger(m) || m < 1 || m > 12)) return { error: "Elige meses válidos para la época de lluvias." };
    general.meses_lluvia = [...new Set(meses)].sort((a, b) => a - b);
  }

  for (const especie of finca.especies) {
    for (const campo of grupo.especie) {
      const rango = campo.clave === "gestacion_dias" ? rangos[especie] : null;
      const r = leer(campo, `${campo.clave}__${especie}`, rango?.min, rango?.max);
      if (typeof r === "object" && r !== null) return { error: `${especie === "ovino" ? "Ovejas" : "Cabras"}: ${r.error}` };
      porEspecie[especie][campo.clave] = r;
      valores.set(`${campo.clave}__${especie}`, r);
    }
  }

  for (const par of PARES_ORDENADOS) {
    const sufijos = ["", ...finca.especies.map((e) => `__${e}`)];
    for (const s of sufijos) {
      const a = valores.get(`${par.menor}${s}`);
      const b = valores.get(`${par.mayor}${s}`);
      if (a != null && b != null && a > b) return { error: par.mensaje };
    }
  }

  const supabase = await crearClienteServidor();
  if (grupo.general.length > 0 || grupo.id === "sanidad") {
    const { data, error } = await supabase.from("finca_ajustes").update(general as Partial<AjustesFinca>).eq("finca_id", finca.id).select("finca_id");
    if (error) return { error: mensajeAmigable(error.message) };
    if (!data?.length) return { error: SOLO_PROPIETARIO };
  }
  for (const especie of finca.especies) {
    if (grupo.especie.length === 0) break;
    const { data, error } = await supabase.from("finca_ajustes_especie").update(porEspecie[especie] as Partial<AjustesEspecie>).eq("finca_id", finca.id).eq("especie", especie).select("finca_id");
    if (error) return { error: mensajeAmigable(error.message) };
    if (!data?.length) return { error: SOLO_PROPIETARIO };
  }

  // Los ajustes cambian avisos y cuentas en casi todas las pantallas.
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Vuelve un grupo a los valores de fábrica. Solo el propietario (lo exige también la base). */
export async function restablecerAjustes(grupo: GrupoAjustes): Promise<{ ok: true } | { ok: false; error: string }> {
  const { finca, rol } = await obtenerContexto();
  if (rol !== "propietario") return { ok: false, error: SOLO_PROPIETARIO };
  if (!GRUPOS_AJUSTES.some((g) => g.id === grupo)) return { ok: false, error: "Ese grupo de ajustes no existe." };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("restablecer_ajustes_finca", { p_finca: finca.id, p_grupo: grupo });
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  revalidatePath("/", "layout");
  return { ok: true };
}
