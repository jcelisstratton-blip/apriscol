import Image from "next/image";
import Link from "next/link";
import { Clock, Play } from "lucide-react";
import { disponible, miniatura, rutaTutorial, type Tutorial } from "@/lib/tutoriales";

/** La tarjeta «Míralo en video» de una ayuda: abre el tutorial de ese módulo; si su video todavía no está publicado, se ve apagada con «Próximamente». */
export function TarjetaVideo({ t, alAbrir, className = "mt-5" }: { t: Tutorial; alAbrir?: () => void; className?: string }) {
  const lista = disponible(t);
  const contenido = (
    <>
      <span className="relative block aspect-video w-28 shrink-0 overflow-hidden rounded-xl bg-arena">
        <Image src={miniatura(t)} alt="" width={800} height={450} sizes="112px" unoptimized className={`size-full object-cover ${lista ? "" : "opacity-60 saturate-50"}`} />
        <span className={`absolute inset-0 grid place-items-center ${lista ? "bg-black/20" : "bg-black/35"}`}>
          <span className="grid size-8 place-items-center rounded-full bg-white/95 text-musgo shadow">
            {lista ? <Play className="ml-0.5 size-3.5 fill-current" strokeWidth={1.75} aria-hidden="true" /> : <Clock className="size-3.5" strokeWidth={1.9} aria-hidden="true" />}
          </span>
        </span>
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-bold uppercase tracking-[0.12em] text-ocre">{lista ? "Míralo en video" : "Tutorial en video"}</span>
        <span className="block font-semibold leading-snug [overflow-wrap:anywhere]">{t.titulo}</span>
        <span className="block text-sm text-humo">
          Tutorial {t.numero} · {lista ? t.duracion : "Próximamente"}
        </span>
      </span>
    </>
  );
  return lista ? (
    <Link href={rutaTutorial(t.numero)} onClick={alAbrir} className={`group ${className} flex items-center gap-3 rounded-2xl bg-lana p-2 pr-4 ring-1 ring-arena transition hover:ring-musgo/40 active:scale-[0.99]`}>
      {contenido}
    </Link>
  ) : (
    <div role="note" aria-label={`Tutorial ${t.numero}: ${t.titulo} (próximamente)`} className={`${className} flex items-center gap-3 rounded-2xl bg-lana p-2 pr-4 ring-1 ring-arena`}>
      {contenido}
    </div>
  );
}
