"use client";

import { ListaEscalable } from "@/components/ListaEscalable";
import { cargarAuditoria } from "@/app/(admin)/admin/pagos/actions";
import { textoAuditoria } from "@/lib/auditoria-texto";
import { fechaHoraBogota } from "@/lib/fechas";
import type { FilaAuditoriaAdmin } from "@/lib/tipos";

/** Superadmin: bitácora de lo que se hizo con planes, pagos y vigencias, de lo más reciente a lo más antiguo. */
export function ListaAuditoria() {
  return (
    <ListaEscalable<FilaAuditoriaAdmin>
      cargar={cargarAuditoria}
      clave={(a) => String(a.id)}
      vacio={<p className="text-sm text-humo">Todavía no hay movimientos registrados.</p>}
      fila={(a) => (
        <div className="min-w-0 space-y-1 rounded-2xl bg-papel p-3.5 ring-1 ring-arena">
          {a.finca_nombre ? <p className="font-semibold [overflow-wrap:anywhere]">{a.finca_nombre}</p> : null}
          <p className="text-[0.9375rem] [overflow-wrap:anywhere]">{textoAuditoria(a)}</p>
          <p className="text-xs text-humo [overflow-wrap:anywhere]">
            {fechaHoraBogota(a.created_at)} · {a.actor_email || "—"}
          </p>
        </div>
      )}
    />
  );
}
