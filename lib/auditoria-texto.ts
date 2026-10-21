import { formatoFecha } from "@/lib/fechas";
import { nombrePlan } from "@/lib/planes";
import type { FilaAuditoriaAdmin, PlanId } from "@/lib/tipos";

const f = (v: unknown) => (typeof v === "string" && v ? formatoFecha(v, { day: "numeric", month: "short", year: "numeric" }) : "sin fecha");
const plan = (v: unknown) => (typeof v === "string" && ["cria", "hato", "profesional", "hacienda"].includes(v) ? nombrePlan(v as PlanId) : String(v ?? ""));
const cop = (v: unknown) => (typeof v === "number" ? `$ ${Math.round(v).toLocaleString("es-CO")} COP` : null);

/** Qué hizo el superadmin, en una frase para leer en la bitácora. */
export function textoAuditoria(a: Pick<FilaAuditoriaAdmin, "accion" | "detalle">): string {
  const d = a.detalle ?? {};
  switch (a.accion) {
    case "pago_confirmado": {
      const cambio = d.plan_antes === d.plan ? plan(d.plan) : `${plan(d.plan_antes)} → ${plan(d.plan)}`;
      return [`Confirmó un pago · ${cambio} · ${d.periodo === "anual" ? "1 año" : "1 mes"}`, `vigencia hasta el ${f(d.vence_despues)}`, cop(d.monto_cop), d.referencia ? `ref. ${String(d.referencia)}` : null]
        .filter(Boolean)
        .join(" · ");
    }
    case "pago_anulado":
      return `Anuló un pago · volvió a ${plan(d.plan_restaurado)}, vigencia ${f(d.vence_restaurado)} · motivo: ${String(d.motivo ?? "")}`;
    case "vigencia_fijada":
      return d.vence_despues ? `Fijó la vigencia: de ${f(d.vence_antes)} a ${f(d.vence_despues)}` : `Dejó la finca sin vencimiento (antes: ${f(d.vence_antes)})`;
    case "cuenta_pruebas":
      return `${d.exenta ? "Marcó" : "Quitó la marca de"} cuenta de pruebas · ${String(d.correo ?? "")}`;
    default:
      return a.accion;
  }
}
