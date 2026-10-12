"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerContexto } from "@/lib/contexto";
import { puedeEscribir } from "@/lib/permisos";
import { mensajeAmigable } from "@/lib/mensaje-amigable";
import { diasHasta, hoyBogota } from "@/lib/fechas";
import { analisisTraeResultado, CONTROLES_DESPACHO, controlesDeSalida, INFO_CONTROL, resultadoDeAnalisis, VENTANA_DIAS } from "@/lib/controles";
import { soporteValido } from "@/lib/soportes";
import { opcional } from "@/lib/validacion";
import type { AnalisisLeche, TipoControl } from "@/lib/tipos";

const TIPOS = Object.keys(INFO_CONTROL) as [TipoControl, ...TipoControl[]];

const esquema = z.object({
  ambito: z.enum(["despacho", "animal"]),
  id: z.uuid(),
  tipo: z.enum(TIPOS, "Ese control no existe."),
  estado: z.enum(["realizado", "no_realizado"], "Elige si lo hiciste o no."),
  analisisId: opcional(z.uuid("El análisis no es válido.")),
  fecha: opcional(z.iso.date("La fecha no es válida.")),
  resultado: opcional(z.enum(["conforme", "no_conforme"], "El resultado no es válido.")),
  valor: opcional(z.number("La condición corporal debe ser un número.").min(1, "La condición corporal va de 1 a 5.").max(5, "La condición corporal va de 1 a 5.")),
  detalle: opcional(z.string().trim().max(500, "Las notas son muy largas.")),
  motivo: opcional(z.string().trim().max(300, "El motivo es muy largo.")),
  soportePath: opcional(z.string().max(200)),
});

export type EntradaControl = z.input<typeof esquema>;
type Resultado = { ok: true } | { ok: false; error: string };

/**
 * Responde un control de calidad: «realizado» (con su respaldo) o «no realizado» (queda la constancia de que el propietario decidió no
 * hacerlo). De un despacho de leche (el respaldo es un análisis de Calidad con su documento) o de un animal que sale para consumo (la
 * condición corporal y el acta de inspección del matadero). Responder de nuevo cambia la respuesta anterior.
 */
export async function guardarControl(entrada: EntradaControl): Promise<Resultado> {
  const { finca, rol } = await obtenerContexto();
  const datos = esquema.safeParse(entrada);
  if (!datos.success) return { ok: false, error: datos.error.issues[0]?.message ?? "Revisa los datos." };
  const d = datos.data;
  const esDespacho = d.ambito === "despacho";
  if (!puedeEscribir(rol, esDespacho ? "leche" : "carne")) return { ok: false, error: "No tienes permiso para responder controles de calidad en esta finca." };
  if (esDespacho && !(CONTROLES_DESPACHO as string[]).includes(d.tipo)) return { ok: false, error: "Ese control no aplica a un despacho de leche." };

  const hoy = hoyBogota();
  const supabase = await crearClienteServidor();
  let fila: {
    analisis_id: string | null; fecha: string | null; resultado: "conforme" | "no_conforme" | null; valor: number | null;
    detalle: string | null; motivo: string | null; soporte_path: string | null;
  } = { analisis_id: null, fecha: null, resultado: null, valor: null, detalle: null, motivo: null, soporte_path: null };

  if (esDespacho) {
    const { data: despacho } = await supabase.from("despachos_leche").select("id, fecha").eq("id", d.id).eq("finca_id", finca.id).maybeSingle();
    if (!despacho) return { ok: false, error: "No encontramos ese despacho." };
    if (d.estado === "realizado") {
      if (!d.analisisId) return { ok: false, error: "Elige el análisis que respalda este control." };
      const { data: analisis } = await supabase.from("analisis_leche").select("*").eq("id", d.analisisId).eq("finca_id", finca.id).maybeSingle();
      if (!analisis) return { ok: false, error: "No encontramos ese análisis." };
      const a = analisis as AnalisisLeche;
      if (a.animal_id) return { ok: false, error: "Para un despacho se usa un análisis del tanque o del lote, no de un animal." };
      if (!a.soporte_path) return { ok: false, error: "Ese análisis no tiene su documento adjunto. Adjúntalo para usarlo como respaldo." };
      if (!analisisTraeResultado(a, d.tipo)) return { ok: false, error: "Ese análisis no incluye el resultado de este control." };
      const antes = diasHasta(despacho.fecha, a.fecha);
      if (antes < 0) return { ok: false, error: "Ese análisis es posterior al despacho: no puede respaldarlo." };
      const ventana = VENTANA_DIAS[d.tipo] ?? 30;
      if (antes > ventana) return { ok: false, error: `Ese análisis es de ${antes} días antes del despacho. Para este control debe ser de máximo ${ventana} ${ventana === 1 ? "día" : "días"} antes.` };
      fila = { ...fila, analisis_id: a.id, fecha: a.fecha, resultado: resultadoDeAnalisis(a, d.tipo) };
    } else {
      fila.motivo = d.motivo ?? null;
    }
  } else {
    const { data: baja } = await supabase.from("bajas").select("tipo, destino_consumo, fecha").eq("animal_id", d.id).eq("finca_id", finca.id).maybeSingle();
    if (!baja) return { ok: false, error: "No encontramos la salida de ese animal." };
    if (!controlesDeSalida(baja.tipo, baja.destino_consumo).includes(d.tipo)) return { ok: false, error: "Ese control no aplica a esta salida." };
    if (d.estado === "realizado") {
      if (!d.fecha) return { ok: false, error: "Indica la fecha en que se hizo." };
      if (d.fecha > hoy) return { ok: false, error: "La fecha no puede ser futura." };
      if (d.tipo === "condicion_corporal") {
        if (d.valor == null) return { ok: false, error: "Indica la condición corporal (de 1 a 5)." };
        if (Math.round(d.valor * 2) !== d.valor * 2) return { ok: false, error: "La condición corporal va de medio en medio punto." };
        fila = { ...fila, fecha: d.fecha, valor: d.valor, detalle: d.detalle ?? null };
      } else {
        if (!d.resultado) return { ok: false, error: "Indica el resultado de la inspección." };
        if (!d.soportePath) return { ok: false, error: "Adjunta el acta o certificado de la inspección." };
        if (!soporteValido(d.soportePath, finca.id, "carne")) return { ok: false, error: "El documento no es válido. Adjúntalo de nuevo." };
        fila = { ...fila, fecha: d.fecha, resultado: d.resultado, detalle: d.detalle ?? null, soporte_path: d.soportePath };
      }
    } else {
      fila.motivo = d.motivo ?? null;
    }
  }

  const { error } = await supabase.from("controles_calidad").upsert(
    { finca_id: finca.id, despacho_id: esDespacho ? d.id : null, animal_id: esDespacho ? null : d.id, tipo: d.tipo, estado: d.estado, ...fila },
    { onConflict: esDespacho ? "despacho_id,tipo" : "animal_id,tipo" },
  );
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  revalidatePath("/leche");
  revalidatePath("/carne");
  revalidatePath(esDespacho ? `/leche/despachos/${d.id}/controles` : `/hato/${d.id}`);
  return { ok: true };
}
