"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerContexto } from "@/lib/contexto";
import { puedeEscribir } from "@/lib/permisos";
import { mensajeAmigable } from "@/lib/mensaje-amigable";
import { leerNumero } from "@/lib/numeros";
import { RUBROS } from "@/lib/costos";
import { LINEAS } from "@/lib/ventas";
import type { Producto, Tercero } from "@/lib/tipos";

type Resultado<T = Record<never, never>> = ({ ok: true } & T) | { ok: false; error: string };

const ID = z.uuid();
const nombre = (max: number, mensaje: string) => z.string().trim().min(1, mensaje).max(max, `El nombre es muy largo (máximo ${max} letras).`);
const precio = z.preprocess(
  (v) => (typeof v === "string" ? (v.trim() === "" ? null : (leerNumero(v) ?? v)) : v),
  z.union([z.null(), z.number("El precio debe ser un número.").min(0, "El precio no puede ser negativo.").max(99_999_999_999, "El precio es demasiado alto. Revísalo.")]),
);

/** Quien registra compras, ventas, leche, carne o animales puede crear terceros; la base lo exige también (RLS). */
async function puedeCatalogar() {
  const { finca, rol } = await obtenerContexto();
  const ok = ["contabilidad", "leche", "carne", "hato"].some((m) => puedeEscribir(rol, m as never, finca.plan));
  return { finca, ok };
}

function refrescar() {
  revalidatePath("/mas/productos");
  revalidatePath("/hato");
  revalidatePath("/leche");
  revalidatePath("/costos");
}

// ───────────────────────── Terceros ─────────────────────────
const esquemaTercero = z.object({ nombre: nombre(120, "Escribe el nombre."), tipo: z.enum(["proveedor", "comprador", "ambos"], "Elige si es proveedor o comprador.") });

/**
 * Crea un proveedor o un comprador. Si ya existe uno con ese nombre (aunque cambie una mayúscula) se devuelve el que había, y si era solo de
 * un tipo y ahora se usa en el otro, pasa a «ambos»: así nunca quedan dos con el mismo nombre.
 */
export async function crearTercero(entrada: z.input<typeof esquemaTercero>): Promise<Resultado<{ tercero: Tercero }>> {
  const { finca, ok } = await puedeCatalogar();
  if (!ok) return { ok: false, error: "No tienes permiso para agregar proveedores o compradores en esta finca." };
  const d = esquemaTercero.safeParse(entrada);
  if (!d.success) return { ok: false, error: d.error.issues[0]?.message ?? "Revisa los datos." };
  const supabase = await crearClienteServidor();
  const { data: previos } = await supabase.from("finca_terceros").select("*").eq("finca_id", finca.id).ilike("nombre", d.data.nombre.replace(/[%_\\]/g, (c) => `\\${c}`)).limit(5);
  const igual = (previos ?? []).find((t) => t.nombre.trim().toLowerCase() === d.data.nombre.toLowerCase());
  if (igual) {
    if (!igual.activo || (igual.tipo !== "ambos" && igual.tipo !== d.data.tipo)) {
      const { data, error } = await supabase.from("finca_terceros").update({ activo: true, tipo: igual.tipo === d.data.tipo ? igual.tipo : "ambos" }).eq("id", igual.id).eq("finca_id", finca.id).select("*").single();
      if (error) return { ok: false, error: mensajeAmigable(error.message) };
      refrescar();
      return { ok: true, tercero: data };
    }
    return { ok: true, tercero: igual };
  }
  const { data, error } = await supabase.from("finca_terceros").insert({ finca_id: finca.id, nombre: d.data.nombre, tipo: d.data.tipo }).select("*").single();
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  refrescar();
  return { ok: true, tercero: data };
}

const esquemaEditarTercero = z.object({ id: ID, nombre: nombre(120, "Escribe el nombre.").optional(), tipo: z.enum(["proveedor", "comprador", "ambos"]).optional(), activo: z.boolean().optional() });

/** Cambia el nombre, el tipo o si se sigue usando (lo que ya se registró con él no cambia de dueño: sigue enlazado). */
export async function actualizarTercero(entrada: z.input<typeof esquemaEditarTercero>): Promise<Resultado> {
  const { finca, ok } = await puedeCatalogar();
  if (!ok) return { ok: false, error: "No tienes permiso para cambiar proveedores o compradores en esta finca." };
  const d = esquemaEditarTercero.safeParse(entrada);
  if (!d.success) return { ok: false, error: d.error.issues[0]?.message ?? "Revisa los datos." };
  const { id, ...cambios } = d.data;
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("finca_terceros").update(cambios).eq("id", id).eq("finca_id", finca.id).select("id");
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  if (!data || data.length === 0) return { ok: false, error: "No encontramos ese registro." };
  refrescar();
  return { ok: true };
}

// ───────────────────────── Productos ─────────────────────────
const esquemaProducto = z
  .object({
    tipo: z.enum(["compra", "venta"], "Elige si es algo que compras o que vendes."),
    nombre: nombre(120, "Escribe cómo se llama."),
    rubro: z.enum(RUBROS.filter((r) => r !== "mano_obra") as [string, ...string[]]).optional(),
    linea: z.enum(LINEAS as [string, ...string[]]).optional(),
    unidad: z.string().trim().max(20, "La unidad es muy larga.").optional(),
    precio_habitual: precio,
  })
  .refine((d) => d.tipo !== "compra" || d.rubro, { message: "Elige en qué rubro va.", path: ["rubro"] })
  .refine((d) => d.tipo !== "venta" || d.linea, { message: "Elige en qué línea de venta va.", path: ["linea"] });

/** Agrega a la lista un producto que la finca compra o vende y que no venía en ella. Solo contabilidad (propietario, administrador, contador). */
export async function crearProducto(entrada: z.input<typeof esquemaProducto>): Promise<Resultado<{ producto: Producto }>> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "contabilidad", finca.plan)) return { ok: false, error: "No tienes permiso para agregar productos en esta finca." };
  const d = esquemaProducto.safeParse(entrada);
  if (!d.success) return { ok: false, error: d.error.issues[0]?.message ?? "Revisa los datos." };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("finca_productos")
    .insert({
      finca_id: finca.id,
      tipo: d.data.tipo,
      nombre: d.data.nombre,
      rubro: d.data.tipo === "compra" ? ((d.data.rubro as never) ?? null) : null,
      linea: d.data.tipo === "venta" ? ((d.data.linea as never) ?? null) : null,
      unidad: d.data.unidad || null,
      precio_habitual: d.data.precio_habitual,
      orden: 80,
    })
    .select("*")
    .single();
  if (error) return { ok: false, error: /finca_productos_nombre_uk/.test(error.message) ? "Ya tienes un producto con ese nombre." : mensajeAmigable(error.message) };
  refrescar();
  return { ok: true, producto: data };
}

const esquemaEditarProducto = z.object({
  id: ID,
  nombre: nombre(120, "Escribe cómo se llama.").optional(),
  unidad: z.string().trim().max(20, "La unidad es muy larga.").optional(),
  precio_habitual: precio.optional(),
  activo: z.boolean().optional(),
});

/** Cambia el nombre, la unidad o el precio habitual de un producto, o lo oculta de las listas (lo ya registrado lo sigue mostrando). */
export async function actualizarProducto(entrada: z.input<typeof esquemaEditarProducto>): Promise<Resultado> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "contabilidad", finca.plan)) return { ok: false, error: "No tienes permiso para cambiar productos en esta finca." };
  const d = esquemaEditarProducto.safeParse(entrada);
  if (!d.success) return { ok: false, error: d.error.issues[0]?.message ?? "Revisa los datos." };
  const { id, unidad, ...resto } = d.data;
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("finca_productos")
    .update({ ...resto, ...(unidad !== undefined ? { unidad: unidad || null } : {}) })
    .eq("id", id)
    .eq("finca_id", finca.id)
    .select("id");
  if (error) return { ok: false, error: /finca_productos_nombre_uk/.test(error.message) ? "Ya tienes un producto con ese nombre." : mensajeAmigable(error.message) };
  if (!data || data.length === 0) return { ok: false, error: "No encontramos ese producto." };
  refrescar();
  return { ok: true };
}
