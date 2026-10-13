import Link from "next/link";
import { Lock } from "lucide-react";
import { clasesBoton } from "@/components/Boton";
import { EstadoVacio } from "@/components/EstadoVacio";
import { nombrePlan, SERVICIOS_PLAN, type ServicioPlan } from "@/lib/planes";
import type { RolFinca } from "@/lib/tipos";

/** Lo que se ve donde un servicio pertenece a un plan superior: qué es, en qué plan está y cómo mejorarlo (solo el propietario puede). */
export function RequierePlan({ servicio, rol, descripcion }: { servicio: ServicioPlan; rol: RolFinca; descripcion?: string }) {
  const { nombre, desde } = SERVICIOS_PLAN[servicio];
  const propietario = rol === "propietario";
  return (
    <EstadoVacio
      icono={<Lock strokeWidth={1.5} />}
      titulo={`${nombre} está en el plan ${nombrePlan(desde)}`}
      descripcion={descripcion ?? (propietario ? "Mejora tu plan y queda disponible al instante." : "Pídele al propietario de la finca que mejore el plan.")}
    >
      {propietario ? (
        <Link href="/mas/plan" className={clasesBoton("primario")}>
          Mejorar mi plan
        </Link>
      ) : null}
    </EstadoVacio>
  );
}
