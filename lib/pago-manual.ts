/**
 * Pago manual (por ahora, Nequi): el propietario paga por fuera de la app y avisa con «Ya pagué»; el equipo confirma y activa.
 * Los datos de cobro viven en variables de entorno del servidor (nunca en el repo ni en el navegador):
 *  · `NEQUI_NUMERO` y `NEQUI_TITULAR` — a dónde se paga. Sin ellas, la pantalla pide esperar a que el equipo escriba con los datos.
 *  · `PESOS_POR_DOLAR` — opcional; valor de respaldo para mostrar el equivalente en pesos junto al precio en dólares cuando no se puede
 *    consultar la TRM del día (ver `pesosPorDolar`).
 */
export type DatosNequi = { numero: string; titular: string };

export function datosNequi(): DatosNequi | null {
  const numero = process.env.NEQUI_NUMERO?.trim();
  const titular = process.env.NEQUI_TITULAR?.trim();
  return numero && titular ? { numero, titular } : null;
}

/** Fuente oficial de la TRM: Superintendencia Financiera, publicada en datos.gov.co (la más reciente va primero). */
const URL_TRM = "https://www.datos.gov.co/resource/32sa-8pi3.json?%24order=vigenciadesde%20DESC&%24limit=1";

/** Lee la TRM de la respuesta de datos.gov.co. Devuelve null si el formato no es el esperado o el valor no tiene sentido (nunca inventa un cambio). */
export function leerTrm(json: unknown): number | null {
  const fila = Array.isArray(json) ? json[0] : null;
  const n = Number((fila as { valor?: unknown } | null)?.valor);
  return Number.isFinite(n) && n >= 1000 && n <= 20000 ? n : null;
}

/** Pesos por dólar para mostrar «≈ $ …» junto al precio. Primero la TRM del día (consulta guardada 6 horas); si no responde, `PESOS_POR_DOLAR`; si tampoco, null. */
export async function pesosPorDolar(): Promise<number | null> {
  try {
    const r = await fetch(URL_TRM, { next: { revalidate: 21600 }, signal: AbortSignal.timeout(3000) });
    if (r.ok) {
      const trm = leerTrm(await r.json());
      if (trm) return trm;
    }
  } catch {
    // Sin conexión o sin respuesta a tiempo: se sigue con el valor de respaldo.
  }
  const n = Number(process.env.PESOS_POR_DOLAR?.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}
