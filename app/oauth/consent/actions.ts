"use server";

import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { RUTA_SALIR } from "@/lib/supabase/sesion";
import { idAutorizacionValido } from "@/lib/mcp/consentimiento";

/**
 * La persona decide si Claude (u otro asistente) puede ver su finca. Supabase guarda la decisión y devuelve a dónde volver (con el permiso o con la negativa):
 * esa dirección la arma Supabase, nunca el navegador. Si algo falla, la persona vuelve a la pantalla con el aviso.
 */
async function decidir(formData: FormData, aprobar: boolean) {
  const id = formData.get("authorization_id");
  if (typeof id !== "string" || !idAutorizacionValido(id)) redirect("/oauth/consent");
  const supabase = await crearClienteServidor();
  const { data: sesion } = await supabase.auth.getClaims();
  if (!sesion?.claims?.sub) redirect(RUTA_SALIR);
  const { data, error } = aprobar
    ? await supabase.auth.oauth.approveAuthorization(id, { skipBrowserRedirect: true })
    : await supabase.auth.oauth.denyAuthorization(id, { skipBrowserRedirect: true });
  if (error || !data?.redirect_url) redirect(`/oauth/consent?authorization_id=${encodeURIComponent(id)}&error=1`);
  redirect(data.redirect_url);
}

export async function permitirAcceso(formData: FormData) {
  await decidir(formData, true);
}

export async function negarAcceso(formData: FormData) {
  await decidir(formData, false);
}
