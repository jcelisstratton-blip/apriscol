import Link from "next/link";
import { Marca } from "@/components/Marca";

/** Pie de las pantallas públicas: enlaces legales y, al final y centrada, la firma de la agencia. */
export function PieLegal() {
  return (
    <footer className="mx-auto w-full max-w-6xl px-4 pb-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-arena pt-6 text-sm text-humo">
        <Marca />
        <nav aria-label="Información legal" className="flex flex-wrap items-center gap-x-1 gap-y-0">
          <Link href="/terminos" className="inline-flex min-h-11 items-center px-2 font-semibold hover:text-tinta">
            Términos de servicio
          </Link>
          <Link href="/privacidad" className="inline-flex min-h-11 items-center px-2 font-semibold hover:text-tinta">
            Política de privacidad
          </Link>
        </nav>
      </div>
      <p className="pt-4 text-center text-sm text-humo">Design by © Stratt-On Agency</p>
    </footer>
  );
}
