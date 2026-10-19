"use client";

import { useRef, useState, useTransition } from "react";
import { ArrowRight, Download, FileSpreadsheet, GitFork, MapPin, RefreshCw, Stethoscope } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Boton, EnlaceBoton } from "@/components/Boton";
import { Cargando } from "@/components/Cargando";
import { ListaEscalable } from "@/components/ListaEscalable";
import { Tarjeta } from "@/components/Tarjeta";
import { useToast } from "@/components/Toast";
import { guardarImportacion, revisarImportacion, type RevisionImportacion, type ResultadoGuardado } from "@/app/(app)/hato/importar/actions";
import { MAX_FILAS_IMPORTAR, type ErrorFila, type FilaVista } from "@/lib/importar-animales";

type Revision = Exclude<RevisionImportacion, { error: string }>;

const fechaCorta = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : null);

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

/** `acciones` solo se cambia en pruebas de pantalla (sin sesión); en la app siempre son las acciones del servidor. */
export function ImportarAnimales({
  rutaPlantilla,
  rutaHato,
  acciones = { revisar: revisarImportacion, guardar: guardarImportacion },
}: {
  rutaPlantilla: string;
  rutaHato: string;
  acciones?: { revisar: (f: FormData) => Promise<RevisionImportacion>; guardar: (f: FormData) => Promise<ResultadoGuardado> };
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [revision, setRevision] = useState<Revision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creados, setCreados] = useState<{ animales: number; con_padres: number; con_servicio: number; con_ubicacion: number } | null>(null);
  const [revisando, iniciarRevision] = useTransition();
  const [guardando, iniciarGuardado] = useTransition();
  const toast = useToast();

  const elegir = (f: File | undefined) => {
    if (!f) return;
    setArchivo(f);
    setRevision(null);
    setError(null);
    const form = new FormData();
    form.set("archivo", f);
    iniciarRevision(async () => {
      try {
        const r = await acciones.revisar(form);
        if ("error" in r) setError(r.error);
        else setRevision(r);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo revisar el archivo.");
      }
    });
    if (entrada.current) entrada.current.value = "";
  };

  const guardar = () => {
    if (!archivo) return;
    const form = new FormData();
    form.set("archivo", archivo);
    setError(null);
    iniciarGuardado(async () => {
      try {
        const r = await acciones.guardar(form);
        if ("error" in r) {
          setError(r.error);
          return;
        }
        setCreados({ animales: r.animales, con_padres: r.con_padres, con_servicio: r.con_servicio, con_ubicacion: r.con_ubicacion });
        toast.exito(`${r.animales} animales cargados`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudieron guardar los animales.");
      }
    });
  };

  if (creados) {
    return (
      <Tarjeta>
        <div className="space-y-4">
          <Aviso tipo="exito">
            Se cargaron {creados.animales} {creados.animales === 1 ? "animal" : "animales"}
            {[
              creados.con_padres > 0 ? `${creados.con_padres} con su genealogía enlazada` : null,
              creados.con_servicio > 0 ? `${creados.con_servicio} con su servicio registrado` : null,
              creados.con_ubicacion > 0 ? `${creados.con_ubicacion} ya en su corral o potrero` : null,
            ]
              .filter(Boolean)
              .map((t) => `, ${t}`)
              .join("")}.
          </Aviso>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <EnlaceBoton href={rutaHato}>
              Ver mi hato <ArrowRight className="size-5" strokeWidth={2} aria-hidden="true" />
            </EnlaceBoton>
            <Boton
              variante="secundario"
              onClick={() => {
                setCreados(null);
                setArchivo(null);
                setRevision(null);
              }}
            >
              Cargar otro archivo
            </Boton>
          </div>
        </div>
      </Tarjeta>
    );
  }

  const hayErrores = !!revision && revision.errores.length > 0;
  const listo = !!revision && revision.errores.length === 0;

  return (
    <div className="space-y-3.5">
      <Tarjeta titulo="1. Descarga la plantilla">
        <div className="space-y-3">
          <p className="text-[0.9375rem] text-humo">
            Llénala con un animal por fila (hasta {MAX_FILAS_IMPORTAR}). Para la genealogía escribe el arete del padre y de la madre: pueden estar en el mismo archivo o ya en tu hato.
          </p>
          <a href={rutaPlantilla} download className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-arena px-5 text-base font-semibold text-tinta transition hover:brightness-95 active:scale-[0.98]">
            <Download className="size-5" strokeWidth={1.75} aria-hidden="true" /> Descargar plantilla de Excel
          </a>
        </div>
      </Tarjeta>

      <Tarjeta titulo="2. Sube tu archivo">
        <div className="space-y-3">
          <input ref={entrada} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" aria-label="Archivo de Excel con los animales" onChange={(e) => elegir(e.target.files?.[0])} />
          {archivo ? (
            <div className="flex items-center gap-3 rounded-2xl bg-papel p-3 ring-1 ring-arena">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-musgo/12 text-musgo">
                <FileSpreadsheet className="size-5" strokeWidth={1.75} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{archivo.name}</span>
              <button type="button" onClick={() => entrada.current?.click()} disabled={revisando || guardando} aria-label="Cambiar el archivo" className="grid size-11 shrink-0 place-items-center rounded-full text-humo hover:bg-arena hover:text-tinta disabled:opacity-50">
                <RefreshCw className="size-5" strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => entrada.current?.click()} className="flex min-h-20 w-full items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed border-arena bg-papel px-4 text-humo transition active:scale-[0.99]">
              <FileSpreadsheet className="size-6" strokeWidth={1.5} aria-hidden="true" />
              <span className="font-semibold">Elegir el archivo .xlsx</span>
            </button>
          )}
          {revisando ? <Cargando texto="Revisando tu archivo…" /> : null}
          {error ? <Aviso tipo="error">{error}</Aviso> : null}
        </div>
      </Tarjeta>

      {hayErrores ? (
        <Tarjeta titulo={`Hay ${revision.errores.length} ${revision.errores.length === 1 ? "fila" : "filas"} para corregir`}>
          <div className="space-y-3">
            <Aviso tipo="atencion">Corrígelas en tu Excel y súbelo de nuevo. No se guardó nada.</Aviso>
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
              <Dato valor={revision.resumen.total} etiqueta="Animales" />
              <Dato valor={revision.resumen.hembras} etiqueta="Hembras" />
              <Dato valor={revision.resumen.machos} etiqueta="Machos" />
            </div>
            <Aviso tipo="info">
              {revision.resumen.con_padres_en_archivo + revision.resumen.con_padres_en_hato > 0
                ? `${revision.resumen.con_padres_en_archivo + revision.resumen.con_padres_en_hato} con padre o madre enlazados${revision.resumen.con_padres_en_hato > 0 ? ` (${revision.resumen.con_padres_en_hato} con animales que ya están en tu hato)` : ""}. `
                : ""}
              Todo está correcto. Se guardan todos juntos al confirmar.
              {revision.resumen.con_servicio > 0 ? ` ${revision.resumen.con_servicio} hembras con servicio.` : ""}
              {revision.resumen.con_ubicacion > 0 ? ` ${revision.resumen.con_ubicacion} con corral o potrero.` : ""}
            </Aviso>
            <ListaEscalable<FilaVista>
              key={`ok-${revision.resumen.total}-${archivo?.name}`}
              cargar={async (desde, cantidad) => ({ filas: revision.vista.slice(desde, desde + cantidad), total: revision.vista.length })}
              fila={(f) => <FilaAnimalVista f={f} />}
              clave={(f) => `${f.fila}`}
              vacio={null}
            />
            <Boton pendiente={guardando} cargando="Cargando animales…" onClick={guardar}>
              Cargar {revision.resumen.total} {revision.resumen.total === 1 ? "animal" : "animales"}
            </Boton>
          </div>
        </Tarjeta>
      ) : null}
    </div>
  );
}
