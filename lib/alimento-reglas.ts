import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { aKg, compraEnKg, RUBROS_ALIMENTO } from "@/lib/inventario-alimento";
import { decimal, noFutura, opcional } from "@/lib/validacion";
import { puedeVer } from "@/lib/permisos";
import type { Database, PlanId, RolFinca } from "@/lib/tipos";

/** Un destino posible de lo que se dio de comer (`ubicacion:<id>` o `lote:<id>`). */
export type DestinoSalida = { valor: string; etiqueta: string; detalle?: string };

type Cliente = SupabaseClient<Database>;

/**
 * Lo que se dio de comer (una salida del inventario de alimento): la validación y la fila, una sola vez para «Anotar lo que se dio» con señal
 * (`guardarSalida`) y para lo anotado sin señal (`guardarSalidaAlimentoCampo`). El peso de cada bulto lo pone el servidor: el navegador nunca lo elige.
 */
export const esquemaSalida = z.object({
  producto_id: z.uuid("Elige el alimento."),
  cantidad: decimal(z.number("Escribe cuánto se dio.").gt(0, "Escribe cuánto se dio (más de 0).").max(1_000_000, "Ese número es demasiado grande.")),
  unidad: opcional(z.enum(["kg", "unidad"])),
  fecha: z.iso.date("Indica la fecha."),
  destino: opcional(z.string().max(60)),
  observaciones: opcional(z.string().trim().max(300, "Las observaciones son muy largas (máximo 300 letras).")),
  client_request_id: opcional(z.uuid()),
});
export type DatosSalida = z.infer<typeof esquemaSalida>;

/** El alimento, con su peso por unidad (lo pone el servidor: el navegador nunca elige cuánto pesa un bulto). */
export async function cargarAlimento(supabase: Cliente, fincaId: string, id: string) {
  const { data } = await supabase
    .from("finca_productos")
    .select("id, nombre, unidad, kg_por_unidad, rubro")
    .eq("id", id)
    .eq("finca_id", fincaId)
    .eq("tipo", "compra")
    .maybeSingle();
  return data && data.rubro && (RUBROS_ALIMENTO as readonly string[]).includes(data.rubro) ? data : null;
}

/**
 * Comprueba una salida contra la finca (el alimento, su peso por unidad y el destino: un corral o un lote de ceba de la finca) y arma la fila de
 * `inventario_alimento_movimientos`. No inserta: cada llamador decide qué hacer con un envío repetido.
 */
export async function prepararSalida(supabase: Cliente, fincaId: string, d: DatosSalida) {
  if (d.cantidad === undefined) return { error: "Escribe cuánto se dio." } as const;
  const futura = noFutura(d.fecha);
  if (futura) return { error: futura } as const;
  const alimento = await cargarAlimento(supabase, fincaId, d.producto_id);
  if (!alimento) return { error: "No encontramos ese alimento." } as const;
  const enUnidad = d.unidad === "unidad";
  if (enUnidad && (compraEnKg(alimento.unidad) || !alimento.kg_por_unidad)) return { error: "Este alimento todavía no tiene el peso de cada unidad. Escribe la cantidad en kg." } as const;
  const kg = aKg(d.cantidad, enUnidad ? (alimento.kg_por_unidad ?? 1) : 1);
  if (kg <= 0) return { error: "La cantidad es demasiado pequeña." } as const;

  // El destino (corral o lote de ceba) se comprueba contra los de la finca; solo lo ve quien puede ver Corrales o Carne.
  let ubicacionId: string | null = null;
  let loteId: string | null = null;
  if (d.destino) {
    const [tipo, id] = d.destino.split(":");
    if (!z.uuid().safeParse(id).success || (tipo !== "ubicacion" && tipo !== "lote")) return { error: "Ese destino no es válido." } as const;
    if (tipo === "ubicacion") {
      const { data } = await supabase.from("ubicaciones").select("id").eq("id", id).eq("finca_id", fincaId).maybeSingle();
      if (!data) return { error: "No encontramos ese corral." } as const;
      ubicacionId = data.id;
    } else {
      const { data } = await supabase.from("lotes_ceba").select("id").eq("id", id).eq("finca_id", fincaId).maybeSingle();
      if (!data) return { error: "No encontramos ese lote." } as const;
      loteId = data.id;
    }
  }
  return {
    alimento,
    fila: {
      finca_id: fincaId,
      producto_id: alimento.id,
      tipo: "salida" as const,
      fecha: d.fecha,
      cantidad: kg,
      ubicacion_id: ubicacionId,
      lote_id: loteId,
      observaciones: d.observaciones ?? null,
      client_request_id: d.client_request_id ?? null,
    },
  } as const;
}

/**
 * Los destinos que se ofrecen al anotar lo que se dio de comer: los corrales y potreros activos (a quien ve Corrales) y los lotes de ceba abiertos (a quien ve Carne).
 * El ordeñador no ve ninguno de los dos módulos: para él la salida no lleva destino.
 */
export async function cargarDestinosSalida(supabase: Cliente, finca: { id: string; plan: PlanId }, rol: RolFinca): Promise<DestinoSalida[]> {
  const [ubicaciones, lotes] = await Promise.all([
    puedeVer(rol, "corrales", finca.plan) ? supabase.from("ubicaciones").select("id, nombre").eq("finca_id", finca.id).eq("activa", true).order("nombre").limit(300) : Promise.resolve({ data: [] }),
    puedeVer(rol, "carne", finca.plan) ? supabase.from("lotes_ceba").select("id, nombre").eq("finca_id", finca.id).is("cerrado_en", null).order("nombre").limit(300) : Promise.resolve({ data: [] }),
  ]);
  return [
    ...(ubicaciones.data ?? []).map((u) => ({ valor: `ubicacion:${u.id}`, etiqueta: u.nombre, detalle: "Corral o potrero" })),
    ...(lotes.data ?? []).map((l) => ({ valor: `lote:${l.id}`, etiqueta: l.nombre, detalle: "Lote de ceba" })),
  ];
}
