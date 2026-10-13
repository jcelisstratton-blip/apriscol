import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AvisoGuardado } from "@/components/AvisoGuardado";
import { EnlaceBoton } from "@/components/Boton";
import { Encabezado } from "@/components/Encabezado";
import { PestanasTarjetas } from "@/components/TarjetaOpcion";
import { armarPestanas } from "@/lib/escenas";
import { FiltroPeriodo } from "@/components/FiltroPeriodo";
import { ListaEventos } from "@/components/ListaEventos";
import { ListaProductos } from "@/components/ListaProductos";
import { ListaPruebas } from "@/components/ListaPruebas";
import { obtenerContexto } from "@/lib/contexto";
import { hoyBogota } from "@/lib/fechas";
import { esPeriodo, rangoPeriodo } from "@/lib/periodos";
import { puedeEscribir, puedeVer } from "@/lib/permisos";
import { TIPOS_EVENTO } from "@/lib/sanidad";
import type { TipoEvento } from "@/lib/tipos";
import { Resumen } from "./Resumen";

export const metadata: Metadata = { title: "Sanidad" };

const PESTANAS = [
  { valor: "resumen", etiqueta: "Resumen", detalle: "Lo aplicado y por atender" },
  { valor: "historial", etiqueta: "Historial", detalle: "Todo lo aplicado" },
  { valor: "productos", etiqueta: "Productos", detalle: "Tu catálogo veterinario" },
  { valor: "pruebas", etiqueta: "Pruebas", detalle: "Diagnósticos del hato" },
] as const;
type Vista = (typeof PESTANAS)[number]["valor"];

/**
 * Sanidad (menú de todo el hato): el resumen de lo aplicado, programado y por atender, con filtros por fechas, más el historial, los productos y las
 * pruebas. Programar y aplicar vacunas o tratamientos a varios animales se hace en Hato → Sanidad, y lo de cada animal en su ficha.
 */
export default async function PaginaSanidad({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; guardado?: string; periodo?: string; desde?: string; hasta?: string; tipo?: string }>;
}) {
  const { finca, rol } = await obtenerContexto();
  if (!puedeVer(rol, "sanidad", finca.plan)) redirect("/");
  const sp = await searchParams;
  const vista: Vista = PESTANAS.some((p) => p.valor === sp.vista) ? (sp.vista as Vista) : "resumen";
  const puedeEditar = puedeEscribir(rol, "sanidad", finca.plan);
  const periodo = esPeriodo(sp.periodo) ? sp.periodo : "todo";
  const tipo: TipoEvento | "todos" = TIPOS_EVENTO.includes(sp.tipo as TipoEvento) ? (sp.tipo as TipoEvento) : "todos";
  const filtroFechas = { periodo, desde: sp.desde, hasta: sp.hasta };
  const rango = rangoPeriodo(periodo, hoyBogota(), sp.desde, sp.hasta);
  const conFechas = vista === "resumen" || vista === "historial" || vista === "pruebas";

  const accion = vista === "productos" && puedeEditar ? <EnlaceBoton href="/sanidad/productos/nuevo" ancho={false}>Nuevo producto</EnlaceBoton> : null;

  return (
    <>
      <AvisoGuardado activo={sp.guardado === "1"} />
      <Encabezado titulo="Sanidad" subtitulo={finca.nombre} acciones={accion} />
      <PestanasTarjetas pestanas={armarPestanas("/sanidad", "resumen", PESTANAS)} actual={vista} />

      {conFechas ? (
        <div className="mb-3">
          <FiltroPeriodo ruta="/sanidad" fijos={{ ...(vista !== "resumen" ? { vista } : {}), ...(tipo !== "todos" && vista !== "pruebas" ? { tipo } : {}) }} filtro={filtroFechas} />
        </div>
      ) : null}

      {vista === "resumen" ? <Resumen fincaId={finca.id} filtros={{ ...filtroFechas, tipo }} puedeProgramar={puedeEditar} /> : null}
      {vista === "historial" ? <ListaEventos fincaId={finca.id} puedeRegistrar={puedeEditar} rango={rango} tipoInicial={tipo} /> : null}
      {vista === "productos" ? <ListaProductos fincaId={finca.id} puedeEditar={puedeEditar} /> : null}
      {vista === "pruebas" ? <ListaPruebas fincaId={finca.id} puedeEditar={puedeEditar} rango={rango} /> : null}
    </>
  );
}
