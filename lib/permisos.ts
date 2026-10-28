import { moduloEnPlan } from "@/lib/planes";
import type { ModuloApp, PlanId, RolFinca } from "@/lib/tipos";

/** Espejo en la interfaz de private.puede_escribir / puede_ver. La autoridad real es la RLS de la base. */
export function puedeEscribir(rol: RolFinca, modulo: ModuloApp, plan: PlanId = "hacienda"): boolean {
  if (!moduloEnPlan(plan, modulo)) return false;
  switch (rol) {
    case "propietario":
    case "administrador":
      // Quien administra no crea novedades: las atiende (ver `atiendeNovedad`).
      return modulo !== "novedades";
    case "ordenador":
      return modulo === "leche" || modulo === "novedades";
    case "veterinario":
      return modulo === "sanidad" || modulo === "reproduccion" || modulo === "corrales" || modulo === "novedades";
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
      return modulo === "hato" || modulo === "leche" || modulo === "novedades";
    case "veterinario":
      return ["hato", "genealogia", "sanidad", "reproduccion", "leche", "carne", "corrales", "novedades"].includes(modulo);
    case "contador":
      return ["hato", "leche", "carne", "contabilidad"].includes(modulo);
  }
}

/** Quién atiende novedades (no solo las suyas): propietario, administrador y veterinario. Cada uno atiende las suyas según su destino (`atiendeNovedad`). */
export function revisaNovedades(rol: RolFinca): boolean {
  return rol === "propietario" || rol === "administrador" || rol === "veterinario";
}

export type TipoNovedadPermiso = "compra" | "aplicacion" | "prueba" | "coprologico" | "famacha";

/** Qué novedades puede CREAR cada perfil: el ordeñador, comprar y aplicar dosis; el veterinario, solo comprar; los demás ninguna. Espejo de `private.puede_crear_novedad`. */
export function tiposNovedadQueCrea(rol: RolFinca): TipoNovedadPermiso[] {
  return rol === "ordenador" ? ["compra", "aplicacion"] : rol === "veterinario" ? ["compra"] : [];
}

/** Qué novedades le llegan a un perfil para atender: `compra`, `no_compra` (aplicar dosis y las anteriores) o `todas`. Sirve para contar y filtrar. */
export function destinoNovedades(rol: RolFinca): "compra" | "no_compra" | "todas" | null {
  return rol === "propietario" ? "todas" : rol === "administrador" ? "compra" : rol === "veterinario" ? "no_compra" : null;
}

/** ¿Atiende (marca vista o atendida) una novedad de este tipo? Comprar: administrador y propietario; las demás (aplicar dosis…): veterinario y propietario. */
export function atiendeNovedad(rol: RolFinca, tipo: TipoNovedadPermiso): boolean {
  if (rol === "propietario") return true;
  return tipo === "compra" ? rol === "administrador" : rol === "veterinario";
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
