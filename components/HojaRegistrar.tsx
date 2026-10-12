"use client";

import Link from "next/link";
import { Droplets, Rabbit, Scale, Syringe } from "lucide-react";
import { Sheet } from "@/components/Sheet";

export type Accion = { href: string; titulo: string; detalle: string; icono: React.ReactNode };
export type PermisosRegistro = { puedeOrdenar: boolean; puedeCrearAnimal: boolean; puedeSanidad: boolean; puedeCarne: boolean };

/** Lo que la persona puede registrar desde el botón «+» (celular) o «Registrar» (menú lateral), según su rol. */
export function accionesRegistro({ puedeOrdenar, puedeCrearAnimal, puedeSanidad, puedeCarne }: PermisosRegistro): Accion[] {
  return [
    ...(puedeOrdenar
      ? [{ href: "/hato?vista=ordeno", titulo: "Registrar ordeño", detalle: "Litros por animal, jornada de hoy", icono: <Droplets className="size-6" strokeWidth={1.75} /> }]
      : []),
    ...(puedeCrearAnimal
      ? [{ href: "/hato/nuevo", titulo: "Animal nuevo", detalle: "Cabra, cabro, oveja o carnero", icono: <Rabbit className="size-6" strokeWidth={1.75} /> }]
      : []),
    ...(puedeSanidad
      ? [{ href: "/hato/sanidad/nuevo", titulo: "Vacuna o tratamiento", detalle: "Para uno o varios animales", icono: <Syringe className="size-6" strokeWidth={1.75} /> }]
      : []),
    ...(puedeCarne
      ? [{ href: "/hato?vista=ceba", titulo: "Pesar animales", detalle: "Peso de los animales en ceba", icono: <Scale className="size-6" strokeWidth={1.75} /> }]
      : []),
  ];
}

/** Hoja «¿Qué vas a registrar?», compartida por la barra inferior y el menú lateral. */
export function HojaRegistrar({ abierta, onCerrar, acciones }: { abierta: boolean; onCerrar: () => void; acciones: Accion[] }) {
  return (
    <Sheet abierta={abierta} onCerrar={onCerrar} titulo="¿Qué vas a registrar?">
      <ul className="space-y-2">
        {acciones.map((a) => (
          <li key={a.href}>
            <Link href={a.href} onClick={onCerrar} className="flex min-h-16 items-center gap-4 rounded-2xl bg-lana px-4 hover:bg-arena/70">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-musgo/12 text-musgo">{a.icono}</span>
              <span className="min-w-0">
                <span className="block font-semibold">{a.titulo}</span>
                <span className="block text-sm text-humo">{a.detalle}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
