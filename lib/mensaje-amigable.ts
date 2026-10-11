/** Traduce errores técnicos (Postgres, Supabase Auth, red) a frases para personas. El original queda en consola. */
const REGLAS: [RegExp, string][] = [
  [/animales_arete_uk|numero_arete/i, "Ya tienes un animal con ese número de arete."],
  [/duplicate key|already exists|23505/i, "Ya existe un registro con ese dato."],
  [/Invalid login credentials/i, "El correo o la contraseña no coinciden."],
  [/Email not confirmed/i, "Falta confirmar tu correo. Revisa tu bandeja de entrada."],
  [/User already registered/i, "Ese correo ya tiene una cuenta. Prueba iniciar sesión."],
  [/Password should be at least/i, "La contraseña debe tener al menos 8 caracteres."],
  [/rate limit|too many requests|over_email_send_rate_limit/i, "Demasiados intentos. Espera un momento y vuelve a probar."],
  [/row-level security|permission denied|42501|insufficient_privilege/i, "No tienes permiso para hacer esto en esta finca."],
  [/violates check constraint|23514/i, "Alguno de los datos está fuera del rango permitido."],
  [/violates foreign key|23503/i, "Alguno de los datos hace referencia a algo que ya no existe."],
  [/null value in column|23502/i, "Falta completar un dato obligatorio."],
  [/fetch failed|Failed to fetch|NetworkError|network/i, "No hay conexión. Revisa tu señal e inténtalo de nuevo."],
  [/Falta configurar la conexión|SUPABASE/i, "La aplicación no está configurada todavía. Avisa al administrador."],
  [/JWT|session|refresh_token/i, "Tu sesión venció. Vuelve a iniciar sesión."],
];

const TECNICO = /(error|exception|violates|constraint|relation|column|syntax|undefined|null|TypeError|ECONN|ETIMEDOUT|PGRST|\bpg_)/i;

export function mensajeAmigable(original: string): string {
  if (!original) return "Algo salió mal. Inténtalo de nuevo.";
  for (const [patron, frase] of REGLAS) {
    if (patron.test(original)) {
      if (typeof console !== "undefined") console.warn("[apriscol]", original);
      return frase;
    }
  }
  // Los mensajes que escribimos en la base (triggers) ya vienen en lenguaje de persona.
  if (TECNICO.test(original) && !/[áéíóúñ¿]/i.test(original) && original.length > 60) {
    if (typeof console !== "undefined") console.warn("[apriscol]", original);
    return "Algo salió mal. Inténtalo de nuevo.";
  }
  return original;
}
