import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { Finca, Perfil, RolFinca } from "@/lib/tipos";

export type FincaConRol = Finca & { rol: RolFinca };

export type Contexto = {
  user: { id: string; email: string };
  perfil: Perfil | null;
  fincas: FincaConRol[];
  finca: FincaConRol;
  rol: RolFinca;
};

/** Usuario autenticado (o redirige a /login). Una consulta por petición. */
export const obtenerUsuario = cache(async () => {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  return { id: data.user.id, email: data.user.email ?? "" };
});

/** Fincas del usuario con su rol; sin fincas no hay panel, solo onboarding. */
export const obtenerContexto = cache(async (): Promise<Contexto> => {
  const user = await obtenerUsuario();
  const supabase = await crearClienteServidor();

  const [{ data: perfil }, { data: miembros }] = await Promise.all([
    supabase.from("perfiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("finca_miembros").select("finca_id, rol").eq("user_id", user.id),
  ]);

  const ids = (miembros ?? []).map((m) => m.finca_id);
  if (ids.length === 0) redirect((await esAdminPlataforma()) ? "/admin" : "/onboarding");

  const { data: fincasData } = await supabase.from("fincas").select("*").in("id", ids).order("nombre");
  const rolPorFinca = new Map((miembros ?? []).map((m) => [m.finca_id, m.rol]));
  const fincas: FincaConRol[] = (fincasData ?? []).map((f) => ({ ...f, rol: rolPorFinca.get(f.id)! }));
  if (fincas.length === 0) redirect("/onboarding");

  const finca = fincas.find((f) => f.id === perfil?.finca_activa_id) ?? fincas[0];
  return { user, perfil: perfil ?? null, fincas, finca, rol: finca.rol };
});

/** ¿La persona es administradora de la plataforma? (superadmin: vista global e importaciones del libro genealógico). */
export const esAdminPlataforma = cache(async (): Promise<boolean> => {
  const user = await obtenerUsuario();
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from("plataforma_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  return Boolean(data);
});
