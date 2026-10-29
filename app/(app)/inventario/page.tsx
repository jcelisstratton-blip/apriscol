import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Aviso } from "@/components/Aviso";
import { AyudaModulo } from "@/components/AyudaModulo";
import { Encabezado } from "@/components/Encabezado";
import { ListaInventario } from "@/components/ListaInventario";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeVer } from "@/lib/permisos";
import { hoyBogota } from "@/lib/fechas";
import { AYUDA_INVENTARIO } from "@/lib/ayuda";
import { mensajeAmigable } from "@/lib/mensaje-amigable";
import type { FilaInventario } from "@/lib/inventario";

export const metadata: Metadata = { title: "Inventario" };

/** Inventario de medicamentos y vacunas: lo que queda de cada producto, calculado con el conteo de apertura, las compras y las aplicaciones. */
export default async function PaginaInventario() {
  const { finca, rol } = await obtenerContexto();
  if (!puedeVer(rol, "inventario", finca.plan)) redirect("/");
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("inventario_productos", { p_finca: finca.id });

  return (
    <>
      <Encabezado titulo="Inventario" subtitulo={`${finca.nombre} · Medicamentos y vacunas`} />
      <div className="mb-2">
        <AyudaModulo ayuda={AYUDA_INVENTARIO} />
      </div>
      {error ? <Aviso tipo="error">{mensajeAmigable(error.message)}</Aviso> : <ListaInventario filas={(data ?? []) as FilaInventario[]} hoy={hoyBogota()} />}
    </>
  );
}
