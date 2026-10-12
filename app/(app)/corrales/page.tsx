import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EnlaceBoton } from "@/components/Boton";
import { Encabezado } from "@/components/Encabezado";
import { FilaDesplazable } from "@/components/FilaDesplazable";
import { FiltroPeriodo } from "@/components/FiltroPeriodo";
import { ListaMovimientos } from "@/components/ListaMovimientos";
import { obtenerContexto } from "@/lib/contexto";
import { MOTIVOS } from "@/lib/corrales";
import { hoyBogota } from "@/lib/fechas";
import { esPeriodo, rangoPeriodo } from "@/lib/periodos";
import { puedeEscribir, puedeVer } from "@/lib/permisos";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { MotivoMovimiento } from "@/lib/tipos";
import { Resumen } from "./Resumen";

export const metadata: Metadata = { title: "Corrales" };

const PESTANAS = [
  { valor: "resumen", etiqueta: "Resumen" },
  { valor: "movimientos", etiqueta: "Movimientos" },
] as const;
type Vista = (typeof PESTANAS)[number]["valor"];

/**
 * Corrales (menú de todo el hato): el resumen de movimientos y del estado de las instalaciones, con filtros por fechas, y el historial de
 * movimientos. Crear corrales y potreros y mover animales se hace en Hato → Corrales, y la ubicación de cada animal en su ficha.
 */
export default async function PaginaCorrales({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; periodo?: string; desde?: string; hasta?: string; motivo?: string }>;
}) {
  const { finca, rol } = await obtenerContexto();
  if (!puedeVer(rol, "corrales")) redirect("/");
  const sp = await searchParams;
  const vista: Vista = PESTANAS.some((p) => p.valor === sp.vista) ? (sp.vista as Vista) : "resumen";
  const puedeEditar = puedeEscribir(rol, "corrales");
  const periodo = esPeriodo(sp.periodo) ? sp.periodo : "todo";
  const motivo: MotivoMovimiento | "todos" = MOTIVOS.includes(sp.motivo as MotivoMovimiento) ? (sp.motivo as MotivoMovimiento) : "todos";
  const filtroFechas = { periodo, desde: sp.desde, hasta: sp.hasta };
  const rango = rangoPeriodo(periodo, hoyBogota(), sp.desde, sp.hasta);

  let nombres: Record<string, string> = {};
  if (vista === "movimientos") {
    const supabase = await crearClienteServidor();
    const { data } = await supabase.from("ubicaciones").select("id, nombre").eq("finca_id", finca.id).limit(500);
    nombres = Object.fromEntries((data ?? []).map((u) => [u.id, u.nombre]));
  }

  return (
    <>
      <Encabezado
        titulo="Corrales"
        subtitulo={finca.nombre}
        acciones={puedeEditar ? <EnlaceBoton href="/hato?vista=corrales" ancho={false}>Ir a Hato</EnlaceBoton> : null}
      />
      <FilaDesplazable className="mb-3">
        {PESTANAS.map((t) => (
          <Link
            key={t.valor}
            href={t.valor === "resumen" ? "/corrales" : `/corrales?vista=${t.valor}`}
            aria-current={vista === t.valor ? "page" : undefined}
            className={`inline-flex min-h-10 shrink-0 items-center rounded-full px-4 text-sm font-semibold transition ${
              vista === t.valor ? "bg-musgo text-sobre-musgo" : "bg-papel text-humo ring-1 ring-arena hover:text-tinta"
            }`}
          >
            {t.etiqueta}
          </Link>
        ))}
      </FilaDesplazable>

      <div className="mb-3">
        <FiltroPeriodo ruta="/corrales" fijos={{ ...(vista !== "resumen" ? { vista } : {}), ...(motivo !== "todos" ? { motivo } : {}) }} filtro={filtroFechas} />
      </div>

      {vista === "resumen" ? <Resumen fincaId={finca.id} filtros={{ ...filtroFechas, motivo }} /> : null}
      {vista === "movimientos" ? <ListaMovimientos fincaId={finca.id} ubicaciones={nombres} rango={rango} puedeEditar={puedeEditar} /> : null}
    </>
  );
}
