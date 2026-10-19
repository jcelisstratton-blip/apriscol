import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PlanVencidoVista } from "@/components/PlanVencidoVista";
import { obtenerContexto } from "@/lib/contexto";
import { hoyBogota } from "@/lib/fechas";
import { planPorId, precioMes, usd } from "@/lib/planes";
import { numeroDeFinca } from "@/lib/planes-servidor";
import { crearClienteServidor } from "@/lib/supabase/server";
import { estadoPlan } from "@/lib/vigencia";

export const metadata: Metadata = { title: "Plan vencido" };

/** Fuera del grupo (app): no pasa por el bloqueo del layout. Con el plan al día no hay nada que mostrar aquí. */
export default async function PaginaPlanVencido() {
  const { finca, fincas, rol } = await obtenerContexto();
  const estado = estadoPlan(finca.plan_vence_en, hoyBogota());
  if (estado === "vigente" || !finca.plan_vence_en) redirect("/");

  const supabase = await crearClienteServidor();
  const numero = await numeroDeFinca(supabase, fincas, finca.id);
  const plan = planPorId(finca.plan);
  const mes = precioMes(plan, false, numero);
  const mesAnual = precioMes(plan, true, numero);
  const { data: pendiente } = await supabase.from("solicitudes_plan").select("periodo").eq("finca_id", finca.id).eq("estado", "pendiente").maybeSingle();

  return (
    <PlanVencidoVista
      datos={{
        estado,
        fincaNombre: finca.nombre,
        venceEn: finca.plan_vence_en,
        planNombre: plan.nombre,
        esPropietario: rol === "propietario",
        precioMes: `${usd(mes)} al mes`,
        precioAnio: `${usd(mesAnual * 12)} al año (${usd(mesAnual)} al mes)`,
        pendiente: pendiente?.periodo === "anual" ? "anual" : pendiente?.periodo === "mensual" ? "mensual" : null,
        fincas: fincas.map((f) => ({ id: f.id, nombre: f.nombre, rol: f.rol })),
        fincaActiva: finca.id,
      }}
    />
  );
}
