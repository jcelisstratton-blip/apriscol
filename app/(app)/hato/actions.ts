"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerContexto } from "@/lib/contexto";
import { puedeEscribir } from "@/lib/permisos";
import { mensajeAmigable } from "@/lib/mensaje-amigable";

export type EstadoAnimal = { error?: string } | undefined;

const vacio = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const opcional = <T extends z.ZodType>(s: T) => z.preprocess(vacio, s.optional());

const esquema = z.object({
  especie: z.enum(["caprino", "ovino"]),
  numero_arete: z.string().trim().min(1, "El número de arete es obligatorio.").max(40),
  nombre: opcional(z.string().trim().max(60)),
  sexo: z.enum(["hembra", "macho"]),
  raza_id: opcional(z.coerce.number().int().positive()),
  fecha_nacimiento: opcional(z.iso.date("La fecha de nacimiento no es válida.")),
  fecha_nacimiento_aprox: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  padre_id: opcional(z.uuid()),
  madre_id: opcional(z.uuid()),
  padre_externo: opcional(z.string().trim().max(80)),
  madre_externa: opcional(z.string().trim().max(80)),
  origen: z.enum(["nacido_en_finca", "comprado"]),
  vocacion: z.enum(["leche", "carne", "doble"]),
  fecha_ultimo_parto: opcional(z.iso.date("La fecha del parto no es válida.")),
  client_request_id: opcional(z.uuid()),
});

export async function crearAnimal(_: EstadoAnimal, form: FormData): Promise<EstadoAnimal> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "hato")) return { error: "No tienes permiso para registrar animales en esta finca." };

  const datos = esquema.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message };
  const { fecha_ultimo_parto, ...animal } = datos.data;

  if (!finca.especies.includes(animal.especie)) return { error: "Esa especie no está activa en tu finca." };
  if (fecha_ultimo_parto && animal.sexo !== "hembra") return { error: "Solo una hembra puede tener un parto." };
  if (fecha_ultimo_parto && animal.fecha_nacimiento && fecha_ultimo_parto <= animal.fecha_nacimiento) {
    return { error: "El parto debe ser posterior al nacimiento de la hembra." };
  }

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("animales")
    .insert({ ...animal, finca_id: finca.id })
    .select("id")
    .single();

  let id = data?.id;
  if (error) {
    // Doble toque: la misma solicitud ya se guardó (client_request_id único) → seguimos a la ficha.
    if (error.code === "23505" && animal.client_request_id && /client_req/.test(error.message)) {
      const previo = await supabase
        .from("animales")
        .select("id")
        .eq("finca_id", finca.id)
        .eq("client_request_id", animal.client_request_id)
        .maybeSingle();
      id = previo.data?.id;
    }
    if (!id) return { error: mensajeAmigable(error.message) };
  }

  if (id && fecha_ultimo_parto) {
    const { error: eLac } = await supabase
      .from("lactancias")
      .insert({ finca_id: finca.id, animal_id: id, numero: 1, fecha_parto: fecha_ultimo_parto });
    if (eLac) return { error: `El animal quedó registrado, pero no se pudo abrir su lactancia: ${mensajeAmigable(eLac.message)}` };
  }

  revalidatePath("/hato");
  revalidatePath("/");
  redirect(`/hato/${id}`);
}
