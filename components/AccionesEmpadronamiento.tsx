"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, X } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { CampoNumeroHembras } from "@/components/CampoNumeroHembras";
import { Sheet } from "@/components/Sheet";
import { SelectorAnimal } from "@/components/SelectorAnimal";
import { useToast } from "@/components/Toast";
import { agregarSemental, cambiarNumeroHembras, quitarHembra, quitarSemental } from "@/app/(app)/reproduccion/empadronamiento/actions";
import { leerNumeroHembras } from "@/lib/empadronamiento";
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

/** Sumar otro semental a la temporada, con el número de hembras que va a tener. */
export function AgregarSemental({ fincaId, loteId, especie }: { fincaId: string; loteId: string; especie: Especie }) {
  const router = useRouter();
  const toast = useToast();
  const [abierto, setAbierto] = useState(false);
  const [macho, setMacho] = useState<Ref | null>(null);
  const [numero, setNumero] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const n = leerNumeroHembras(numero);
  const cerrar = () => {
    setAbierto(false);
    setMacho(null);
    setNumero("");
    setError(null);
  };
  const agregar = () => {
    if (!macho || n == null) return;
    iniciar(async () => {
      setError(null);
      const r = await agregarSemental(loteId, macho.id, n);
      if (!r.ok) return setError(r.error);
      toast.exito("Semental agregado");
      cerrar();
      router.refresh();
    });
  };
  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="inline-flex min-h-11 items-center gap-1.5 text-[0.9375rem] font-semibold text-musgo underline-offset-4 hover:underline">
        <Plus className="size-4" strokeWidth={2.2} aria-hidden="true" /> Agregar semental
      </button>
    );
  }
  return (
    <div className="space-y-3 rounded-2xl bg-lana p-3.5">
      <div className="space-y-1.5">
        <p className="text-sm font-semibold">Semental</p>
        <SelectorAnimal nombre="semental" fincaId={fincaId} sexo="macho" especie={especie} titulo="Agregar semental" valor={macho} onCambio={setMacho} vacio="Elegir un macho de tu hato" />
      </div>
      <CampoNumeroHembras valor={numero} onCambio={setNumero} especie={especie} nacimiento={macho?.fecha_nacimiento} nombre="num_hembras_nuevo" />
      {error ? <Aviso tipo="error">{error}</Aviso> : null}
      {!macho || n == null ? <Aviso tipo="atencion">{!macho ? "Elige el semental." : "Escribe cuántas hembras tendrá el semental."}</Aviso> : null}
      <div className="space-y-2">
        <Boton onClick={agregar} pendiente={pendiente} cargando="Agregando…" disabled={!macho || n == null}>Agregar semental</Boton>
        <Boton variante="fantasma" onClick={cerrar} disabled={pendiente}>Cancelar</Boton>
      </div>
    </div>
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
