/** Datos de los documentos legales (términos y privacidad): un solo lugar para cambiarlos. */
export const ACTUALIZADO = "13 de octubre de 2026";
export const RESPONSABLE = "Stratt-On Agency";

/** Correo para consultas, reclamos y solicitudes sobre datos personales. Se define en Vercel (NEXT_PUBLIC_CORREO_PRIVACIDAD). */
export const CORREO_PRIVACIDAD = (process.env.NEXT_PUBLIC_CORREO_PRIVACIDAD ?? "").trim();
