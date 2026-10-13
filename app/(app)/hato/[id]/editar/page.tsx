import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Encabezado } from "@/components/Encabezado";
import { FormAnimal } from "@/components/FormAnimal";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir } from "@/lib/permisos";
import { motivoBloqueoIdentidad } from "@/lib/animal-historia";
import { etiquetaAnimal } from "@/lib/animal";
import { urlsFotos } from "@/lib/fotos";

export const metadata: Metadata = { title: "Editar animal" };

const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PaginaEditarAnimal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_UUID.test(id)) notFound();
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "hato", finca.plan)) redirect(`/hato/${id}`);

  const supabase = await crearClienteServidor();
  const { data: animal } = await supabase.from("animales").select("*").eq("id", id).eq("finca_id", finca.id).is("deleted_at", null).maybeSingle();
  if (!animal) notFound();

  const idsPadres = [animal.padre_id, animal.madre_id].filter((x): x is string => !!x);
  const [razas, padres, bloqueo, fotos] = await Promise.all([
    supabase.from("razas").select("*").in("especie", finca.especies).order("nombre"),
    idsPadres.length ? supabase.from("animales").select("id, numero_arete, nombre").in("id", idsPadres) : Promise.resolve({ data: [] }),
    motivoBloqueoIdentidad(supabase, id, finca.id),
    urlsFotos(supabase, "fotos-animales", [animal.foto_path]),
  ]);
  const fotoUrl = animal.foto_path ? fotos.get(animal.foto_path) : undefined;
  const padre = padres.data?.find((p) => p.id === animal.padre_id) ?? null;
  const madre = padres.data?.find((p) => p.id === animal.madre_id) ?? null;

  return (
    <>
      <Link href={`/hato/${id}`} className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> {animal.nombre ?? animal.numero_arete}
      </Link>
      <Encabezado titulo="Editar animal" subtitulo={etiquetaAnimal(animal)} />
      <div className="space-y-5 lg:max-w-3xl">
        {animal.libro_id ? (
          <Aviso tipo="info">Este animal viene del libro genealógico: su pedigrí oficial no cambia aunque corrijas aquí a su padre o a su madre.</Aviso>
        ) : null}
        <FormAnimal
          fincaId={finca.id}
          especies={finca.especies}
          propositoFinca={finca.proposito}
          razas={razas.data ?? []}
          bloqueoIdentidad={bloqueo}
          animal={{
            id: animal.id,
            especie: animal.especie,
            sexo: animal.sexo,
            numero_arete: animal.numero_arete,
            chip: animal.chip,
            nombre: animal.nombre,
            raza_id: animal.raza_id,
            color: animal.color,
            marcas: animal.marcas,
            rasgos: animal.rasgos,
            fecha_nacimiento: animal.fecha_nacimiento,
            fecha_nacimiento_aprox: animal.fecha_nacimiento_aprox,
            origen: animal.origen === "comprado" ? "comprado" : "nacido_en_finca",
            peso_nacer_kg: animal.peso_nacer_kg,
            valor_compra: animal.valor_compra,
            vocacion: animal.vocacion,
            uso_macho: animal.uso_macho,
            padre,
            madre,
            padre_externo: animal.padre_externo,
            madre_externa: animal.madre_externa,
            notas: animal.notas,
            foto: animal.foto_path && fotoUrl ? { path: animal.foto_path, url: fotoUrl } : null,
          }}
        />
      </div>
    </>
  );
}
