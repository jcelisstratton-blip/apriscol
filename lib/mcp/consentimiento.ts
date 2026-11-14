/** El identificador de una solicitud de permiso que Supabase pone en la dirección de la pantalla de consentimiento: solo letras, números, guiones y guion bajo. */
export const idAutorizacionValido = (id: unknown): id is string => typeof id === "string" && /^[A-Za-z0-9_-]{8,200}$/.test(id);

/** Lo que el asistente podrá y no podrá hacer, escrito para el ganadero. Es lo mismo que las herramientas de `lib/mcp/herramientas.ts` (solo lectura). */
export const PODRA_VER = ["Qué hay que atender hoy en tu finca", "Cómo va la producción de leche", "Buscar animales por nombre o arete"];
export const NUNCA_PODRA = "Registrar, cambiar ni borrar nada. Solo lee, y ve lo mismo que tú ves en la app.";
