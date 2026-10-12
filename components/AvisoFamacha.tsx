import Link from "next/link";
import { CalendarClock } from "lucide-react";

/** Lo que dejan las evaluaciones FAMACHA: a quién desparasitar y a quién vigilar. */
export function AvisoFamacha({ desparasitar, vigilar, puedeProgramar }: { desparasitar: number; vigilar: number; puedeProgramar: boolean }) {
  return (
    <div className="space-y-1.5 text-[0.9375rem] text-humo">
      {desparasitar > 0 ? (
        <p>
          <span className="font-semibold text-tinta">{desparasitar} {desparasitar === 1 ? "animal sacó" : "animales sacaron"} FAMACHA 4 o 5</span> y {desparasitar === 1 ? "no ha sido desparasitado" : "no han sido desparasitados"}. Desparasitar solo a quien lo necesita evita la resistencia.
        </p>
      ) : null}
      {vigilar > 0 ? (
        <p>
          <span className="font-semibold text-tinta">{vigilar} {vigilar === 1 ? "animal sacó" : "animales sacaron"} FAMACHA 3</span>: evalúa de nuevo en una o dos semanas.
        </p>
      ) : null}
      {desparasitar > 0 && puedeProgramar ? (
        <Link href="/hato/sanidad/programar?tipo=desparasitacion&grupo=famacha" className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-musgo underline-offset-4 hover:underline">
          <CalendarClock className="size-4" strokeWidth={2} aria-hidden="true" /> Programar la desparasitación para ellos
        </Link>
      ) : null}
    </div>
  );
}
