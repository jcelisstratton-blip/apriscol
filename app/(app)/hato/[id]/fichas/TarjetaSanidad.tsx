import Link from "next/link";
import { Plus } from "lucide-react";
import { Insignia } from "@/components/Insignia";
import { Tarjeta } from "@/components/Tarjeta";
import { puedeEscribir, puedeVer } from "@/lib/permisos";
import { clasesBoton } from "@/components/Boton";
import { formatoFecha, hoyBogota } from "@/lib/fechas";
import { HistorialSanidadAnimal } from "@/components/HistorialSanidadAnimal";
import { aplicaFamacha, estadoFamacha, FAMACHA } from "@/lib/famacha";
import { estadoDosis, estadoFechaPrograma, ETIQUETA_EVENTO, nombreEvento } from "@/lib/sanidad";
import type { CtxFicha } from "./contexto";

/** Vacunas, tratamientos, pruebas y FAMACHA del animal, y lo que está programado. */
export async function TarjetaSanidad({ c }: { c: CtxFicha }) {
  const { id, animal, finca, rol, supabase } = c;
  const verSanidad = puedeVer(rol, "sanidad", finca.plan);
  const [eventosSan, pruebasSan, pendientesSan] = verSanidad
    ? await Promise.all([
        supabase.from("v_eventos_animal").select("*").eq("animal_id", id).order("fecha", { ascending: false }).limit(100),
        supabase.from("pruebas_sanitarias").select("id, fecha, prueba, resultado, laboratorio").eq("animal_id", id).eq("finca_id", finca.id).order("fecha", { ascending: false }).limit(50),
        supabase.from("v_sanidad_pendiente").select("evento_id, tipo, producto_nombre, proxima_fecha").eq("animal_id", id).order("proxima_fecha"),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];
  const aplicaEvaluarFamacha = aplicaFamacha(animal, hoyBogota());
  const [famachaSan, famachaActual] = verSanidad
    ? await Promise.all([
        supabase.from("evaluaciones_famacha").select("id, fecha, puntaje, observaciones").eq("animal_id", id).eq("finca_id", finca.id).order("fecha", { ascending: false }).limit(50),
        supabase.from("v_famacha_animal").select("*").eq("animal_id", id).maybeSingle(),
      ])
    : [{ data: [] }, { data: null }];
  const estadoFama = famachaActual.data ? estadoFamacha(famachaActual.data) : null;
  const pendientesProg = verSanidad ? ((await supabase.from("programa_sanitario_animales").select("programa_id").eq("animal_id", id).eq("finca_id", finca.id).is("evento_id", null).limit(50)).data ?? []) : [];
  const programasAnimal = pendientesProg.length > 0
    ? ((await supabase.from("v_programas_sanitarios").select("*").in("id", pendientesProg.map((p) => p.programa_id)).eq("finca_id", finca.id).neq("estado", "cancelado").order("fecha_programada")).data ?? [])
    : [];
  const historialEventos = (eventosSan.data ?? []).map((e) => ({
    clave: `e-${e.id}`,
    fecha: e.fecha ?? "",
    tipo: e.tipo,
    producto_nombre: e.producto_nombre,
    evento_id: e.id ?? "",
    retiro_leche_hasta: e.fin_retiro_leche && (e.retiro_leche_dias ?? 0) > 0 && e.fin_retiro_leche >= hoyBogota() ? e.fin_retiro_leche : null,
    retiro_carne_hasta: e.fin_retiro_carne && (e.retiro_carne_dias ?? 0) > 0 && e.fin_retiro_carne >= hoyBogota() ? e.fin_retiro_carne : null,
  }));
  const historialPruebas = (pruebasSan.data ?? []).map((p) => ({ clave: `p-${p.id}`, id: p.id, fecha: p.fecha, prueba: p.prueba, resultado: p.resultado, laboratorio: p.laboratorio }));
  const historialFamacha = (famachaSan.data ?? []).map((f) => ({ clave: `f-${f.id}`, id: f.id, fecha: f.fecha, puntaje: f.puntaje, observaciones: f.observaciones }));
  const dosisPendientes = pendientesSan.data ?? [];
  if (!(verSanidad && (animal.estado === "activo" || historialEventos.length > 0 || historialPruebas.length > 0 || historialFamacha.length > 0))) return null;

  return (
    <Tarjeta titulo="Sanidad" id="sanidad">
      {estadoFama && famachaActual.data ? (
        <div className="mb-3 rounded-2xl bg-lana px-3 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="min-w-0 text-[0.9375rem]">
              <span className="font-semibold">FAMACHA {famachaActual.data.puntaje}</span>
              <span className="block text-sm text-humo">
                {FAMACHA[famachaActual.data.puntaje].color} · {formatoFecha(famachaActual.data.ultima_fecha, { day: "numeric", month: "short", year: "numeric" })}
              </span>
            </span>
            <Insignia tono={estadoFama.tono}>{estadoFama.texto}</Insignia>
          </div>
          {estadoFama.clave === "desparasitar" || estadoFama.clave === "vigilar" ? <p className="mt-1.5 text-sm text-humo">{FAMACHA[famachaActual.data.puntaje].accion}</p> : null}
          {estadoFama.clave === "desparasitar" && puedeEscribir(rol, "sanidad", finca.plan) && animal.estado === "activo" ? (
            <Link href={`/hato/sanidad/nuevo?animal=${id}&tipo=desparasitacion`} className="mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-musgo underline-offset-4 hover:underline">
              Registrar la desparasitación
            </Link>
          ) : null}
        </div>
      ) : null}
      {dosisPendientes.length > 0 ? (
        <ul className="mb-3 space-y-2">
          {dosisPendientes.map((d) => {
            const e = estadoDosis(d.proxima_fecha ?? hoyBogota(), hoyBogota());
            return (
              <li key={d.evento_id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-lana px-3 py-2.5">
                <span className="min-w-0 text-[0.9375rem]">
                  <span className="font-semibold [overflow-wrap:anywhere]">{nombreEvento({ tipo: d.tipo, producto_nombre: d.producto_nombre })}</span>
                  <span className="block text-sm text-humo">Próxima dosis · {formatoFecha(d.proxima_fecha, { day: "numeric", month: "short" })}</span>
                </span>
                <Insignia tono={e.tono}>{e.texto}</Insignia>
              </li>
            );
          })}
        </ul>
      ) : null}
      {programasAnimal.length > 0 ? (
        <ul className="mb-3 space-y-2">
          {programasAnimal.map((p) => {
            const e = estadoFechaPrograma(p.fecha_programada, hoyBogota());
            return (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-lana px-3 py-2.5">
                <span className="min-w-0 text-[0.9375rem]">
                  <span className="font-semibold [overflow-wrap:anywhere]">{p.producto_nombre?.trim() || ETIQUETA_EVENTO[p.tipo]}</span>
                  <span className="block text-sm text-humo">Programada · {formatoFecha(p.fecha_programada, { day: "numeric", month: "short" })}</span>
                </span>
                <span className="flex items-center gap-2">
                  <Insignia tono={e.tono}>{e.texto}</Insignia>
                  {puedeEscribir(rol, "sanidad", finca.plan) && animal.estado === "activo" ? (
                    <Link href={`/hato/sanidad/nuevo?programa=${p.id}&animal=${id}`} className="inline-flex min-h-11 items-center rounded-full bg-musgo px-4 text-sm font-semibold text-sobre-musgo">
                      Aplicar
                    </Link>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
      {historialEventos.length === 0 && historialPruebas.length === 0 && historialFamacha.length === 0 ? (
        <p className="text-[0.9375rem] text-humo">Todavía no tiene vacunas, tratamientos ni pruebas registrados.</p>
      ) : (
        <HistorialSanidadAnimal eventos={historialEventos} pruebas={historialPruebas} famacha={historialFamacha} puedeEditar={puedeEscribir(rol, "sanidad", finca.plan)} />
      )}
      {puedeEscribir(rol, "sanidad", finca.plan) && animal.estado === "activo" ? (
        <div className="mt-3 space-y-3">
          <div>
            <Link href={`/hato/sanidad/nuevo?animal=${id}`} className={clasesBoton("primario")}>
              <Plus className="size-5" strokeWidth={2.2} aria-hidden="true" /> Registrar lo aplicado
            </Link>
            <p className="mt-1.5 text-[0.8125rem] text-humo">Vacuna, desparasitación, tratamiento, podología, pediluvio o cirugía: eliges cuál en el siguiente paso.</p>
          </div>
          <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
            <Link href={`/hato/sanidad/programar?animal=${id}`} className={clasesBoton("secundario")}>
              Programar una aplicación
            </Link>
            <Link href={`/sanidad/pruebas/nueva?animal=${id}`} className={clasesBoton("secundario")}>
              Prueba diagnóstica
            </Link>
            {aplicaEvaluarFamacha ? (
              <Link href={`/hato/sanidad/famacha/nueva?animal=${id}`} className={clasesBoton("secundario")}>
                Evaluación FAMACHA
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </Tarjeta>
  );
}
