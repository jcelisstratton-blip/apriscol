import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
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
import { Animales, CalidadLeche, ProgramaLeche } from "./ProgramaLeche";

export const metadata: Metadata = { title: "Hato" };

/**
 * Hato: los animales (con sus filtros) y, como un filtro más, «Ordeño»: el registro del ordeño de cada jornada y el programa de qué
 * hembras se ordeñan y en qué turnos. Lo que se mira de la producción de todo el hato (totales, gráficas) está en el menú «Leche».
 */
export default async function PaginaHato({ searchParams }: { searchParams: Promise<{ vista?: string; modo?: string; filtro?: string; agregar?: string; guardado?: string }> }) {
  const sp = await searchParams;
  const { finca, rol, perfil } = await obtenerContexto();
  const puedeCrear = puedeEscribir(rol, "hato");
  const verLeche = puedeVer(rol, "leche");
  const puedeRegistrar = puedeEscribir(rol, "leche");
  const enOrdeno = sp.vista === "ordeno" && verLeche;
  const verCarne = puedeVer(rol, "carne");
  const enCeba = sp.vista === "ceba" && verCarne;
  const verRepro = puedeVer(rol, "reproduccion");
  const enMonta = sp.vista === "empadronamiento" && verRepro;
  const verSanidad = puedeVer(rol, "sanidad");
  const enSanidad = sp.vista === "sanidad" && verSanidad;
  const verCorrales = puedeVer(rol, "corrales");
  const enCorrales = sp.vista === "corrales" && verCorrales;
  const conteos = await conteosHato(await crearClienteServidor(), finca.id, finca.especies);
  const vistas = vistasHato({ leche: verLeche, carne: verCarne, repro: verRepro, sanidad: verSanidad, corrales: verCorrales });
  // Quien no puede escribir leche (veterinario, contador) no registra ordeños: ve el programa y la calidad, sin poder cambiarlos.
  const modo = sp.modo === "calidad" ? "calidad" : sp.modo === "programar" || !puedeRegistrar ? "programar" : "registrar";

  return (
    <>
      <Encabezado
        titulo="Hato"
        subtitulo={finca.nombre}
        acciones={
          puedeCrear ? (
            <Link
              href="/hato/nuevo"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-musgo px-4 text-sm font-semibold text-sobre-musgo"
            >
              <Plus className="size-4" strokeWidth={2.4} /> Nuevo
            </Link>
          ) : null
        }
      />

      {enCeba ? (
        <div className="space-y-4">
          <TarjetasHato especies={finca.especies} vistas={vistas} conteos={conteos} vistaActiva="ceba" />
          <Ceba fincaId={finca.id} puedeEditar={puedeEscribir(rol, "carne")} />
        </div>
      ) : enMonta ? (
        <div className="space-y-4">
          <TarjetasHato especies={finca.especies} vistas={vistas} conteos={conteos} vistaActiva="empadronamiento" />
          <Monta fincaId={finca.id} umbral={finca.umbral_endogamia} puedeEditar={puedeEscribir(rol, "reproduccion")} />
        </div>
      ) : enSanidad ? (
        <div className="space-y-4">
          <TarjetasHato especies={finca.especies} vistas={vistas} conteos={conteos} vistaActiva="sanidad" />
          <Sanidad fincaId={finca.id} puedeEditar={puedeEscribir(rol, "sanidad")} guardado={sp.guardado === "1"} />
        </div>
      ) : enCorrales ? (
        <div className="space-y-4">
          <TarjetasHato especies={finca.especies} vistas={vistas} conteos={conteos} vistaActiva="corrales" />
          <Corrales fincaId={finca.id} puedeEditar={puedeEscribir(rol, "corrales")} guardado={sp.guardado === "1"} />
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
