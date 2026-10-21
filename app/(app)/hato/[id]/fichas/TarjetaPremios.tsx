import Link from "next/link";
import { Tarjeta } from "@/components/Tarjeta";
import { puedeEscribir, puedeVer } from "@/lib/permisos";
import { urlsFotosPremios } from "@/lib/fotos";
import { FilaParticipacion } from "@/components/FilaParticipacion";
import { clasesBoton } from "@/components/Boton";
import { formatoFecha } from "@/lib/fechas";
import type { CtxFicha } from "./contexto";

/** Participaciones en ferias, premios y palmarés del animal. */
export async function TarjetaPremios({ c }: { c: CtxFicha }) {
  const { id, animal, finca, rol, supabase } = c;
  const verFerias = puedeVer(rol, "ferias", finca.plan);
  const [palmares, participaciones] = await Promise.all([
    verFerias ? supabase.from("v_palmares_animal").select("*").eq("animal_id", id).maybeSingle() : Promise.resolve({ data: null }),
    verFerias
      ? supabase
          .from("participaciones_feria")
          .select("id, feria_id, categoria, resultado, puesto, puntaje, premio_descripcion, premio_en_dinero, foto_path")
          .eq("animal_id", id)
          .order("created_at", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] }),
  ]);
  const listaPremios = participaciones.data ?? [];
  const idsFerias = [...new Set(listaPremios.map((p) => p.feria_id))];
  const [feriasData, fotosPremios] = await Promise.all([
    idsFerias.length ? supabase.from("ferias").select("id, nombre, fecha_inicio").in("id", idsFerias) : Promise.resolve({ data: [] }),
    urlsFotosPremios(supabase, listaPremios.map((p) => p.foto_path)),
  ]);
  const ferias = new Map((feriasData.data ?? []).map((f) => [f.id, f]));
  if (!(verFerias && (animal.estado === "activo" || listaPremios.length > 0))) return null;

  return (
    <Tarjeta titulo="Ferias y premios" id="premios">
      {listaPremios.length === 0 ? (
        <p className="text-[0.9375rem] text-humo">Todavía no tiene participaciones en ferias.</p>
      ) : (
        <>
          <dl className="mb-3 grid grid-cols-3 divide-x divide-arena text-center">
            {[
              ["Ferias", palmares.data?.participaciones ?? 0],
              ["Premios", palmares.data?.premios ?? 0],
              ["Campeonatos", palmares.data?.campeonatos ?? 0],
            ].map(([etiqueta, valor]) => (
              <div key={etiqueta} className="min-w-0 px-1">
                <dd className="font-display text-2xl font-semibold tabular-nums">{valor}</dd>
                <dt className="text-xs font-medium text-humo">{etiqueta}</dt>
              </div>
            ))}
          </dl>
          <ul className="grid grid-cols-1 gap-2.5">
            {listaPremios.map((p) => {
              const f = ferias.get(p.feria_id);
              return (
                <li key={p.id} className="min-w-0">
                  <FilaParticipacion
                    p={p}
                    titulo={f?.nombre ?? "Feria"}
                    detalle={f ? formatoFecha(f.fecha_inicio) : undefined}
                    enlace={`/ferias/${p.feria_id}`}
                    fotoUrl={p.foto_path ? fotosPremios.get(p.foto_path) : undefined}
                    editar={puedeEscribir(rol, "ferias", finca.plan) ? `/ferias/participacion/${p.id}/editar` : undefined}
                  />
                </li>
              );
            })}
          </ul>
        </>
      )}
      {puedeEscribir(rol, "ferias", finca.plan) && animal.estado === "activo" ? (
        <Link href={`/ferias/participacion/nueva?animal=${id}`} className={`${clasesBoton("secundario")} mt-3`}>
          Registrar premio
        </Link>
      ) : null}
    </Tarjeta>
  );
}
