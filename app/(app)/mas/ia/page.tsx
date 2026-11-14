import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ConexionIa } from "@/components/ConexionIa";
import { Encabezado } from "@/components/Encabezado";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Conexión con IA" };

/** Conexión con IA: la persona deja que su asistente (Claude, por ejemplo) consulte su finca, solo para leer. Ve y revoca sus propias conexiones. */
export default async function PaginaIa() {
  const { finca, user } = await obtenerContexto();
  const supabase = await crearClienteServidor();
  // Nunca se trae la huella: la pantalla no la necesita.
  const { data } = await supabase.from("tokens_ia").select("id, nombre, prefijo, creado_en, ultimo_uso").eq("finca_id", finca.id).eq("user_id", user.id).is("revocado_en", null).order("creado_en", { ascending: false }).limit(10);

  return (
    <>
      <Link href="/mas" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo lg:hidden">
        <ChevronLeft className="size-5" strokeWidth={2} /> Más
      </Link>
      <Encabezado titulo="Conexión con IA" subtitulo="Pregúntale a tu asistente por tu finca" />
      <div className="lg:max-w-xl">
        <ConexionIa finca={finca.nombre} conexiones={data ?? []} />
      </div>
    </>
  );
}
