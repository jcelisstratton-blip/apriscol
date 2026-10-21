"use client";

import { useCallback, useState } from "react";
import { AccionAnularPago } from "@/components/AccionAnularPago";
import { CampoBusqueda } from "@/components/CampoBusqueda";
import { Insignia } from "@/components/Insignia";
import { ListaEscalable } from "@/components/ListaEscalable";
import { cargarPagos } from "@/app/(admin)/admin/pagos/actions";
import { fechaHoraBogota, formatoFecha } from "@/lib/fechas";
import { nombrePlan, usd } from "@/lib/planes";
import type { FilaPagoAdmin } from "@/lib/tipos";

const pesos = (n: number) => `$ ${Math.round(n).toLocaleString("es-CO")}`;

/** Superadmin: todos los pagos confirmados, del más reciente al más antiguo, con buscador por finca o correo. */
export function ListaPagos() {
  const [texto, setTexto] = useState("");
  // Estable mientras no cambie la búsqueda: la lista vuelve a cargar si esta función cambia.
  const cargar = useCallback((desde: number, cantidad: number) => cargarPagos(texto, desde, cantidad), [texto]);
  return (
    <div className="space-y-3">
      <CampoBusqueda onBuscar={setTexto} placeholder="Buscar finca o correo" />
      <ListaEscalable<FilaPagoAdmin>
        key={texto}
        cargar={cargar}
        clave={(p) => p.id}
        vacio={<p className="text-sm text-humo">{texto ? "No hay pagos con ese nombre o correo." : "Todavía no se ha confirmado ningún pago."}</p>}
        fila={(p) => <FilaPago p={p} />}
      />
    </div>
  );
}

/** Una fila de pago: finca, valor, referencia, quién y cuándo; si se puede, el botón para anularlo. */
export function FilaPago({ p }: { p: FilaPagoAdmin }) {
  return (
    <div className="min-w-0 space-y-2.5 rounded-2xl bg-papel p-3.5 ring-1 ring-arena">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`font-semibold [overflow-wrap:anywhere] ${p.anulado_en ? "text-humo line-through" : ""}`}>{p.finca_nombre}</p>
          <p className="text-sm text-humo [overflow-wrap:anywhere]">{p.propietario_email}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Insignia tono={p.anulado_en ? "alerta" : "musgo"}>{p.anulado_en ? "Anulado" : nombrePlan(p.plan)}</Insignia>
          <Insignia tono="neutro">{p.periodo === "anual" ? "1 año" : "1 mes"}</Insignia>
        </div>
      </div>
      <p className="text-[0.9375rem] [overflow-wrap:anywhere]">
        {p.plan_antes !== p.plan ? `${nombrePlan(p.plan_antes)} → ${nombrePlan(p.plan)} · ` : ""}
        {p.monto_cop ? `${pesos(p.monto_cop)} COP` : "Sin monto registrado"}
        {p.monto_usd ? ` (lista ${usd(p.monto_usd)})` : ""}
        {p.referencia ? ` · ref. ${p.referencia}` : ""}
      </p>
      <p className="text-xs text-humo [overflow-wrap:anywhere]">
        {fechaHoraBogota(p.created_at)} · confirmó {p.confirmado_por_email || "—"} · vigencia hasta el {formatoFecha(p.vence_despues)}
      </p>
      {p.anulado_en ? (
        <p className="text-xs text-rojo [overflow-wrap:anywhere]">
          Anulado el {fechaHoraBogota(p.anulado_en)} por {p.anulado_por_email || "—"}: {p.motivo_anulacion}
        </p>
      ) : null}
      {p.se_puede_anular ? <AccionAnularPago pagoId={p.id} finca={p.finca_nombre} /> : null}
    </div>
  );
}
