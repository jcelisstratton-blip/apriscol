import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { formatoFecha } from "@/lib/fechas";
import { DIAS_GRACIA, ultimoDiaDeGracia, type EstadoPlan } from "@/lib/vigencia";

/** Aviso fijo arriba de las pantallas cuando el plan está por vencer o ya venció (en gracia, solo lectura). Bloqueada no llega aquí: va a /plan-vencido. */
export function AvisoVigencia({ estado, venceEn }: { estado: EstadoPlan; venceEn: string | null }) {
  if (!venceEn || (estado !== "por_vencer" && estado !== "gracia")) return null;
  const corta = { day: "numeric", month: "long" } as const;
  return (
    <Aviso tipo="atencion" className="mt-3">
      {estado === "por_vencer" ? (
        <>
          Tu plan vence el {formatoFecha(venceEn, corta)}. Después tendrás {DIAS_GRACIA} días solo para consultar y luego la app se bloquea hasta que pagues el valor del plan.{" "}
        </>
      ) : (
        <>
          Tu plan venció el {formatoFecha(venceEn, corta)}. Hasta el {formatoFecha(ultimoDiaDeGracia(venceEn), corta)} solo puedes consultar y descargar tus datos; después la app se bloquea hasta que pagues el valor del plan.{" "}
        </>
      )}
      <Link href="/plan-vencido" className="font-semibold underline underline-offset-4">
        {estado === "por_vencer" ? "Ver cómo renovar" : "Renovar ahora"}
      </Link>
    </Aviso>
  );
}
