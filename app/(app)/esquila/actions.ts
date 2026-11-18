"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerContexto } from "@/lib/contexto";
import { puedeEscribir } from "@/lib/permisos";
import { mensajeAmigable } from "@/lib/mensaje-amigable";
import { leerNumero } from "@/lib/numeros";
import { opcional } from "@/lib/validacion";
import { hoyBogota } from "@/lib/fechas";

export type EstadoEsquila = { error?: string } | undefined;

const TOPE_OVEJAS = 1000;

const encabezado = z.object({
  fecha: z.iso.date("Indica la fecha de la esquila."),
  esquilador: opcional(z.string().trim().max(120, "El nombre de quien esquiló es muy largo.")),
  costo: z.preprocess(
    (v) => (typeof v === "string" ? (leerNumero(v) ?? v) : v),
    opcional(z.number("El costo debe ser un número.").min(0, "El costo no puede ser negativo.").max(99_999_999_999, "El costo es demasiado grande. Revísalo.")),
  ),
  notas: opcional(z.string().trim().max(1000, "Las notas son muy largas.")),
});

/** Los kilos de vellón de cada oveja vienen en campos `peso_<id de la oveja>` (opcionales, con coma o punto decimal). */
function leerPesos(form: FormData, ids: string[]): { ok: true; pesos: { animal_id: string; peso_kg: number | null }[] } | { ok: false; error: string } {
  const pesos: { animal_id: string; peso_kg: number | null }[] = [];
  for (const id of ids) {
    const crudo = String(form.get(`peso_${id}`) ?? "").trim();
    if (!crudo) {
      pesos.push({ animal_id: id, peso_kg: null });
      continue;
    }
    const n = leerNumero(crudo);
    if (n === null || !Number.isFinite(n)) return { ok: false, error: "Un peso de vellón no es un número. Escríbelo en kilos, por ejemplo 2,4." };
    if (n < 0.05 || n > 25) return { ok: false, error: "El peso de cada vellón debe estar entre 0,05 y 25 kg." };
    pesos.push({ animal_id: id, peso_kg: Math.round(n * 100) / 100 });
  }
  return { ok: true, pesos };
}

const idsDe = (form: FormData) => [...new Set(form.getAll("animal_id").map(String))];

/** Registra una esquila con las ovejas elegidas, todo o nada. El doble toque devuelve la misma esquila. */
export async function registrarEsquila(_prev: EstadoEsquila, form: FormData): Promise<EstadoEsquila> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "hato", finca.plan)) return { error: "No tienes permiso para registrar esquilas en esta finca." };

  const datos = encabezado.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message };
  if (datos.data.fecha > hoyBogota()) return { error: "La fecha no puede ser futura: registra la esquila que ya hiciste." };

  const ids = idsDe(form);
  if (ids.length === 0) return { error: "Elige al menos una oveja." };
  if (ids.length > TOPE_OVEJAS) return { error: `Son demasiadas ovejas a la vez (máximo ${TOPE_OVEJAS}).` };
  if (!ids.every((i) => z.uuid().safeParse(i).success)) return { error: "Hay una oveja que no se reconoce. Vuelve a elegirlas." };
  const pesos = leerPesos(form, ids);
  if (!pesos.ok) return { error: pesos.error };
  const solicitud = z.uuid().safeParse(form.get("client_request_id"));

  const supabase = await crearClienteServidor();
  const { data: id, error } = await supabase.rpc("registrar_esquila", {
    p_finca: finca.id,
    p_fecha: datos.data.fecha,
    p_animales: pesos.pesos,
    p_esquilador: datos.data.esquilador ?? null,
    p_costo: datos.data.costo ?? null,
    p_notas: datos.data.notas ?? null,
    p_client_request_id: solicitud.success ? solicitud.data : randomUUID(),
  });
  if (error || !id) return { error: mensajeAmigable(error?.message ?? "No se pudo registrar la esquila.") };

  revalidatePath("/esquila");
  revalidatePath("/hato", "layout");
  redirect(`/esquila/${id}?guardado=1`);
}

/** Corrige una esquila: fecha, quién esquiló, costo, notas y kilos de cada oveja. Las ovejas no cambian: para eso se anula y se registra otra. */
export async function actualizarEsquila(_prev: EstadoEsquila, form: FormData): Promise<EstadoEsquila> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "hato", finca.plan)) return { error: "No tienes permiso para cambiar esquilas en esta finca." };

  const esquilaId = z.uuid().safeParse(form.get("esquila_id"));
  if (!esquilaId.success) return { error: "Esquila no válida." };
  const datos = encabezado.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message };
  if (datos.data.fecha > hoyBogota()) return { error: "La fecha no puede ser futura: registra la esquila que ya hiciste." };

  const ids = idsDe(form);
  if (!ids.every((i) => z.uuid().safeParse(i).success)) return { error: "Hay una oveja que no se reconoce." };
  const pesos = leerPesos(form, ids);
  if (!pesos.ok) return { error: pesos.error };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("actualizar_esquila", {
    p_esquila: esquilaId.data,
    p_fecha: datos.data.fecha,
    p_esquilador: datos.data.esquilador ?? null,
    p_costo: datos.data.costo ?? null,
    p_notas: datos.data.notas ?? null,
    p_pesos: pesos.pesos,
  });
  if (error) return { error: mensajeAmigable(error.message) };

  revalidatePath("/esquila");
  revalidatePath("/hato", "layout");
  redirect(`/esquila/${esquilaId.data}?guardado=1`);
}

/** Anula una esquila mal registrada: queda guardada, pero ya no cuenta en la ficha de las ovejas ni en los plazos. */
export async function anularEsquila(esquilaId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "hato", finca.plan)) return { ok: false, error: "No tienes permiso para anular esquilas en esta finca." };
  if (!z.uuid().safeParse(esquilaId).success) return { ok: false, error: "Esquila no válida." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("anular_esquila", { p_esquila: esquilaId });
  if (error) return { ok: false, error: mensajeAmigable(error.message) };

  revalidatePath("/esquila");
  revalidatePath("/hato", "layout");
  return { ok: true };
}
