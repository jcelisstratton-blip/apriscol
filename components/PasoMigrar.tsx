import Link from "next/link";
import { Activity, ArrowRight, Check, Circle, CircleCheck, Fence, Lock, Pill, PawPrint, Scale, ShieldPlus, Sprout, Syringe, Tags, Wheat, Milk, Droplets, Boxes } from "lucide-react";
import { clasesBoton } from "@/components/Boton";
import { Escena } from "@/components/TarjetaOpcion";
import { escena, type EscenaDef } from "@/lib/escenas";
import type { PasoId, PasoMigracion } from "@/lib/migracion";

/** El ícono y el color de cada paso (los mismos de los módulos a los que lleva, para que se reconozcan). */
const ESCENA: Record<PasoId, EscenaDef> = {
  corrales: escena(Fence, "ocre"),
  animales: escena(PawPrint, "ambar", Tags),
  pesajes: escena(Scale, "arcilla"),
  ordenos: escena(Milk, "oliva", Droplets),
  sanidad: escena(Syringe, "musgo", ShieldPlus),
  medicamentos: escena(Pill, "arcilla", Boxes),
  alimento: escena(Wheat, "ambar", Sprout),
  revision: escena(Activity, "oliva"),
};

function Estado({ p, siguiente }: { p: PasoMigracion; siguiente: boolean }) {
  const base = "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold";
  if (p.estado === "hecho") {
    return (
      <span className={`${base} bg-musgo/12 text-musgo`}>
        <Check className="size-3.5" strokeWidth={2.6} aria-hidden="true" /> Hecho
      </span>
    );
  }
  if (p.estado === "bloqueado") {
    return (
      <span className={`${base} bg-arena text-humo`}>
        <Lock className="size-3" strokeWidth={2.2} aria-hidden="true" /> Primero tus animales
      </span>
    );
  }
  if (siguiente) return <span className={`${base} bg-musgo text-sobre-musgo`}>Siguiente paso</span>;
  return <span className={`${base} bg-arena text-humo`}>{p.opcional ? "Opcional" : "Pendiente"}</span>;
}

/**
 * Un paso de «Migrar mi finca» como tarjeta: la escena del módulo, su nombre y estado, lo que ya hay cargado, para qué sirve (en palabras de la persona), las
 * partes que van en el mismo archivo (si las hay) y el botón que lleva a hacerlo. El siguiente paso se resalta; uno bloqueado no ofrece botón y dice por qué.
 */
export function PasoMigrar({ p, siguiente = false, principal = siguiente }: { p: PasoMigracion; siguiente?: boolean; /** Su botón es el principal de la pantalla (el siguiente paso; o, cuando todo está hecho, el de revisar). */ principal?: boolean }) {
  const hecho = p.estado === "hecho";
  const bloqueado = p.estado === "bloqueado";
  const resumen = p.dato ?? (p.subpasos ? p.subpasos.find((s) => s.titulo === "Animales")?.dato : null);
  return (
    <li className={`flex min-w-0 flex-col overflow-hidden rounded-3xl bg-papel sm:flex-row ${siguiente ? "ring-2 ring-musgo" : "ring-1 ring-arena"} ${bloqueado ? "opacity-80" : ""}`}>
      <div className="sm:flex sm:w-40 sm:shrink-0">
        <Escena escena={ESCENA[p.id]} alto="h-14 sm:h-auto sm:min-h-full" grande />
      </div>
      <div className="min-w-0 flex-1 space-y-2.5 p-4">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <h3 className="font-display text-lg font-semibold leading-tight [overflow-wrap:anywhere]">{p.titulo}</h3>
          <Estado p={p} siguiente={siguiente} />
        </div>
        {resumen && !p.subpasos ? <p className="text-sm font-semibold text-musgo [overflow-wrap:anywhere]">{resumen}</p> : null}
        <p className="text-sm leading-relaxed text-humo [overflow-wrap:anywhere]">{p.detalle}</p>
        {p.subpasos ? (
          <ul className="grid grid-cols-1 gap-1.5 rounded-2xl bg-lana p-3">
            {p.subpasos.map((s) => (
              <li key={s.titulo} className="flex min-w-0 items-start gap-2 text-sm">
                {s.hecho ? <CircleCheck className="mt-0.5 size-4 shrink-0 text-musgo" strokeWidth={2} aria-hidden="true" /> : <Circle className="mt-0.5 size-4 shrink-0 text-humo/60" strokeWidth={1.75} aria-hidden="true" />}
                <span className="min-w-0 [overflow-wrap:anywhere]">
                  <span className="font-semibold">{s.titulo}</span>
                  {s.dato ? <span className="text-humo"> · {s.dato}</span> : <span className="text-humo"> · pendiente</span>}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        {bloqueado ? (
          <p className="text-sm font-semibold text-humo">{p.motivo}</p>
        ) : (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-0.5">
            <Link href={p.href} className={clasesBoton(principal && !hecho ? "primario" : "secundario", false)}>
              {p.accion} <ArrowRight className="size-4" strokeWidth={2.2} aria-hidden="true" />
            </Link>
            {p.alternativa ? (
              <Link href={p.alternativa.href} className="inline-flex min-h-11 items-center text-sm font-semibold text-musgo underline-offset-4 hover:underline">
                {p.alternativa.texto}
              </Link>
            ) : null}
          </div>
        )}
      </div>
    </li>
  );
}
