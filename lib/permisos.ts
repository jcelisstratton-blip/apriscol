import { moduloEnPlan } from "@/lib/planes";
import type { ModuloApp, PlanId, RolFinca } from "@/lib/tipos";

/** Espejo en la interfaz de private.puede_escribir / puede_ver. La autoridad real es la RLS de la base. */
export function puedeEscribir(rol: RolFinca, modulo: ModuloApp, plan: PlanId = "hacienda"): boolean {
  if (!moduloEnPlan(plan, modulo)) return false;
  switch (rol) {
    case "propietario":
    case "administrador":
      return true;
    case "ordenador":
      return modulo === "leche";
    case "veterinario":
      return modulo === "sanidad" || modulo === "reproduccion" || modulo === "corrales";
    case "contador":
      return modulo === "contabilidad";
  }
}

export function puedeVer(rol: RolFinca, modulo: ModuloApp, plan: PlanId = "hacienda"): boolean {
  if (!moduloEnPlan(plan, modulo)) return false;
  switch (rol) {
    case "propietario":
    case "administrador":
      return true;
    case "ordenador":
      return modulo === "hato" || modulo === "leche";
    case "veterinario":
      return ["hato", "genealogia", "sanidad", "reproduccion", "leche", "carne", "corrales"].includes(modulo);
    case "contador":
      return ["hato", "leche", "carne", "contabilidad"].includes(modulo);
  }
}

export function puedeGestionar(rol: RolFinca): boolean {
  return rol === "propietario" || rol === "administrador";
}

/** La primera finca la crea cualquiera; para agregar otra hay que ser propietario o administrador de alguna. */
export function puedeAgregarFinca(roles: RolFinca[]): boolean {
  return roles.length === 0 || roles.some(puedeGestionar);
}

export const ETIQUETA_ROL: Record<RolFinca, string> = {
  propietario: "Propietario",
  administrador: "Administrador",
  ordenador: "Ordeñador",
  veterinario: "Veterinario",
  contador: "Contador",
};

/** Perfiles que se pueden invitar a la app (el propietario no se invita) y qué puede hacer cada uno. */
export const ROLES_INVITABLES: Exclude<RolFinca, "propietario">[] = ["administrador", "ordenador", "veterinario", "contador"];
export const DETALLE_ROL: Record<Exclude<RolFinca, "propietario">, string> = {
  administrador: "Ve y edita todo, e invita personas",
  ordenador: "Registra ordeños y consulta el hato",
  veterinario: "Sanidad y reproducción",
  contador: "Solo consulta leche y reportes",
};
