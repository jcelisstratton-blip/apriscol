/** A dónde se manda a quien tiene una sesión que ya no sirve: esa ruta borra sus cookies y lo lleva a entrar de nuevo. */
export const RUTA_SALIR = "/auth/salir";

/** Las cookies de la sesión de Supabase (`sb-<proyecto>-auth-token`, y sus trozos `.0`, `.1`…). */
export const esCookieDeSesion = (nombre: string): boolean => nombre.startsWith("sb-");
