"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, X } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { CampoNumeroHembras } from "@/components/CampoNumeroHembras";
import { CamposSementalExterno } from "@/components/CamposSementalExterno";
import { OrigenYSemental, type OrigenSemental } from "@/components/OrigenYSemental";
import { Sheet } from "@/components/Sheet";
import { useToast } from "@/components/Toast";
import { agregarSemental, cambiarNumeroHembras, editarSementalExterno, quitarHembra, quitarSemental } from "@/app/(app)/reproduccion/empadronamiento/actions";
import { leerNumeroHembras } from "@/lib/empadronamiento";
import { datosExternoVacios, faltantesExterno, type DatosExterno } from "@/lib/semental-externo";
import type { Especie } from "@/lib/tipos";

type Ref = { id: string; numero_arete: string; nombre: string | null; fecha_nacimiento?: string | null };

/** Botón discreto «Quitar» de una hembra o un semental de una temporada abierta. */
export function QuitarDeEmp({ loteId, animalId, tipo, nombre }: { loteId: string; animalId: string; tipo: "hembra" | "semental"; nombre: string }) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const quitar = () =>
    iniciar(async () => {
      setError(null);
      const r = await (tipo === "hembra" ? quitarHembra(loteId, animalId) : quitarSemental(loteId, animalId));
      if (!r.ok) return setError(r.error);
      toast.exito(`${nombre} salió de la temporada`);
      router.refresh();
    });
  return (
    <span className="flex shrink-0 flex-col items-end">
      <button
        type="button"
        onClick={quitar}
        disabled={pendiente}
        aria-label={`Quitar a ${nombre} de la temporada`}
        className="grid size-11 place-items-center rounded-full text-humo hover:bg-arena hover:text-rojo disabled:opacity-50"
      >
        <X className="size-5" strokeWidth={1.75} aria-hidden="true" />
      </button>
      {error ? <span className="max-w-48 text-right text-xs text-rojo">{error}</span> : null}
    </span>
  );
}

/** Sumar otro semental a la temporada (del hato o prestado por otro hato), con el número de hembras que va a tener. */
export function AgregarSemental({ fincaId, loteId, especie, inicio, fin }: { fincaId: string; loteId: string; especie: Especie; inicio: string; fin: string }) {
  const router = useRouter();
  const toast = useToast();
  const [abierta, setAbierta] = useState(false);
  const [origen, setOrigen] = useState<OrigenSemental>("propio");
  const [macho, setMacho] = useState<Ref | null>(null);
  const [externo, setExterno] = useState<DatosExterno>(() => datosExternoVacios(inicio, fin));
  const [numero, setNumero] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const n = leerNumeroHembras(numero);
  const faltan = origen === "propio" ? (macho ? [] : ["el semental"]) : faltantesExterno(externo);
  const listo = n != null && faltan.length === 0;
  const abrir = () => {
    setOrigen("propio");
    setMacho(null);
    setExterno(datosExternoVacios(inicio, fin));
    setNumero("");
    setError(null);
    setAbierta(true);
  };
  const agregar = () =>
    iniciar(async () => {
      setError(null);
      const r = await agregarSemental({ loteId, numHembras: n ?? 0, ...(origen === "propio" ? { machoId: macho?.id } : { externo }) });
      if (!r.ok) return setError(r.error);
      toast.exito("Semental agregado");
      setAbierta(false);
      router.refresh();
    });
  return (
    <>
      <button type="button" onClick={abrir} className="inline-flex min-h-11 items-center gap-1.5 text-[0.9375rem] font-semibold text-musgo underline-offset-4 hover:underline">
        <Plus className="size-4" strokeWidth={2.2} aria-hidden="true" /> Agregar semental
      </button>
      <Sheet
        abierta={abierta}
        onCerrar={() => (pendiente ? undefined : setAbierta(false))}
        titulo="Agregar semental"
        pie={
          <div className="space-y-2">
            {!listo ? <p className="text-sm text-humo">{n == null && faltan.length === 0 ? "Escribe cuántas hembras tendrá el semental." : faltan.length > 0 ? `Falta ${faltan.join(", ")}.` : "Escribe cuántas hembras tendrá el semental."}</p> : null}
            <Boton onClick={agregar} pendiente={pendiente} cargando="Agregando…" disabled={!listo}>Agregar semental</Boton>
          </div>
        }
      >
        <div className="space-y-5">
          <OrigenYSemental
            fincaId={fincaId}
            especie={especie}
            origen={origen}
            onOrigen={setOrigen}
            macho={macho}
            onMacho={setMacho}
            externo={externo}
            onExterno={setExterno}
            finTemporada={fin}
          />
          <CampoNumeroHembras valor={numero} onCambio={setNumero} especie={especie} nacimiento={origen === "propio" ? macho?.fecha_nacimiento : externo.nacimiento || null} nombre="num_hembras_nuevo" />
          {error ? <Aviso tipo="error">{error}</Aviso> : null}
        </div>
      </Sheet>
    </>
  );
}

/** Corregir los datos de un semental de otro hato (chip, hato, préstamo…). */
export function EditarSementalExterno({ loteId, machoId, etiqueta, datos, finTemporada }: { loteId: string; machoId: string; etiqueta: string; datos: DatosExterno; finTemporada: string }) {
  const router = useRouter();
  const toast = useToast();
  const [abierta, setAbierta] = useState(false);
  const [valor, setValor] = useState<DatosExterno>(datos);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const faltan = faltantesExterno(valor);
  const guardar = () =>
    iniciar(async () => {
      setError(null);
      const r = await editarSementalExterno(loteId, machoId, valor);
      if (!r.ok) return setError(r.error);
      toast.exito("Datos del semental guardados");
      setAbierta(false);
      router.refresh();
    });
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setValor(datos);
          setError(null);
          setAbierta(true);
        }}
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-musgo underline-offset-4 hover:underline"
        aria-label={`Editar los datos de ${etiqueta}`}
      >
        <Pencil className="size-3.5" strokeWidth={2} aria-hidden="true" /> Editar datos
      </button>
      <Sheet
        abierta={abierta}
        onCerrar={() => (pendiente ? undefined : setAbierta(false))}
        titulo="Datos del semental"
        pie={
          <Boton onClick={guardar} pendiente={pendiente} cargando="Guardando…" disabled={faltan.length > 0}>
            Guardar
          </Boton>
        }
      >
        <div className="space-y-4">
          <CamposSementalExterno valor={valor} onCambio={setValor} finTemporada={finTemporada} />
          {error ? <Aviso tipo="error">{error}</Aviso> : null}
        </div>
      </Sheet>
    </>
  );
}

/** Corregir cuántas hembras tendrá un semental de la temporada (no puede ser menos de las que ya tiene). */
export function CambiarNumeroHembras({
  loteId,
  machoId,
  etiqueta,
  especie,
  nacimiento,
  actual,
  asignadas,
}: {
  loteId: string;
  machoId: string;
  etiqueta: string;
  especie: Especie;
  nacimiento: string | null;
  actual: number | null;
  asignadas: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [abierta, setAbierta] = useState(false);
  const [numero, setNumero] = useState(actual == null ? "" : String(actual));
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const n = leerNumeroHembras(numero);
  const guardar = () => {
    if (n == null) return;
    iniciar(async () => {
      setError(null);
      const r = await cambiarNumeroHembras(loteId, machoId, n);
      if (!r.ok) return setError(r.error);
      toast.exito(`${etiqueta} tendrá ${n} ${n === 1 ? "hembra" : "hembras"}`);
      setAbierta(false);
      router.refresh();
    });
  };
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setNumero(actual == null ? "" : String(actual));
          setError(null);
          setAbierta(true);
        }}
        aria-label={`Cambiar cuántas hembras tendrá ${etiqueta}`}
        className="grid size-11 place-items-center rounded-full text-humo hover:bg-arena hover:text-tinta"
      >
        <Pencil className="size-[1.125rem]" strokeWidth={1.75} aria-hidden="true" />
      </button>
      <Sheet
        abierta={abierta}
        onCerrar={() => (pendiente ? undefined : setAbierta(false))}
        titulo="Número de hembras"
        pie={
          <Boton onClick={guardar} pendiente={pendiente} cargando="Guardando…" disabled={n == null || n < asignadas}>
            Guardar
          </Boton>
        }
      >
        <div className="space-y-3">
          <p className="text-[0.9375rem]">
            Semental: <strong className="[overflow-wrap:anywhere]">{etiqueta}</strong>. Ahora tiene {asignadas} {asignadas === 1 ? "hembra asignada" : "hembras asignadas"}.
          </p>
          <CampoNumeroHembras valor={numero} onCambio={setNumero} especie={especie} nacimiento={nacimiento} minimo={asignadas} nombre="num_hembras_cambio" />
          {error ? <Aviso tipo="error">{error}</Aviso> : null}
        </div>
      </Sheet>
    </>
  );
}
