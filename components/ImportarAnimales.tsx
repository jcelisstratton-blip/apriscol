"use client";

import { useRef, useState, useTransition } from "react";
import { ArrowRight, CirclePlus, Download, FileSpreadsheet, GitFork, MapPin, PenLine, RefreshCw, Stethoscope, Undo2 } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Boton, EnlaceBoton } from "@/components/Boton";
import { Cargando } from "@/components/Cargando";
import { ListaEscalable } from "@/components/ListaEscalable";
import { Selector } from "@/components/Selector";
import { SelectorTarjetas } from "@/components/SelectorTarjetas";
import { Sheet } from "@/components/Sheet";
import { Tarjeta } from "@/components/Tarjeta";
import { useToast } from "@/components/Toast";
import {
  analizarImportacion,
  deshacerImportacion,
  guardarImportacion,
  revisarImportacion,
  type AnalisisImportacion,
  type ResultadoDeshacer,
  type ResultadoGuardado,
  type RevisionImportacion,
} from "@/app/(app)/hato/importar/actions";
import { MAX_FILAS_IMPORTAR, type ColumnaId, type ErrorFila, type FilaVista, type ModoImportar } from "@/lib/importar-animales";
import { CAMPOS_MAPEO } from "@/lib/importar-mapeo";
import { escena } from "@/lib/escenas";

type Revision = Exclude<RevisionImportacion, { error: string }>;
type Analisis = Exclude<AnalisisImportacion, { error: string }>;
type Guardado = Exclude<ResultadoGuardado, { error: string }>;

const fechaCorta = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : null);

const MODOS = [
  { valor: "nuevos" as const, etiqueta: "Solo los nuevos", detalle: "Los que ya están en tu hato se dejan como están.", escena: escena(CirclePlus, "musgo") },
  { valor: "completar" as const, etiqueta: "Nuevos y completar", detalle: "A los que ya existen les llena solo lo que tengan vacío.", escena: escena(PenLine, "ocre") },
  { valor: "corregir" as const, etiqueta: "Nuevos y corregir", detalle: "En los que ya existen, el archivo cambia los datos que trae.", escena: escena(RefreshCw, "arcilla") },
];

const ETIQUETA_ACCION: Record<FilaVista["accion"], string> = { crear: "Nuevo", completar: "Se completa", corregir: "Se corrige", omitir: "Ya existe: se deja igual" };

function Dato({ valor, etiqueta }: { valor: number; etiqueta: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-lana px-3 py-2.5">
      <p className="font-display text-xl font-semibold sm:text-2xl">{valor}</p>
      <p className="text-xs text-humo">{etiqueta}</p>
    </div>
  );
}

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

function FilaAnimalVista({ f }: { f: FilaVista }) {
  const detalle = [f.sexo === "hembra" ? "Hembra" : "Macho", f.especie === "caprino" ? "Cabra" : "Oveja", f.raza, fechaCorta(f.fecha_nacimiento), f.origen === "comprado" ? "Comprado" : null].filter(Boolean).join(" · ");
  return (
    <div className="min-w-0 rounded-2xl bg-papel p-3 ring-1 ring-arena">
      <p className="font-bold [overflow-wrap:anywhere]">
        {f.numero_arete}
        {f.nombre ? <span className="font-normal text-humo"> · {f.nombre}</span> : null}
      </p>
      <p className={`text-xs font-semibold ${f.accion === "crear" ? "text-musgo" : f.accion === "omitir" ? "text-humo" : "text-ocre"}`}>{ETIQUETA_ACCION[f.accion]}</p>
      <p className="text-sm text-humo [overflow-wrap:anywhere]">{detalle}</p>
      {f.repro ? (
        <p className="mt-1 flex items-start gap-1.5 text-sm [overflow-wrap:anywhere]">
          <Stethoscope className="mt-0.5 size-4 shrink-0 text-musgo" strokeWidth={1.75} aria-hidden="true" />
          <span className="min-w-0">{f.repro}</span>
        </p>
      ) : null}
      {f.ubicacion ? (
        <p className="mt-1 flex items-start gap-1.5 text-sm [overflow-wrap:anywhere]">
          <MapPin className="mt-0.5 size-4 shrink-0 text-musgo" strokeWidth={1.75} aria-hidden="true" />
          <span className="min-w-0">{f.ubicacion}</span>
        </p>
      ) : null}
      {f.padre || f.madre ? (
        <p className="mt-1 flex items-start gap-1.5 text-sm [overflow-wrap:anywhere]">
          <GitFork className="mt-0.5 size-4 shrink-0 text-musgo" strokeWidth={1.75} aria-hidden="true" />
          <span className="min-w-0">
            {f.padre ? <span className="block">Padre: {f.padre}</span> : null}
            {f.madre ? <span className="block">Madre: {f.madre}</span> : null}
          </span>
        </p>
      ) : null}
    </div>
  );
}

type Acciones = {
  analizar: (f: FormData) => Promise<AnalisisImportacion>;
  revisar: (f: FormData) => Promise<RevisionImportacion>;
  guardar: (f: FormData) => Promise<ResultadoGuardado>;
  deshacer: (id: string) => Promise<ResultadoDeshacer>;
};

/** `acciones` solo se cambia en pruebas de pantalla (sin sesión); en la app siempre son las acciones del servidor. */
export function ImportarAnimales({
  rutaPlantilla,
  rutaHato,
  camposDisponibles,
  puedeDeshacer,
  acciones = { analizar: analizarImportacion, revisar: revisarImportacion, guardar: guardarImportacion, deshacer: deshacerImportacion },
}: {
  rutaPlantilla: string;
  rutaHato: string;
  /** Los campos que esta finca puede cargar (según su plan y el rol de quien carga). */
  camposDisponibles: ColumnaId[];
  puedeDeshacer: boolean;
  acciones?: Acciones;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [analisis, setAnalisis] = useState<Analisis | null>(null);
  /** Campo elegido para cada columna del archivo (por su posición en la hoja). */
  const [mapeo, setMapeo] = useState<Record<number, ColumnaId | "">>({});
  const [modo, setModo] = useState<ModoImportar>("nuevos");
  const [revision, setRevision] = useState<Revision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState<Guardado | null>(null);
  const [confirmandoDeshacer, setConfirmandoDeshacer] = useState(false);
  const [deshecho, setDeshecho] = useState<{ eliminados: number; revertidos: number } | null>(null);
  const [analizando, iniciarAnalisis] = useTransition();
  const [revisando, iniciarRevision] = useTransition();
  const [guardando, iniciarGuardado] = useTransition();
  const [deshaciendo, iniciarDeshacer] = useTransition();
  const toast = useToast();

  const disponibles = new Set<string>(camposDisponibles);
  const opciones = CAMPOS_MAPEO.filter((c) => disponibles.has(c.id)).map((c) => ({ valor: c.id, etiqueta: c.titulo }));

  const reiniciar = () => {
    setArchivo(null);
    setAnalisis(null);
    setMapeo({});
    setRevision(null);
    setError(null);
    setGuardado(null);
    setDeshecho(null);
  };

  const analizar = (f: File, hoja?: string) => {
    setError(null);
    setRevision(null);
    const form = new FormData();
    form.set("archivo", f);
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
        setMapeo(Object.fromEntries(r.columnas.map((c) => [c.indice, c.campo && disponibles.has(c.campo) ? c.campo : ""])));
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

  /** Un campo va en una sola columna: si ya estaba en otra, esa otra queda sin campo. */
  const cambiarCampo = (indice: number, campo: ColumnaId | "") => {
    setRevision(null);
    setMapeo((m) => {
      const siguiente = { ...m };
      if (campo) for (const k of Object.keys(siguiente)) if (siguiente[+k] === campo) siguiente[+k] = "";
      siguiente[indice] = campo;
      return siguiente;
    });
  };

  const formularioDe = () => {
    const form = new FormData();
    form.set("archivo", archivo!);
    form.set("hoja", analisis!.hoja);
    form.set("filaEncabezado", String(analisis!.filaEncabezado));
    form.set("modo", modo);
    form.set("mapeo", JSON.stringify(Object.entries(mapeo).filter(([, c]) => c).map(([i, c]) => ({ indice: Number(i), campo: c }))));
    return form;
  };

  const tieneArete = Object.values(mapeo).includes("numero_arete");
  const reconocidas = Object.values(mapeo).filter(Boolean).length;

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
        toast.exito(r.animales > 0 ? `${r.animales} animales cargados` : "Cargue aplicado");
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudieron guardar los animales.");
      }
    });
  };

  const deshacer = () => {
    if (!guardado) return;
    iniciarDeshacer(async () => {
      try {
        const r = await acciones.deshacer(guardado.importacion);
        setConfirmandoDeshacer(false);
        if ("error" in r) {
          setError(r.error);
          return;
        }
        setDeshecho({ eliminados: r.eliminados, revertidos: r.revertidos });
        toast.exito("Cargue deshecho");
      } catch (e) {
        setConfirmandoDeshacer(false);
        setError(e instanceof Error ? e.message : "No se pudo deshacer el cargue.");
      }
    });
  };

  if (guardado) {
    const partes = [
      guardado.animales > 0 ? `${guardado.animales} ${guardado.animales === 1 ? "animal nuevo" : "animales nuevos"}` : null,
      guardado.actualizados > 0 ? `${guardado.actualizados} ${guardado.actualizados === 1 ? "animal actualizado" : "animales actualizados"}` : null,
      guardado.con_padres > 0 ? `${guardado.con_padres} con su genealogía enlazada` : null,
      guardado.con_servicio > 0 ? `${guardado.con_servicio} con su servicio registrado` : null,
      guardado.con_ubicacion > 0 ? `${guardado.con_ubicacion} ya en su corral o potrero` : null,
    ].filter(Boolean);
    return (
      <Tarjeta>
        <div className="space-y-4">
          {deshecho ? (
            <Aviso tipo="info">
              Cargue deshecho: se quitaron {deshecho.eliminados} {deshecho.eliminados === 1 ? "animal" : "animales"}
              {deshecho.revertidos > 0 ? ` y se devolvieron ${deshecho.revertidos} ${deshecho.revertidos === 1 ? "dato" : "datos"} que había cambiado` : ""}.
            </Aviso>
          ) : (
            <Aviso tipo="exito">
              Listo: {partes.length > 0 ? partes.join(", ") : "no hubo cambios"}.
              {guardado.sin_cambios > 0 ? ` ${guardado.sin_cambios} ya tenían esos datos.` : ""}
            </Aviso>
          )}
          {error ? <Aviso tipo="error">{error}</Aviso> : null}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <EnlaceBoton href={rutaHato}>
              Ver mi hato <ArrowRight className="size-5" strokeWidth={2} aria-hidden="true" />
            </EnlaceBoton>
            <Boton variante="secundario" onClick={reiniciar}>
              Cargar otro archivo
            </Boton>
          </div>
          {puedeDeshacer && !deshecho ? (
            <div className="space-y-1.5 border-t border-arena pt-3">
              <p className="text-sm text-humo">¿Algo no quedó como esperabas? Mientras nadie haya usado esos animales, puedes dejar todo como estaba.</p>
              <Boton variante="fantasma" ancho={false} onClick={() => setConfirmandoDeshacer(true)}>
                <Undo2 className="size-5" strokeWidth={1.75} aria-hidden="true" /> Deshacer este cargue
              </Boton>
            </div>
          ) : null}
        </div>
        <Sheet
          abierta={confirmandoDeshacer}
          onCerrar={() => (deshaciendo ? undefined : setConfirmandoDeshacer(false))}
          titulo="¿Deshacer este cargue?"
          pie={
            <Boton variante="peligro" pendiente={deshaciendo} cargando="Deshaciendo…" onClick={deshacer}>
              Sí, deshacer el cargue
            </Boton>
          }
        >
          <p className="text-[0.9375rem] text-humo">
            Se quitarán los animales que creó este cargue, con su genealogía, servicios y corral, y se devolverán los datos que cambió en los que ya existían. Si alguno ya tiene registros (ordeños, pesajes, sanidad…), no se podrá deshacer.
          </p>
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
            Sirve el archivo que ya tienes, con las columnas que tenga: en el siguiente paso te ayudamos a emparejarlas. Hasta {MAX_FILAS_IMPORTAR} animales por archivo; si tienes más, súbelos en varios.
          </p>
          <input ref={entrada} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" aria-label="Archivo de Excel con los animales" onChange={(e) => elegir(e.target.files?.[0])} />
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
          <a href={rutaPlantilla} download className="inline-flex min-h-11 items-center gap-2 rounded-full px-1 text-[0.9375rem] font-semibold text-musgo">
            <Download className="size-5" strokeWidth={1.75} aria-hidden="true" /> ¿Prefieres empezar de cero? Descarga la plantilla
          </a>
        </div>
      </Tarjeta>

      {analisis && !analizando ? (
        <Tarjeta titulo="2. Revisa las columnas">
          <div className="space-y-3.5">
            <p className="text-[0.9375rem] text-humo">
              Encontré {analisis.totalFilas} {analisis.totalFilas === 1 ? "fila" : "filas"} y reconocí {reconocidas} de {analisis.columnas.length} columnas. Revisa que cada una vaya al dato correcto; las que no necesites, déjalas sin cargar.
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
                  <Selector<ColumnaId> titulo={`Dato de la columna «${c.encabezado}»`} valor={mapeo[c.indice] ?? ""} opciones={opciones} onCambio={(v) => cambiarCampo(c.indice, v)} permitirVacio placeholder="No cargar esta columna" />
                </div>
              ))}
            </div>
            {!tieneArete ? <Aviso tipo="atencion">Falta indicar cuál columna es el «Número de arete»: es lo que identifica a cada animal.</Aviso> : null}

            <div className="space-y-2">
              <p className="text-sm font-semibold">Si un arete ya está en tu hato</p>
              <SelectorTarjetas<ModoImportar> titulo="Qué hacer con los animales que ya existen" valor={modo} opciones={MODOS} onCambio={(v) => v && (setModo(v), setRevision(null))} />
              {modo !== "nuevos" ? <p className="text-xs text-humo">A los que ya existen solo se les actualizan los datos del animal. Su genealogía solo se completa si no la tenían; los servicios, partos y el corral se registran únicamente en animales nuevos.</p> : null}
            </div>

            <Boton onClick={revisar} disabled={!tieneArete || guardando} pendiente={revisando} cargando="Revisando…">
              Revisar el archivo
            </Boton>
          </div>
        </Tarjeta>
      ) : null}

      {hayErrores ? (
        <Tarjeta titulo={`Hay ${revision.errores.length} ${revision.errores.length === 1 ? "fila" : "filas"} para corregir`}>
          <div className="space-y-3">
            <Aviso tipo="atencion">Corrígelas en tu Excel y súbelo de nuevo, o cambia las columnas de arriba si alguna quedó mal emparejada. No se guardó nada.</Aviso>
            <ListaEscalable<ErrorFila>
              key={`err-${revision.errores.length}-${archivo?.name}`}
              cargar={async (desde, cantidad) => ({ filas: revision.errores.slice(desde, desde + cantidad), total: revision.errores.length })}
              fila={(e) => <FilaError e={e} />}
              clave={(e) => `${e.fila}`}
              vacio={null}
            />
          </div>
        </Tarjeta>
      ) : null}

      {listo ? (
        <Tarjeta titulo="3. Revisa y confirma">
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <Dato valor={revision.resumen.nuevos} etiqueta="Nuevos" />
              <Dato valor={revision.resumen.actualizar} etiqueta={modo === "corregir" ? "Se corrigen" : "Se completan"} />
              <Dato valor={revision.resumen.ya_existen} etiqueta="Ya estaban" />
            </div>
            <Aviso tipo="info">
              {revision.resumen.con_padres_en_archivo + revision.resumen.con_padres_en_hato > 0
                ? `${revision.resumen.con_padres_en_archivo + revision.resumen.con_padres_en_hato} con padre o madre enlazados${revision.resumen.con_padres_en_hato > 0 ? ` (${revision.resumen.con_padres_en_hato} con animales que ya están en tu hato)` : ""}. `
                : ""}
              Todo está correcto. Se guarda todo junto al confirmar, y después podrás deshacerlo si hace falta.
              {revision.resumen.ya_existen > 0 ? ` ${revision.resumen.ya_existen} ${revision.resumen.ya_existen === 1 ? "animal ya está" : "animales ya están"} en tu hato y se dejan como están.` : ""}
              {revision.resumen.omitidos > 0 ? ` Se omitieron ${revision.resumen.omitidos} ${revision.resumen.omitidos === 1 ? "fila" : "filas"} de animales dados de baja (vendidos, muertos…): solo se cargan los activos.` : ""}
              {revision.resumen.con_servicio > 0 ? ` ${revision.resumen.con_servicio} hembras con servicio.` : ""}
              {revision.resumen.con_ubicacion > 0 ? ` ${revision.resumen.con_ubicacion} con corral o potrero.` : ""}
              {revision.resumen.historia_ignorada > 0 ? ` ${revision.resumen.historia_ignorada} de los que ya existen traen partos, servicio o corral: eso no se registra en animales que ya existen.` : ""}
            </Aviso>
            <ListaEscalable<FilaVista>
              key={`ok-${revision.resumen.total}-${revision.resumen.ya_existen}-${archivo?.name}`}
              cargar={async (desde, cantidad) => ({ filas: revision.vista.slice(desde, desde + cantidad), total: revision.vista.length })}
              fila={(f) => <FilaAnimalVista f={f} />}
              clave={(f) => `${f.fila}`}
              vacio={null}
            />
            <Boton pendiente={guardando} cargando="Cargando animales…" onClick={guardar}>
              {revision.resumen.nuevos > 0 && revision.resumen.actualizar > 0
                ? `Cargar ${revision.resumen.nuevos} nuevos y actualizar ${revision.resumen.actualizar}`
                : revision.resumen.actualizar > 0
                  ? `Actualizar ${revision.resumen.actualizar} ${revision.resumen.actualizar === 1 ? "animal" : "animales"}`
                  : `Cargar ${revision.resumen.nuevos} ${revision.resumen.nuevos === 1 ? "animal" : "animales"}`}
            </Boton>
          </div>
        </Tarjeta>
      ) : null}
    </div>
  );
}
