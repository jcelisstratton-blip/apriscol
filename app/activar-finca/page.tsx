import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ActivarFincaVista } from "@/components/ActivarFincaVista";
import { obtenerContexto } from "@/lib/contexto";
import { datosNequi, pesos, pesosPorDolar } from "@/lib/pago-manual";
import { planPorId, precioMes, usd } from "@/lib/planes";
import { numeroDeFinca } from "@/lib/planes-servidor";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Activar finca" };

/** Fuera del grupo (app): no pasa por el bloqueo del layout. Solo para una finca adicional cuyo pago aún no se confirma; si no, no hay nada que mostrar. */
export default async function PaginaActivarFinca() {
  const { user, finca, fincas, rol, vigencia } = await obtenerContexto();
  if (vigencia !== "pendiente") redirect("/");

  const supabase = await crearClienteServidor();
  const numero = await numeroDeFinca(supabase, fincas, finca.id);
  const plan = planPorId(finca.plan);
  const mes = precioMes(plan, false, numero);
  const mesAnual = precioMes(plan, true, numero);
  const cambio = pesosPorDolar();
  const { data: pendiente } = await supabase.from("solicitudes_plan").select("periodo").eq("finca_id", finca.id).eq("estado", "pendiente").maybeSingle();

  return (
    <ActivarFincaVista
      datos={{
        fincaNombre: finca.nombre,
        planNombre: plan.nombre,
        numeroFinca: numero,
        esPropietario: rol === "propietario",
        precioMes: `${usd(mes)} al mes`,
        precioAnio: `${usd(mesAnual * 12)} al año`,
        equivaleMes: `${usd(mesAnual)} al mes`,
        pesosMes: cambio ? pesos(mes * cambio) : null,
        pesosAnio: cambio ? pesos(mesAnual * 12 * cambio) : null,
        nequi: datosNequi(),
        referencia: `${finca.nombre} · ${user.email ?? ""}`.trim(),
        pendiente: pendiente?.periodo === "anual" ? "anual" : pendiente?.periodo === "mensual" ? "mensual" : null,
        fincas: fincas.map((f) => ({ id: f.id, nombre: f.nombre, rol: f.rol, logo_path: f.logo_path })),
        fincaActiva: finca.id,
      }}
    />
  );
}
