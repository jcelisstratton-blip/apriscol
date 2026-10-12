import type { ModuloApp, RolFinca } from "@/lib/tipos";

/** Espejo en la interfaz de private.puede_escribir / puede_ver. La autoridad real es la RLS de la base. */
export function puedeEscribir(rol: RolFinca, modulo: ModuloApp): boolean {
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

export function puedeVer(rol: RolFinca, modulo: ModuloApp): boolean {
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

export const ETIQUETA_ROL: Record<RolFinca, string> = {
  propietario: "Propietario",
  administrador: "Administrador",
  ordenador: "Ordeñador",
  veterinario: "Veterinario",
  contador: "Contador",
};
