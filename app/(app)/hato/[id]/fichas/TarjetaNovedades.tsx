import Link from "next/link";
import { Inbox } from "lucide-react";
import { clasesBoton } from "@/components/Boton";
import { Insignia } from "@/components/Insignia";
import { Tarjeta } from "@/components/Tarjeta";
import { formatoFecha } from "@/lib/fechas";
import { ETIQUETA_ESTADO_NOVEDAD, TONO_ESTADO_NOVEDAD, resumenNovedad } from "@/lib/novedades";
import { puedeEscribir, puedeVer } from "@/lib/permisos";
import type { CtxFicha } from "./contexto";

/** Las novedades de este animal y el botón para enviar una (solo eligiendo opciones). Quien revisa ve todas las del animal; el ordeñador, las suyas. */
export async function TarjetaNovedades({ c }: { c: CtxFicha }) {
  const { id, animal, finca, rol, supabase } = c;
  if (!puedeVer(rol, "novedades", finca.plan)) return null;
  const puedeEnviar = puedeEscribir(rol, "novedades", finca.plan) && animal.estado === "activo";
  const { data } = await supabase.from("novedades").select("*").eq("animal_id", id).eq("finca_id", finca.id).order("created_at", { ascending: false }).limit(5);
  const novedades = data ?? [];
  if (!puedeEnviar && novedades.length === 0) return null;

  return (
    <Tarjeta titulo="Novedades" id="novedades">
      {novedades.length === 0 ? (
        <p className="text-[0.9375rem] text-humo">Nadie ha enviado novedades de este animal.</p>
      ) : (
        <ul className="divide-y divide-arena">
          {novedades.map((n) => (
            <li key={n.id} className="py-2.5">
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0 font-semibold [overflow-wrap:anywhere]">{resumenNovedad(n)}</span>
                <Insignia tono={TONO_ESTADO_NOVEDAD[n.estado]}>{ETIQUETA_ESTADO_NOVEDAD[n.estado]}</Insignia>
              </div>
              <p className="text-sm text-humo [overflow-wrap:anywhere]">
                Enviada por {n.enviada_por_nombre} · ocurrió el {formatoFecha(n.fecha, { day: "numeric", month: "short" })}
              </p>
            </li>
          ))}
        </ul>
      )}
      {novedades.length > 0 ? (
        <Link href="/novedades?estado=todas" className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-musgo underline-offset-4 hover:underline">
          Ver todas las novedades
        </Link>
      ) : null}
      {puedeEnviar ? (
        <div className="mt-3">
          <Link href={`/novedades/nueva?animal=${id}`} className={clasesBoton("primario")}>
            <Inbox className="size-5" strokeWidth={2} aria-hidden="true" /> Enviar una novedad
          </Link>
          <p className="mt-1.5 text-[0.8125rem] text-humo">Cuéntales al administrador y al veterinario una aplicación, una prueba, un coprológico o un FAMACHA. Solo eliges opciones.</p>
        </div>
      ) : null}
    </Tarjeta>
  );
}
