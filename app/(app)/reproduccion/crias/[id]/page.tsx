import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { Encabezado } from "@/components/Encabezado";
import { Insignia } from "@/components/Insignia";
import { Tarjeta } from "@/components/Tarjeta";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeVer } from "@/lib/permisos";
import { etiquetaAnimal, nombreTipo } from "@/lib/animal";
import { ETIQUETA_TIPO_BAJA } from "@/lib/bajas";
import { ETIQUETA_MOTIVO } from "@/lib/corrales";
import { formatoFecha, hoyBogota } from "@/lib/fechas";
import { ETIQUETA_PARTO } from "@/lib/reproduccion";
import { ETIQUETA_EVENTO, nombreEvento } from "@/lib/sanidad";
import { estanciaEn, ordenarHitos, textoEdad, type Hito } from "@/lib/trazabilidad";

export const metadata: Metadata = { title: "Trazabilidad de la cría" };
const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const larga = { day: "numeric", month: "long", year: "numeric" } as const;
const corta = { day: "numeric", month: "short", year: "numeric" } as const;

/**
 * Trazabilidad de una cría: de quién nació, dónde está hoy y dónde estaba en una fecha, y todo lo que le ha pasado (corrales, pesos, sanidad, baja). Una cría sin arete
 * no tiene movimientos propios: se muestra dónde estaba su madre, y se dice.
 */
export default async function PaginaTrazabilidadCria({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ fecha?: string }> }) {
  const { id } = await params;
  const { fecha: fechaPedida } = await searchParams;
  if (!ID_UUID.test(id)) notFound();
  const { finca, rol } = await obtenerContexto();
  if (!puedeVer(rol, "reproduccion", finca.plan)) redirect("/");
  const supabase = await crearClienteServidor();
  const hoy = hoyBogota();

  const { data: cria } = await supabase.from("crias").select("*").eq("id", id).eq("finca_id", finca.id).maybeSingle();
  if (!cria) notFound();
  const { data: parto } = await supabase.from("partos").select("*").eq("id", cria.parto_id).eq("finca_id", finca.id).maybeSingle();
  if (!parto) notFound();

  const verCorrales = puedeVer(rol, "corrales", finca.plan);
  const verSanidad = puedeVer(rol, "sanidad", finca.plan);
  const [{ data: madre }, { data: servicio }, { data: animal }] = await Promise.all([
    supabase.from("animales").select("id, numero_arete, nombre").eq("id", parto.madre_id).eq("finca_id", finca.id).maybeSingle(),
    parto.servicio_id ? supabase.from("servicios").select("macho_id, macho_externo").eq("id", parto.servicio_id).eq("finca_id", finca.id).maybeSingle() : Promise.resolve({ data: null }),
    cria.animal_id ? supabase.from("animales").select("id, numero_arete, nombre, especie, sexo, estado, padre_id, padre_externo, fecha_baja, created_at").eq("id", cria.animal_id).eq("finca_id", finca.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const padreId = servicio?.macho_id ?? animal?.padre_id ?? null;
  const { data: padre } = padreId ? await supabase.from("animales").select("id, numero_arete, nombre").eq("id", padreId).eq("finca_id", finca.id).maybeSingle() : { data: null };
  const padreExterno = servicio?.macho_externo ?? animal?.padre_externo ?? null;

  // Sin arete no hay movimientos propios: se sigue a la madre desde el nacimiento.
  const sigueA = animal ? animal.id : parto.madre_id;
  const [ubicaciones, movimientos, pesajes, eventos, baja] = await Promise.all([
    verCorrales ? supabase.from("ubicaciones").select("id, nombre").eq("finca_id", finca.id).limit(500) : Promise.resolve({ data: [] }),
    verCorrales ? supabase.from("movimientos_animales").select("ubicacion_id, desde, hasta, motivo").eq("animal_id", sigueA).eq("finca_id", finca.id).gte("desde", animal ? "0001-01-01" : parto.fecha).order("desde").limit(500) : Promise.resolve({ data: [] }),
    animal ? supabase.from("pesajes").select("id, fecha, peso_kg, tipo").eq("animal_id", animal.id).eq("finca_id", finca.id).order("fecha").limit(200) : Promise.resolve({ data: [] }),
    animal && verSanidad ? supabase.from("v_eventos_animal").select("id, fecha, tipo, producto_nombre, lote_producto").eq("animal_id", animal.id).order("fecha").limit(200) : Promise.resolve({ data: [] }),
    animal ? supabase.from("bajas").select("tipo, motivo, fecha").eq("animal_id", animal.id).eq("finca_id", finca.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const nombreUbicacion = new Map((ubicaciones.data ?? []).map((u) => [u.id, u.nombre]));
  const estancias = movimientos.data ?? [];

  const fecha = fechaPedida && FECHA.test(fechaPedida) ? fechaPedida : hoy;
  const fechaVista = fecha > hoy ? hoy : fecha;
  const enFecha = estanciaEn(estancias, fechaVista);
  const antesDeNacer = fechaVista < parto.fecha;
  const salioDelHato = Boolean(baja.data && fechaVista >= baja.data.fecha) || (animal?.estado !== undefined && animal.estado !== "activo" && animal.fecha_baja != null && fechaVista >= animal.fecha_baja);

  const hitos: Hito[] = [
    {
      clave: "nacimiento",
      fecha: parto.fecha,
      tipo: "nacimiento",
      titulo: cria.vivo ? "Nació" : "Nació muerta",
      detalle: [ETIQUETA_PARTO[parto.tipo], cria.peso_nacer_kg != null ? `${String(cria.peso_nacer_kg).replace(".", ",")} kg` : null].filter(Boolean).join(" · "),
    },
    ...(animal ? [{ clave: "arete", fecha: (animal.created_at ?? parto.fecha).slice(0, 10), tipo: "arete" as const, titulo: `Se registró con el arete ${animal.numero_arete}`, href: `/hato/${animal.id}` }] : []),
    ...estancias.map((m, i) => ({
      clave: `u-${i}`,
      fecha: m.desde,
      tipo: "ubicacion" as const,
      titulo: `${animal ? "Entró a" : "Con su madre en"} ${nombreUbicacion.get(m.ubicacion_id) ?? "una instalación"}`,
      detalle: ETIQUETA_MOTIVO[m.motivo],
      href: `/hato/corrales/${m.ubicacion_id}`,
    })),
    ...(pesajes.data ?? []).map((p) => ({ clave: `p-${p.id}`, fecha: p.fecha, tipo: "peso" as const, titulo: `Pesó ${String(p.peso_kg).replace(".", ",")} kg`, href: animal ? `/hato/${animal.id}#crecimiento` : undefined })),
    ...(eventos.data ?? []).map((e) => ({
      clave: `s-${e.id}`,
      fecha: e.fecha ?? parto.fecha,
      tipo: "sanidad" as const,
      titulo: nombreEvento(e),
      detalle: [e.tipo ? ETIQUETA_EVENTO[e.tipo] : null, e.lote_producto ? `Lote ${e.lote_producto}` : null].filter(Boolean).join(" · "),
      href: `/sanidad/evento/${e.id}`,
    })),
    ...(baja.data ? [{ clave: "baja", fecha: baja.data.fecha, tipo: "baja" as const, titulo: ETIQUETA_TIPO_BAJA[baja.data.tipo as keyof typeof ETIQUETA_TIPO_BAJA] ?? "Salió del hato", detalle: baja.data.motivo ?? undefined, href: animal ? `/hato/${animal.id}` : undefined }] : []),
  ];
  const linea = ordenarHitos(hitos);

  const titulo = animal ? etiquetaAnimal(animal) : `Cría sin arete${cria.sexo ? ` (${cria.sexo === "hembra" ? "hembra" : "macho"})` : ""}`;
  const volver = `/reproduccion/partos/${parto.id}`;

  return (
    <>
      <Link href={volver} className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> Parto del {formatoFecha(parto.fecha, corta)}
      </Link>
      <Encabezado titulo="Trazabilidad" subtitulo={titulo} />
      <div className="grid grid-cols-1 gap-4 lg:max-w-3xl">
        <Tarjeta titulo="De dónde viene">
          <div className="flex flex-wrap items-center gap-2 pb-2">
            <Insignia tono={cria.vivo ? "ok" : "alerta"}>{cria.vivo ? "Nació viva" : "Nació muerta"}</Insignia>
            <Insignia>{animal ? nombreTipo(animal.especie, animal.sexo) : cria.sexo === "hembra" ? "Hembra" : cria.sexo === "macho" ? "Macho" : "Sexo sin registrar"}</Insignia>
            {animal && animal.estado !== "activo" ? <Insignia tono="neutro">Ya no está en el hato</Insignia> : null}
          </div>
          <dl className="divide-y divide-arena">
            <Fila etiqueta="Nació el">{formatoFecha(parto.fecha, larga)}</Fila>
            <Fila etiqueta="Madre">{madre ? <Link href={`/hato/${madre.id}`} className="text-musgo underline-offset-4 hover:underline">{etiquetaAnimal(madre)}</Link> : "No registrada"}</Fila>
            <Fila etiqueta="Padre">
              {padre ? <Link href={`/hato/${padre.id}`} className="text-musgo underline-offset-4 hover:underline">{etiquetaAnimal(padre)}</Link> : padreExterno ? padreExterno : "No registrado"}
            </Fila>
            <Fila etiqueta="Tipo de parto">{ETIQUETA_PARTO[parto.tipo]}</Fila>
            {cria.peso_nacer_kg != null ? <Fila etiqueta="Peso al nacer">{String(cria.peso_nacer_kg).replace(".", ",")} kg</Fila> : null}
            {animal ? <Fila etiqueta="Ficha"><Link href={`/hato/${animal.id}`} className="text-musgo underline-offset-4 hover:underline">Ver la ficha del animal</Link></Fila> : null}
          </dl>
        </Tarjeta>

        {verCorrales ? (
          <Tarjeta titulo="¿Dónde estaba?">
            <form method="get" className="space-y-3">
              <Campo etiqueta="Fecha" ayuda="Elige un día y te decimos dónde estaba.">
                {(idc) => <input id={idc} name="fecha" type="date" defaultValue={fechaVista} min={parto.fecha} max={hoy} className={CLASE_INPUT} />}
              </Campo>
              <Boton type="submit" variante="secundario">Ver dónde estaba</Boton>
            </form>
            <div className="mt-4 rounded-2xl bg-lana px-3 py-3">
              {antesDeNacer ? (
                <p className="text-[0.9375rem]">Todavía no había nacido: nació el {formatoFecha(parto.fecha, larga)}.</p>
              ) : salioDelHato ? (
                <p className="text-[0.9375rem]">Ya no estaba en el hato: {baja.data ? (ETIQUETA_TIPO_BAJA[baja.data.tipo as keyof typeof ETIQUETA_TIPO_BAJA] ?? "salió").toLowerCase() : "salió"} el {formatoFecha(baja.data?.fecha ?? animal?.fecha_baja ?? fechaVista, larga)}.</p>
              ) : enFecha ? (
                <>
                  <p className="text-[0.9375rem]">
                    El {formatoFecha(fechaVista, larga)} {animal ? "estaba" : "estaba con su madre"} en{" "}
                    <Link href={`/hato/corrales/${enFecha.ubicacion_id}`} className="font-semibold text-musgo underline-offset-4 hover:underline">{nombreUbicacion.get(enFecha.ubicacion_id) ?? "una instalación"}</Link>
                  </p>
                  <p className="mt-1 text-sm text-humo">Tenía {textoEdad(parto.fecha, fechaVista)} de edad · desde el {formatoFecha(enFecha.desde, corta)}{enFecha.hasta ? ` hasta el ${formatoFecha(enFecha.hasta, corta)}` : ""}.</p>
                </>
              ) : (
                <p className="text-[0.9375rem]">No hay un corral o potrero registrado para esa fecha.</p>
              )}
            </div>
            {!animal ? (
              <div className="mt-3">
                <Aviso tipo="info">Esta cría todavía no tiene arete, así que no tiene movimientos propios: se muestra dónde estaba su madre. Cuando le pongas arete (Animal nuevo, con esta madre) se registra su recorrido.</Aviso>
              </div>
            ) : null}
          </Tarjeta>
        ) : null}

        <Tarjeta titulo="Todo lo que le ha pasado">
          <ol className="divide-y divide-arena">
            {linea.map((h) => {
              const cuerpo = (
                <>
                  <span className="block text-sm text-humo">{formatoFecha(h.fecha, corta)} · {textoEdad(parto.fecha, h.fecha)}</span>
                  <span className="block font-semibold [overflow-wrap:anywhere]">{h.titulo}</span>
                  {h.detalle ? <span className="block text-sm text-humo [overflow-wrap:anywhere]">{h.detalle}</span> : null}
                </>
              );
              return (
                <li key={h.clave} className="py-2.5">
                  {h.href ? <Link href={h.href} className="block min-h-11 hover:underline">{cuerpo}</Link> : cuerpo}
                </li>
              );
            })}
          </ol>
        </Tarjeta>
      </div>
    </>
  );
}

function Fila({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-sm text-humo">{etiqueta}</dt>
      <dd className="min-w-0 text-right font-semibold [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}
