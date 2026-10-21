import { Smartphone } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { FincaSelector } from "@/components/FincaSelector";
import { Marca } from "@/components/Marca";
import { SolicitarRenovacion } from "@/components/SolicitarRenovacion";
import { Tarjeta } from "@/components/Tarjeta";
import { cerrarSesion } from "@/app/login/actions";
import type { DatosNequi } from "@/lib/pago-manual";
import type { RolFinca } from "@/lib/tipos";

export type DatosActivarFinca = {
  fincaNombre: string;
  planNombre: string;
  /** Lugar de la finca entre las del propietario (2 en adelante, con 10 % menos). */
  numeroFinca: number;
  esPropietario: boolean;
  /** «US$ 9 al mes» y «US$ 84 al año», con el descuento de la finca adicional; `equivaleMes` es el año partido en meses («US$ 7 al mes»). */
  precioMes: string;
  precioAnio: string;
  equivaleMes: string;
  /** Equivalentes aproximados en pesos, si se conoce el cambio. */
  pesosMes: string | null;
  pesosAnio: string | null;
  nequi: DatosNequi | null;
  /** Mensaje que el propietario escribe al pagar para que el equipo reconozca el pago. */
  referencia: string;
  pendiente: "mensual" | "anual" | null;
  fincas: { id: string; nombre: string; rol: RolFinca; logo_path?: string | null }[];
  fincaActiva: string;
};

const MENSAJE_ENVIADA = {
  mensual: "Avisamos al equipo que pagaste el mes. Activamos tu finca apenas se confirme el pago.",
  anual: "Avisamos al equipo que pagaste el año. Activamos tu finca apenas se confirme el pago.",
};

/**
 * Lo único que se ve de una finca adicional mientras su pago no está confirmado: cuánto cuesta, a dónde se paga (Nequi) y el botón «Ya pagué» para
 * avisar al equipo. Fuera del grupo (app): no pasa por el bloqueo del layout.
 */
export function ActivarFincaVista({ datos, solicitar }: { datos: DatosActivarFinca; solicitar?: React.ComponentProps<typeof SolicitarRenovacion>["solicitar"] }) {
  return (
    <main className="mx-auto w-full max-w-md px-4 pb-16 pt-[calc(1.5rem+env(safe-area-inset-top))] lg:max-w-xl lg:pt-10">
      <Marca />
      <h1 className="mt-8 font-display text-[1.875rem] font-semibold leading-tight tracking-tight">Activa tu finca</h1>
      <p className="mt-1.5 text-[0.9375rem] text-humo [overflow-wrap:anywhere]">{datos.fincaNombre}</p>

      <div className="mt-5 space-y-3.5">
        <Aviso tipo="info">
          Tu finca ya está creada. Se activa en cuanto confirmemos el pago del plan {datos.planNombre}; mientras tanto no se puede registrar nada en ella.
        </Aviso>

        {datos.esPropietario ? (
          <>
            <Tarjeta titulo={`Finca n.º ${datos.numeroFinca} · 10 % menos`}>
              <dl className="divide-y divide-arena">
                <div className="flex min-w-0 items-baseline justify-between gap-3 py-2.5">
                  <dt className="text-[0.9375rem] text-humo">Cada mes</dt>
                  <dd className="min-w-0 text-right font-semibold">
                    {datos.precioMes}
                    {datos.pesosMes ? <span className="block text-sm font-normal text-humo">≈ {datos.pesosMes} COP</span> : null}
                  </dd>
                </div>
                <div className="flex min-w-0 items-baseline justify-between gap-3 py-2.5">
                  <dt className="text-[0.9375rem] text-humo">Todo el año</dt>
                  <dd className="min-w-0 text-right font-semibold">
                    {datos.precioAnio}
                    <span className="block text-sm font-normal text-humo">equivale a {datos.equivaleMes}</span>
                    {datos.pesosAnio ? <span className="block text-sm font-normal text-humo">≈ {datos.pesosAnio} COP</span> : null}
                  </dd>
                </div>
              </dl>
            </Tarjeta>

            <Tarjeta titulo="Paga por Nequi">
              {datos.nequi ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Smartphone className="mt-0.5 size-5 shrink-0 text-musgo" strokeWidth={1.75} aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="font-display text-2xl font-semibold tracking-tight [overflow-wrap:anywhere]">{datos.nequi.numero}</p>
                      <p className="text-sm text-humo [overflow-wrap:anywhere]">A nombre de {datos.nequi.titular}</p>
                    </div>
                  </div>
                  <p className="text-[0.9375rem]">
                    En el mensaje del pago escribe <span className="font-semibold [overflow-wrap:anywhere]">{datos.referencia}</span> para reconocerlo más rápido.
                  </p>
                </div>
              ) : (
                <p className="text-[0.9375rem]">El equipo de Apriscol te comparte los datos de pago por Nequi. Si ya los tienes, paga y avísanos abajo.</p>
              )}
            </Tarjeta>

            <Tarjeta titulo="¿Ya pagaste?">
              <div className="space-y-3">
                <p className="text-[0.9375rem]">Cuéntanos qué pagaste y el equipo activa tu finca apenas lo confirme.</p>
                <SolicitarRenovacion textoMes="Ya pagué el mes" textoAnio="Ya pagué el año" pendiente={datos.pendiente} solicitar={solicitar} mensajeEnviada={MENSAJE_ENVIADA} />
              </div>
            </Tarjeta>
          </>
        ) : (
          <Aviso tipo="atencion">Avisa al propietario de la finca: es quien paga el plan, y la finca se activa para todo el equipo cuando se confirme el pago.</Aviso>
        )}

        {datos.fincas.length > 1 ? (
          <div className="space-y-1.5">
            <p className="text-sm text-humo">¿Tienes otra finca? Cambia a ella:</p>
            <FincaSelector fincas={datos.fincas} activa={datos.fincaActiva} />
          </div>
        ) : null}
        <form action={cerrarSesion} className="pt-1">
          <button type="submit" className="inline-flex min-h-11 items-center px-1 text-[0.9375rem] font-semibold text-humo underline-offset-4 hover:underline">
            Cerrar sesión
          </button>
        </form>
      </div>
    </main>
  );
}
