"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ChevronRight, Pill } from "lucide-react";
import { CampoBusqueda } from "@/components/CampoBusqueda";
import { EnlaceBoton } from "@/components/Boton";
import { EstadoVacio } from "@/components/EstadoVacio";
import { Chip, FilaDesplazable } from "@/components/FilaDesplazable";
import { Insignia } from "@/components/Insignia";
import { ListaEscalable } from "@/components/ListaEscalable";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { ETIQUETA_PRODUCTO, TIPOS_PRODUCTO } from "@/lib/sanidad";
import type { ProductoVeterinario, TipoProducto } from "@/lib/tipos";

/** Catálogo de productos veterinarios de la finca: lo que se sabe de cada uno (retiro, unidad) para no repetirlo en cada aplicación. */
export function ListaProductos({ fincaId, puedeEditar }: { fincaId: string; puedeEditar: boolean }) {
  const [busqueda, setBusqueda] = useState("");
  const [tipo, setTipo] = useState<TipoProducto | "todos">("todos");
  const alBuscar = useCallback((t: string) => setBusqueda(t), []);

  const cargar = useCallback(
    async (desde: number, cantidad: number) => {
      let q = crearClienteNavegador().from("productos_veterinarios").select("*", { count: "exact" }).eq("finca_id", fincaId);
      if (tipo !== "todos") q = q.eq("tipo", tipo);
      const limpio = busqueda.replace(/[%,()*\\]/g, " ").trim();
      if (limpio) q = q.or(`nombre.ilike.%${limpio}%,registro_ica.ilike.%${limpio}%`);
      const { data, count, error } = await q.order("activo", { ascending: false }).order("nombre").range(desde, desde + cantidad - 1);
      if (error) throw new Error(error.message);
      return { filas: (data ?? []) as ProductoVeterinario[], total: count ?? 0 };
    },
    [fincaId, busqueda, tipo],
  );

  const hayFiltro = busqueda !== "" || tipo !== "todos";

  return (
    <div className="space-y-3">
      <CampoBusqueda onBuscar={alBuscar} placeholder="Buscar producto" />
      <FilaDesplazable>
        <Chip activo={tipo === "todos"} onClick={() => setTipo("todos")}>Todos</Chip>
        {TIPOS_PRODUCTO.map((t) => (
          <Chip key={t} activo={tipo === t} onClick={() => setTipo(t)}>
            {ETIQUETA_PRODUCTO[t]}
          </Chip>
        ))}
      </FilaDesplazable>
      <ListaEscalable<ProductoVeterinario>
        rejilla="grid-cols-1 lg:grid-cols-2"
        key={`${busqueda}|${tipo}`}
        cargar={cargar}
        clave={(p) => p.id}
        fila={(p) => {
          const contenido = (
            <>
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-ocre/15 text-ocre">
                <Pill className="size-5" strokeWidth={1.75} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold [overflow-wrap:anywhere]">{p.nombre}</span>
                <span className="block text-sm text-humo">
                  {ETIQUETA_PRODUCTO[p.tipo]}
                  {p.registro_ica ? ` · ICA ${p.registro_ica}` : ""}
                </span>
                <span className="mt-1.5 flex flex-wrap gap-1.5">
                  {p.activo ? null : <Insignia>Archivado</Insignia>}
                  {p.retiro_leche_dias > 0 ? <Insignia tono="aviso">Leche {p.retiro_leche_dias} d</Insignia> : null}
                  {p.retiro_carne_dias > 0 ? <Insignia tono="alerta">Carne {p.retiro_carne_dias} d</Insignia> : null}
                  {p.retiro_leche_dias === 0 && p.retiro_carne_dias === 0 ? <Insignia tono="ok">Sin retiro</Insignia> : null}
                </span>
              </span>
              {puedeEditar ? <ChevronRight className="size-5 shrink-0 text-humo" strokeWidth={1.75} /> : null}
            </>
          );
          const clases = "flex min-h-[4.5rem] items-center gap-3 rounded-2xl bg-papel px-3.5 py-3 ring-1 ring-arena";
          return puedeEditar ? (
            <Link href={`/sanidad/productos/${p.id}/editar`} className={`${clases} transition active:scale-[0.99]`}>
              {contenido}
            </Link>
          ) : (
            <div className={clases}>{contenido}</div>
          );
        }}
        vacio={
          hayFiltro ? (
            <EstadoVacio icono={<Pill strokeWidth={1.5} />} titulo="Ningún producto coincide" descripcion="Prueba con otro nombre o quita el filtro." />
          ) : (
            <EstadoVacio icono={<Pill strokeWidth={1.5} />} titulo="Tu catálogo está vacío" descripcion="Guarda aquí las vacunas, desparasitantes y medicinas que usas, con su retiro, y al registrar una aplicación se llenan solos.">
              {puedeEditar ? <EnlaceBoton href="/sanidad/productos/nuevo">Agregar el primer producto</EnlaceBoton> : null}
            </EstadoVacio>
          )
        }
      />
    </div>
  );
}
