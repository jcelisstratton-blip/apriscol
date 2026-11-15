import { PLANES, nombrePlan } from "@/lib/planes";
import { ETIQUETA_AREA, areasSemaforo, type AreaSemaforo } from "@/lib/semaforos";
import type { PlanId, RolFinca } from "@/lib/tipos";

/**
 * Lo que Claude puede ver depende del plan de la finca (y del rol de la persona): las mismas reglas de la app (`areasSemaforo`). Si alguien pide algo de un plan
 * superior, la respuesta de la herramienta se lo explica a Claude (qué plan lo incluye y cómo mejorar) y Claude se lo cuenta a la persona. Nada de esto inventa reglas:
 * sale de `lib/planes.ts` y `lib/semaforos.ts`.
 */
export type FueraDelPlan = { area: AreaSemaforo; tema: string; desdePlan: PlanId };

/** El primer plan (de menor a mayor) en el que ese rol ve esa área. */
function planMinimo(rol: RolFinca, area: AreaSemaforo): PlanId | null {
  return PLANES.find((p) => areasSemaforo(rol, p.id).includes(area))?.id ?? null;
}

/** Las áreas que el rol vería con un plan mayor pero no con el de la finca. */
export function areasFueraDelPlan(rol: RolFinca, plan: PlanId): FueraDelPlan[] {
  const hoy = areasSemaforo(rol, plan);
  const salida: FueraDelPlan[] = [];
  for (const area of areasSemaforo(rol, PLANES[PLANES.length - 1].id)) {
    if (hoy.includes(area)) continue;
    const desde = planMinimo(rol, area);
    if (desde) salida.push({ area, tema: ETIQUETA_AREA[area], desdePlan: desde });
  }
  return salida;
}

/** Cómo se mejora el plan: solo lo hace el propietario, en Mi finca → Plan. */
export const comoMejorarPlan = (rol: RolFinca): string =>
  rol === "propietario" ? "Puedes mejorar el plan en Apriscol: Mi finca → Plan." : "El plan lo cambia el propietario de la finca, en Apriscol: Mi finca → Plan. Pídeselo a él.";

export function mensajeFueraDelPlan(f: FueraDelPlan, plan: PlanId, rol: RolFinca): string {
  return `El tema «${f.tema}» no está incluido en el plan ${nombrePlan(plan)} de esta finca: está disponible desde el plan ${nombrePlan(f.desdePlan)}. ${comoMejorarPlan(rol)} Díselo así a la persona, con amabilidad, y no inventes datos de ese tema.`;
}

/** Lo que incluye el plan y lo que no, para la herramienta `mi_plan`. */
export function alcanceDelPlan(rol: RolFinca, plan: PlanId) {
  const fuera = areasFueraDelPlan(rol, plan);
  return {
    plan: nombrePlan(plan),
    temas_incluidos: areasSemaforo(rol, plan).map((a) => ETIQUETA_AREA[a]),
    temas_no_incluidos: fuera.map((f) => ({ tema: f.tema, disponible_desde_el_plan: nombrePlan(f.desdePlan) })),
    como_mejorar: fuera.length > 0 ? comoMejorarPlan(rol) : null,
  };
}
