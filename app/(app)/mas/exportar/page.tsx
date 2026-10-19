import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, Download } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Encabezado } from "@/components/Encabezado";
import { Tarjeta } from "@/components/Tarjeta";
import { obtenerContexto } from "@/lib/contexto";
import { DIAS_ENLACE_ARCHIVO } from "@/lib/exportar-finca";

export const metadata: Metadata = { title: "Exportar los datos" };

export default async function PaginaExportar() {
  const { finca, rol } = await obtenerContexto();
  if (rol !== "propietario") redirect("/mas");

  return (
    <>
      <Link href="/mas" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> Más
      </Link>
      <Encabezado titulo="Exportar los datos" subtitulo={finca.nombre} />
      <div className="space-y-3.5 lg:max-w-xl">
        <Tarjeta>
          <div className="space-y-3.5">
            <p className="text-[0.9375rem]">
              Un solo archivo de Excel con todo lo de <strong>{finca.nombre}</strong>: animales y genealogía, reproducción, leche, sanidad, compras, ventas, personal y pagos, corrales y ajustes. Cada tema va en su hoja.
            </p>
            <Aviso tipo="info">La hoja «Animales» tiene el formato de la plantilla de cargue, así que sirve para llevar el hato a otra finca.</Aviso>
            <Aviso tipo="atencion">
              Las fotos y los documentos van como enlaces que funcionan {DIAS_ENLACE_ARCHIVO} días: descárgalos antes de que venzan. Si la finca tiene muchos registros, el archivo tarda en prepararse.
            </Aviso>
            <a
              href="/mas/exportar/archivo"
              download
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-musgo px-5 text-base font-semibold text-sobre-musgo shadow-sm transition hover:brightness-110 active:scale-[0.98]"
            >
              <Download className="size-5" strokeWidth={1.75} aria-hidden="true" /> Descargar los datos en Excel
            </a>
          </div>
        </Tarjeta>
      </div>
    </>
  );
}
