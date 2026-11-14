/**
 * Lo que la persona copia para conectar su asistente. Salen de un solo lugar para que la pantalla y las pruebas digan lo mismo.
 * El token solo existe en pantalla el momento de crearlo; estas funciones no lo guardan.
 */
export const rutaMcp = (sitio: string): string => `${sitio.replace(/\/$/, "")}/api/mcp`;

/** Claude Code: un solo comando en la terminal. */
export const comandoClaudeCode = (url: string, token: string): string => `claude mcp add --transport http apriscol ${url} --header "Authorization: Bearer ${token}"`;

/** Claude Desktop: el archivo de configuración, con el puente `mcp-remote` (el encabezado va por variable para que el espacio de «Bearer » no se parta). */
export const configClaudeDesktop = (url: string, token: string): string =>
  JSON.stringify({ mcpServers: { apriscol: { command: "npx", args: ["-y", "mcp-remote", url, "--header", "Authorization:${APRISCOL_AUTH}"], env: { APRISCOL_AUTH: `Bearer ${token}` } } } }, null, 2);

/** Cursor y otros asistentes que aceptan una dirección con encabezados. */
export const configGenerica = (url: string, token: string): string => JSON.stringify({ mcpServers: { apriscol: { url, headers: { Authorization: `Bearer ${token}` } } } }, null, 2);

export const NOMBRE_SUGERIDO = "Mi asistente";
export const nombreValido = (texto: string): string | null => {
  const t = texto.trim().replace(/\s+/g, " ");
  return t.length >= 1 && t.length <= 60 ? t : null;
};
