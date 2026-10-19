import "server-only";
import { cache } from "react";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { Producto, Tercero } from "@/lib/tipos";

/** Los productos del catálogo de la finca activa (compras y ventas), en el orden del catálogo. Una consulta por petición. */
export const obtenerProductos = cache(async (): Promise<Producto[]> => {
  const { finca } = await obtenerContexto();
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from("finca_productos").select("*").eq("finca_id", finca.id).order("orden").order("nombre").limit(1000);
  return data ?? [];
});

/** Los proveedores y compradores de la finca activa, por nombre. Una consulta por petición. */
export const obtenerTerceros = cache(async (): Promise<Tercero[]> => {
  const { finca } = await obtenerContexto();
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from("finca_terceros").select("*").eq("finca_id", finca.id).order("nombre").limit(2000);
  return data ?? [];
});
