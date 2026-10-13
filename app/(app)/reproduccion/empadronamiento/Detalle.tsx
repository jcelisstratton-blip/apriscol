import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Pencil } from "lucide-react";
import { AsignarHembrasEmp } from "@/components/AsignarHembrasEmp";
import { CerrarEmpadronamiento } from "@/components/CerrarEmpadronamiento";
import { Encabezado } from "@/components/Encabezado";
import { Insignia } from "@/components/Insignia";
import { ListaHembrasEmp, type FilaHembraEmp } from "@/components/ListaHembrasEmp";
import { Tarjeta } from "@/components/Tarjeta";
import { AgregarSemental, CambiarNumeroHembras, EditarSementalExterno, QuitarDeEmp } from "@/components/AccionesEmpadronamiento";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir, puedeGestionar } from "@/lib/permisos";
import { animalesPorIds } from "@/lib/animal-etiquetas";
import { etiquetaAnimal } from "@/lib/animal";
import { avanceEmp, capacidadSemental, ETIQUETA_CAPACIDAD, mesesDesde, textoCC } from "@/lib/empadronamiento";
import { porcentaje } from "@/lib/endogamia";
import { formatoFecha, hoyBogota } from "@/lib/fechas";
import { datosDesdeExterno, diasPrestamo, estadoPrestamo, etiquetaExterno } from "@/lib/semental-externo";
import type { PlanId, Raza, ReproHembra, RolFinca, SementalExterno } from "@/lib/tipos";


/** Los datos de un semental de otro hato: de dónde viene, a quién se le devuelve y cuánto dura el préstamo. */
function DatosPrestamo({ e, hoy, editable, loteId, finTemporada, etiqueta, razas }: { e: SementalExterno; hoy: string; editable: boolean; loteId: string; finTemporada: string; etiqueta: string; razas: Raza[] }) {
  const p = estadoPrestamo(e.prestamo_hasta, hoy);
  const dias = diasPrestamo(e.prestamo_desde, e.prestamo_hasta);
  const fila = (k: string, v: React.ReactNode) => (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <dt className="shrink-0 text-sm text-humo">{k}</dt>
      <dd className="min-w-0 text-right text-[0.9375rem] [overflow-wrap:anywhere]">{v}</dd>
    </div>
  );
  return (
    <div className="mt-2 rounded-xl bg-lana px-3 py-2">
      <dl className="divide-y divide-arena">
        {fila("Hato", <strong>{e.hato_origen}</strong>)}
        {e.propietario ? fila("Propietario", e.propietario) : null}
        {e.telefono ? fila("Teléfono", <a href={`tel:${e.telefono.replace(/[^\d+]/g, "")}`} className="font-semibold text-musgo underline-offset-4 hover:underline">{e.telefono}</a>) : null}
        {fila("Raza", razas.find((r) => r.id === e.raza_id)?.nombre ?? "—")}
        {fila("Préstamo", `${formatoFecha(e.prestamo_desde, { day: "numeric", month: "short" })} al ${formatoFecha(e.prestamo_hasta, { day: "numeric", month: "short", year: "numeric" })} (${dias} ${dias === 1 ? "día" : "días"})`)}
        {fila("Devolución", p.vencido ? <Insignia tono="aviso">Ya pasó la fecha</Insignia> : <Insignia tono="musgo">{p.faltan === 0 ? "Hoy" : `En ${p.faltan} ${p.faltan === 1 ? "día" : "días"}`}</Insignia>)}
        {e.sanidad ? fila("Sanidad", e.sanidad) : null}
        {e.condiciones ? fila("Condiciones", e.condiciones) : null}
      </dl>
      {editable ? <EditarSementalExterno loteId={loteId} machoId={e.id} etiqueta={etiqueta} datos={datosDesdeExterno(e)} finTemporada={finTemporada} especie={e.especie} razas={razas} /> : null}
    </div>
  );
}

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-sm text-humo">{etiqueta}</dt>
      <dd className="min-w-0 text-right font-semibold [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

/** Una temporada de monta: sus fechas y criterios, los sementales, las hembras de cada uno y el cierre que las pasa a gestación. */
export async function Detalle({
  id,
  finca,
  rol,
  cliente,
}: {
  id: string;
  finca: { id: string; nombre: string; umbral_endogamia: number; plan: PlanId };
  rol: RolFinca;
  /** Solo para pruebas: un cliente de base de datos en lugar del de la sesión. */
  cliente?: Awaited<ReturnType<typeof crearClienteServidor>>;
}) {
  const supabase = cliente ?? (await crearClienteServidor());

  const { data: lote } = await supabase.from("v_empadronamientos").select("*").eq("id", id).eq("finca_id", finca.id).maybeSingle();
  if (!lote) notFound();

  const [machosDB, hembrasDB, paramDB] = await Promise.all([
    supabase.from("empadronamiento_machos").select("macho_id, num_hembras, externo").eq("empadronamiento_id", id).eq("finca_id", finca.id).order("created_at"),
    supabase.from("empadronamiento_hembras").select("*").eq("empadronamiento_id", id).eq("finca_id", finca.id).order("created_at").limit(2000),
    supabase.from("parametros_especie").select("gestacion_dias").eq("especie", lote.especie).maybeSingle(),
  ]);
  const numeros = new Map((machosDB.data ?? []).map((m) => [m.macho_id, m.num_hembras]));
  const machoIds = (machosDB.data ?? []).map((m) => m.macho_id);
  // Los sementales de otro hato (prestados) no están en `animales`: sus datos vienen de `sementales_externos`.
  const externoIds = (machosDB.data ?? []).filter((m) => m.externo).map((m) => m.macho_id);
  const propiosIds = machoIds.filter((m) => !externoIds.includes(m));
  const hembras = hembrasDB.data ?? [];
  const edades = propiosIds.length > 0 ? ((await supabase.from("animales").select("id, fecha_nacimiento").in("id", propiosIds).eq("finca_id", finca.id)).data ?? []) : [];
  const externos = new Map(
    (externoIds.length > 0 ? ((await supabase.from("sementales_externos").select("*").in("id", externoIds).eq("finca_id", finca.id)).data ?? []) : []).map((e) => [e.id, e]),
  );
  const razas = (await supabase.from("razas").select("*").eq("especie", lote.especie).order("nombre")).data ?? [];
  const nombres = new Map((await animalesPorIds(supabase, finca.id, [...propiosIds, ...hembras.map((h) => h.hembra_id)])).map((a) => [a.id, etiquetaAnimal(a)]));
  for (const e of externos.values()) nombres.set(e.id, etiquetaExterno(e));
  const etiqueta = (x: string) => nombres.get(x) ?? "Animal";

  // Cerrada: cómo quedó cada hembra (servida, gestante…) y cuándo se espera su parto.
  const repro = new Map<string, ReproHembra>();
  if (lote.cerrado_en && hembras.length > 0) {
    for (let i = 0; i < hembras.length; i += 100) {
      const { data } = await supabase.from("v_repro_hembras").select("*").in("animal_id", hembras.slice(i, i + 100).map((h) => h.hembra_id));
      for (const r of (data ?? []) as ReproHembra[]) repro.set(r.animal_id, r);
    }
  }

  const hoy = hoyBogota();
  const abierto = !lote.cerrado_en;
  const a = avanceEmp(lote, hoy);
  const puedeEditar = puedeEscribir(rol, "reproduccion", finca.plan);
  const porMacho = new Map<string, number>();
  for (const h of hembras) porMacho.set(h.macho_id, (porMacho.get(h.macho_id) ?? 0) + 1);
  const machos = machoIds.map((m) => {
    const ext = externos.get(m) ?? null;
    const nacimiento = ext ? ext.fecha_nacimiento : (edades.find((e) => e.id === m)?.fecha_nacimiento ?? null);
    const fijado = numeros.get(m) ?? null;
    const cap = capacidadSemental(lote.especie, mesesDesde(nacimiento, hoy), fijado);
    return { id: m, etiqueta: etiqueta(m), asignadas: porMacho.get(m) ?? 0, capacidad: cap.max, origen: cap.origen, limite: fijado, nacimiento, externo: ext != null, datosExt: ext };
  });
  const filas: FilaHembraEmp[] = hembras.map((h) => ({
    hembraId: h.hembra_id,
    etiqueta: etiqueta(h.hembra_id),
    machoId: h.macho_id,
    machoEtiqueta: etiqueta(h.macho_id),
    endogamia: Number(h.endogamia),
    machoExterno: externos.has(h.macho_id),
    excepcion: h.excepcion,
    estado: repro.get(h.hembra_id)?.estado ?? null,
    prevista: repro.get(h.hembra_id)?.fecha_prevista_parto ?? null,
  }));

  return (
    <>
      <Link href={abierto ? "/hato?vista=empadronamiento" : "/reproduccion?vista=empadronamiento"} className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> {abierto ? "Hato" : "Reproducción"}
      </Link>
      <Encabezado titulo={lote.nombre} subtitulo={`${lote.especie === "caprino" ? "Cabras" : "Ovejas"} · ${finca.nombre}`} />

      <div className="space-y-3.5 lg:max-w-3xl">
        <div className="flex flex-wrap items-center gap-2">
          {abierto ? <Insignia tono="musgo">Abierta</Insignia> : <Insignia>Cerrada</Insignia>}
          {abierto ? (
            a.atrasado ? <Insignia tono="aviso">Pasó la fecha prevista de cierre hace {-a.faltan} {-a.faltan === 1 ? "día" : "días"}</Insignia> : <Insignia tono="ok">{a.faltan === 0 ? "Cierra hoy" : `Faltan ${a.faltan} días`}</Insignia>
          ) : null}
          {lote.excepciones > 0 ? <Insignia tono="alerta">{lote.excepciones} {lote.excepciones === 1 ? "excepción" : "excepciones"} de endogamia</Insignia> : null}
        </div>

        <Tarjeta titulo="La temporada">
          {abierto ? (
            <div className="mb-3">
              <div className="h-2 overflow-hidden rounded-full bg-arena" role="progressbar" aria-valuenow={a.pct} aria-valuemin={0} aria-valuemax={100} aria-label="Avance de la temporada">
                <div className="h-full rounded-full bg-musgo" style={{ width: `${a.pct}%` }} />
              </div>
              <p className="mt-1 text-xs text-humo">Día {Math.min(a.corridos, a.total)} de {a.total}</p>
            </div>
          ) : null}
          <dl className="divide-y divide-arena">
            <Dato etiqueta="Empezó">{formatoFecha(lote.fecha_inicio)}</Dato>
            {lote.cerrado_en ? <Dato etiqueta="Cerró">{formatoFecha(lote.cerrado_en)}</Dato> : <Dato etiqueta="Cierre previsto">{formatoFecha(lote.fecha_fin_prevista)}</Dato>}
            {lote.fecha_base ? <Dato etiqueta="Gestación contada desde">{formatoFecha(lote.fecha_base)} ({paramDB.data?.gestacion_dias ?? 150} días)</Dato> : null}
            <Dato etiqueta="Criterios de las hembras">
              {lote.edad_min_meses}+ meses · {String(lote.peso_min_kg).replace(".", ",")}+ kg · CC {textoCC(lote.cc_min)}+
            </Dato>
          </dl>
          {lote.observaciones ? <p className="mt-3 whitespace-pre-wrap text-[0.9375rem] [overflow-wrap:anywhere]">{lote.observaciones}</p> : null}
          {puedeEditar ? (
            <Link href={`/reproduccion/empadronamiento/${id}/editar`} className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-[0.9375rem] font-semibold text-musgo underline-offset-4 hover:underline">
              <Pencil className="size-4" strokeWidth={2} aria-hidden="true" /> {abierto ? "Editar la temporada" : "Corregir observaciones"}
            </Link>
          ) : null}
        </Tarjeta>

        <Tarjeta titulo={`Sementales (${machos.length})`}>
          {machos.length === 0 ? (
            <p className="text-[0.9375rem] text-humo">Esta temporada no tiene sementales.</p>
          ) : (
            <ul className="divide-y divide-arena">
              {machos.map((m) => (
                <li key={m.id} className="py-1">
                  <div className="flex items-center gap-2">
                    {m.datosExt ? (
                      <div className="min-w-0 flex-1 py-2">
                        <span className="block font-semibold [overflow-wrap:anywhere]">{m.etiqueta}</span>
                        <span className="mt-0.5 inline-block"><Insignia>De otro hato</Insignia></span>
                      </div>
                    ) : (
                      <Link href={`/hato/${m.id}`} className="min-w-0 flex-1 py-2">
                        <span className="block font-semibold [overflow-wrap:anywhere]">{m.etiqueta}</span>
                      </Link>
                    )}
                    {abierto && puedeEditar ? <CambiarNumeroHembras loteId={id} machoId={m.id} etiqueta={m.etiqueta} especie={lote.especie} nacimiento={m.nacimiento} actual={m.limite} asignadas={m.asignadas} /> : null}
                    {abierto && puedeGestionar(rol) ? <QuitarDeEmp loteId={id} animalId={m.id} tipo="semental" nombre={m.etiqueta} /> : null}
                  </div>
                  <span className="block text-sm text-humo">
                    {m.limite != null ? `${m.asignadas} de ${m.limite} ${m.limite === 1 ? "hembra" : "hembras"}` : `${m.asignadas} de ${m.capacidad} hembras recomendadas (${ETIQUETA_CAPACIDAD[m.origen]})`}
                  </span>
                  {abierto && m.limite != null && m.asignadas < m.limite ? (
                    <span className="mt-1 inline-block"><Insignia tono="aviso">Faltan {m.limite - m.asignadas} {m.limite - m.asignadas === 1 ? "hembra" : "hembras"}</Insignia></span>
                  ) : null}
                  {m.limite == null && m.asignadas > m.capacidad ? <span className="mt-1 inline-block"><Insignia tono="aviso">Pasa de lo recomendado</Insignia></span> : null}
                  {m.datosExt ? <DatosPrestamo razas={razas} e={m.datosExt} hoy={hoy} editable={abierto && puedeEditar} loteId={id} finTemporada={lote.fecha_fin_prevista} etiqueta={m.etiqueta} /> : null}
                </li>
              ))}
            </ul>
          )}
          {abierto && puedeEditar ? (
            <div className="mt-2">
              <AgregarSemental fincaId={finca.id} loteId={id} especie={lote.especie} inicio={lote.fecha_inicio} fin={lote.fecha_fin_prevista} razas={razas} />
            </div>
          ) : null}
        </Tarjeta>

        <Tarjeta titulo={`Hembras (${hembras.length})`}>
          <div className="space-y-3">
            {abierto && puedeEditar ? <AsignarHembrasEmp loteId={id} machos={machos} umbral={finca.umbral_endogamia} /> : null}
            <ListaHembrasEmp loteId={id} filas={filas} machos={machos} umbral={finca.umbral_endogamia} abierto={abierto} puedeQuitar={puedeGestionar(rol)} hoy={hoy} />
            {lote.cerrado_en && hembras.length > 0 ? (
              <p className="text-sm text-humo">
                Al cerrar, cada hembra quedó servida por su semental (monta natural) con su fecha prevista de parto. Para corregir un servicio o confirmar la gestación, entra a la ficha de la hembra.
                {hembras.some((h) => !externos.has(h.macho_id)) ? `Endogamia máxima de las parejas del hato: ${porcentaje(Math.max(...hembras.filter((h) => !externos.has(h.macho_id)).map((h) => Number(h.endogamia))))}.` : null}
              </p>
            ) : null}
          </div>
        </Tarjeta>

        {abierto && puedeEditar ? (
          <CerrarEmpadronamiento loteId={id} inicio={lote.fecha_inicio} hoy={hoy} hembras={hembras.length} gestacionDias={paramDB.data?.gestacion_dias ?? 150} especie={lote.especie} />
        ) : null}
      </div>
    </>
  );
}
