import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { ChipEnlace } from "@/components/ChipEnlace";
import { Encabezado } from "@/components/Encabezado";
import { FilaDesplazable } from "@/components/FilaDesplazable";
import { obtenerContexto } from "@/lib/contexto";
import { puedeEscribir, puedeGestionar, puedeVer } from "@/lib/permisos";
import { DIRECCION_CEBA, DIRECCION_EMPADRONAMIENTO, DIRECCION_ORDENO, direccionHato, esFiltroHato, filtrosHato } from "@/lib/hato";
import { Registrar } from "./Registrar";
import { Ceba } from "./Ceba";
import { Monta } from "./Monta";
import { Animales, CalidadLeche, ProgramaLeche } from "./ProgramaLeche";

export const metadata: Metadata = { title: "Hato" };

/**
 * Hato: los animales (con sus filtros) y, como un filtro más, «Ordeño»: el registro del ordeño de cada jornada y el programa de qué
 * hembras se ordeñan y en qué turnos. Lo que se mira de la producción de todo el hato (totales, gráficas) está en el menú «Leche».
 */
export default async function PaginaHato({ searchParams }: { searchParams: Promise<{ vista?: string; modo?: string; filtro?: string; agregar?: string }> }) {
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
  // Quien no puede escribir leche (veterinario, contador) no registra ordeños: ve el programa y la calidad, sin poder cambiarlos.
  const modo = sp.modo === "calidad" ? "calidad" : sp.modo === "programar" || !puedeRegistrar ? "programar" : "registrar";
  const filtros = filtrosHato(finca.especies);

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
          <FilaDesplazable>
            {filtros.map((f) => (
              <ChipEnlace key={f.id} href={direccionHato(f.id)} activo={false}>
                {f.texto}
              </ChipEnlace>
            ))}
            {verLeche ? <ChipEnlace href={DIRECCION_ORDENO} activo={false}>Ordeño</ChipEnlace> : null}
            <ChipEnlace href={DIRECCION_CEBA} activo>
              Ceba
            </ChipEnlace>
            {verRepro ? <ChipEnlace href={DIRECCION_EMPADRONAMIENTO} activo={false}>Empadronamiento</ChipEnlace> : null}
          </FilaDesplazable>
          <Ceba fincaId={finca.id} puedeEditar={puedeEscribir(rol, "carne")} />
        </div>
      ) : enMonta ? (
        <div className="space-y-4">
          <FilaDesplazable>
            {filtros.map((f) => (
              <ChipEnlace key={f.id} href={direccionHato(f.id)} activo={false}>
                {f.texto}
              </ChipEnlace>
            ))}
            {verLeche ? <ChipEnlace href={DIRECCION_ORDENO} activo={false}>Ordeño</ChipEnlace> : null}
            {verCarne ? <ChipEnlace href={DIRECCION_CEBA} activo={false}>Ceba</ChipEnlace> : null}
            <ChipEnlace href={DIRECCION_EMPADRONAMIENTO} activo>
              Empadronamiento
            </ChipEnlace>
          </FilaDesplazable>
          <Monta fincaId={finca.id} umbral={finca.umbral_endogamia} puedeEditar={puedeEscribir(rol, "reproduccion")} />
        </div>
      ) : enOrdeno ? (
        <div className="space-y-4">
          <FilaDesplazable>
            {filtros.map((f) => (
              <ChipEnlace key={f.id} href={direccionHato(f.id)} activo={false}>
                {f.texto}
              </ChipEnlace>
            ))}
            <ChipEnlace href={DIRECCION_ORDENO} activo>
              Ordeño
            </ChipEnlace>
            {verCarne ? <ChipEnlace href={DIRECCION_CEBA} activo={false}>Ceba</ChipEnlace> : null}
            {verRepro ? <ChipEnlace href={DIRECCION_EMPADRONAMIENTO} activo={false}>Empadronamiento</ChipEnlace> : null}
          </FilaDesplazable>

          <FilaDesplazable>
            {puedeRegistrar ? (
              <ChipEnlace href={DIRECCION_ORDENO} activo={modo === "registrar"}>
                Registrar ordeño
              </ChipEnlace>
            ) : null}
            <ChipEnlace href={`${DIRECCION_ORDENO}&modo=programar`} activo={modo === "programar"}>
              Programar turnos
            </ChipEnlace>
            <ChipEnlace href={`${DIRECCION_ORDENO}&modo=calidad`} activo={modo === "calidad"}>
              Calidad
            </ChipEnlace>
          </FilaDesplazable>

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
          conOrdeno={verLeche}
          conCeba={verCarne}
          conMonta={verRepro}
        />
      )}
    </>
  );
}
