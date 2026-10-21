import { lineaDeViolacionCsp } from "@/lib/cabeceras-seguridad";

/** Recibe los reportes de la política de contenido y los deja en una línea buscable (`[apriscol:csp]`). No guarda nada ni responde con datos. */
export async function POST(request: Request) {
  const texto = await request.text();
  if (texto.length > 8_000) return new Response(null, { status: 413 });
  try {
    const linea = lineaDeViolacionCsp(JSON.parse(texto));
    if (linea) console.warn(linea);
  } catch {
    // Un reporte ilegible simplemente se ignora.
  }
  return new Response(null, { status: 204 });
}
