import "server-only";
import { crearClienteServidor } from "@/lib/supabase/server";
import { clienteServicio } from "@/lib/notificaciones/servidor";

/**
 * Abre en el navegador (en las cookies de esta respuesta) la sesión de una persona, y deja activa la finca del mensaje. Supabase emite la sesión con su llave: se pide un
 * enlace de acceso de un solo uso para esa persona y se canjea en el acto. Solo se llama después de comprobar la firma de Telegram y que el chat esté vinculado a esa finca.
 */
export async function abrirSesionWeb(userId: string, fincaId: string, secretKey: string): Promise<{ ok: true } | { ok: false; paso: string }> {
  const admin = clienteServicio(secretKey);
  const { data: usuario, error: errUsuario } = await admin.auth.admin.getUserById(userId);
  if (errUsuario || !usuario.user?.email) return { ok: false, paso: "leer a la persona" };
  const { data: enlace, error: errEnlace } = await admin.auth.admin.generateLink({ type: "magiclink", email: usuario.user.email });
  if (errEnlace || !enlace.properties?.hashed_token) return { ok: false, paso: "preparar el acceso" };
  const supabase = await crearClienteServidor();
  const { error: errSesion } = await supabase.auth.verifyOtp({ token_hash: enlace.properties.hashed_token, type: "magiclink" });
  if (errSesion) return { ok: false, paso: "abrir la sesión" };
  // La finca del mensaje queda activa para que la pantalla abra en ella (el vínculo ya garantiza que la persona es de esa finca).
  await supabase.from("perfiles").update({ finca_activa_id: fincaId }).eq("id", userId);
  return { ok: true };
}
