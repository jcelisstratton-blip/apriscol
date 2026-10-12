import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Encabezado } from "@/components/Encabezado";
import { PestanasTarjetas } from "@/components/TarjetaOpcion";
import { armarPestanas } from "@/lib/escenas";
import { ListaFerias } from "@/components/ListaFerias";
import { ListaPremios } from "@/components/ListaPremios";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir, puedeVer } from "@/lib/permisos";
import { pesos } from "@/lib/ferias";

export const metadata: Metadata = { title: "Premios" };

const PESTANAS = [
  { valor: "premios", etiqueta: "Premios", detalle: "Lo ganado por tus animales" },
  { valor: "ferias", etiqueta: "Ferias", detalle: "Dónde participaste" },
] as const;

/**
 * Compendio de todos los premios que han ganado los animales de la finca, y las ferias donde los ganaron.
 * Los premios se registran y se corrigen desde la ficha de cada animal.
 */
export default async function PaginaPremios({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const { finca, rol } = await obtenerContexto();
  if (!puedeVer(rol, "ferias")) redirect("/");
  const { vista } = await searchParams;
  const actual = vista === "ferias" ? "ferias" : "premios";

  const supabase = await crearClienteServidor();
  const { data: totales } = await supabase.from("v_palmares_finca").select("*").eq("finca_id", finca.id).maybeSingle();
  const cifras: [string, string][] = [
    ["Participaciones", String(totales?.participaciones ?? 0)],
    ["Premios", String(totales?.premios ?? 0)],
    ["Campeonatos", String(totales?.campeonatos ?? 0)],
  ];
  const dinero = Number(totales?.dinero ?? 0);

  return (
    <>
      <Encabezado titulo="Premios" subtitulo={finca.nombre} />

      {(totales?.participaciones ?? 0) > 0 ? (
        <section aria-label="Resumen" className="mb-4 rounded-3xl bg-papel p-4 ring-1 ring-arena">
          <dl className="grid grid-cols-3 divide-x divide-arena text-center">
            {cifras.map(([etiqueta, valor]) => (
              <div key={etiqueta} className="min-w-0 px-1">
                <dd className="font-display text-2xl font-semibold tabular-nums">{valor}</dd>
                <dt className="text-xs font-medium text-humo">{etiqueta}</dt>
              </div>
            ))}
          </dl>
          {dinero > 0 || (totales?.animales_premiados ?? 0) > 0 ? (
            <p className="mt-3 border-t border-arena pt-3 text-center text-sm text-humo [overflow-wrap:anywhere]">
              {totales?.animales_premiados ?? 0} {(totales?.animales_premiados ?? 0) === 1 ? "animal premiado" : "animales premiados"}
              {dinero > 0 ? <> · <span className="font-semibold text-tinta">{pesos(dinero)}</span> en premios</> : null}
            </p>
          ) : null}
        </section>
      ) : null}

      <PestanasTarjetas pestanas={armarPestanas("/ferias", "premios", PESTANAS)} actual={actual} />

      {actual === "premios" ? <ListaPremios fincaId={finca.id} puedeEditar={puedeEscribir(rol, "ferias")} /> : <ListaFerias fincaId={finca.id} />}
    </>
  );
}
