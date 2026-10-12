"use client";

import { useRouter } from "next/navigation";
import { Chip, FilaDesplazable } from "@/components/FilaDesplazable";
import { SelectorAnimal } from "@/components/SelectorAnimal";
import { Boton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { PERIODOS, type PeriodoId } from "@/lib/leche";

type Ref = { id: string; numero_arete: string; nombre: string | null };

/** Dirección de la pantalla Leche con lo que se pide: periodo, fechas y animal. */
export function direccionLeche(p: { periodo?: PeriodoId; desde?: string; hasta?: string; animal?: string | null }): string {
  const q = new URLSearchParams();
  if (p.periodo && p.periodo !== "30") q.set("periodo", p.periodo);
  if (p.periodo === "rango" && p.desde && p.hasta) {
    q.set("desde", p.desde);
    q.set("hasta", p.hasta);
  }
  if (p.animal) q.set("animal", p.animal);
  const s = q.toString();
  return s ? `/leche?${s}` : "/leche";
}

/**
 * Qué se mira en Leche: todo el hato o un animal, y de cuándo a cuándo (7, 30 o 90 días, un año, todo el historial o unas fechas).
 * Todo vive en la dirección, así que se puede compartir y el botón «atrás» funciona.
 */
export function FiltrosLeche({
  fincaId,
  animal,
  periodo,
  desde,
  hasta,
  hoy,
}: {
  fincaId: string;
  animal: Ref | null;
  periodo: PeriodoId;
  desde: string;
  hasta: string;
  hoy: string;
}) {
  const router = useRouter();
  const ir = (p: Parameters<typeof direccionLeche>[0]) => router.push(direccionLeche(p));

  return (
    <div className="space-y-3">
      <Campo etiqueta="¿De quién?">
        {(id) => (
          <SelectorAnimal
            id={id}
            nombre="animal_filtro"
            fincaId={fincaId}
            sexo="hembra"
            incluirInactivos
            vacio="Todo el hato"
            titulo="¿De qué animal?"
            valor={animal}
            onCambio={(a) => ir({ periodo, desde, hasta, animal: a?.id ?? null })}
          />
        )}
      </Campo>
      <FilaDesplazable>
        {PERIODOS.map((p) => (
          <Chip key={p.id} activo={periodo === p.id} onClick={() => ir({ periodo: p.id, desde, hasta, animal: animal?.id ?? null })}>
            {p.texto}
          </Chip>
        ))}
      </FilaDesplazable>
      {periodo === "rango" ? (
        <form action="/leche" method="get" className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-[1fr_1fr_auto] min-[420px]:items-end">
          <input type="hidden" name="periodo" value="rango" />
          {animal ? <input type="hidden" name="animal" value={animal.id} /> : null}
          <Campo etiqueta="Desde">{(id) => <input id={id} name="desde" type="date" defaultValue={desde} max={hoy} required className={CLASE_INPUT} />}</Campo>
          <Campo etiqueta="Hasta">{(id) => <input id={id} name="hasta" type="date" defaultValue={hasta} max={hoy} required className={CLASE_INPUT} />}</Campo>
          <Boton type="submit" ancho={false}>Ver</Boton>
        </form>
      ) : null}
    </div>
  );
}
