// Variables públicas: se leen de forma literal para que Next las incruste en el cliente.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
/**
 * La dirección pública de la app. `NEXT_PUBLIC_SITE_URL` manda si existe; si no, en producción se usa el dominio que Vercel da al proyecto (o, de último, el oficial)
 * y solo en desarrollo, localhost: un enlace a localhost en un mensaje de Telegram no abre nada.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production"
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL ?? "apriscol.shop"}`
    : "http://localhost:3000")
).replace(/\/$/, "");

export function assertSupabaseEnv() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("Falta configurar la conexión con Supabase (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).");
  }
}

/** Usuario público del bot de Telegram (sin la arroba): sale en el enlace «Conectar Telegram». No es un secreto. */
export const TELEGRAM_BOT = (process.env.NEXT_PUBLIC_TELEGRAM_BOT ?? "apriscolbot").replace(/^@/, "");
