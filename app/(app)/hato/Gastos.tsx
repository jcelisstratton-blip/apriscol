import Link from "next/link";
import { Plus, Receipt } from "lucide-react";
import { AvisoGuardado } from "@/components/AvisoGuardado";
import { AyudaModulo } from "@/components/AyudaModulo";
import { clasesBoton } from "@/components/Boton";
import { ListaGastos } from "@/components/ListaGastos";
import { crearClienteServidor } from "@/lib/supabase/server";
import { AYUDA_GASTOS } from "@/lib/ayuda";
import { formatoFecha, hoyBogota } from "@/lib/fechas";
import { pesos } from "@/lib/ferias";

/**
 * Hato → Gastos: donde se registran los gastos del aprisco (concentrado, sales, mano de obra, fletes…), se ven los que quedan por pagar y se corrigen.
 * El resumen de toda la finca, con filtros por fechas y reportes en Excel, está en el menú «Costos».
 */
export async function Gastos({
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
  const { data: pendientes } = await supabase.from("gastos").select("monto, vence").eq("finca_id", fincaId).is("pagado_en", null).limit(1000);
  const porPagar = (pendientes ?? []).reduce((s, g) => s + Number(g.monto), 0);
  const vencidos = (pendientes ?? []).filter((g) => g.vence && g.vence < hoy);
  const proximo = (pendientes ?? []).map((g) => g.vence).filter((v): v is string => !!v && v >= hoy).sort()[0];

  return (
    <div className="space-y-4">
      <AvisoGuardado activo={guardado} />
      <AyudaModulo ayuda={AYUDA_GASTOS} />
      {puedeEditar ? (
        <Link href="/hato/gastos/nuevo" className={clasesBoton("primario")}>
          <Plus className="size-5" strokeWidth={2.2} aria-hidden="true" /> Registrar un gasto
        </Link>
      ) : null}

      {(pendientes ?? []).length > 0 ? (
        <section className="rounded-2xl bg-lana p-3.5" aria-label="Por pagar">
          <div className="flex items-start gap-3">
            <Receipt className="mt-0.5 size-6 shrink-0 text-ocre" strokeWidth={1.75} aria-hidden="true" />
            <div className="min-w-0">
              <p className="font-bold">
                Por pagar: <span className="tabular-nums">{pesos(porPagar)}</span>
              </p>
              <p className="mt-0.5 text-[0.9375rem] text-humo">
                {(pendientes ?? []).length} {(pendientes ?? []).length === 1 ? "gasto" : "gastos"}
                {vencidos.length > 0 ? `, ${vencidos.length} ya ${vencidos.length === 1 ? "venció" : "vencieron"}` : ""}
                {proximo ? `. El próximo vence el ${formatoFecha(proximo, { day: "numeric", month: "short" })}` : ""}.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <ListaGastos fincaId={fincaId} hoy={hoy} puedeEditar={puedeEditar} />
    </div>
  );
}
