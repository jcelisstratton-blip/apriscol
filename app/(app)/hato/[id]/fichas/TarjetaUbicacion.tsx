import Link from "next/link";
import { Insignia } from "@/components/Insignia";
import { Tarjeta } from "@/components/Tarjeta";
import { puedeEscribir, puedeVer } from "@/lib/permisos";
import { clasesBoton } from "@/components/Boton";
import { diasHasta, formatoFecha } from "@/lib/fechas";
import { ListaMovimientos } from "@/components/ListaMovimientos";
import { ETIQUETA_MOTIVO } from "@/lib/corrales";
import type { CtxFicha } from "./contexto";

/** Dónde está el animal (corral o potrero) y por dónde ha pasado. */
export async function TarjetaUbicacion({ c }: { c: CtxFicha }) {
  const { id, animal, finca, rol, supabase, hoy } = c;
  const verCorrales = puedeVer(rol, "corrales", finca.plan);
  const [ubicacionesFinca, movimientoActual, totalMovimientos] = verCorrales
    ? await Promise.all([
        supabase.from("ubicaciones").select("id, nombre, tipo").eq("finca_id", finca.id).limit(500),
        supabase.from("movimientos_animales").select("ubicacion_id, desde, motivo").eq("animal_id", id).eq("finca_id", finca.id).is("hasta", null).maybeSingle(),
        supabase.from("movimientos_animales").select("id", { count: "exact", head: true }).eq("animal_id", id).eq("finca_id", finca.id),
      ])
    : [{ data: [] }, { data: null }, { count: 0 }];
  const nombresUbicacion: Record<string, string> = Object.fromEntries((ubicacionesFinca.data ?? []).map((u) => [u.id, u.nombre]));
  if (!(verCorrales && (animal.estado === "activo" || (totalMovimientos.count ?? 0) > 0))) return null;

  return (
    <Tarjeta titulo="Ubicación" id="ubicacion">
      {movimientoActual.data ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-lana px-3 py-2.5">
          <span className="min-w-0">
            <Link href={`/hato/corrales/${movimientoActual.data.ubicacion_id}`} className="font-semibold [overflow-wrap:anywhere] hover:underline">
              {nombresUbicacion[movimientoActual.data.ubicacion_id] ?? "Instalación"}
            </Link>
            <span className="block text-sm text-humo">
              desde el {formatoFecha(movimientoActual.data.desde, { day: "numeric", month: "short", year: "numeric" })} ·{" "}
              {(() => {
                const dias = Math.max(0, -diasHasta(movimientoActual.data.desde, hoy));
                return dias === 0 ? "entró hoy" : `${dias} ${dias === 1 ? "día" : "días"}`;
              })()}
            </span>
          </span>
          <Insignia>{ETIQUETA_MOTIVO[movimientoActual.data.motivo]}</Insignia>
        </div>
      ) : animal.estado === "activo" ? (
        <p className="text-[0.9375rem] text-humo">Todavía no tiene un corral o potrero asignado.</p>
      ) : (
        <p className="text-[0.9375rem] text-humo">Ya no está en ninguna instalación.</p>
      )}
      {(totalMovimientos.count ?? 0) > 0 ? (
        <div className="mt-3">
          <p className="mb-1.5 text-sm font-semibold">Por dónde ha pasado</p>
          <ListaMovimientos fincaId={finca.id} ubicaciones={nombresUbicacion} animalId={id} puedeEditar={puedeEscribir(rol, "corrales", finca.plan)} />
        </div>
      ) : null}
      {puedeEscribir(rol, "corrales", finca.plan) && animal.estado === "activo" ? (
        <div className="mt-3">
          <Link href={`/hato/corrales/mover?animal=${id}`} className={clasesBoton("secundario")}>
            {movimientoActual.data ? "Moverlo a otra instalación" : "Asignarle una instalación"}
          </Link>
        </div>
      ) : null}
    </Tarjeta>
  );
}
