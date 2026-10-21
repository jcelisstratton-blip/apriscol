import { Smartphone } from "lucide-react";
import { Tarjeta } from "@/components/Tarjeta";
import type { DatosNequi } from "@/lib/pago-manual";

/** Cuánto y a dónde pagar una solicitud ya hecha (mejora de plan). El pago es manual: el equipo activa el plan al confirmarlo. */
export function PagoNequi({ titulo, monto, pesos, nequi, referencia }: { titulo: string; monto: string; pesos: string | null; nequi: DatosNequi | null; referencia: string }) {
  return (
    <Tarjeta titulo={titulo}>
      <div className="space-y-3">
        <p className="text-[0.9375rem]">
          Valor a pagar: <span className="font-semibold">{monto}</span>
          {pesos ? <span className="text-humo"> (≈ {pesos} COP)</span> : null}
        </p>
        {nequi ? (
          <>
            <div className="flex items-start gap-3">
              <Smartphone className="mt-0.5 size-5 shrink-0 text-musgo" strokeWidth={1.75} aria-hidden="true" />
              <div className="min-w-0">
                <p className="font-display text-2xl font-semibold tracking-tight [overflow-wrap:anywhere]">{nequi.numero}</p>
                <p className="text-sm text-humo [overflow-wrap:anywhere]">Nequi · a nombre de {nequi.titular}</p>
              </div>
            </div>
            <p className="text-[0.9375rem]">
              En el mensaje del pago escribe <span className="font-semibold [overflow-wrap:anywhere]">{referencia}</span> para reconocerlo más rápido.
            </p>
          </>
        ) : (
          <p className="text-[0.9375rem]">El equipo de Apriscol te comparte los datos de pago por Nequi.</p>
        )}
        <p className="text-sm text-humo">Cuando se confirme el pago, el equipo activa el plan.</p>
      </div>
    </Tarjeta>
  );
}
