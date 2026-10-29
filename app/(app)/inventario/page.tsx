import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Aviso } from "@/components/Aviso";
import { EnlaceBoton } from "@/components/Boton";
import { AyudaModulo } from "@/components/AyudaModulo";
import { Encabezado } from "@/components/Encabezado";
import { ListaAlimento } from "@/components/ListaAlimento";
import { ListaInventario } from "@/components/ListaInventario";
import { PestanasTarjetas } from "@/components/TarjetaOpcion";
import { obtenerContexto } from "@/lib/contexto";
import { obtenerAjustes } from "@/lib/ajustes-servidor";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir, puedeVer } from "@/lib/permisos";
import { armarPestanas } from "@/lib/escenas";
import { hoyBogota } from "@/lib/fechas";
import { AYUDA_ALIMENTO, AYUDA_INVENTARIO } from "@/lib/ayuda";
import { mensajeAmigable } from "@/lib/mensaje-amigable";
import type { FilaInventario } from "@/lib/inventario";
import type { FilaAlimento } from "@/lib/inventario-alimento";

export const metadata: Metadata = { title: "Inventario" };

const PESTANAS = [
  { valor: "medicamentos", etiqueta: "Medicamentos", detalle: "Medicamentos y vacunas" },
  { valor: "alimento", etiqueta: "Alimento", detalle: "Concentrado, forraje y sales" },
] as const;
type Vista = (typeof PESTANAS)[number]["valor"];

/**
 * Inventario de la bodega: medicamentos y vacunas (propietario, administrador y veterinario) y alimento (propietario, administrador y ordeñador). Lo que queda de cada
 * producto se calcula en la base con el conteo de apertura, las compras y lo que se aplica o se da de comer; aquí solo se muestra.
 */
export default async function PaginaInventario({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const { finca, rol } = await obtenerContexto();
  const verMedicamentos = puedeVer(rol, "inventario", finca.plan);
  const verAlimento = puedeVer(rol, "nutricion", finca.plan);
  if (!verMedicamentos && !verAlimento) redirect("/");
  const { vista: pedida } = await searchParams;
  const disponibles = PESTANAS.filter((p) => (p.valor === "medicamentos" ? verMedicamentos : verAlimento));
  const vista: Vista = disponibles.some((p) => p.valor === pedida) ? (pedida as Vista) : disponibles[0].valor;
  const supabase = await crearClienteServidor();
  const hoy = hoyBogota();

  let contenido: React.ReactNode;
  if (vista === "medicamentos") {
    const { data, error } = await supabase.rpc("inventario_productos", { p_finca: finca.id });
    contenido = error ? <Aviso tipo="error">{mensajeAmigable(error.message)}</Aviso> : <ListaInventario filas={(data ?? []) as FilaInventario[]} hoy={hoy} />;
  } else {
    const [{ data, error }, ajustes] = await Promise.all([supabase.rpc("inventario_alimento", { p_finca: finca.id, p_hoy: hoy }), obtenerAjustes()]);
    contenido = error ? <Aviso tipo="error">{mensajeAmigable(error.message)}</Aviso> : <ListaAlimento filas={(data ?? []) as FilaAlimento[]} plazoDias={ajustes.general.stock_autonomia_dias} hoy={hoy} />;
  }

  return (
    <>
      <Encabezado
        titulo="Inventario"
        subtitulo={`${finca.nombre} · ${vista === "medicamentos" ? "Medicamentos y vacunas" : "Alimento"}`}
        acciones={
          vista === "alimento" && puedeEscribir(rol, "nutricion", finca.plan) ? (
            <div className="flex flex-wrap gap-2">
              <EnlaceBoton href="/inventario/alimento/repetir" variante="secundario" ancho={false}>Repetir un día</EnlaceBoton>
              <EnlaceBoton href="/inventario/alimento/salida" ancho={false}>Anotar lo que se dio</EnlaceBoton>
            </div>
          ) : null
        }
      />
      {disponibles.length > 1 ? <PestanasTarjetas pestanas={armarPestanas("/inventario", disponibles[0].valor, disponibles)} actual={vista} /> : null}
      <div className="mb-2">
        <AyudaModulo ayuda={vista === "medicamentos" ? AYUDA_INVENTARIO : AYUDA_ALIMENTO} />
      </div>
      {contenido}
    </>
  );
}
