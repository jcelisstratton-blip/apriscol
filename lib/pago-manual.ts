/**
 * Pago manual (por ahora, Nequi): el propietario paga por fuera de la app y avisa con «Ya pagué»; el equipo confirma y activa.
 * Los datos de cobro viven en variables de entorno del servidor (nunca en el repo ni en el navegador):
 *  · `NEQUI_NUMERO` y `NEQUI_TITULAR` — a dónde se paga. Sin ellas, la pantalla pide esperar a que el equipo escriba con los datos.
 *  · `PESOS_POR_DOLAR` — opcional; con ella se muestra el valor aproximado en pesos junto al precio en dólares.
 */
export type DatosNequi = { numero: string; titular: string };

export function datosNequi(): DatosNequi | null {
  const numero = process.env.NEQUI_NUMERO?.trim();
  const titular = process.env.NEQUI_TITULAR?.trim();
  return numero && titular ? { numero, titular } : null;
}

export function pesosPorDolar(): number | null {
  const n = Number(process.env.PESOS_POR_DOLAR?.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** «$ 37.800» (punto de miles, sin decimales). */
export const pesos = (n: number) => `$ ${Math.round(n).toLocaleString("es-CO")}`;
