"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { FlaskConical } from "lucide-react";
import { CampoBusqueda } from "@/components/CampoBusqueda";
import { EstadoVacio } from "@/components/EstadoVacio";
import { Chip, FilaDesplazable } from "@/components/FilaDesplazable";
import { Insignia } from "@/components/Insignia";
import { ListaPorTramos } from "@/components/ListaPorTramos";
import { formatoFecha } from "@/lib/fechas";
import { estadoRcs, formatoMiles, RCS_ALTO } from "@/lib/leche-calidad";

export type HembraCalidad = {
  id: string;
  etiqueta: string;
  ultimo: { fecha: string; grasa_pct: number | null; proteina_pct: number | null; rcs_miles_ml: number | null } | null;
};

type Filtro = "todas" | "sin" | "altas";
const MIN_PARA_BUSCAR = 8;
const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const esAlta = (h: HembraCalidad) => (h.ultimo?.rcs_miles_ml ?? 0) > RCS_ALTO;

/** Hato → Ordeño → Calidad: cada hembra en leche con su último análisis, y el atajo para registrar uno desde su ficha. */
export function CalidadAnimales({ hembras, puedeEditar }: { hembras: HembraCalidad[]; puedeEditar: boolean }) {
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const alBuscar = useCallback((t: string) => setBusqueda(t), []);

  if (hembras.length === 0) {
    return (
      <EstadoVacio
        icono={<FlaskConical strokeWidth={1.5} />}
        titulo="Aún no hay hembras en leche"
        descripcion="Aquí registras la calidad de la leche de cada hembra en ordeño. Primero agrega hembras al ordeño."
      />
    );
  }

  const sin = hembras.filter((h) => !h.ultimo).length;
  const altas = hembras.filter(esAlta).length;
  const texto = sinTildes(busqueda);
  const filtradas = hembras
    .filter((h) => (filtro === "sin" ? !h.ultimo : filtro === "altas" ? esAlta(h) : true))
    .filter((h) => !texto || sinTildes(h.etiqueta).includes(texto));

  return (
    <div className="space-y-3">
      <p className="px-1 text-[0.9375rem] text-humo">El último análisis de grasa, proteína y células somáticas de cada hembra en leche. Toca una para ver todo su historial.</p>
      {hembras.length > MIN_PARA_BUSCAR ? <CampoBusqueda onBuscar={alBuscar} placeholder="Buscar por arete o nombre" /> : null}
      <FilaDesplazable>
        <Chip activo={filtro === "todas"} onClick={() => setFiltro("todas")}>{`Todas (${hembras.length})`}</Chip>
        <Chip activo={filtro === "sin"} onClick={() => setFiltro("sin")}>{`Sin análisis (${sin})`}</Chip>
        <Chip activo={filtro === "altas"} onClick={() => setFiltro("altas")}>{`Células altas (${altas})`}</Chip>
      </FilaDesplazable>
      {filtradas.length === 0 ? (
        <p className="py-6 text-center text-[0.9375rem] text-humo">Ninguna hembra coincide.</p>
      ) : (
        <ListaPorTramos
          key={`${texto}|${filtro}`}
          items={filtradas}
          clave={(h) => h.id}
          fila={(h) => {
            const rcs = h.ultimo?.rcs_miles_ml != null ? estadoRcs(h.ultimo.rcs_miles_ml) : null;
            return (
              <div className="flex items-start gap-3 rounded-2xl bg-papel px-3.5 py-3 ring-1 ring-arena">
                <Link href={`/hato/${h.id}#calidad`} className="block min-w-0 flex-1">
                  <span className="block font-bold [overflow-wrap:anywhere]">{h.etiqueta}</span>
                  {h.ultimo ? (
                    <>
                      <span className="block text-sm text-humo [overflow-wrap:anywhere]">
                        {formatoFecha(h.ultimo.fecha, { day: "numeric", month: "short", year: "numeric" })}
                        {" · "}
                        {[
                          h.ultimo.grasa_pct != null ? `Grasa ${h.ultimo.grasa_pct.toLocaleString("es-CO")} %` : null,
                          h.ultimo.proteina_pct != null ? `Proteína ${h.ultimo.proteina_pct.toLocaleString("es-CO")} %` : null,
                          h.ultimo.rcs_miles_ml != null ? `Células ${formatoMiles(h.ultimo.rcs_miles_ml)}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                      {rcs ? (
                        <span className="mt-1.5 block">
                          <Insignia tono={rcs.tono}>{`Células somáticas: ${rcs.texto.toLowerCase()}`}</Insignia>
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <span className="block text-sm text-humo">Sin análisis todavía</span>
                  )}
                </Link>
                {puedeEditar ? (
                  <Link href={`/hato/${h.id}/calidad/nuevo`} className="inline-flex min-h-11 shrink-0 items-center text-sm font-semibold text-musgo underline-offset-4 hover:underline">
                    Registrar
                  </Link>
                ) : null}
              </div>
            );
          }}
        />
      )}
    </div>
  );
}
