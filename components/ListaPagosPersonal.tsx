"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Banknote } from "lucide-react";
import { EstadoVacio } from "@/components/EstadoVacio";
import { Insignia } from "@/components/Insignia";
import { ListaEscalable } from "@/components/ListaEscalable";
import { FilaTarjetas, TarjetaOpcion } from "@/components/TarjetaOpcion";
import { useToast } from "@/components/Toast";
import { marcarPagoPersonal } from "@/app/(app)/personal/actions";
import { ESCENA_PAGO, ESCENA_TODAS_LINEAS } from "@/lib/escenas-costos";
import { direccionSoporte } from "@/lib/soportes";
import { formatoFecha } from "@/lib/fechas";
import { pesos } from "@/lib/ferias";
import { UNIDAD_PAGO } from "@/lib/nomina";
import { crearClienteNavegador } from "@/lib/supabase/client";
import type { PagoPersonal, Persona } from "@/lib/tipos";

type Filtro = "todos" | "por_pagar" | "pagados";
const textoNumero = (n: number) => String(Number(n)).replace(".", ",");

/**
 * Los pagos al personal, lo más reciente primero, con filtro por estado. Lo que falta por pagar se marca pagado con un toque (a quien está por prestación
 * de servicios se le pide antes el PILA, y eso se hace al corregir el pago). Pagina en el servidor.
 */
export function ListaPagosPersonal({ fincaId, personal, puedeEditar }: { fincaId: string; personal: Persona[]; puedeEditar: boolean }) {
  const toast = useToast();
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [version, setVersion] = useState(0);
  const [pagando, setPagando] = useState<string | null>(null);
  const porId = new Map(personal.map((p) => [p.id, p]));

  const cargar = useCallback(
    async (desde: number, cantidad: number) => {
      let q = crearClienteNavegador()
        .from("pagos_personal")
        .select("*", { count: "exact" })
        .eq("finca_id", fincaId)
        .order("fecha", { ascending: false })
        .order("created_at", { ascending: false })
        .range(desde, desde + cantidad - 1);
      if (filtro === "por_pagar") q = q.is("pagado_en", null);
      if (filtro === "pagados") q = q.not("pagado_en", "is", null);
      const { data, error, count } = await q;
      if (error) throw new Error(error.message);
      return { filas: (data ?? []) as PagoPersonal[], total: count ?? 0 };
    },
    // `version` fuerza a recargar la lista después de marcar un pago.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fincaId, filtro, version],
  );

  const pagar = async (p: PagoPersonal) => {
    setPagando(p.id);
    const r = await marcarPagoPersonal(p.id, true);
    setPagando(null);
    if (!r.ok) return toast.error(r.error);
    toast.exito("Pago marcado como hecho");
    setVersion((n) => n + 1);
  };

  return (
    <div className="space-y-3">
      <FilaTarjetas etiqueta="Estado del pago">
        <TarjetaOpcion escena={ESCENA_TODAS_LINEAS} titulo="Todos" activo={filtro === "todos"} onClick={() => setFiltro("todos")} />
        <TarjetaOpcion escena={ESCENA_PAGO.por_pagar} titulo="Por pagar" activo={filtro === "por_pagar"} onClick={() => setFiltro("por_pagar")} />
        <TarjetaOpcion escena={ESCENA_PAGO.pagado} titulo="Pagados" activo={filtro === "pagados"} onClick={() => setFiltro("pagados")} />
      </FilaTarjetas>
      <ListaEscalable<PagoPersonal>
        key={`${filtro}|${version}`}
        rejilla="grid-cols-1 lg:grid-cols-2"
        cargar={cargar}
        clave={(p) => p.id}
        fila={(p) => {
          const persona = porId.get(p.personal_id);
          const unidad = persona ? UNIDAD_PAGO[persona.forma_pago] : null;
          const sinPila = persona?.vinculacion === "servicios" && !p.soporte_pila;
          const cuenta = `${textoNumero(p.cantidad)} ${Number(p.cantidad) === 1 ? (unidad?.singular ?? "") : (unidad?.plural ?? "")}`.trim();
          return (
            <div className="min-w-0 rounded-2xl bg-papel p-3.5 ring-1 ring-arena">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold [overflow-wrap:anywhere]">{persona?.nombre ?? "Persona"}</p>
                  <p className="text-sm text-humo [overflow-wrap:anywhere]">
                    {formatoFecha(p.fecha, { day: "numeric", month: "short", year: "numeric" })} · {cuenta}
                  </p>
                </div>
                <p className="shrink-0 text-right font-display text-lg font-semibold tabular-nums">{pesos(Number(p.costo_total))}</p>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {p.pagado_en ? <Insignia tono="ok">Pagado</Insignia> : <Insignia tono="aviso">Por pagar</Insignia>}
                <Insignia tono="neutro">{persona?.vinculacion === "servicios" ? "Prestación de servicios" : "Contrato de trabajo"}</Insignia>
                {Number(p.factor) > 1 ? <span className="text-xs text-humo">recibe {pesos(Number(p.valor_pago))} · cargas ×{String(Number(p.factor)).replace(".", ",")}</span> : null}
              </div>
              {p.soporte_pila ? (
                <p className="mt-1 text-sm">
                  <a href={direccionSoporte(p.soporte_pila)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center font-semibold text-musgo underline-offset-4 hover:underline">
                    Ver comprobante de seguridad social
                  </a>
                </p>
              ) : sinPila && !p.pagado_en ? (
                <p className="mt-1 text-sm text-humo">Falta el comprobante de seguridad social para registrarlo como pagado.</p>
              ) : null}
              {puedeEditar ? (
                <div className="mt-1 flex flex-wrap items-center gap-x-4 border-t border-arena pt-1">
                  {!p.pagado_en && !sinPila ? (
                    <button type="button" onClick={() => void pagar(p)} disabled={pagando === p.id} className="inline-flex min-h-11 items-center text-sm font-semibold text-musgo underline-offset-4 hover:underline disabled:opacity-60">
                      {pagando === p.id ? "Guardando…" : "Marcar pagado"}
                    </button>
                  ) : null}
                  <Link href={`/personal/pagos/${p.id}/editar`} className="inline-flex min-h-11 items-center text-sm font-semibold text-musgo underline-offset-4 hover:underline">
                    {sinPila && !p.pagado_en ? "Adjuntar comprobante" : "Editar"}
                  </Link>
                </div>
              ) : null}
            </div>
          );
        }}
        vacio={
          <EstadoVacio
            icono={<Banknote strokeWidth={1.5} />}
            titulo={filtro === "todos" ? "Todavía no hay pagos" : "Nada con ese filtro"}
            descripcion={filtro === "todos" ? "Cuando registres el primer pago al personal aparecerá aquí, ya sumado a la mano de obra de Costos." : "Prueba con otro estado."}
          />
        }
      />
    </div>
  );
}
