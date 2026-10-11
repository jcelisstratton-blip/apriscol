"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerContexto } from "@/lib/contexto";
import { puedeEscribir, puedeGestionar } from "@/lib/permisos";
import { mensajeAmigable } from "@/lib/mensaje-amigable";
import { hoyBogota } from "@/lib/fechas";

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
  chip: opcional(z.string().trim().max(40, "El microchip es muy largo.")),
  color: opcional(z.string().trim().max(60, "El color es muy largo.")),
  marcas: opcional(z.string().trim().max(120, "Las marcas son muy largas.")),
  rasgos: opcional(z.string().trim().max(200, "Los rasgos son muy largos.")),
  peso_nacer_kg: z.preprocess(
    (v) => (typeof v === "string" ? v.replace(",", ".") : v),
    opcional(z.coerce.number("El peso al nacer debe ser un número.").min(0.1, "El peso al nacer debe estar entre 0,1 y 15 kg.").max(15, "El peso al nacer debe estar entre 0,1 y 15 kg.")),
  ),
  notas: opcional(z.string().trim().max(1000, "Las notas son muy largas.")),
  fecha_ultimo_parto: opcional(z.iso.date("La fecha del parto no es válida.")),
  client_request_id: opcional(z.uuid()),
});

export async function crearAnimal(_: EstadoAnimal, form: FormData): Promise<EstadoAnimal> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "hato")) return { error: "No tienes permiso para registrar animales en esta finca." };

  const datos = esquema.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message };
  const { fecha_ultimo_parto, ...animal } = datos.data;
  // El peso al nacer solo se conoce de los animales que nacieron en la finca.
  if (animal.origen === "comprado") animal.peso_nacer_kg = undefined;

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

// ───────────────────────── Bajas ─────────────────────────
export type ResultadoBaja = { ok: true; aviso?: string } | { ok: false; error: string };

const esquemaBaja = z.object({
  animalId: z.uuid(),
  tipo: z.enum(["venta", "sacrificio", "muerte", "perdida"], "Elige qué pasó con el animal."),
  fecha: z.iso.date("Indica la fecha."),
  motivo: z.preprocess(vacio, z.enum(["edad", "partos", "baja_produccion", "sanidad", "reproductivo", "accidente", "otro"]).optional()),
  comprador: z.preprocess(vacio, z.string().trim().max(160, "El nombre del comprador es muy largo.").optional()),
  valor: z.preprocess(vacio, z.number().min(0, "El valor no puede ser negativo.").max(9_999_999_999, "Revisa el valor: es demasiado alto.").optional()),
  destinoConsumo: z.boolean(),
  detalle: z.preprocess(vacio, z.string().trim().max(1000, "Las notas son muy largas.").optional()),
});

/**
 * Da de baja a un animal (venta, muerte, sacrificio o pérdida). La base marca el estado y la fecha, y rechaza sacar para consumo
 * a un animal en retiro de carne. Si era una hembra en ordeño, también se cierra su lactancia con la fecha de la baja.
 */
export async function darDeBaja(entrada: z.input<typeof esquemaBaja>): Promise<ResultadoBaja> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "hato")) return { ok: false, error: "No tienes permiso para dar de baja animales en esta finca." };
  const datos = esquemaBaja.safeParse(entrada);
  if (!datos.success) return { ok: false, error: datos.error.issues[0]?.message ?? "Dato inválido." };
  const d = datos.data;
  if (d.fecha > hoyBogota()) return { ok: false, error: "La fecha no puede ser futura." };

  const supabase = await crearClienteServidor();
  const { data: animal } = await supabase
    .from("animales")
    .select("id, estado, fecha_nacimiento")
    .eq("id", d.animalId)
    .eq("finca_id", finca.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!animal) return { ok: false, error: "No encontramos ese animal en tu finca." };
  if (animal.estado !== "activo") return { ok: false, error: "Ese animal ya está dado de baja." };
  if (animal.fecha_nacimiento && d.fecha < animal.fecha_nacimiento) return { ok: false, error: "La fecha no puede ser anterior al nacimiento del animal." };

  const esVenta = d.tipo === "venta";
  const { error } = await supabase.from("bajas").insert({
    finca_id: finca.id,
    animal_id: d.animalId,
    tipo: d.tipo,
    fecha: d.fecha,
    motivo: d.motivo ?? null,
    comprador: esVenta ? (d.comprador ?? null) : null,
    valor: esVenta ? (d.valor ?? null) : null,
    destino_consumo: esVenta && d.destinoConsumo,
    detalle: d.detalle ?? null,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Ese animal ya tiene una baja registrada." };
    return { ok: false, error: mensajeAmigable(error.message) };
  }

  // Una hembra que sale del hato sale también del ordeño: se cierra su lactancia abierta.
  let aviso: string | undefined;
  const { data: lactancia } = await supabase
    .from("lactancias")
    .select("id, fecha_parto")
    .eq("animal_id", d.animalId)
    .eq("finca_id", finca.id)
    .is("fecha_secado", null)
    .maybeSingle();
  if (lactancia) {
    const { error: e } = await supabase
      .from("lactancias")
      .update({ fecha_secado: d.fecha > lactancia.fecha_parto ? d.fecha : lactancia.fecha_parto })
      .eq("id", lactancia.id);
    if (e) aviso = "La baja quedó registrada, pero no pudimos sacarla del ordeño. Hazlo desde Leche.";
  }

  revalidatePath("/hato");
  revalidatePath(`/hato/${d.animalId}`);
  revalidatePath("/leche");
  revalidatePath("/");
  return { ok: true, aviso };
}

/** Deshace una baja: el animal vuelve al hato como activo. Solo propietario o administrador. */
export async function deshacerBaja(animalId: string): Promise<ResultadoBaja> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeGestionar(rol)) return { ok: false, error: "Solo el propietario o un administrador puede deshacer una baja." };
  if (!z.uuid().safeParse(animalId).success) return { ok: false, error: "Animal no válido." };

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("bajas").delete().eq("animal_id", animalId).eq("finca_id", finca.id).select("id");
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  if (!data || data.length === 0) return { ok: false, error: "No encontramos la baja de ese animal." };

  revalidatePath("/hato");
  revalidatePath(`/hato/${animalId}`);
  revalidatePath("/");
  return { ok: true };
}
