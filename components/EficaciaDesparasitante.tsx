import Link from "next/link";
import { Pencil, Plus } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Insignia } from "@/components/Insignia";
import { Tarjeta } from "@/components/Tarjeta";
import { ANIMALES_MIN_EFICACIA, ETIQUETA_MOMENTO, eficaciaDesparasitante, textoResultado } from "@/lib/coprologico";
import { etiquetaAnimal } from "@/lib/animal";
import type { AnimalCorto } from "@/lib/animal-etiquetas";
import type { ExamenCoprologico } from "@/lib/tipos";

const MAX_FILAS = 25;

/**
 * «¿Funcionó el desparasitante?»: la prueba de reducción del conteo de huevos de una desparasitación. Por cada animal, el examen de antes y el de
 * después (10 a 14 días); con ambos, se compara el promedio. Solo se puede registrar si el animal recibió esta desparasitación.
 */
export function EficaciaDesparasitante({ eventoId, animales, examenes, puedeEditar }: { eventoId: string; animales: AnimalCorto[]; examenes: ExamenCoprologico[]; puedeEditar: boolean }) {
  const resultado = eficaciaDesparasitante(examenes);
  const porAnimal = new Map<string, { antes?: ExamenCoprologico; despues?: ExamenCoprologico }>();
  for (const x of examenes) {
    if (x.momento === "diagnostico") continue;
    const fila = porAnimal.get(x.animal_id) ?? {};
    fila[x.momento] = x;
    porAnimal.set(x.animal_id, fila);
  }
  const filas = animales.slice(0, MAX_FILAS);
  const nuevo = (animal: string, momento: "antes" | "despues") => `/hato/sanidad/coprologico/nuevo?animal=${animal}&evento=${eventoId}&momento=${momento}`;

  return (
    <Tarjeta titulo="¿Funcionó el desparasitante?">
      <p className="mb-3 text-sm text-humo">
        Cuenta los huevos de las heces antes de desparasitar y de nuevo 10 a 14 días después. Si bajan en 95 % o más, el producto funcionó; si bajan menos de 90 %, puede haber resistencia. Con menos de {ANIMALES_MIN_EFICACIA} animales es solo una orientación.
      </p>
      {resultado ? (
        <div className="mb-3 space-y-2 rounded-2xl bg-lana px-3 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[0.9375rem]">
              <span className="font-semibold">Bajó {String(resultado.reduccion).replace(".", ",")} %</span>
              <span className="block text-sm text-humo">
                De {resultado.mediaAntes.toLocaleString("es-CO")} a {resultado.mediaDespues.toLocaleString("es-CO")} huevos por gramo en promedio · {resultado.n} {resultado.n === 1 ? "animal" : "animales"}
              </span>
            </span>
            <Insignia tono={resultado.veredicto === "eficaz" ? "ok" : resultado.veredicto === "dudoso" ? "aviso" : "alerta"}>{resultado.veredicto === "eficaz" ? "Funcionó" : resultado.veredicto === "dudoso" ? "Dudoso" : "Posible resistencia"}</Insignia>
          </div>
          <Aviso tipo={resultado.veredicto === "eficaz" ? "info" : "atencion"}>
            {resultado.texto}
            {resultado.orientativo ? ` Es solo una orientación: hay ${resultado.n} de al menos ${ANIMALES_MIN_EFICACIA} animales.` : ""}
          </Aviso>
        </div>
      ) : null}
      <ul className="divide-y divide-arena">
        {filas.map((a) => {
          const x = porAnimal.get(a.id) ?? {};
          return (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5">
              <span className="min-w-0 font-semibold [overflow-wrap:anywhere]">{etiquetaAnimal(a)}</span>
              <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
                {(["antes", "despues"] as const).map((m) =>
                  x[m] ? (
                    puedeEditar ? (
                      <Link key={m} href={`/hato/sanidad/coprologico/${x[m]!.id}/editar`} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-musgo underline-offset-4 hover:underline">
                        {ETIQUETA_MOMENTO[m].split(" ")[0]}: {textoResultado(x[m]!)} <Pencil className="size-3.5" strokeWidth={2} aria-hidden="true" />
                      </Link>
                    ) : (
                      <span key={m} className="text-sm">{ETIQUETA_MOMENTO[m].split(" ")[0]}: {textoResultado(x[m]!)}</span>
                    )
                  ) : puedeEditar ? (
                    <Link key={m} href={nuevo(a.id, m)} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-musgo underline-offset-4 hover:underline">
                      <Plus className="size-3.5" strokeWidth={2.2} aria-hidden="true" /> {m === "antes" ? "Antes" : "Después"}
                    </Link>
                  ) : null,
                )}
              </span>
            </li>
          );
        })}
      </ul>
      {animales.length > MAX_FILAS ? <p className="mt-2 text-sm text-humo">Se muestran {MAX_FILAS} de {animales.length} animales. Para los demás, registra el examen desde la ficha de cada uno.</p> : null}
    </Tarjeta>
  );
}
