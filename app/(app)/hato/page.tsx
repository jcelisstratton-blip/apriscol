import type { Metadata } from "next";
import Link from "next/link";
import { FileSpreadsheet, Plus } from "lucide-react";
import { AyudaModulo } from "@/components/AyudaModulo";
import { TarjetasHato } from "@/components/TarjetasHato";
import { AYUDA_ORDENO } from "@/lib/ayuda";
import { Encabezado } from "@/components/Encabezado";
import { FilaTarjetas, TarjetaOpcion } from "@/components/TarjetaOpcion";
import { ESCENA_ORDENO } from "@/lib/escenas";
import { obtenerContexto } from "@/lib/contexto";
import { puedeEscribir, puedeGestionar, puedeVer } from "@/lib/permisos";
import { conteosHato, DIRECCION_ORDENO, esFiltroHato, vistasHato } from "@/lib/hato";
import { crearClienteServidor } from "@/lib/supabase/server";
import { Registrar } from "./Registrar";
import { Ceba } from "./Ceba";
import { Monta } from "./Monta";
import { Sanidad } from "./Sanidad";
import { Corrales } from "./Corrales";
import { Gastos } from "./Gastos";
import { Ventas } from "./Ventas";
import { Animales, CalidadLeche, ProgramaLeche } from "./ProgramaLeche";

export const metadata: Metadata = { title: "Hato" };

/**
 * Hato: los animales (con sus filtros) y, como un filtro más, «Ordeño»: el registro del ordeño de cada jornada y el programa de qué
 * hembras se ordeñan y en qué turnos. Lo que se mira de la producción de todo el hato (totales, gráficas) está en el menú «Leche».
 */
export default async function PaginaHato({ searchParams }: { searchParams: Promise<{ vista?: string; modo?: string; filtro?: string; agregar?: string; guardado?: string }> }) {
  const sp = await searchParams;
  const { finca, rol, perfil } = await obtenerContexto();
  const puedeCrear = puedeEscribir(rol, "hato", finca.plan);
  const verLeche = puedeVer(rol, "leche", finca.plan);
  const puedeRegistrar = puedeEscribir(rol, "leche", finca.plan);
  const enOrdeno = sp.vista === "ordeno" && verLeche;
  const verCarne = puedeVer(rol, "carne", finca.plan);
  const enCeba = sp.vista === "ceba" && verCarne;
  const verRepro = puedeVer(rol, "reproduccion", finca.plan);
  const enMonta = sp.vista === "empadronamiento" && verRepro;
  const verSanidad = puedeVer(rol, "sanidad", finca.plan);
  const enSanidad = sp.vista === "sanidad" && verSanidad;
  const verCorrales = puedeVer(rol, "corrales", finca.plan);
  const enCorrales = sp.vista === "corrales" && verCorrales;
  const conteos = await conteosHato(await crearClienteServidor(), finca.id, finca.especies);
  const verGastos = puedeVer(rol, "contabilidad", finca.plan);
  const enGastos = sp.vista === "gastos" && verGastos;
  const enVentas = sp.vista === "ventas" && verGastos;
  const vistas = vistasHato({ leche: verLeche, carne: verCarne, repro: verRepro, sanidad: verSanidad, corrales: verCorrales, gastos: verGastos });
  // Quien no puede escribir leche (veterinario, contador) no registra ordeños: ve el programa y la calidad, sin poder cambiarlos.
  const modo = sp.modo === "calidad" ? "calidad" : sp.modo === "programar" || !puedeRegistrar ? "programar" : "registrar";

  return (
    <>
      <Encabezado
        titulo="Hato"
        subtitulo={finca.nombre}
        acciones={
          puedeCrear ? (
            <>
              <Link
                href="/hato/importar"
                aria-label="Cargar animales desde Excel"
                className="grid size-11 shrink-0 place-items-center rounded-full bg-arena text-musgo transition active:scale-95"
              >
                <FileSpreadsheet className="size-5" strokeWidth={1.75} aria-hidden="true" />
              </Link>
              <Link
                href="/hato/nuevo"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-musgo px-4 text-sm font-semibold text-sobre-musgo"
              >
                <Plus className="size-4" strokeWidth={2.4} /> Nuevo
              </Link>
            </>
          ) : null
        }
      />

      {enCeba ? (
        <div className="space-y-4">
          <TarjetasHato especies={finca.especies} vistas={vistas} conteos={conteos} vistaActiva="ceba" />
          <Ceba fincaId={finca.id} puedeEditar={puedeEscribir(rol, "carne", finca.plan)} />
        </div>
      ) : enMonta ? (
        <div className="space-y-4">
          <TarjetasHato especies={finca.especies} vistas={vistas} conteos={conteos} vistaActiva="empadronamiento" />
          <Monta fincaId={finca.id} umbral={finca.umbral_endogamia} puedeEditar={puedeEscribir(rol, "reproduccion", finca.plan)} />
        </div>
      ) : enSanidad ? (
        <div className="space-y-4">
          <TarjetasHato especies={finca.especies} vistas={vistas} conteos={conteos} vistaActiva="sanidad" />
          <Sanidad fincaId={finca.id} puedeEditar={puedeEscribir(rol, "sanidad", finca.plan)} guardado={sp.guardado === "1"} />
        </div>
      ) : enCorrales ? (
        <div className="space-y-4">
          <TarjetasHato especies={finca.especies} vistas={vistas} conteos={conteos} vistaActiva="corrales" />
          <Corrales fincaId={finca.id} puedeEditar={puedeEscribir(rol, "corrales", finca.plan)} guardado={sp.guardado === "1"} />
        </div>
      ) : enGastos ? (
        <div className="space-y-4">
          <TarjetasHato especies={finca.especies} vistas={vistas} conteos={conteos} vistaActiva="gastos" />
          <Gastos fincaId={finca.id} puedeEditar={puedeEscribir(rol, "contabilidad", finca.plan)} guardado={sp.guardado === "1"} />
        </div>
      ) : enVentas ? (
        <div className="space-y-4">
          <TarjetasHato especies={finca.especies} vistas={vistas} conteos={conteos} vistaActiva="ventas" />
          <Ventas fincaId={finca.id} puedeEditar={puedeEscribir(rol, "contabilidad", finca.plan)} guardado={sp.guardado === "1"} />
        </div>
      ) : enOrdeno ? (
        <div className="space-y-4">
          <TarjetasHato especies={finca.especies} vistas={vistas} conteos={conteos} vistaActiva="ordeno" />
          <AyudaModulo ayuda={AYUDA_ORDENO} />

          <FilaTarjetas etiqueta="Qué hacer con el ordeño">
            {puedeRegistrar ? <TarjetaOpcion escena={ESCENA_ORDENO.registrar} titulo="Registrar ordeño" detalle="Litros de cada jornada" href={DIRECCION_ORDENO} activo={modo === "registrar"} /> : null}
            <TarjetaOpcion escena={ESCENA_ORDENO.programar} titulo="Programar turnos" detalle="Quién se ordeña y cuándo" href={`${DIRECCION_ORDENO}&modo=programar`} activo={modo === "programar"} />
            <TarjetaOpcion escena={ESCENA_ORDENO.calidad} titulo="Calidad" detalle="Análisis de la leche" href={`${DIRECCION_ORDENO}&modo=calidad`} activo={modo === "calidad"} />
          </FilaTarjetas>

          {modo === "registrar" ? (
            <Registrar fincaId={finca.id} puedeEditar={puedeRegistrar} agregar={sp.agregar} />
          ) : modo === "calidad" ? (
            <CalidadLeche fincaId={finca.id} puedeEditar={puedeRegistrar} />
          ) : (
            <ProgramaLeche fincaId={finca.id} puedeEditar={puedeCrear} />
          )}
        </div>
      ) : (
        <Animales
          fincaId={finca.id}
          especies={finca.especies}
          puedeCrear={puedeCrear}
          puedeTraer={puedeGestionar(rol) && !perfil?.libro_resuelto_en}
          filtroInicial={esFiltroHato(sp.filtro) ? sp.filtro : "todos"}
          vistas={vistas}
          conteos={conteos}
        />
      )}
    </>
  );
}
