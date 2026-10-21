import type { Instrumentation } from "next";
import { lineaDeError } from "@/lib/registro-errores";

/** Todo error no controlado del servidor (al pintar una pantalla, en una acción o en una ruta) queda en una línea buscable de los registros de Vercel. */
export const onRequestError: Instrumentation.onRequestError = (err, request, context) => {
  console.error(lineaDeError(err, request.method, context));
};
