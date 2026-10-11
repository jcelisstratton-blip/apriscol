import Link from "next/link";
import { ChevronRight, Mars, Venus } from "lucide-react";
import { Insignia } from "@/components/Insignia";
import { edadTexto, formatoFecha } from "@/lib/fechas";
import { nombreTipo } from "@/lib/animal";
import type { Especie, SexoAnimal } from "@/lib/tipos";

export type AnimalFila = {
  id: string;
  numero_arete: string;
  nombre: string | null;
  sexo: SexoAnimal;
  especie: Especie;
  fecha_nacimiento: string | null;
  fecha_nacimiento_aprox: boolean;
};

export type RetiroFila = { leche: string | null; carne: string | null };

export function FilaAnimal({ animal, retiro }: { animal: AnimalFila; retiro?: RetiroFila }) {
  const Icono = animal.sexo === "hembra" ? Venus : Mars;
  return (
    <Link
      href={`/hato/${animal.id}`}
      className="flex min-h-[4.25rem] items-center gap-3 rounded-2xl bg-papel px-3.5 py-2.5 ring-1 ring-arena transition active:scale-[0.99]"
    >
      <span
        className={`grid size-11 shrink-0 place-items-center rounded-full ${
          animal.sexo === "hembra" ? "bg-ocre/15 text-ocre" : "bg-musgo/12 text-musgo"
        }`}
      >
        <Icono className="size-5" strokeWidth={2} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-bold">{animal.numero_arete}</span>
        <span className="block truncate text-sm text-humo">
          {animal.nombre ? `${animal.nombre} · ` : ""}
          {nombreTipo(animal.especie, animal.sexo)} · {edadTexto(animal.fecha_nacimiento)}
          {animal.fecha_nacimiento_aprox ? " aprox." : ""}
        </span>
        {retiro ? (
          <span className="mt-1 flex flex-wrap gap-1">
            {retiro.leche ? <Insignia tono="aviso">Retiro leche · {formatoFecha(retiro.leche, { day: "numeric", month: "short" })}</Insignia> : null}
            {retiro.carne ? <Insignia tono="alerta">Retiro carne · {formatoFecha(retiro.carne, { day: "numeric", month: "short" })}</Insignia> : null}
          </span>
        ) : null}
      </span>
      <ChevronRight className="size-5 shrink-0 text-humo" strokeWidth={1.75} />
    </Link>
  );
}
