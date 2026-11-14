/** La dirección que la persona pega en Claude para conectar Apriscol. */
export const rutaMcp = (sitio: string): string => `${sitio.replace(/\/$/, "")}/api/mcp`;
