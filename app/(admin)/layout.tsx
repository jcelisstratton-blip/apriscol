import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { Marca } from "@/components/Marca";
import { Insignia } from "@/components/Insignia";
import { NavAdmin } from "@/components/NavAdmin";
import { esAdminPlataforma, obtenerUsuario } from "@/lib/contexto";
import { cerrarSesion } from "@/app/login/actions";
import { crearClienteServidor } from "@/lib/supabase/server";

/** Espacio del superadmin: no depende de tener una finca. Quien no es superadmin vuelve al inicio. */
export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  if (!(await esAdminPlataforma())) redirect("/");
  const user = await obtenerUsuario();
  const supabase = await crearClienteServidor();
  const { count } = await supabase.from("finca_miembros").select("*", { count: "exact", head: true }).eq("user_id", user.id);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-12 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
      <header className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2.5">
          <Marca />
          <Insignia tono="musgo">Superadmin</Insignia>
        </span>
        <form action={cerrarSesion}>
          <button
            type="submit"
            aria-label="Cerrar sesión"
            className="grid size-11 place-items-center rounded-full text-humo ring-1 ring-arena hover:text-rojo"
          >
            <LogOut className="size-5" strokeWidth={1.75} />
          </button>
        </form>
      </header>
      <div className="mt-3">
        <NavAdmin conFincas={(count ?? 0) > 0} />
      </div>
      {children}
    </main>
  );
}
