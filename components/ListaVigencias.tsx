"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { BotonesRecordatorio } from "@/components/BotonesRecordatorio";
import { CampoBusqueda } from "@/components/CampoBusqueda";
import { ConfirmarPago } from "@/components/ConfirmarPago";
import { Chip, FilaDesplazable } from "@/components/FilaDesplazable";
import { Insignia } from "@/components/Insignia";
import { ListaEscalable } from "@/components/ListaEscalable";
import { coincideFiltro, mensajeCobranza, type FilaCobranza, type FiltroCobranza } from "@/lib/cobranza";
import { formatoFecha } from "@/lib/fechas";
import type { DatosNequi } from "@/lib/pago-manual";
import { nombrePlan } from "@/lib/planes";

export type FilaVigencia = FilaCobranza;

const ETIQUETA = { vigente: "Al día", por_vencer: "Por vencer", gracia: "Solo lectura", bloqueada: "Bloqueada", pendiente: "Pendiente de pago" } as const;
const TONO = { vigente: "musgo", por_vencer: "aviso", gracia: "aviso", bloqueada: "alerta", pendiente: "aviso" } as const;
const FILTROS: { id: FiltroCobranza; etiqueta: string }[] = [
  { id: "por_cobrar", etiqueta: "Por cobrar" },
  { id: "pendiente", etiqueta: "Por activar" },
  { id: "por_vencer", etiqueta: "Vencen pronto" },
  { id: "gracia", etiqueta: "Solo lectura" },
  { id: "bloqueada", etiqueta: "Bloqueadas" },
  { id: "todas", etiqueta: "Todas" },
];

/** Cuándo vence, en palabras: «vence en 5 días», «venció hace 3 días», «vence hoy». */
function cuando(dias: number | null): string {
  if (dias === null) return "";
  if (dias === 0) return " · vence hoy";
  if (dias > 0) return ` · vence en ${dias} ${dias === 1 ? "día" : "días"}`;
  return ` · venció hace ${-dias} ${dias === -1 ? "día" : "días"}`;
}

/**
 * Superadmin: cobranza. Las fincas con filtros por estado (por cobrar, por activar, vencen pronto, solo lectura, bloqueadas), con las que vencen primero
 * arriba, un buscador por finca o correo y, en las que hay algo que cobrar, el recordatorio ya redactado y el pago a un clic.
 */
export function ListaVigencias({ filas, nequi }: { filas: FilaCobranza[]; nequi: DatosNequi | null }) {
  const hayPorCobrar = filas.some((f) => f.estado !== "vigente");
  const [filtro, setFiltro] = useState<FiltroCobranza>(hayPorCobrar ? "por_cobrar" : "todas");
  const [texto, setTexto] = useState("");
  const alBuscar = useCallback((t: string) => setTexto(t.toLowerCase()), []);
  const visibles = filas.filter((f) => coincideFiltro(f, filtro) && (!texto || `${f.nombre} ${f.propietario_email} ${f.propietario_nombre}`.toLowerCase().includes(texto)));
  // Estable mientras no cambie el filtro, la búsqueda o los datos: la lista vuelve a cargar si esta función cambia.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cargar = useCallback(async (desde: number, cantidad: number) => ({ filas: visibles.slice(desde, desde + cantidad), total: visibles.length }), [filas, filtro, texto]);
  const cuantas = (id: FiltroCobranza) => filas.filter((f) => coincideFiltro(f, id)).length;

  return (
    <div className="space-y-3">
      <FilaDesplazable>
        {FILTROS.map((fl) => (
          <Chip key={fl.id} activo={filtro === fl.id} onClick={() => setFiltro(fl.id)}>
            {fl.etiqueta} · {cuantas(fl.id)}
          </Chip>
        ))}
      </FilaDesplazable>
      {filas.length > 8 ? <CampoBusqueda onBuscar={alBuscar} placeholder="Buscar finca o correo" /> : null}
      <ListaEscalable<FilaCobranza>
        key={`${filtro}|${texto}`}
        cargar={cargar}
        fila={(f) => {
          const mensaje = mensajeCobranza(f, nequi);
          return (
            <div className="min-w-0 space-y-3 rounded-2xl bg-papel p-3.5 ring-1 ring-arena">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/admin/fincas/${f.finca_id}`} className="font-semibold underline-offset-4 [overflow-wrap:anywhere] hover:underline">
                    {f.nombre}
                  </Link>
                  <p className="text-sm text-humo [overflow-wrap:anywhere]">
                    {f.propietario_nombre ? `${f.propietario_nombre} · ` : ""}
                    {f.propietario_email}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Insignia tono={TONO[f.estado]}>{ETIQUETA[f.estado]}</Insignia>
                  {f.cuenta_pruebas ? <Insignia tono="neutro">Cuenta de pruebas</Insignia> : null}
                </div>
              </div>
              <p className="text-[0.9375rem]">
                Plan {nombrePlan(f.plan)} · {f.plan_vence_en ? `pagado hasta el ${formatoFecha(f.plan_vence_en, { day: "numeric", month: "short", year: "numeric" })}${cuando(f.dias_restantes)}` : f.estado === "pendiente" ? "esperando el primer pago" : "sin vencimiento"}
              </p>
              {mensaje ? (
                <>
                  <BotonesRecordatorio mensaje={mensaje} telefono={f.telefono} />
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <ConfirmarPago fincaId={f.finca_id} plan={f.plan} periodo="mensual" variante="secundario">
                      Pago recibido · 1 mes
                    </ConfirmarPago>
                    <ConfirmarPago fincaId={f.finca_id} plan={f.plan} periodo="anual" variante="secundario">
                      Pago recibido · 1 año
                    </ConfirmarPago>
                  </div>
                </>
              ) : null}
            </div>
          );
        }}
        clave={(f) => f.finca_id}
        vacio={<p className="text-sm text-humo">{texto ? "No hay fincas con ese nombre o correo en este filtro." : "Nada por aquí: ninguna finca en este estado."}</p>}
      />
    </div>
  );
}
