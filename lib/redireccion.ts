/** Solo se aceptan rutas internas como destino de un login (evita redirecciones abiertas). */
export function destinoSeguro(next: FormDataEntryValue | string | null | undefined, porDefecto = "/"): string {
  const v = typeof next === "string" ? next : "";
  return v.startsWith("/") && !v.startsWith("//") && !v.includes("\\") ? v : porDefecto;
}
