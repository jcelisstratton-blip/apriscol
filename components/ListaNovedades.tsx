"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Inbox } from "lucide-react";
import { AccionesNovedad } from "@/components/AccionesNovedad";
import { CampoBusqueda } from "@/components/CampoBusqueda";
import { EstadoVacio } from "@/components/EstadoVacio";
import { Insignia } from "@/components/Insignia";
import { ListaEscalable } from "@/components/ListaEscalable";
import { FilaTarjetas, TarjetaOpcion } from "@/components/TarjetaOpcion";
import { ESCENA_ESTADO_NOVEDAD, ESCENA_TODAS_NOVEDADES } from "@/lib/escenas-novedades";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { etiquetaAnimal } from "@/lib/animal";
import { formatoFecha } from "@/lib/fechas";
import { ESTADOS_NOVEDAD, ETIQUETA_ESTADO_NOVEDAD, TONO_ESTADO_NOVEDAD, direccionParaRegistrar, resumenNovedad, type EstadoNovedad } from "@/lib/novedades";
import type { Novedad } from "@/lib/tipos";

type Fila = Novedad & { animal?: { numero_arete: string; nombre: string | null } };

/** Las novedades de la finca (quien las revisa ve todas; el ordeñador, las suyas). Cada una dice quién la envió, sobre qué animal y qué contó. */
export function ListaNovedades({ fincaId, reviso, estadoInicial }: { fincaId: string; reviso: boolean; estadoInicial: EstadoNovedad | "todas" }) {
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState<EstadoNovedad | "todas">(estadoInicial);
  const [version, setVersion] = useState(0);
  const alBuscar = useCallback((t: string) => setBusqueda(t), []);

  const cargar = useCallback(
    async (desde: number, cantidad: number) => {
      const supabase = crearClienteNavegador();
      let q = supabase.from("novedades").select("*", { count: "exact" }).eq("finca_id", fincaId);
      if (estado !== "todas") q = q.eq("estado", estado);
      const limpio = busqueda.replace(/[%,()*\\]/g, " ").trim();
      if (limpio) {
        const { data: animales } = await supabase.from("animales").select("id").eq("finca_id", fincaId).or(`numero_arete.ilike.%${limpio}%,nombre.ilike.%${limpio}%`).limit(200);
        const condiciones = [`enviada_por_nombre.ilike.%${limpio}%`];
        const ids = (animales ?? []).map((a) => a.id);
        if (ids.length) condiciones.push(`animal_id.in.(${ids.join(",")})`);
        q = q.or(condiciones.join(","));
      }
      const { data, count, error } = await q.order("created_at", { ascending: false }).range(desde, desde + cantidad - 1);
      if (error) throw new Error(error.message);
      const filas = (data ?? []) as Fila[];
      const { data: animales } = await supabase.from("animales").select("id, numero_arete, nombre").in("id", [...new Set(filas.map((f) => f.animal_id))]);
      const porId = new Map((animales ?? []).map((a) => [a.id, a]));
      for (const f of filas) f.animal = porId.get(f.animal_id);
      return { filas, total: count ?? 0 };
    },
    [fincaId, busqueda, estado],
  );

  const hayFiltro = busqueda !== "" || estado !== "todas";
  const hora = (iso: string) => new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso));

  return (
    <div className="space-y-3">
      <CampoBusqueda onBuscar={alBuscar} placeholder="Buscar animal o quién la envió" />
      <FilaTarjetas etiqueta="Estado de la novedad">
        <TarjetaOpcion escena={ESCENA_TODAS_NOVEDADES} titulo="Todas" activo={estado === "todas"} onClick={() => setEstado("todas")} />
        {ESTADOS_NOVEDAD.map((e) => (
          <TarjetaOpcion key={e} escena={ESCENA_ESTADO_NOVEDAD[e]} titulo={`${ETIQUETA_ESTADO_NOVEDAD[e]}s`} activo={estado === e} onClick={() => setEstado(e)} />
        ))}
      </FilaTarjetas>
      <ListaEscalable<Fila>
        rejilla="grid-cols-1 lg:grid-cols-2"
        key={`${busqueda}|${estado}|${version}`}
        cargar={cargar}
        clave={(n) => n.id}
        fila={(n) => (
          <div className="space-y-2 rounded-2xl bg-papel px-3.5 py-3 ring-1 ring-arena">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold [overflow-wrap:anywhere]">{resumenNovedad(n)}</p>
                <Link href={`/hato/${n.animal_id}`} className="block text-sm font-semibold text-musgo underline-offset-4 hover:underline [overflow-wrap:anywhere]">
                  {n.animal ? etiquetaAnimal(n.animal) : "Animal"}
                </Link>
              </div>
              <Insignia tono={TONO_ESTADO_NOVEDAD[n.estado]}>{ETIQUETA_ESTADO_NOVEDAD[n.estado]}</Insignia>
            </div>
            <p className="text-sm text-humo [overflow-wrap:anywhere]">
              Enviada por <span className="font-semibold text-tinta">{n.enviada_por_nombre}</span> · {hora(n.created_at)} · ocurrió el {formatoFecha(n.fecha, { day: "numeric", month: "short" })}
            </p>
            {reviso ? <AccionesNovedad id={n.id} estado={n.estado} registrar={direccionParaRegistrar(n)} alCambiar={() => setVersion((v) => v + 1)} /> : null}
          </div>
        )}
        vacio={
          hayFiltro ? (
            <EstadoVacio icono={<Inbox strokeWidth={1.5} />} titulo="Ninguna novedad coincide" descripcion="Prueba con otro nombre o quita el filtro." />
          ) : (
            <EstadoVacio
              icono={<Inbox strokeWidth={1.5} />}
              titulo={reviso ? "No hay novedades" : "Todavía no has enviado novedades"}
              descripcion={reviso ? "Cuando alguien del equipo cuente algo de un animal, aparecerá aquí con su nombre." : "Entra a la ficha de un animal y elige «Enviar una novedad» para contar una aplicación, una prueba, un coprológico o un FAMACHA."}
            />
          )
        }
      />
    </div>
  );
}
