"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { Cargando } from "@/components/Cargando";
import { Sheet } from "@/components/Sheet";
import { useToast } from "@/components/Toast";
import { activarPlan, previsualizarActivacion, type VistaPrevia } from "@/app/(admin)/admin/planes/actions";
import { formatoFecha } from "@/lib/fechas";
import { nombrePlan, usd } from "@/lib/planes";
import type { PlanId } from "@/lib/tipos";

const LARGA = { day: "numeric", month: "long", year: "numeric" } as const;
const ETIQUETA_ESTADO: Record<string, string> = { vigente: "Al día", por_vencer: "Por vencer", gracia: "En solo lectura", bloqueada: "Bloqueada", pendiente: "Pendiente de pago" };

/**
 * Superadmin: confirmar el pago de una finca. Antes de aplicar nada muestra qué cambia (plan, vigencia de hoy y de después), avisa de un posible
 * doble clic y pide —sin obligar— lo recibido en pesos y la referencia de Nequi, que quedan en el registro de pagos.
 */
export function ConfirmarPago({ fincaId, plan, periodo, children, variante = "primario" }: { fincaId: string; plan: PlanId; periodo: "mensual" | "anual"; children: React.ReactNode; variante?: "primario" | "secundario" }) {
  const router = useRouter();
  const toast = useToast();
  const [abierta, setAbierta] = useState(false);
  const [cargando, iniciarCarga] = useTransition();
  const [aplicando, iniciarAplicar] = useTransition();
  const [vista, setVista] = useState<VistaPrevia | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [monto, setMonto] = useState("");
  const [referencia, setReferencia] = useState("");

  const abrir = () => {
    setAbierta(true);
    setVista(null);
    setError(null);
    setMonto("");
    setReferencia("");
    iniciarCarga(async () => {
      const r = await previsualizarActivacion(fincaId, plan, periodo);
      if (r.ok) setVista(r.vista);
      else setError(r.error);
    });
  };

  const confirmar = () =>
    iniciarAplicar(async () => {
      setError(null);
      const r = await activarPlan(fincaId, plan, periodo, monto, referencia);
      if (!r.ok) return setError(r.error);
      toast.exito(r.detalle);
      setAbierta(false);
      router.refresh();
    });

  const periodoTexto = periodo === "anual" ? "1 año" : "1 mes";

  return (
    <>
      <Boton type="button" variante={variante} onClick={abrir}>
        <Check className="size-4" strokeWidth={2.4} aria-hidden="true" /> {children}
      </Boton>
      <Sheet
        abierta={abierta}
        onCerrar={() => (aplicando ? undefined : setAbierta(false))}
        titulo="Confirmar pago"
        pie={
          <Boton type="button" onClick={confirmar} pendiente={aplicando} cargando="Confirmando…" disabled={!vista || cargando}>
            Confirmar pago de {periodoTexto}
          </Boton>
        }
      >
        <div className="space-y-3.5">
          {cargando || (!vista && !error) ? <Cargando texto="Calculando…" /> : null}
          {vista ? (
            <>
              <PanelConfirmacion vista={vista} plan={plan} periodo={periodo} monto={monto} setMonto={setMonto} referencia={referencia} setReferencia={setReferencia} />
            </>
          ) : null}
          {error ? <Aviso tipo="error">{error}</Aviso> : null}
        </div>
      </Sheet>
    </>
  );
}

/** Lo que se ve al confirmar un pago: qué cambia, avisos de duplicado o vigencia previa, y los dos datos opcionales del registro. */
export function PanelConfirmacion({ vista, plan, periodo, monto, setMonto, referencia, setReferencia }: {
  vista: VistaPrevia; plan: PlanId; periodo: "mensual" | "anual"; monto: string; setMonto: (v: string) => void; referencia: string; setReferencia: (v: string) => void;
}) {
  const yaPagada = vista.venceActual && vista.estado !== "pendiente";
  const periodoTexto = periodo === "anual" ? "1 año" : "1 mes";
  return (
    <>
              <div>
                <p className="font-semibold [overflow-wrap:anywhere]">{vista.fincaNombre}</p>
                <p className="text-sm text-humo [overflow-wrap:anywhere]">{vista.correo}</p>
              </div>
              <dl className="divide-y divide-arena rounded-2xl bg-papel px-4 ring-1 ring-arena">
                <Fila etiqueta="Plan">{vista.planActual === plan ? nombrePlan(plan) : `${nombrePlan(vista.planActual)} → ${nombrePlan(plan)}`}</Fila>
                <Fila etiqueta="Periodo">{periodoTexto}</Fila>
                <Fila etiqueta="Valor de lista">{usd(vista.usdEsperado)}{vista.numeroFinca > 1 ? ` · finca n.º ${vista.numeroFinca}, con 10 % menos` : ""}</Fila>
                <Fila etiqueta="Hoy">
                  {ETIQUETA_ESTADO[vista.estado] ?? vista.estado}
                  {vista.venceActual ? ` · pagada hasta el ${formatoFecha(vista.venceActual, LARGA)}` : ""}
                </Fila>
                <Fila etiqueta="Quedará">pagada hasta el {formatoFecha(vista.venceNueva, LARGA)}</Fila>
              </dl>
              {vista.pagoReciente ? (
                <Aviso tipo="atencion">Hace unos minutos ya se confirmó un pago de esta finca. Si es el mismo, no lo confirmes otra vez: se sumaría otro periodo.</Aviso>
              ) : yaPagada ? (
                <Aviso tipo="info">La finca ya tiene vigencia: el periodo se suma desde esa fecha, no desde hoy.</Aviso>
              ) : null}
              <Campo etiqueta="Monto recibido (COP)" ayuda="Opcional. Lo que llegó a Nequi, para cuadrar cuentas.">
                {(id) => <input id={id} inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="36.000" className={CLASE_INPUT} />}
              </Campo>
              <Campo etiqueta="Referencia de Nequi" ayuda="Opcional. Número de la transacción o lo que dice el mensaje del pago.">
                {(id) => <input id={id} maxLength={120} value={referencia} onChange={(e) => setReferencia(e.target.value)} className={CLASE_INPUT} />}
              </Campo>
    </>
  );
}

function Fila({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3 py-2.5">
      <dt className="shrink-0 text-[0.9375rem] text-humo">{etiqueta}</dt>
      <dd className="min-w-0 text-right text-[0.9375rem] font-semibold [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}
