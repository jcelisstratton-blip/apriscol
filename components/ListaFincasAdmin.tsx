"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { SearchX, Sprout } from "lucide-react";
import { CampoBusqueda } from "@/components/CampoBusqueda";
import { EstadoVacio } from "@/components/EstadoVacio";
import { ListaEscalable } from "@/components/ListaEscalable";
import { formatoFecha } from "@/lib/fechas";

export type FilaFinca = {
  id: string;
  nombre: string;
  departamento: string | null;
  municipio: string | null;
  propietario_email: string;
  propietario_nombre: string;
  animales_activos: number;
  miembros: number;
  creada_en: string;
};

/** Fincas de toda la plataforma (llegan ya cargadas del servidor); busca por finca, propietario o correo. */
export function ListaFincasAdmin({ filas }: { filas: FilaFinca[] }) {
  const [busqueda, setBusqueda] = useState("");
  const alBuscar = useCallback((t: string) => setBusqueda(t), []);

  const cargar = useCallback(
    async (desde: number, cantidad: number) => {
      const t = busqueda.toLowerCase();
      const visibles = t
        ? filas.filter((f) => [f.nombre, f.propietario_nombre, f.propietario_email, f.municipio ?? ""].some((x) => x.toLowerCase().includes(t)))
        : filas;
      return { filas: visibles.slice(desde, desde + cantidad), total: visibles.length };
    },
    [filas, busqueda],
  );

  return (
    <div className="space-y-3">
      {filas.length > 8 ? <CampoBusqueda onBuscar={alBuscar} placeholder="Buscar finca, propietario o correo" /> : null}
      <ListaEscalable<FilaFinca>
        key={busqueda}
        cargar={cargar}
        clave={(f) => f.id}
        fila={(f) => (
          <article className="min-w-0 rounded-2xl bg-papel p-4 ring-1 ring-arena">
            <h2 className="font-bold [overflow-wrap:anywhere]">
              <Link href={`/admin/fincas/${f.id}`} className="underline-offset-4 hover:underline">
                {f.nombre}
              </Link>
            </h2>
            <p className="text-sm text-humo [overflow-wrap:anywhere]">
              {[f.municipio, f.departamento].filter(Boolean).join(", ") || "Sin ubicación"}
            </p>
            <p className="mt-2 text-[0.9375rem] [overflow-wrap:anywhere]">
              {f.propietario_nombre ? <span className="font-semibold">{f.propietario_nombre} · </span> : null}
              <span className="text-humo">{f.propietario_email || "Sin propietario"}</span>
            </p>
            <p className="mt-2 text-sm text-humo">
              {f.animales_activos} {f.animales_activos === 1 ? "animal activo" : "animales activos"} · {f.miembros}{" "}
              {f.miembros === 1 ? "persona" : "personas"} · creada el {formatoFecha(f.creada_en.slice(0, 10), { day: "numeric", month: "short", year: "numeric" })}
            </p>
          </article>
        )}
        vacio={
          busqueda ? (
            <EstadoVacio icono={<SearchX strokeWidth={1.5} />} titulo="Nada con esa búsqueda" descripcion="Prueba con otro nombre o correo." />
          ) : (
            <EstadoVacio icono={<Sprout strokeWidth={1.5} />} titulo="Todavía no hay fincas" descripcion="Cuando alguien cree su finca, aparecerá aquí." />
          )
        }
      />
    </div>
  );
}
