import type { crearClienteServidor } from "@/lib/supabase/server";

type Cliente = Awaited<ReturnType<typeof crearClienteServidor>>;

/** El país de las fincas mientras Colombia sea el único activo (`geo_paises.activo`). Código ISO 3166-1 alfa-2. */
export const PAIS_DEFECTO = "CO";

/**
 * Lo que se guarda junto al nombre del departamento (o provincia) y del municipio (o cantón): el país y los códigos oficiales de cada nivel.
 * `departamento_dane` y `municipio_dane` son las columnas de antes (solo Colombia) y se quitarán cuando todo lea `nivel1_codigo` y `nivel2_codigo`.
 */
export type UbicacionCodificada = {
  pais: string;
  nivel1_codigo: string | null;
  nivel2_codigo: string | null;
  departamento_dane: string | null;
  municipio_dane: string | null;
};

const sinCodigos = (pais: string): UbicacionCodificada => ({ pais, nivel1_codigo: null, nivel2_codigo: null, departamento_dane: null, municipio_dane: null });

/**
 * Traduce el departamento y el municipio que la persona eligió (los nombres de `lib/colombia.ts` y `lib/municipios.ts`) a los códigos oficiales de
 * su país con `geo_codigos`. Se guardan junto al nombre en `fincas` y `ferias` para poder agrupar y reportar por zona sin depender de cómo esté
 * escrito (en Colombia hay 67 nombres de municipio repetidos). Si la consulta falla o el nombre no existe en el catálogo, los códigos quedan en
 * `null` en vez de impedir que se guarde la finca o la feria: el nombre sigue siendo el dato principal.
 */
export async function codigosUbicacion(
  supabase: Pick<Cliente, "rpc">,
  departamento: string | null | undefined,
  municipio: string | null | undefined,
  pais: string = PAIS_DEFECTO,
): Promise<UbicacionCodificada> {
  if (!departamento) return sinCodigos(pais);
  const { data, error } = await supabase.rpc("geo_codigos", { p_pais: pais, p_nivel1: departamento, p_nivel2: municipio ?? "" });
  if (error) {
    console.warn("[apriscol] geo_codigos:", error.message);
    return sinCodigos(pais);
  }
  const nivel1 = data?.[0]?.nivel1_codigo ?? null;
  const nivel2 = data?.[0]?.nivel2_codigo ?? null;
  // Las columnas de Colombia se siguen llenando mientras existan.
  const colombia = pais === "CO";
  return { pais, nivel1_codigo: nivel1, nivel2_codigo: nivel2, departamento_dane: colombia ? nivel1 : null, municipio_dane: colombia ? nivel2 : null };
}
