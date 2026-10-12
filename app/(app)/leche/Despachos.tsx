import { Aviso } from "@/components/Aviso";
import { ListaDespachos } from "@/components/ListaDespachos";
import { crearClienteServidor } from "@/lib/supabase/server";
import { hoyBogota, litros as formatoLitros, sumarDias } from "@/lib/fechas";
import { pesos } from "@/lib/leche-calidad";

/** Despachos de leche de la finca: lo que salió en los últimos 30 días frente a lo que se ordeñó, y el historial. */
export async function Despachos({
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
  const hoy = hoyBogota();
  const { data } = await supabase.rpc("leche_balance", { p_finca: fincaId, p_desde: sumarDias(hoy, -29), p_hasta: hoy });
  const b = data?.[0];
  const producida = Number(b?.producida ?? 0);
  const descartada = Number(b?.descartada ?? 0);
  const despachada = Number(b?.despachada ?? 0);
  const valor = Number(b?.valor_despachado ?? 0);
  const cifras: [string, string][] = [
    ["Ordeñada al tanque", `${formatoLitros(producida)} l`],
    ["Despachada", `${formatoLitros(despachada)} l`],
    ["Ingresos", valor > 0 ? pesos(valor) : "—"],
  ];

  return (
    <div className="space-y-4">
      <section aria-label="Últimos 30 días" className="space-y-2">
        <h2 className="px-1 text-sm font-semibold text-humo">Últimos 30 días</h2>
        <dl className="grid grid-cols-1 gap-2 text-center min-[420px]:grid-cols-3">
          {cifras.map(([e, v]) => (
            <div key={e} className="min-w-0 rounded-2xl bg-papel px-2 py-3 ring-1 ring-arena">
              <dd className="font-display text-xl font-semibold tabular-nums [overflow-wrap:anywhere] sm:text-2xl">{v}</dd>
              <dt className="mt-0.5 text-xs font-medium text-humo">{e}</dt>
            </div>
          ))}
        </dl>
        <Aviso tipo="info">
          La leche de animales en periodo de retiro (por un tratamiento), con mastitis o de calostro no entra al tanque: se separa sola al registrar el ordeño
          {descartada > 0 ? ` (en estos 30 días fueron ${formatoLitros(descartada)} litros)` : ""}.
        </Aviso>
      </section>
      <ListaDespachos fincaId={fincaId} puedeEditar={puedeEditar} />
    </div>
  );
}
