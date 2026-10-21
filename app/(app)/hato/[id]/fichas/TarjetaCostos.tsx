import Link from "next/link";
import { Tarjeta } from "@/components/Tarjeta";
import { puedeEscribir, puedeVer } from "@/lib/permisos";
import { clasesBoton } from "@/components/Boton";
import { formatoFecha } from "@/lib/fechas";
import { pesos } from "@/lib/ferias";
import { ETIQUETA_RUBRO } from "@/lib/costos";
import type { CtxFicha } from "./contexto";

/** Compras cargadas al animal y su valor de compra. */
export async function TarjetaCostos({ c }: { c: CtxFicha }) {
  const { id, animal, finca, rol, supabase } = c;
  const verCostos = puedeVer(rol, "contabilidad", finca.plan);
  const gastosAnimal = verCostos
    ? ((await supabase.from("gastos").select("id, fecha, rubro, descripcion, monto, pagado_en").eq("animal_id", id).eq("finca_id", finca.id).order("fecha", { ascending: false }).limit(200)).data ?? [])
    : [];
  const totalGastosAnimal = gastosAnimal.reduce((s, g) => s + Number(g.monto), 0);
  if (!(verCostos && (animal.estado === "activo" || gastosAnimal.length > 0 || animal.valor_compra != null))) return null;

  return (
    <Tarjeta titulo="Costos" id="costos">
      <dl className="divide-y divide-arena">
        <div className="flex items-baseline justify-between gap-3 py-2.5">
          <dt className="shrink-0 text-sm text-humo">Valor de compra</dt>
          <dd className="min-w-0 text-right font-semibold">{animal.valor_compra != null ? pesos(animal.valor_compra) : <span className="font-normal text-humo">Sin registrar</span>}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 py-2.5">
          <dt className="shrink-0 text-sm text-humo">Compras cargadas a él</dt>
          <dd className="min-w-0 text-right font-semibold tabular-nums">{pesos(totalGastosAnimal)}</dd>
        </div>
      </dl>
      {gastosAnimal.length > 0 ? (
        <ul className="mt-2 divide-y divide-arena border-t border-arena">
          {gastosAnimal.slice(0, 6).map((g) => (
            <li key={g.id} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0">
                <span className="block font-medium [overflow-wrap:anywhere]">{g.descripcion}</span>
                <span className="block text-sm text-humo">
                  {ETIQUETA_RUBRO[g.rubro]} · {formatoFecha(g.fecha, { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end">
                <span className="font-semibold tabular-nums">{pesos(g.monto)}</span>
                {puedeEscribir(rol, "contabilidad", finca.plan) ? (
                  <Link href={`/hato/gastos/${g.id}/editar?volver=${id}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-musgo underline-offset-4 hover:underline">
                    Editar
                  </Link>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {gastosAnimal.length > 6 ? <p className="text-sm text-humo">Y {gastosAnimal.length - 6} más. Están todas en Hato → Compras.</p> : null}
      <p className="mt-2 text-[0.8125rem] text-humo">
        El costo completo del animal suma además su parte de los tratamientos y de lo cargado a su lote, su corral o su especie: está en{" "}
        <Link href="/costos?vista=animales" className="font-semibold text-musgo underline underline-offset-2">Costos → Por animal</Link>.
      </p>
      {puedeEscribir(rol, "contabilidad", finca.plan) && animal.estado === "activo" ? (
        <div className="mt-3">
          <Link href={`/hato/gastos/nuevo?animal=${id}`} className={clasesBoton("secundario")}>
            Registrar una compra para este animal
          </Link>
        </div>
      ) : null}
    </Tarjeta>
  );
}
