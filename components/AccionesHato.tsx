import Link from "next/link";
import { FileSpreadsheet, Inbox, Plus } from "lucide-react";

/**
 * Los botones del encabezado del Hato. Cada uno dice qué hace con texto (los que caben) y con una ayuda al pasar el mouse (`title`):
 * «Cargar desde Excel» abre «Migrar mi finca», la guía de todo el proceso (animales, genealogía, pesos, ordeños y sanidad).
 */
export function AccionesHato({ puedeNovedad, puedeCrear }: { puedeNovedad: boolean; puedeCrear: boolean }) {
  return (
    <>
            {/* «Crear una novedad»: con texto para quien no crea animales (ordeñador, veterinario); como icono (con texto en pantalla ancha) junto a los demás botones para quien sí. En el celular angosto se oculta para que no aplaste el título: Novedades está en el menú y en «Al grano». */}
            {puedeNovedad ? (
              puedeCrear ? (
                <Link href="/novedades/nueva" aria-label="Crear una novedad" title="Crear una novedad: avisa que hay algo por comprar o aplicar" className="hidden size-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-arena text-sm font-semibold text-musgo transition active:scale-95 sm:inline-flex lg:w-auto lg:px-3.5">
                  <Inbox className="size-5" strokeWidth={1.75} aria-hidden="true" />
                  <span className="hidden lg:inline">Novedad</span>
                </Link>
              ) : (
                <Link href="/novedades/nueva" className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-musgo px-4 text-sm font-semibold text-sobre-musgo">
                  <Inbox className="size-4" strokeWidth={2.2} aria-hidden="true" /> Crear una novedad
                </Link>
              )
            ) : null}
            {puedeCrear ? (
              <>
                <Link
                  href="/hato/migrar"
                  title="Migrar mi finca desde Excel: animales, genealogía, pesos, ordeños y sanidad"
                  className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-arena px-3.5 text-sm font-semibold text-musgo transition active:scale-95"
                >
                  <FileSpreadsheet className="size-4" strokeWidth={1.9} aria-hidden="true" />
                  <span className="sm:hidden">Excel</span>
                  <span className="hidden sm:inline">Cargar desde Excel</span>
                </Link>
                <Link
                  href="/hato/nuevo"
                  title="Registrar un animal a mano"
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-musgo px-4 text-sm font-semibold text-sobre-musgo"
                >
                  <Plus className="size-4" strokeWidth={2.4} /> Nuevo
                </Link>
              </>
            ) : null}
    </>
  );
}
