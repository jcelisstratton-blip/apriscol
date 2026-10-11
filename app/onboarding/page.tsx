import type { Metadata } from "next";
import Link from "next/link";
import { FormFinca } from "@/components/FormFinca";
import { PantallaAuth } from "@/components/PantallaAuth";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerUsuario } from "@/lib/contexto";

export const metadata: Metadata = { title: "Nueva finca" };

export default async function PaginaOnboarding() {
  const user = await obtenerUsuario();
  const supabase = await crearClienteServidor();
  const { count } = await supabase.from("finca_miembros").select("*", { count: "exact", head: true }).eq("user_id", user.id);
  const tieneFincas = (count ?? 0) > 0;

  return (
    <PantallaAuth
      titulo={tieneFincas ? "Agregar otra finca" : "Cuéntanos de tu finca"}
      subtitulo={tieneFincas ? "Podrás cambiar entre tus fincas cuando quieras." : "Con esto armamos tu panel. Lo puedes cambiar después."}
    >
      <FormFinca />
      {tieneFincas ? (
        <Link href="/mas" className="text-center text-[0.9375rem] font-semibold text-musgo">
          Volver
        </Link>
      ) : null}
    </PantallaAuth>
  );
}
