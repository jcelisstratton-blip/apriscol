"use client";

import { useRef, useState, useTransition } from "react";
import { ArrowRight, Download, FileSpreadsheet, RefreshCw, Undo2 } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Boton, EnlaceBoton } from "@/components/Boton";
import { Cargando } from "@/components/Cargando";
import { ListaEscalable } from "@/components/ListaEscalable";
import { Selector } from "@/components/Selector";
import { Sheet } from "@/components/Sheet";
import { Tarjeta } from "@/components/Tarjeta";
import { useToast } from "@/components/Toast";
import { analizarHistoria, guardarHistoria, revisarHistoria, type AnalisisHistoria, type ResultadoHistoria, type RevisionHistoria } from "@/app/(app)/hato/importar/historia/actions";
import { deshacerImportacion, type ResultadoDeshacer } from "@/app/(app)/hato/importar/actions";
import type { ErrorFila } from "@/lib/importar-animales";
import { CAMPOS_HISTORIA, MAX_FILAS_HISTORIA, type TipoHistoria } from "@/lib/importar-historia";

type Revision = Exclude<RevisionHistoria, { error: string }>;
type Analisis = Exclude<AnalisisHistoria, { error: string }>;
type Guardado = Exclude<ResultadoHistoria, { error: string }>;

const fechaCorta = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "");
const numero = (n: number) => n.toLocaleString("es-CO", { maximumFractionDigits: 1 });

const TEXTOS: Record<TipoHistoria, { titulo: string; ejemplo: string; unidad: string; registros: string; promedio: string }> = {
  pesajes: { titulo: "pesajes", ejemplo: "Una fila por pesaje, con el arete, la fecha y el peso en kilos.", unidad: "kg", registros: "pesos", promedio: "Peso promedio" },
  ordenos: { titulo: "ordeños", ejemplo: "Una fila por ordeño, con el arete, la fecha y los litros. Si ordeñas dos veces al día, pon la jornada (Mañana/Tarde).", unidad: "L", registros: "ordeños", promedio: "Litros en total" },
  sanidad: { titulo: "eventos de sanidad", ejemplo: "Una fila por animal y evento, con el arete, la fecha y el tipo (Vacunación, Desparasitación, Tratamiento…). Si das lo mismo a varios animales el mismo día, quedan juntos en un solo evento. El producto va como nombre: no toca el inventario.", unidad: "", registros: "registros de sanidad", promedio: "Eventos" },
};

type Acciones = {
  analizar: (f: FormData) => Promise<AnalisisHistoria>;
  revisar: (f: FormData) => Promise<RevisionHistoria>;
  guardar: (f: FormData) => Promise<ResultadoHistoria>;
  deshacer: (id: string) => Promise<ResultadoDeshacer>;
};

function FilaError({ e }: { e: ErrorFila }) {
  return (
    <div className="min-w-0 rounded-2xl bg-papel p-3 ring-1 ring-arena">
      <p className="text-sm font-bold [overflow-wrap:anywhere]">
        Fila {e.fila}
        {e.arete ? <span className="font-normal text-humo"> · arete {e.arete}</span> : null}
      </p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-rojo">
        {e.mensajes.map((m) => (
          <li key={m} className="[overflow-wrap:anywhere]">
            {m}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Carga de historia (pesajes u ordeños) desde el Excel de la persona: archivo → columnas → revisión → listo, con «Deshacer». */
export function ImportarHistoria({
  tipo,
  rutaVolver,
  rutaPlantilla,
  puedeDeshacer,
  acciones = { analizar: analizarHistoria, revisar: revisarHistoria, guardar: guardarHistoria, deshacer: deshacerImportacion },
}: {
  tipo: TipoHistoria;
  rutaVolver: string;
  /** Plantilla opcional de este cargue (con listas y explicaciones). */
  rutaPlantilla: string;
  puedeDeshacer: boolean;
  acciones?: Acciones;
}) {
  const t = TEXTOS[tipo];
  const entrada = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [analisis, setAnalisis] = useState<Analisis | null>(null);
  const [mapeo, setMapeo] = useState<Record<number, string>>({});
  const [revision, setRevision] = useState<Revision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState<Guardado | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [deshecho, setDeshecho] = useState(false);
  const [analizando, iniciarAnalisis] = useTransition();
  const [revisando, iniciarRevision] = useTransition();
  const [guardando, iniciarGuardado] = useTransition();
  const [deshaciendo, iniciarDeshacer] = useTransition();
  const toast = useToast();

  const campos = CAMPOS_HISTORIA[tipo];
  const opciones = campos.map((c) => ({ valor: c.id, etiqueta: c.titulo }));
  const faltan = campos.filter((c) => c.requerido && !Object.values(mapeo).includes(c.id));

  const reiniciar = () => {
    setArchivo(null);
    setAnalisis(null);
    setMapeo({});
    setRevision(null);
    setError(null);
    setGuardado(null);
    setDeshecho(false);
  };

  const analizar = (f: File, hoja?: string) => {
    setError(null);
    setRevision(null);
    const form = new FormData();
    form.set("archivo", f);
    form.set("tipo", tipo);
    if (hoja) form.set("hoja", hoja);
    iniciarAnalisis(async () => {
      try {
        const r = await acciones.analizar(form);
        if ("error" in r) {
          setAnalisis(null);
          setError(r.error);
          return;
        }
        setAnalisis(r);
        setMapeo(Object.fromEntries(r.columnas.map((c) => [c.indice, c.campo])));
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo leer el archivo.");
      }
    });
  };

  const elegir = (f: File | undefined) => {
    if (!f) return;
    reiniciar();
    setArchivo(f);
    analizar(f);
    if (entrada.current) entrada.current.value = "";
  };

  const cambiarCampo = (indice: number, campo: string) => {
    setRevision(null);
    setMapeo((m) => {
      const s = { ...m };
      if (campo) for (const k of Object.keys(s)) if (s[+k] === campo) s[+k] = "";
      s[indice] = campo;
      return s;
    });
  };

  const formularioDe = () => {
    const form = new FormData();
    form.set("archivo", archivo!);
    form.set("tipo", tipo);
    form.set("hoja", analisis!.hoja);
    form.set("filaEncabezado", String(analisis!.filaEncabezado));
    form.set("mapeo", JSON.stringify(Object.entries(mapeo).filter(([, c]) => c).map(([i, c]) => ({ indice: Number(i), campo: c }))));
    return form;
  };

  const revisar = () => {
    if (!archivo || !analisis) return;
    setError(null);
    setRevision(null);
    iniciarRevision(async () => {
      try {
        const r = await acciones.revisar(formularioDe());
        if ("error" in r) setError(r.error);
        else setRevision(r);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo revisar el archivo.");
      }
    });
  };

  const guardar = () => {
    if (!archivo || !analisis) return;
    setError(null);
    iniciarGuardado(async () => {
      try {
        const r = await acciones.guardar(formularioDe());
        if ("error" in r) {
          setError(r.error);
          return;
        }
        setGuardado(r);
        toast.exito(`${r.creados} ${t.registros} cargados`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo guardar.");
      }
    });
  };

  const deshacer = () => {
    if (!guardado) return;
    iniciarDeshacer(async () => {
      try {
        const r = await acciones.deshacer(guardado.importacion);
        setConfirmando(false);
        if ("error" in r) {
          setError(r.error);
          return;
        }
        setDeshecho(true);
        toast.exito("Cargue deshecho");
      } catch (e) {
        setConfirmando(false);
        setError(e instanceof Error ? e.message : "No se pudo deshacer el cargue.");
      }
    });
  };

  if (guardado) {
    return (
      <Tarjeta>
        <div className="space-y-4">
          {deshecho ? (
            <Aviso tipo="info">Cargue deshecho: se quitaron {guardado.creados} {t.registros}.</Aviso>
          ) : (
            <Aviso tipo="exito">
              Listo: {guardado.creados} {t.registros} cargados.
              {guardado.omitidos > 0 ? ` ${guardado.omitidos} ya estaban registrados y se dejaron como estaban.` : ""}
            </Aviso>
          )}
          {error ? <Aviso tipo="error">{error}</Aviso> : null}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <EnlaceBoton href={rutaVolver}>
              Volver a Migrar mi finca <ArrowRight className="size-5" strokeWidth={2} aria-hidden="true" />
            </EnlaceBoton>
            <Boton variante="secundario" onClick={reiniciar}>
              Cargar otro archivo
            </Boton>
          </div>
          {puedeDeshacer && !deshecho ? (
            <div className="space-y-1.5 border-t border-arena pt-3">
              <p className="text-sm text-humo">¿Algo no quedó como esperabas? Mientras nadie haya editado esos registros, puedes quitarlos todos.</p>
              <Boton variante="fantasma" ancho={false} onClick={() => setConfirmando(true)}>
                <Undo2 className="size-5" strokeWidth={1.75} aria-hidden="true" /> Deshacer este cargue
              </Boton>
            </div>
          ) : null}
        </div>
        <Sheet
          abierta={confirmando}
          onCerrar={() => (deshaciendo ? undefined : setConfirmando(false))}
          titulo="¿Deshacer este cargue?"
          pie={
            <Boton variante="peligro" pendiente={deshaciendo} cargando="Deshaciendo…" onClick={deshacer}>
              Sí, deshacer el cargue
            </Boton>
          }
        >
          <p className="text-[0.9375rem] text-humo">Se quitarán los {guardado.creados} {t.registros} que trajo este cargue. Lo que ya estaba registrado antes no se toca. Si alguno se editó después, no se podrá deshacer.</p>
        </Sheet>
      </Tarjeta>
    );
  }

  const hayErrores = !!revision && revision.errores.length > 0;
  const listo = !!revision && revision.errores.length === 0;

  return (
    <div className="space-y-3.5">
      <Tarjeta titulo="1. Sube tu Excel">
        <div className="space-y-3">
          <p className="text-[0.9375rem] text-humo">
            {t.ejemplo} Cada fila se amarra al animal por su número de arete, que ya debe estar en tu hato. Hasta {MAX_FILAS_HISTORIA.toLocaleString("es-CO")} registros por archivo.
          </p>
          <input ref={entrada} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" aria-label={`Archivo de Excel con los ${t.titulo}`} onChange={(e) => elegir(e.target.files?.[0])} />
          {archivo ? (
            <div className="flex items-center gap-3 rounded-2xl bg-papel p-3 ring-1 ring-arena">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-musgo/12 text-musgo">
                <FileSpreadsheet className="size-5" strokeWidth={1.75} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{archivo.name}</span>
              <button type="button" onClick={() => entrada.current?.click()} disabled={analizando || revisando || guardando} aria-label="Cambiar el archivo" className="grid size-11 shrink-0 place-items-center rounded-full text-humo hover:bg-arena hover:text-tinta disabled:opacity-50">
                <RefreshCw className="size-5" strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => entrada.current?.click()} className="flex min-h-20 w-full items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed border-arena bg-papel px-4 text-humo transition active:scale-[0.99]">
              <FileSpreadsheet className="size-6" strokeWidth={1.5} aria-hidden="true" />
              <span className="font-semibold">Elegir el archivo .xlsx</span>
            </button>
          )}
          {analizando ? <Cargando texto="Leyendo tu archivo…" /> : null}
          {error ? <Aviso tipo="error">{error}</Aviso> : null}
          <a href={rutaPlantilla} download title="Un Excel con las columnas, listas desplegables y explicaciones. Es opcional: también sirve tu propio archivo." className="inline-flex min-h-11 items-center gap-2 rounded-full px-1 text-[0.9375rem] font-semibold text-musgo">
            <Download className="size-5" strokeWidth={1.75} aria-hidden="true" /> ¿Prefieres empezar de cero? Descarga la plantilla
          </a>
        </div>
      </Tarjeta>

      {analisis && !analizando ? (
        <Tarjeta titulo="2. Revisa las columnas">
          <div className="space-y-3.5">
            <p className="text-[0.9375rem] text-humo">
              Encontré {analisis.totalFilas.toLocaleString("es-CO")} {analisis.totalFilas === 1 ? "fila" : "filas"} y reconocí {Object.values(mapeo).filter(Boolean).length} de {analisis.columnas.length} columnas. Revisa que cada una vaya al dato correcto; las que no necesites, déjalas sin cargar.
            </p>
            {analisis.hojas.length > 1 ? (
              <div className="space-y-1.5">
                <p className="text-sm font-semibold">Hoja del archivo</p>
                <Selector<string> titulo="Hoja del archivo" valor={analisis.hoja} opciones={analisis.hojas.map((h) => ({ valor: h.nombre, etiqueta: h.nombre, detalle: `${h.filas} filas` }))} onCambio={(v) => v && archivo && analizar(archivo, v)} />
              </div>
            ) : null}
            <div className="grid grid-cols-1 gap-2.5">
              {analisis.columnas.map((c) => (
                <div key={c.indice} className="min-w-0 space-y-1.5 rounded-2xl bg-papel p-3 ring-1 ring-arena">
                  <p className="text-sm font-bold [overflow-wrap:anywhere]">{c.encabezado}</p>
                  {c.muestras.length > 0 ? <p className="text-xs text-humo [overflow-wrap:anywhere]">Ej.: {c.muestras.join(" · ")}</p> : <p className="text-xs text-humo">Sin datos de ejemplo</p>}
                  <Selector<string> titulo={`Dato de la columna «${c.encabezado}»`} valor={mapeo[c.indice] ?? ""} opciones={opciones} onCambio={(v) => cambiarCampo(c.indice, v)} permitirVacio placeholder="No cargar esta columna" />
                </div>
              ))}
            </div>
            {faltan.length > 0 ? <Aviso tipo="atencion">Falta indicar {faltan.length === 1 ? "la columna" : "las columnas"}: {faltan.map((c) => `«${c.titulo}»`).join(", ")}.</Aviso> : null}
            <Boton onClick={revisar} disabled={faltan.length > 0 || guardando} pendiente={revisando} cargando="Revisando…">
              Revisar el archivo
            </Boton>
          </div>
        </Tarjeta>
      ) : null}

      {hayErrores ? (
        <Tarjeta titulo={`Hay ${revision.resumen.total_errores} ${revision.resumen.total_errores === 1 ? "fila" : "filas"} para corregir`}>
          <div className="space-y-3">
            <Aviso tipo="atencion">
              Corrígelas en tu Excel y súbelo de nuevo, o cambia las columnas de arriba si alguna quedó mal emparejada. No se guardó nada.
              {revision.resumen.total_errores > revision.errores.length ? ` Se muestran las primeras ${revision.errores.length}.` : ""}
            </Aviso>
            <ListaEscalable<ErrorFila>
              key={`err-${revision.errores.length}-${archivo?.name}`}
              cargar={async (desde, cantidad) => ({ filas: revision.errores.slice(desde, desde + cantidad), total: revision.errores.length })}
              fila={(e) => <FilaError e={e} />}
              clave={(e) => `${e.fila}-${e.arete}`}
              vacio={null}
            />
          </div>
        </Tarjeta>
      ) : null}

      {listo ? (
        <Tarjeta titulo="3. Revisa y confirma">
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {[
                { v: revision.resumen.total.toLocaleString("es-CO"), e: tipo === "pesajes" ? "Pesajes" : tipo === "ordenos" ? "Ordeños" : "Registros" },
                { v: String(revision.resumen.animales), e: "Animales" },
                { v: numero(revision.resumen.suma), e: tipo === "pesajes" ? `${t.promedio} (kg)` : tipo === "sanidad" ? "Eventos" : "Litros" },
              ].map((d) => (
                <div key={d.e} className="min-w-0 rounded-2xl bg-lana px-3 py-2.5">
                  <p className="font-display text-xl font-semibold [overflow-wrap:anywhere] sm:text-2xl">{d.v}</p>
                  <p className="text-xs text-humo">{d.e}</p>
                </div>
              ))}
            </div>
            <Aviso tipo="info">
              Todo está correcto: de {fechaCorta(revision.resumen.desde)} a {fechaCorta(revision.resumen.hasta)}. Se guarda todo junto al confirmar, y después podrás deshacerlo si hace falta. Lo que ya esté registrado ese día se deja como está.
            </Aviso>
            <p className="text-sm font-semibold">Así se ven los primeros {revision.muestra.length}</p>
            <ul className="grid grid-cols-1 gap-1.5">
              {revision.muestra.map((m) => (
                <li key={`${m.fila}`} className="min-w-0 rounded-xl bg-papel px-3 py-2 text-sm ring-1 ring-arena [overflow-wrap:anywhere]">
                  <span className="font-semibold">{m.numero_arete}</span> · {fechaCorta(m.fecha)} · {m.detalle}
                </li>
              ))}
            </ul>
            <Boton pendiente={guardando} cargando="Cargando…" onClick={guardar}>
              Cargar {revision.resumen.total.toLocaleString("es-CO")} {t.registros}
            </Boton>
          </div>
        </Tarjeta>
      ) : null}
    </div>
  );
}
