import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Marca } from "@/components/Marca";
import { PieLegal } from "@/components/legal/PieLegal";
import { ACTUALIZADO } from "@/lib/legal";

export type SeccionLegal = { id: string; titulo: string; contenido: React.ReactNode };

/** Párrafo de un documento legal. */
export function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[1rem] leading-relaxed text-tinta/90 [overflow-wrap:anywhere]">{children}</p>;
}

/** Lista con viñetas de un documento legal. */
export function Lista({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-5 text-[1rem] leading-relaxed text-tinta/90 marker:text-ocre [&_li]:[overflow-wrap:anywhere]">{children}</ul>;
}

/** Resumen destacado al inicio: lo esencial en pocas líneas. */
export function Resumen({ titulo, puntos }: { titulo: string; puntos: string[] }) {
  return (
    <div className="rounded-2xl bg-papel p-4 ring-1 ring-arena sm:p-5">
      <p className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-ocre">{titulo}</p>
      <ul className="mt-2.5 space-y-2">
        {puntos.map((p) => (
          <li key={p} className="flex gap-2.5 text-[0.9375rem] leading-snug [overflow-wrap:anywhere]">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-musgo" aria-hidden="true" />
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Tabla simple de dos columnas que en el celular se apila (nada cortado a 320 px). */
export function Tabla({ filas }: { filas: [string, React.ReactNode][] }) {
  return (
    <dl className="divide-y divide-arena overflow-hidden rounded-2xl bg-papel ring-1 ring-arena">
      {filas.map(([dato, detalle]) => (
        <div key={dato} className="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-[13rem_1fr] sm:gap-4">
          <dt className="text-[0.9375rem] font-semibold [overflow-wrap:anywhere]">{dato}</dt>
          <dd className="min-w-0 text-[0.9375rem] leading-relaxed text-humo [overflow-wrap:anywhere]">{detalle}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Estructura común de Términos y Privacidad: encabezado, índice, secciones numeradas y pie con la firma. */
export function PaginaLegal({
  actual,
  rotulo,
  titulo,
  introduccion,
  resumen,
  secciones,
}: {
  actual: "terminos" | "privacidad";
  rotulo: string;
  titulo: string;
  introduccion: string;
  resumen: React.ReactNode;
  secciones: SeccionLegal[];
}) {
  const otro = actual === "terminos" ? { href: "/privacidad", texto: "Política de privacidad" } : { href: "/terminos", texto: "Términos de servicio" };
  return (
    <div className="min-h-dvh bg-lana text-tinta">
      <header className="px-3 pt-[calc(0.5rem+env(safe-area-inset-top))] sm:px-6">
        <nav aria-label="Principal" className="mx-auto flex max-w-5xl items-center justify-between gap-3 rounded-full bg-papel/85 py-1.5 pl-4 pr-1.5 shadow-sm ring-1 ring-arena">
          <Link href="/login" aria-label="Apriscol, inicio" className="shrink-0 whitespace-nowrap">
            <Marca />
          </Link>
          <Link href="/login" className="inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-sm font-semibold text-musgo ring-1 ring-arena hover:bg-lana">
            <ArrowLeft className="size-4" strokeWidth={2} aria-hidden="true" /> Volver
          </Link>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-10 pt-10 sm:px-6 sm:pt-14">
        <div className="max-w-3xl space-y-3">
          <p className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-ocre">{rotulo}</p>
          <h1 className="font-display text-[2rem] font-semibold leading-[1.08] tracking-tight sm:text-5xl">{titulo}</h1>
          <p className="text-[1.0625rem] text-humo">{introduccion}</p>
          <p className="text-sm text-humo">Última actualización: {ACTUALIZADO}</p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[16rem_1fr] lg:gap-12">
          <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
            <nav aria-label="Contenido del documento" className="rounded-2xl bg-papel p-4 ring-1 ring-arena">
              <p className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-ocre">Contenido</p>
              <ol className="mt-2 space-y-0.5">
                {secciones.map((s, i) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`} className="flex min-h-9 items-baseline gap-2 rounded-lg px-1 py-1.5 text-[0.9375rem] text-humo hover:text-tinta">
                      <span className="shrink-0 font-mono text-xs font-semibold text-ocre">{String(i + 1).padStart(2, "0")}</span>
                      <span className="min-w-0 [overflow-wrap:anywhere]">{s.titulo}</span>
                    </a>
                  </li>
                ))}
              </ol>
              <Link href={otro.href} className="mt-3 inline-flex min-h-11 items-center border-t border-arena pt-3 text-[0.9375rem] font-semibold text-musgo underline-offset-4 hover:underline">
                {otro.texto} →
              </Link>
            </nav>
          </aside>

          <div className="min-w-0 space-y-9">
            {resumen}
            {secciones.map((s, i) => (
              <section key={s.id} id={s.id} className="scroll-mt-6 space-y-3">
                <h2 className="flex items-baseline gap-3 font-display text-2xl font-semibold leading-tight tracking-tight">
                  <span className="shrink-0 font-mono text-sm font-semibold text-ocre">{String(i + 1).padStart(2, "0")}</span>
                  <span className="min-w-0 [overflow-wrap:anywhere]">{s.titulo}</span>
                </h2>
                <div className="space-y-3">{s.contenido}</div>
              </section>
            ))}
          </div>
        </div>
      </main>

      <PieLegal />
    </div>
  );
}
