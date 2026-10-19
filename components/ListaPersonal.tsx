"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Users } from "lucide-react";
import { CampoBusqueda } from "@/components/CampoBusqueda";
import { EstadoVacio } from "@/components/EstadoVacio";
import { Insignia } from "@/components/Insignia";
import { ListaPorTramos } from "@/components/ListaPorTramos";
import { pesos } from "@/lib/ferias";
import { ETIQUETA_ROL } from "@/lib/permisos";
import { ETIQUETA_FORMA_PAGO, ETIQUETA_VINCULACION, UNIDAD_PAGO } from "@/lib/nomina";
import type { Persona } from "@/lib/tipos";

const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Las personas de la finca: quién es, cómo está vinculada, cómo y cuánto se le paga. Con buscador cuando la lista crece. */
export function ListaPersonal({ personal, puedeEditar }: { personal: Persona[]; puedeEditar: boolean }) {
  const [texto, setTexto] = useState("");
  const visibles = useMemo(() => {
    const t = sinTildes(texto.trim());
    return t ? personal.filter((p) => sinTildes(`${p.nombre} ${p.cargo ?? ""}`).includes(t)) : personal;
  }, [personal, texto]);

  if (personal.length === 0) {
    return <EstadoVacio icono={<Users strokeWidth={1.5} />} titulo="Todavía no hay personal" descripcion="Al invitar a alguien en esta misma pantalla, o agregarlo sin acceso a la app, queda aquí con su contrato: cada pago se calcula solo." />;
  }
  return (
    <div className="space-y-3">
      {personal.length > 8 ? <CampoBusqueda onBuscar={setTexto} placeholder="Buscar por nombre o cargo" /> : null}
      {visibles.length === 0 ? (
        <EstadoVacio icono={<Users strokeWidth={1.5} />} titulo="Nadie con ese nombre" descripcion="Prueba con otra búsqueda." />
      ) : (
        <ListaPorTramos
          key={texto}
          items={visibles}
          clave={(p) => p.id}
          fila={(p) => (
            <div className="min-w-0 rounded-2xl bg-papel p-3.5 ring-1 ring-arena">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold [overflow-wrap:anywhere]">{p.nombre}</p>
                  {p.cargo ? <p className="text-sm text-humo [overflow-wrap:anywhere]">{p.cargo}</p> : null}
                </div>
                <p className="shrink-0 text-right font-display text-lg font-semibold tabular-nums">{pesos(Number(p.valor_base))}</p>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <Insignia tono={p.activo ? "ok" : "neutro"}>{p.activo ? "Activa" : "Retirada"}</Insignia>
                <Insignia tono="neutro">{ETIQUETA_VINCULACION[p.vinculacion]}</Insignia>
                <Insignia tono={p.rol ? "musgo" : "neutro"}>{p.rol ? `App: ${ETIQUETA_ROL[p.rol]}` : "Sin acceso a la app"}</Insignia>
                <span className="text-xs text-humo">
                  {ETIQUETA_FORMA_PAGO[p.forma_pago]} · {UNIDAD_PAGO[p.forma_pago].valor.toLowerCase()}
                </span>
              </div>
              {puedeEditar ? (
                <div className="mt-1 flex flex-wrap items-center gap-x-4 border-t border-arena pt-1">
                  {p.activo ? (
                    <Link href={`/personal/pagos/nuevo?persona=${p.id}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-musgo underline-offset-4 hover:underline">
                      Registrar un pago
                    </Link>
                  ) : null}
                  <Link href={`/personal/${p.id}/editar`} className="inline-flex min-h-11 items-center text-sm font-semibold text-musgo underline-offset-4 hover:underline">
                    Editar
                  </Link>
                </div>
              ) : null}
            </div>
          )}
        />
      )}
    </div>
  );
}
