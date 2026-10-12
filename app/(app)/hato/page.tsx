import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { AgregarAlOrdeno } from "@/components/AgregarAlOrdeno";
import { Encabezado } from "@/components/Encabezado";
import { FilaDesplazable } from "@/components/FilaDesplazable";
import { ListaHato } from "@/components/ListaHato";
import { ProgramaOrdeno } from "@/components/ProgramaOrdeno";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir, puedeGestionar, puedeVer } from "@/lib/permisos";
import { etiquetaAnimal } from "@/lib/animal";
import { hoyBogota } from "@/lib/fechas";

export const metadata: Metadata = { title: "Hato" };

/**
 * Hato: los animales y, en la pestaña «Leche», el programa del ordeño (qué hembras se ordeñan y en qué turnos). Lo que se mira o se hace
 * sobre la producción de todo el hato está en el menú «Leche».
 */
export default async function PaginaHato({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const { vista: vistaPedida } = await searchParams;
  const { finca, rol, perfil } = await obtenerContexto();
  const puedeCrear = puedeEscribir(rol, "hato");
  const verLeche = puedeVer(rol, "leche");
  const vista = vistaPedida === "leche" && verLeche ? "leche" : "animales";

  return (
    <>
      <Encabezado
        titulo="Hato"
        subtitulo={finca.nombre}
        acciones={
          puedeCrear ? (
            <Link
              href="/hato/nuevo"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-musgo px-4 text-sm font-semibold text-sobre-musgo"
            >
              <Plus className="size-4" strokeWidth={2.4} /> Nuevo
            </Link>
          ) : null
        }
      />
      {verLeche ? (
        <FilaDesplazable className="mb-3">
          {[
            { v: "animales", t: "Animales", href: "/hato" },
            { v: "leche", t: "Leche", href: "/hato?vista=leche" },
          ].map((p) => (
            <Link
              key={p.v}
              href={p.href}
              aria-current={vista === p.v ? "page" : undefined}
              className={`inline-flex min-h-10 shrink-0 items-center rounded-full px-4 text-sm font-semibold transition ${
                vista === p.v ? "bg-musgo text-sobre-musgo" : "bg-papel text-humo ring-1 ring-arena hover:text-tinta"
              }`}
            >
              {p.t}
            </Link>
          ))}
        </FilaDesplazable>
      ) : null}

      {vista === "leche" ? (
        <ProgramaLeche fincaId={finca.id} puedeEditar={puedeCrear} />
      ) : (
        <Animales fincaId={finca.id} especies={finca.especies} puedeCrear={puedeCrear} puedeTraer={puedeGestionar(rol) && !perfil?.libro_resuelto_en} />
      )}
    </>
  );
}

async function Animales({ fincaId, especies, puedeCrear, puedeTraer }: { fincaId: string; especies: ("caprino" | "ovino")[]; puedeCrear: boolean; puedeTraer: boolean }) {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.rpc("animales_en_retiro", { p_finca: fincaId });
  const retiros = Object.fromEntries((data ?? []).map((r) => [r.animal_id, { leche: r.retiro_leche_hasta, carne: r.retiro_carne_hasta }]));
  return <ListaHato fincaId={fincaId} especies={especies} retiros={retiros} puedeCrear={puedeCrear} puedeTraer={puedeTraer} />;
}

/** El programa del ordeño: las hembras en leche con sus turnos, y agregar más hembras al ordeño. */
async function ProgramaLeche({ fincaId, puedeEditar }: { fincaId: string; puedeEditar: boolean }) {
  const supabase = await crearClienteServidor();
  const { data: lactancias } = await supabase.from("lactancias").select("animal_id").eq("finca_id", fincaId).is("fecha_secado", null);
  const ids = (lactancias ?? []).map((l) => l.animal_id);
  const activas: { id: string; numero_arete: string; nombre: string | null; turnos_ordeno: string[] | null }[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await supabase
      .from("animales")
      .select("id, numero_arete, nombre, turnos_ordeno")
      .eq("finca_id", fincaId)
      .eq("sexo", "hembra")
      .eq("estado", "activo")
      .is("deleted_at", null)
      .in("id", ids.slice(i, i + 100));
    activas.push(...(data ?? []));
  }
  activas.sort((a, b) => a.numero_arete.localeCompare(b.numero_arete, "es", { numeric: true }));

  return (
    <div className="space-y-4 lg:max-w-3xl">
      <p className="px-1 text-[0.9375rem] text-humo">
        Aquí decides qué hembras se ordeñan y en qué turnos. De esto sale la lista de cada turno cuando registras el ordeño en Leche.
      </p>
      <ProgramaOrdeno
        hembras={activas.map((a) => ({ id: a.id, etiqueta: etiquetaAnimal(a), turnos: a.turnos_ordeno }))}
        puedeEditar={puedeEditar}
      />
      {puedeEditar ? <AgregarAlOrdeno fincaId={fincaId} hoy={hoyBogota()} enLeche={ids} /> : null}
    </div>
  );
}
