import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { AyudaModulo } from "@/components/AyudaModulo";
import { Encabezado } from "@/components/Encabezado";
import { InstalarApp } from "@/components/InstalarApp";
import { AYUDA_PANTALLA } from "@/lib/ayuda-pantallas";

export const metadata: Metadata = { title: "Instalar la app" };

/** Mi finca → Instalar la app: cómo está este aparato, el botón «Instalar» si el navegador lo permite y los pasos para iPhone, Android y computador. */
export default function PaginaInstalar() {
  return (
    <>
      <Link href="/mas" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo lg:hidden">
        <ChevronLeft className="size-5" strokeWidth={2} /> Más
      </Link>
      <Encabezado titulo="Instalar la app" subtitulo="Apriscol en la pantalla de inicio, como una app más" />
      <AyudaModulo ayuda={AYUDA_PANTALLA["/mas/instalar"]} />
      <div className="lg:max-w-xl">
        <InstalarApp />
      </div>
    </>
  );
}
