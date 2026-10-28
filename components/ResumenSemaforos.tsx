import Link from "next/link";
import { CheckCircle2, ChevronRight, Siren, TriangleAlert } from "lucide-react";
import { Insignia } from "@/components/Insignia";
import { Tarjeta } from "@/components/Tarjeta";
import { contarSenales, type Senal } from "@/lib/semaforos";

/** Hoy: lo que pide atención en una mirada. Muestra primero lo rojo y lleva a la pantalla Semáforos para ver el detalle. */
export function ResumenSemaforos({ senales, maximo = 4 }: { senales: Senal[]; maximo?: number }) {
  const c = contarSenales(senales);
  const conAviso = senales.filter((s) => s.nivel !== "verde").sort((a, b) => (a.nivel === b.nivel ? 0 : a.nivel === "rojo" ? -1 : 1));
  return (
    <Tarjeta titulo="Semáforos" acciones={<Link href="/semaforos" className="text-sm font-semibold text-musgo">Ver todos</Link>}>
      <div className="mb-2 flex flex-wrap gap-2">
        <Insignia tono="alerta">{c.rojo} en rojo</Insignia>
        <Insignia tono="aviso">{c.ambar} en ámbar</Insignia>
        <Insignia tono="ok">{c.verde} en orden</Insignia>
      </div>
      {conAviso.length === 0 ? (
        <p className="flex items-center gap-2 text-[0.9375rem] font-semibold text-ok">
          <CheckCircle2 className="size-5" strokeWidth={2} aria-hidden="true" /> Todo en orden por ahora.
        </p>
      ) : (
        <ul className="divide-y divide-arena">
          {conAviso.slice(0, maximo).map((s) => (
            <li key={s.id}>
              <Link href="/semaforos" className="flex min-h-14 items-center justify-between gap-3 py-2">
                <span className="flex min-w-0 items-center gap-2.5">
                  {s.nivel === "rojo" ? <Siren className="size-5 shrink-0 text-rojo" strokeWidth={2} aria-hidden="true" /> : <TriangleAlert className="size-5 shrink-0 text-ambar" strokeWidth={2} aria-hidden="true" />}
                  <span className="min-w-0 [overflow-wrap:anywhere]">
                    <span className="block font-semibold">{s.titulo}</span>
                    <span className="block text-sm text-humo">{s.resumen}</span>
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-humo" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {conAviso.length > maximo ? <p className="mt-2 border-t border-arena pt-2 text-sm text-humo">Y {conAviso.length - maximo} más en Semáforos.</p> : null}
    </Tarjeta>
  );
}
