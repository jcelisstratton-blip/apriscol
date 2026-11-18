import Link from "next/link";
import { Download, Smartphone } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { FincaSelector } from "@/components/FincaSelector";
import { Marca } from "@/components/Marca";
import { SolicitarRenovacion } from "@/components/SolicitarRenovacion";
import { Tarjeta } from "@/components/Tarjeta";
import { formatoFecha } from "@/lib/fechas";
import { cerrarSesion } from "@/app/login/actions";
import type { DatosNequi } from "@/lib/pago-manual";
import { DIAS_GRACIA, ultimoDiaDeGracia, type EstadoPlan } from "@/lib/vigencia";
import type { RolFinca } from "@/lib/tipos";

export type DatosPlanVencido = {
  estado: Exclude<EstadoPlan, "vigente" | "pendiente">;
  fincaNombre: string;
  venceEn: string;
  planNombre: string;
  esPropietario: boolean;
  /** «US$ 10 al mes» y «US$ 96 al año (US$ 8 al mes)», ya con el descuento de la finca. */
  precioMes: string;
  precioAnio: string;
  /** Equivalentes aproximados en pesos, si se conoce el cambio. */
  pesosMes: string | null;
  pesosAnio: string | null;
  /** A dónde se paga (Nequi) y el mensaje que se escribe al pagar para que el equipo reconozca el pago. */
  nequi: DatosNequi | null;
  referencia: string;
  pendiente: "mensual" | "anual" | null;
  fincas: { id: string; nombre: string; rol: RolFinca; logo_path?: string | null }[];
  fincaActiva: string;
};

const LARGA = { day: "numeric", month: "long", year: "numeric" } as const;

const MENSAJE_ENVIADA = {
  mensual: "Avisamos al equipo que pagaste el mes. Activamos tu plan apenas se confirme el pago.",
  anual: "Avisamos al equipo que pagaste el año. Activamos tu plan apenas se confirme el pago.",
};

/**
 * Lo único que se ve con el plan vencido y la semana de gracia agotada: por qué, cuánto cuesta renovar y la descarga de los datos (todas las veces que
 * se quiera). También se llega aquí desde el aviso de «por vencer» y de «gracia».
 */
export function PlanVencidoVista({ datos, solicitar }: { datos: DatosPlanVencido; solicitar?: React.ComponentProps<typeof SolicitarRenovacion>["solicitar"] }) {
  const { estado, venceEn } = datos;
  const titulo = estado === "bloqueada" ? "Tu plan está vencido" : estado === "gracia" ? "Tu plan venció" : "Tu plan vence pronto";
  return (
    <main className="mx-auto w-full max-w-md px-4 pb-16 pt-[calc(1.5rem+env(safe-area-inset-top))] lg:max-w-xl lg:pt-10">
      <Marca />
      <h1 className="mt-8 font-display text-[1.875rem] font-semibold leading-tight tracking-tight">{titulo}</h1>
      <p className="mt-1.5 text-[0.9375rem] text-humo [overflow-wrap:anywhere]">{datos.fincaNombre}</p>

      <div className="mt-5 space-y-3.5">
        <Aviso tipo="atencion">
          {estado === "bloqueada" ? (
            <>
              El plan {datos.planNombre} venció el {formatoFecha(venceEn, LARGA)}. Para volver a usar Apriscol debes pagar el valor del plan. Mientras tanto puedes descargar tus datos todas las veces que quieras.
            </>
          ) : estado === "gracia" ? (
            <>
              El plan {datos.planNombre} venció el {formatoFecha(venceEn, LARGA)}. Hasta el {formatoFecha(ultimoDiaDeGracia(venceEn), LARGA)} puedes consultar y descargar tus datos, pero no registrar nada nuevo. Después la app se bloquea hasta que pagues el valor del plan.
            </>
          ) : (
            <>
              El plan {datos.planNombre} vence el {formatoFecha(venceEn, LARGA)}. Después de esa fecha tendrás {DIAS_GRACIA} días solo para consultar, y luego la app se bloquea hasta que pagues el valor del plan.
            </>
          )}
        </Aviso>

        {datos.esPropietario ? (
          <>
            <Tarjeta titulo="Renovar tu plan">
              <div className="space-y-1.5">
                <p className="text-[0.9375rem]">
                  <span className="font-semibold">{datos.planNombre}</span> · {datos.precioMes}
                  {datos.pesosMes ? <span className="text-humo"> (≈ {datos.pesosMes} COP)</span> : null}
                </p>
                <p className="text-[0.9375rem]">
                  Pagando el año sale más barato: {datos.precioAnio}
                  {datos.pesosAnio ? <span className="text-humo"> (≈ {datos.pesosAnio} COP)</span> : null}.
                </p>
              </div>
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
                <p className="text-[0.9375rem]">Cuéntanos qué pagaste y el equipo activa tu plan apenas lo confirme.</p>
                <SolicitarRenovacion textoMes="Ya pagué el mes" textoAnio="Ya pagué el año" pendiente={datos.pendiente} solicitar={solicitar} mensajeEnviada={MENSAJE_ENVIADA} />
              </div>
            </Tarjeta>
            <Tarjeta titulo="Tus datos">
              <div className="space-y-3">
                <p className="text-[0.9375rem]">Son tuyos: descárgalos en Excel todas las veces que quieras, con el plan vencido o no.</p>
                <a
                  href="/mas/exportar/archivo"
                  download
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-arena px-5 text-base font-semibold text-tinta transition hover:brightness-95 active:scale-[0.98]"
                >
                  <Download className="size-5" strokeWidth={1.75} aria-hidden="true" /> Descargar mis datos en Excel
                </a>
              </div>
            </Tarjeta>
          </>
        ) : (
          <Aviso tipo="info">Avisa al propietario de la finca para que renueve el plan. Él también puede descargar los datos.</Aviso>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {estado !== "bloqueada" ? (
            <Link href="/" className="inline-flex min-h-11 items-center text-[0.9375rem] font-semibold text-musgo underline-offset-4 hover:underline">
              Seguir consultando
            </Link>
          ) : (
            <span />
          )}
          <form action={cerrarSesion}>
            <button type="submit" className="inline-flex min-h-11 items-center px-1 text-[0.9375rem] font-semibold text-humo underline-offset-4 hover:underline">
              Cerrar sesión
            </button>
          </form>
        </div>
        {datos.fincas.length > 1 ? (
          <div className="space-y-1.5">
            <p className="text-sm text-humo">¿Tienes otra finca? Cambia a ella:</p>
            <FincaSelector fincas={datos.fincas} activa={datos.fincaActiva} />
          </div>
        ) : null}
      </div>
    </main>
  );
}
