"use client";

import { useState } from "react";
import { AccionVigencia } from "@/components/AccionVigencia";
import { CampoBusqueda } from "@/components/CampoBusqueda";
import { Insignia } from "@/components/Insignia";
import { ListaEscalable } from "@/components/ListaEscalable";
import { formatoFecha } from "@/lib/fechas";
import { nombrePlan } from "@/lib/planes";
import type { PlanId } from "@/lib/tipos";

export type FilaVigencia = { finca_id: string; nombre: string; propietario_email: string; plan: PlanId; plan_vence_en: string | null; estado: "vigente" | "por_vencer" | "gracia" | "bloqueada"; cuenta_pruebas: boolean };

const ETIQUETA = { vigente: "Al día", por_vencer: "Por vencer", gracia: "Solo lectura", bloqueada: "Bloqueada" } as const;
const TONO = { vigente: "musgo", por_vencer: "aviso", gracia: "aviso", bloqueada: "alerta" } as const;

/** Superadmin: la vigencia de cada finca, con las que vencen primero arriba y un buscador por finca o correo. */
export function ListaVigencias({ filas }: { filas: FilaVigencia[] }) {
  const [texto, setTexto] = useState("");
  const t = texto.toLowerCase();
  const visibles = t ? filas.filter((f) => `${f.nombre} ${f.propietario_email}`.toLowerCase().includes(t)) : filas;
  return (
    <div className="space-y-3">
      {filas.length > 8 ? <CampoBusqueda onBuscar={setTexto} placeholder="Buscar finca o correo" /> : null}
      <ListaEscalable<FilaVigencia>
        key={texto}
        cargar={async (desde, cantidad) => ({ filas: visibles.slice(desde, desde + cantidad), total: visibles.length })}
        fila={(f) => (
          <div className="min-w-0 space-y-3 rounded-2xl bg-papel p-3.5 ring-1 ring-arena">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold [overflow-wrap:anywhere]">{f.nombre}</p>
                <p className="text-sm text-humo [overflow-wrap:anywhere]">{f.propietario_email}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Insignia tono={TONO[f.estado]}>{ETIQUETA[f.estado]}</Insignia>
                {f.cuenta_pruebas ? <Insignia tono="neutro">Cuenta de pruebas</Insignia> : null}
              </div>
            </div>
            <p className="text-[0.9375rem]">
              Plan {nombrePlan(f.plan)} · {f.plan_vence_en ? `pagado hasta el ${formatoFecha(f.plan_vence_en, { day: "numeric", month: "short", year: "numeric" })}` : "sin vencimiento"}
            </p>
            <AccionVigencia fincaId={f.finca_id} plan={f.plan} venceEn={f.plan_vence_en} correo={f.propietario_email} cuentaPruebas={f.cuenta_pruebas} />
          </div>
        )}
        clave={(f) => f.finca_id}
        vacio={<p className="text-sm text-humo">No hay fincas con ese nombre.</p>}
      />
    </div>
  );
}
