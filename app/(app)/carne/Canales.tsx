import { ListaCanales } from "@/components/ListaCanales";
import { crearClienteServidor } from "@/lib/supabase/server";
import { kg, pctUno } from "@/lib/carne";

/** Rendimiento en canal de los animales sacrificados: los promedios de la finca y cada canal. */
export async function Canales({
  fincaId,
  puedeEditar,
  cliente,
}: {
  fincaId: string;
  puedeEditar: boolean;
  /** Solo para pruebas: un cliente de base de datos en lugar del de la sesión. */
  cliente?: Awaited<ReturnType<typeof crearClienteServidor>>;
}) {
  const supabase = cliente ?? (await crearClienteServidor());
  const { data } = await supabase.rpc("canales_resumen", { p_finca: fincaId });
  const r = data?.[0];
  const cifras: [string, string][] = [
    ["Canales registradas", String(r?.n ?? 0)],
    ["Rendimiento caliente", pctUno(r?.rendimiento_caliente_prom)],
    ["Canal caliente", kg(r?.peso_caliente_prom)],
    ["Merma al enfriar", pctUno(r?.merma_prom)],
  ];

  return (
    <div className="space-y-4">
      {(r?.n ?? 0) > 0 ? (
        <section aria-label="Promedios" className="space-y-2">
          <dl className="grid grid-cols-2 gap-2 text-center min-[560px]:grid-cols-4">
            {cifras.map(([e, v]) => (
              <div key={e} className="min-w-0 rounded-2xl bg-papel px-1.5 py-3 ring-1 ring-arena">
                <dd className="font-display text-xl font-semibold tabular-nums [overflow-wrap:anywhere] sm:text-2xl">{v}</dd>
                <dt className="mt-0.5 text-xs font-medium text-humo">{e}</dt>
              </div>
            ))}
          </dl>
          <p className="px-1 text-sm text-humo">
            El rendimiento es el peso de la canal entre el peso en vivo. Solo cuentan las canales que tienen peso en vivo (las que no, no entran al promedio de rendimiento).
          </p>
        </section>
      ) : null}
      <ListaCanales fincaId={fincaId} puedeEditar={puedeEditar} />
    </div>
  );
}
