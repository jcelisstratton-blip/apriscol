import Link from "next/link";
import { ArrowRightLeft, Droplets, Footprints } from "lucide-react";
import { Insignia } from "@/components/Insignia";
import { ETIQUETA_ESTADO_UBICACION, ETIQUETA_PISO, ETIQUETA_TIPO_UBICACION, ETIQUETA_USO, PISOS_SECOS, TONO_ESTADO_UBICACION, textoOcupacion, textoRotacion } from "@/lib/corrales";
import type { UbicacionVista } from "@/lib/tipos";

/** Una instalación (corral o potrero) con cuántos animales tiene, si está hacinada y, en potreros, cómo va su rotación. */
export function TarjetaUbicacion({ u, puedeEditar, href }: { u: UbicacionVista; puedeEditar: boolean; href?: string }) {
  const corral = u.tipo === "corral";
  const llenado = u.capacidad ? Math.min(100, (u.ocupantes / u.capacidad) * 100) : 0;
  const m2 = u.area_m2 && u.ocupantes > 0 ? u.area_m2 / u.ocupantes : null;
  const destino = href ?? `/hato/corrales/${u.id}`;
  return (
    <li className="min-w-0 rounded-2xl bg-papel p-3.5 ring-1 ring-arena">
      <Link href={destino} className="block">
        <span className="flex items-start justify-between gap-2">
          <span className="min-w-0">
            <span className="block font-bold [overflow-wrap:anywhere]">{u.nombre}</span>
            <span className="block text-sm text-humo">
              {ETIQUETA_TIPO_UBICACION[u.tipo]} · {ETIQUETA_USO[u.uso]}
            </span>
          </span>
          <span className="shrink-0 text-right">
            <span className={`block font-display text-2xl font-semibold tabular-nums ${u.hacinada ? "text-rojo" : ""}`}>{textoOcupacion(u.ocupantes, u.capacidad)}</span>
            <span className="block text-xs text-humo">animales</span>
          </span>
        </span>
        {u.capacidad ? (
          <span className="mt-2 block h-2 overflow-hidden rounded-full bg-arena" role="progressbar" aria-valuemin={0} aria-valuemax={u.capacidad} aria-valuenow={u.ocupantes} aria-label="Ocupación">
            <span className={`block h-full rounded-full ${u.hacinada ? "bg-rojo" : "bg-musgo"}`} style={{ width: `${Math.max(u.ocupantes > 0 ? 4 : 0, llenado)}%` }} />
          </span>
        ) : null}
        <span className="mt-2 flex flex-wrap items-center gap-1.5">
          {u.hacinada ? <Insignia tono="alerta">Hacinada: {u.ocupantes - (u.capacidad ?? 0)} de más</Insignia> : null}
          {!corral || u.estado !== "ocupado" ? <Insignia tono={TONO_ESTADO_UBICACION[u.estado]}>{ETIQUETA_ESTADO_UBICACION[u.estado]}</Insignia> : null}
          {m2 ? <span className="text-xs text-humo">{m2.toFixed(1).replace(".", ",")} m² por animal</span> : null}
        </span>
        {!corral ? <span className="mt-1.5 block text-sm text-humo">{textoRotacion(u)}</span> : null}
        {corral && (u.piso || !u.agua) ? (
          <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-humo">
            {u.piso ? (
              <span className="inline-flex items-center gap-1">
                <Footprints className="size-3.5" strokeWidth={1.75} aria-hidden="true" /> Piso {ETIQUETA_PISO[u.piso].toLowerCase()}
                {!PISOS_SECOS.includes(u.piso) ? " (retiene humedad)" : ""}
              </span>
            ) : null}
            {!u.agua ? (
              <span className="inline-flex items-center gap-1 font-semibold text-rojo">
                <Droplets className="size-3.5" strokeWidth={1.75} aria-hidden="true" /> Sin agua permanente
              </span>
            ) : null}
          </span>
        ) : null}
      </Link>
      {puedeEditar && u.activa ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 border-t border-arena pt-1">
          <Link href={`/hato/corrales/mover?destino=${u.id}`} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-musgo underline-offset-4 hover:underline">
            <ArrowRightLeft className="size-4" strokeWidth={2} aria-hidden="true" /> Mover animales aquí
          </Link>
          {u.ocupantes > 0 ? (
            <Link href={`/hato/corrales/mover?de=${u.id}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-musgo underline-offset-4 hover:underline">
              {corral ? "Mover el lote" : "Rotar el lote"}
            </Link>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
