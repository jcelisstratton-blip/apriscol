import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Encabezado } from "@/components/Encabezado";
import { FormCruza, type RefCruza } from "@/components/FormCruza";
import { obtenerContexto } from "@/lib/contexto";
import { puedeVer } from "@/lib/permisos";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Simular cruza" };

const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PaginaCruza({ searchParams }: { searchParams: Promise<{ macho?: string; hembra?: string }> }) {
  const { finca, rol } = await obtenerContexto();
  if (!puedeVer(rol, "hato")) redirect("/hato");
  const { macho, hembra } = await searchParams;
  const supabase = await crearClienteServidor();

  const cargar = async (id: string | undefined, sexo: "macho" | "hembra"): Promise<RefCruza | null> => {
    if (!id || !ID_UUID.test(id)) return null;
    const { data } = await supabase
      .from("animales")
      .select("id, numero_arete, nombre, especie")
      .eq("id", id)
      .eq("finca_id", finca.id)
      .eq("sexo", sexo)
      .eq("estado", "activo")
      .is("deleted_at", null)
      .maybeSingle();
    return data;
  };
  const [m, h] = await Promise.all([cargar(macho, "macho"), cargar(hembra, "hembra")]);

  return (
    <>
      <Link href="/hato" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> Hato
      </Link>
      <Encabezado titulo="Simular cruza" subtitulo={finca.nombre} />
      <FormCruza fincaId={finca.id} umbral={finca.umbral_endogamia} machoInicial={m} hembraInicial={h} />
    </>
  );
}
