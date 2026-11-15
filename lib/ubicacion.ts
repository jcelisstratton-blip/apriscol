import type { crearClienteServidor } from "@/lib/supabase/server";

type Cliente = Awaited<ReturnType<typeof crearClienteServidor>>;

/** Los códigos DIVIPOLA (DANE) de un departamento y un municipio: 2 y 5 dígitos. `null` cuando no hay coincidencia (nunca se adivina). */
export type CodigosDane = { departamento_dane: string | null; municipio_dane: string | null };

const SIN_CODIGOS: CodigosDane = { departamento_dane: null, municipio_dane: null };

/**
 * Traduce el departamento y el municipio que la persona eligió (los nombres de `lib/colombia.ts` y `lib/municipios.ts`) a sus códigos
 * DANE, con la función `divipola_codigos` de la base. Se guardan junto al nombre en `fincas` y `ferias` para poder agrupar y reportar por
 * zona sin depender de cómo esté escrito (hay 67 nombres de municipio repetidos en el país). Si la consulta falla o el nombre no
 * existe en el catálogo, devuelve `null` en vez de impedir que se guarde la finca o la feria: el nombre sigue siendo el dato principal.
 */
export async function codigosDane(supabase: Pick<Cliente, "rpc">, departamento: string | null | undefined, municipio: string | null | undefined): Promise<CodigosDane> {
  if (!departamento) return SIN_CODIGOS;
  const { data, error } = await supabase.rpc("divipola_codigos", { p_departamento: departamento, p_municipio: municipio ?? "" });
  if (error) {
    console.warn("[apriscol] divipola_codigos:", error.message);
    return SIN_CODIGOS;
  }
  const fila = data?.[0];
  return { departamento_dane: fila?.departamento_dane ?? null, municipio_dane: fila?.municipio_dane ?? null };
}
