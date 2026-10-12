import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, MapPin, Pencil, Trophy } from "lucide-react";
import { AvisoGuardado } from "@/components/AvisoGuardado";
import { EstadoVacio } from "@/components/EstadoVacio";
import { FilaParticipacion, rangoFechas } from "@/components/FilaParticipacion";
import { Insignia } from "@/components/Insignia";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir, puedeVer } from "@/lib/permisos";
import { urlsFotosPremios } from "@/lib/fotos";
import { etiquetaAnimal } from "@/lib/animal";
import { ETIQUETA_NIVEL } from "@/lib/ferias";

export const metadata: Metadata = { title: "Feria" };
const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function DetalleFeria({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ guardado?: string }> }) {
  const { id } = await params;
  const { guardado } = await searchParams;
  if (!ID_UUID.test(id)) notFound();
  const { finca, rol } = await obtenerContexto();
  if (!puedeVer(rol, "ferias")) redirect("/");
  const supabase = await crearClienteServidor();

  const { data: feria } = await supabase.from("ferias").select("*").eq("id", id).eq("finca_id", finca.id).maybeSingle();
  if (!feria) notFound();

  const { data: participaciones } = await supabase
    .from("participaciones_feria")
    .select("id, animal_id, categoria, resultado, puesto, puntaje, premio_descripcion, premio_en_dinero, foto_path")
    .eq("feria_id", id)
    .order("created_at", { ascending: false })
    .limit(200);
  const lista = participaciones ?? [];

  const idsAnimales = [...new Set(lista.map((p) => p.animal_id))];
  const [animales, fotos] = await Promise.all([
    idsAnimales.length ? supabase.from("animales").select("id, numero_arete, nombre").in("id", idsAnimales) : Promise.resolve({ data: [] }),
    urlsFotosPremios(supabase, lista.map((p) => p.foto_path)),
  ]);
  const nombres = new Map((animales.data ?? []).map((a) => [a.id, etiquetaAnimal(a)]));
  const premios = lista.filter((p) => p.resultado !== "participacion").length;
  const lugar = [feria.municipio, feria.departamento].filter(Boolean).join(", ");

  return (
    <>
      <AvisoGuardado activo={guardado === "1"} />
      <div className="mt-3 flex items-center justify-between gap-3">
        <Link href="/hato" className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
          <ChevronLeft className="size-5" strokeWidth={2} /> Hato
        </Link>
        {puedeEscribir(rol, "ferias") ? (
          <Link
            href={`/ferias/${id}/editar`}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-papel px-4 text-sm font-semibold text-musgo ring-1 ring-arena transition hover:bg-arena/40"
          >
            <Pencil className="size-4" strokeWidth={2} aria-hidden="true" /> Editar
          </Link>
        ) : null}
      </div>
      <header className="pb-4 pt-1">
        <h1 className="font-display text-[1.875rem] font-semibold leading-tight tracking-tight [overflow-wrap:anywhere]">{feria.nombre}</h1>
        <p className="mt-1.5 text-[0.9375rem] text-humo">{rangoFechas(feria.fecha_inicio, feria.fecha_fin)}</p>
        {lugar ? (
          <p className="mt-0.5 flex items-center gap-1 text-[0.9375rem] text-humo">
            <MapPin className="size-3.5 shrink-0" strokeWidth={1.75} /> {lugar}
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Insignia tono="musgo">{ETIQUETA_NIVEL[feria.nivel]}</Insignia>
          {feria.organizador ? <Insignia>{feria.organizador}</Insignia> : null}
          {lista.length > 0 ? <Insignia tono="ok">{premios} {premios === 1 ? "premio" : "premios"} · {lista.length} {lista.length === 1 ? "participación" : "participaciones"}</Insignia> : null}
        </div>
      </header>

      {lista.length === 0 ? (
        <EstadoVacio
          icono={<Trophy strokeWidth={1.5} />}
          titulo="Todavía sin participaciones"
          descripcion="Los premios se registran desde la ficha de cada animal."
        />
      ) : (
        <ul className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
          {lista.map((p) => (
            <li key={p.id} className="min-w-0">
              <FilaParticipacion
                p={p}
                titulo={nombres.get(p.animal_id) ?? "Animal"}
                enlace={`/hato/${p.animal_id}`}
                fotoUrl={p.foto_path ? fotos.get(p.foto_path) : undefined}
                editar={puedeEscribir(rol, "ferias") ? `/ferias/participacion/${p.id}/editar` : undefined}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
