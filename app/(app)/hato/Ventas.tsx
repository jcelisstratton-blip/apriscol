import Link from "next/link";
import { Banknote, Plus } from "lucide-react";
import { AvisoGuardado } from "@/components/AvisoGuardado";
import { AyudaModulo } from "@/components/AyudaModulo";
import { clasesBoton } from "@/components/Boton";
import { ListaVentas } from "@/components/ListaVentas";
import { crearClienteServidor } from "@/lib/supabase/server";
import { AYUDA_VENTAS } from "@/lib/ayuda";
import { hoyBogota } from "@/lib/fechas";
import { pesos } from "@/lib/ferias";

/**
 * Hato → Ventas: donde se registra lo que se vende (carne, queso, abono, lana…), se ve lo que queda por cobrar y se corrige. La leche despachada y los
 * animales vendidos aparecen solos. El resumen de toda la finca, con filtros por fechas y reportes en Excel, está en el menú «Costos».
 */
export async function Ventas({
  fincaId,
  puedeEditar,
  guardado = false,
  cliente,
}: {
  fincaId: string;
  puedeEditar: boolean;
  guardado?: boolean;
  /** Solo para pruebas: un cliente de base de datos en lugar del de la sesión. */
  cliente?: Awaited<ReturnType<typeof crearClienteServidor>>;
}) {
  const supabase = cliente ?? (await crearClienteServidor());
  const hoy = hoyBogota();
  const { data } = await supabase.rpc("ventas_por_linea", { p_finca: fincaId, p_desde: null, p_hasta: null });
  const porCobrar = (data ?? []).reduce((s, l) => s + Number(l.por_cobrar), 0);
  const vencido = (data ?? []).reduce((s, l) => s + Number(l.vencido), 0);

  return (
    <div className="space-y-4">
      <AvisoGuardado activo={guardado} />
      <AyudaModulo ayuda={AYUDA_VENTAS} />
      {puedeEditar ? (
        <Link href="/hato/ventas/nueva" className={clasesBoton("primario")}>
          <Plus className="size-5" strokeWidth={2.2} aria-hidden="true" /> Registrar una venta
        </Link>
      ) : null}

      {porCobrar > 0 ? (
        <section className="rounded-2xl bg-lana p-3.5" aria-label="Por cobrar">
          <div className="flex items-start gap-3">
            <Banknote className="mt-0.5 size-6 shrink-0 text-ocre" strokeWidth={1.75} aria-hidden="true" />
            <div className="min-w-0">
              <p className="font-bold">
                Por cobrar: <span className="tabular-nums">{pesos(porCobrar)}</span>
              </p>
              <p className="mt-0.5 text-[0.9375rem] text-humo">{vencido > 0 ? `${pesos(vencido)} ya pasó la fecha en que lo esperabas.` : "Nada vencido todavía."}</p>
            </div>
          </div>
        </section>
      ) : null}

      <ListaVentas fincaId={fincaId} hoy={hoy} puedeEditar={puedeEditar} />
    </div>
  );
}
