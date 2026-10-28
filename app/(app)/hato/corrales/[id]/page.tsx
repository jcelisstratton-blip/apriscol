import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRightLeft, ChevronLeft, Droplets, Pencil } from "lucide-react";
import { AccionesUbicacion } from "@/components/AccionesUbicacion";
import { AvisoGuardado } from "@/components/AvisoGuardado";
import { Aviso } from "@/components/Aviso";
import { clasesBoton } from "@/components/Boton";
import { Encabezado } from "@/components/Encabezado";
import { EstadoVacio } from "@/components/EstadoVacio";
import { Insignia } from "@/components/Insignia";
import { ListaMovimientos } from "@/components/ListaMovimientos";
import { ListaOcupantes, type Ocupante } from "@/components/ListaOcupantes";
import { Tarjeta } from "@/components/Tarjeta";
import { obtenerContexto } from "@/lib/contexto";
import { etiquetaAnimal } from "@/lib/animal";
import { animalesPorIds } from "@/lib/animal-etiquetas";
import { ETIQUETA_ESTADO_UBICACION, ETIQUETA_PISO, ETIQUETA_TIPO_UBICACION, ETIQUETA_USO, PISOS_SECOS, TONO_ESTADO_UBICACION, textoOcupacion, textoRotacion } from "@/lib/corrales";
import { obtenerAjustes } from "@/lib/ajustes-servidor";
import { ETIQUETA_ETAPA, avisosMezcla, contarEtapas } from "@/lib/etapas";
import { cargarEtapas } from "@/lib/etapas-servidor";
import { diasHasta, hoyBogota } from "@/lib/fechas";
import { puedeEscribir, puedeVer } from "@/lib/permisos";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { UbicacionVista } from "@/lib/tipos";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Instalación" };
const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Un corral o potrero: sus datos, quiénes están ahora, cómo va su ocupación o rotación y el historial de animales que han pasado por él. */
export default async function PaginaUbicacion({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ guardado?: string }> }) {
  const { id } = await params;
  if (!ID_UUID.test(id)) notFound();
  const { finca, rol } = await obtenerContexto();
  if (!puedeVer(rol, "corrales", finca.plan)) redirect("/hato");
  const sp = await searchParams;
  const puedeEditar = puedeEscribir(rol, "corrales", finca.plan);
  const supabase = await crearClienteServidor();

  const { data } = await supabase.from("v_ubicaciones").select("*").eq("id", id).eq("finca_id", finca.id).maybeSingle();
  if (!data) notFound();
  const u = data as UbicacionVista;

  const hoy = hoyBogota();
  const { data: abiertos } = await supabase.from("movimientos_animales").select("animal_id, desde").eq("finca_id", finca.id).eq("ubicacion_id", id).is("hasta", null).order("desde").limit(1000);
  const animales = await animalesPorIds(supabase, finca.id, (abiertos ?? []).map((m) => m.animal_id));
  const etiquetas = new Map(animales.map((a) => [a.id, etiquetaAnimal(a)]));
  // Etapa de cada animal (lactante, levante, ceba…) y qué conviene revisar si el corral mezcla etapas.
  const ajustes = await obtenerAjustes();
  const etapas = await cargarEtapas(supabase, finca.id, ajustes, (abiertos ?? []).map((m) => m.animal_id), hoy);
  const textoEtapa = (animalId: string) => {
    const e = etapas.get(animalId);
    if (!e?.etapa) return undefined;
    return [ETIQUETA_ETAPA[e.etapa], e.pesoKg !== null ? `${String(e.pesoKg).replace(".", ",")} kg` : null, e.porcentaje !== null ? `${e.porcentaje} % del peso adulto` : null].filter(Boolean).join(" · ");
  };
  const ocupantes: Ocupante[] = (abiertos ?? []).map((m) => ({
    id: m.animal_id,
    etiqueta: etiquetas.get(m.animal_id) ?? "Animal",
    desde: m.desde,
    dias: Math.max(0, -diasHasta(m.desde, hoy)),
    etapa: textoEtapa(m.animal_id),
  }));
  const dentro = [...etapas.values()];
  const porEtapa = contarEtapas(dentro);
  const mezcla = avisosMezcla(dentro.map((e) => ({ etapa: e.etapa, sexo: e.sexo, pesoKg: e.pesoKg })), u.uso, ajustes.general.corral_razon_peso);

  const { data: todas } = await supabase.from("ubicaciones").select("id, nombre").eq("finca_id", finca.id).limit(500);
  const nombres: Record<string, string> = Object.fromEntries((todas ?? []).map((x) => [x.id, x.nombre]));

  const corral = u.tipo === "corral";
  const m2 = u.area_m2 && u.ocupantes > 0 ? u.area_m2 / u.ocupantes : null;
  const filas: { titulo: string; valor: React.ReactNode }[] = [
    { titulo: "Tipo", valor: `${ETIQUETA_TIPO_UBICACION[u.tipo]} · ${ETIQUETA_USO[u.uso]}` },
    { titulo: "Capacidad", valor: u.capacidad ? `${u.capacidad} animales` : "Sin definir" },
    ...(u.area_m2 ? [{ titulo: "Área", valor: `${String(u.area_m2).replace(".", ",")} m²` }] : []),
    ...(m2 ? [{ titulo: "Espacio por animal", valor: `${m2.toFixed(1).replace(".", ",")} m²` }] : []),
    ...(corral && u.piso ? [{ titulo: "Piso", valor: `${ETIQUETA_PISO[u.piso]}${PISOS_SECOS.includes(u.piso) ? "" : " (retiene humedad)"}` }] : []),
    ...(corral ? [{ titulo: "Agua permanente", valor: u.agua ? "Sí" : "No" }] : []),
    ...(!corral ? [{ titulo: "Ocupación máxima", valor: `${u.dias_ocupacion_max} días` }, { titulo: "Descanso mínimo", valor: `${u.dias_descanso_min} días` }] : []),
  ];

  return (
    <>
      <AvisoGuardado activo={sp.guardado === "1"} />
      <Link href="/hato?vista=corrales" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> Corrales
      </Link>
      <Encabezado
        titulo={u.nombre}
        subtitulo={`${ETIQUETA_TIPO_UBICACION[u.tipo]} · ${finca.nombre}`}
        acciones={
          puedeEditar ? (
            <Link href={`/hato/corrales/${u.id}/editar`} className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-musgo ring-1 ring-arena">
              <Pencil className="size-4" strokeWidth={2} aria-hidden="true" /> Editar
            </Link>
          ) : null
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
        <div className="min-w-0 space-y-4">
          <Tarjeta titulo="Ahora">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className={`font-display text-3xl font-semibold tabular-nums ${u.hacinada ? "text-rojo" : ""}`}>{textoOcupacion(u.ocupantes, u.capacidad)}</p>
                <p className="text-sm text-humo">animales</p>
              </div>
              <div className="flex min-w-0 flex-wrap justify-end gap-1.5">
                {!u.activa ? <Insignia tono="neutro">Archivada</Insignia> : null}
                {u.hacinada ? <Insignia tono="alerta">Hacinada: {u.ocupantes - (u.capacidad ?? 0)} de más</Insignia> : null}
                {!corral || u.estado !== "ocupado" ? <Insignia tono={TONO_ESTADO_UBICACION[u.estado]}>{ETIQUETA_ESTADO_UBICACION[u.estado]}</Insignia> : null}
              </div>
            </div>
            {!corral && textoRotacion(u) ? <p className="mt-2 text-[0.9375rem] text-humo">{textoRotacion(u)}</p> : null}
            {u.hacinada ? (
              <div className="mt-3">
                <Aviso tipo="atencion">
                  Tiene {u.ocupantes} animales y le caben {u.capacidad}. El hacinamiento sube el estrés, las peleas y las enfermedades: pasa {u.ocupantes - (u.capacidad ?? 0)} a otra instalación.
                </Aviso>
              </div>
            ) : null}
            {corral && !u.agua ? (
              <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-rojo">
                <Droplets className="size-4" strokeWidth={1.75} aria-hidden="true" /> Sin agua permanente
              </p>
            ) : null}
            {puedeEditar && u.activa ? (
              <div className="mt-3 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
                {u.capacidad && u.ocupantes >= u.capacidad ? (
                  <Aviso tipo="info">Está llena: no caben más animales. Saca a algunos o sube la capacidad si el espacio lo permite.</Aviso>
                ) : (
                  <Link href={`/hato/corrales/mover?destino=${u.id}`} className={clasesBoton("primario")}>
                    <ArrowRightLeft className="size-5" strokeWidth={2} aria-hidden="true" /> Mover animales aquí
                  </Link>
                )}
                {u.ocupantes > 0 ? (
                  <Link href={`/hato/corrales/mover?de=${u.id}`} className={clasesBoton("secundario")}>
                    {corral ? "Mover el lote" : "Rotar el lote"}
                  </Link>
                ) : null}
              </div>
            ) : null}
          </Tarjeta>

          <Tarjeta titulo="Datos">
            <dl className="divide-y divide-arena">
              {filas.map((f) => (
                <div key={f.titulo} className="flex items-baseline justify-between gap-3 py-2.5">
                  <dt className="shrink-0 text-sm text-humo">{f.titulo}</dt>
                  <dd className="min-w-0 text-right font-semibold [overflow-wrap:anywhere]">{f.valor}</dd>
                </div>
              ))}
            </dl>
            {u.observaciones ? <p className="mt-2 border-t border-arena pt-2 text-[0.9375rem] text-humo [overflow-wrap:anywhere]">{u.observaciones}</p> : null}
          </Tarjeta>

          {puedeEditar ? (
            <Tarjeta titulo="Archivar o eliminar">
              <AccionesUbicacion id={u.id} nombre={u.nombre} activa={u.activa} puedeEliminar />
            </Tarjeta>
          ) : null}
        </div>

        <div className="min-w-0 space-y-4">
          {porEtapa.length > 0 ? (
            <Tarjeta titulo="Etapas en este corral">
              <div className="flex flex-wrap gap-1.5">
                {porEtapa.map((x) => (
                  <Insignia key={x.etapa} tono="neutro">{x.n} {ETIQUETA_ETAPA[x.etapa].toLowerCase()}</Insignia>
                ))}
              </div>
              {mezcla.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {mezcla.map((a) => (
                    <Aviso key={a.clave} tipo="atencion">{a.texto}</Aviso>
                  ))}
                </div>
              ) : null}
            </Tarjeta>
          ) : null}
          <Tarjeta titulo={`Quiénes están (${ocupantes.length})`}>
            {ocupantes.length === 0 ? (
              <EstadoVacio icono={<ArrowRightLeft strokeWidth={1.5} />} titulo="Sin animales ahora" descripcion="Cuando muevas animales aquí, los verás en esta lista con los días que llevan." />
            ) : (
              <ListaOcupantes ocupantes={ocupantes} />
            )}
          </Tarjeta>
          <Tarjeta titulo="Historial">
            <ListaMovimientos fincaId={finca.id} ubicaciones={nombres} ubicacionId={u.id} puedeEditar={puedeEditar} />
          </Tarjeta>
        </div>
      </div>
    </>
  );
}
