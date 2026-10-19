import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, GitFork, Scale } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Encabezado } from "@/components/Encabezado";
import { FormAjustes } from "@/components/FormAjustes";
import { Tarjeta } from "@/components/Tarjeta";
import { obtenerContexto } from "@/lib/contexto";
import { obtenerAjustes, obtenerRangosGestacion } from "@/lib/ajustes-servidor";
import { GRUPOS_AJUSTES, textoNumero } from "@/lib/ajustes";
import { puedeVer } from "@/lib/permisos";

export const metadata: Metadata = { title: "Ajustes de la finca" };

const FILA = "flex min-h-14 items-center gap-3.5 px-1 py-2";

export default async function PaginaAjustes() {
  const { finca, rol } = await obtenerContexto();
  const [ajustes, rangos] = await Promise.all([obtenerAjustes(), obtenerRangosGestacion()]);
  const puedeEditar = rol === "propietario";
  const version = [ajustes.general.updated_at, ajustes.especie.caprino.updated_at, ajustes.especie.ovino.updated_at].join("|");

  return (
    <>
      <Link href="/mas" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> Más
      </Link>
      <Encabezado titulo="Ajustes de la finca" subtitulo={finca.nombre} />
      <div className="space-y-3.5 lg:max-w-xl">
        {puedeEditar ? (
          <Aviso tipo="info">Aquí defines los tiempos, límites y criterios con los que la finca avisa y calcula. Vienen con valores sugeridos y los puedes ajustar a tu raza y a tu manejo.</Aviso>
        ) : (
          <Aviso tipo="info">Estos son los criterios de la finca. Solo el propietario puede cambiarlos.</Aviso>
        )}

        {GRUPOS_AJUSTES.map((g) => (
          <Tarjeta key={g.id} id={g.id} titulo={g.titulo}>
            <p className="mb-3 text-sm text-humo">{g.detalle}</p>
            <FormAjustes key={`${g.id}-${version}`} grupo={g} ajustes={ajustes} especies={finca.especies} rangos={rangos} puedeEditar={puedeEditar} />
          </Tarjeta>
        ))}

        <Tarjeta titulo="Otros criterios de la finca" className="divide-y divide-arena py-1.5!">
          <Link href="/hato/endogamia" className={FILA}>
            <GitFork className="size-5 text-musgo" strokeWidth={1.75} />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Límite de endogamia</span>
              <span className="block text-sm text-humo">{textoNumero(finca.umbral_endogamia * 100, 2)} % para dar la alerta</span>
            </span>
            <ChevronRight className="size-5 text-humo" strokeWidth={1.75} />
          </Link>
          {puedeVer(rol, "carne", finca.plan) ? (
            <Link href="/carne?vista=reglas" className={FILA}>
              <Scale className="size-5 text-musgo" strokeWidth={1.75} />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">Reglas de ceba</span>
                <span className="block text-sm text-humo">Cuándo pasar un animal a ceba</span>
              </span>
              <ChevronRight className="size-5 text-humo" strokeWidth={1.75} />
            </Link>
          ) : null}
        </Tarjeta>
      </div>
    </>
  );
}
