import Link from "next/link";
import { ClipboardList, Utensils } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { clasesBoton } from "@/components/Boton";
import { EliminarRegistro } from "@/components/EliminarRegistro";
import { FormPesoUnidad } from "@/components/FormPesoUnidad";
import { Insignia } from "@/components/Insignia";
import { Tarjeta } from "@/components/Tarjeta";
import { formatoFecha } from "@/lib/fechas";
import { ETIQUETA_MOTIVO_AJUSTE } from "@/lib/inventario";
import {
  DETALLE_ESTADO_ALIMENTO,
  ETIQUETA_ESTADO_ALIMENTO,
  autonomiaDias,
  compraEnKg,
  consumoDiarioKg,
  diasTexto,
  estadoAlimento,
  faltaPeso,
  singular,
  textoKg,
  type EstadoAlimento,
  type FilaAlimento,
} from "@/lib/inventario-alimento";
import { eliminarMovimientoAlimento } from "@/app/(app)/inventario/alimento/actions";
import type { InventarioAlimentoMovimiento } from "@/lib/tipos";

const TONO_ESTADO: Record<EstadoAlimento, "neutro" | "ok" | "alerta" | "aviso"> = { sin_contar: "neutro", negativo: "alerta", agotado: "alerta", critico: "alerta", bajo: "aviso", ok: "ok", sin_datos: "neutro" };
const corta = { day: "numeric", month: "short", year: "numeric" } as const;

/** La ficha de un alimento: existencias, para cuántos días alcanza, el peso de cada unidad y lo que se ha dado de comer. Solo dibuja; la página trae los datos. */
export function FichaAlimento({
  f,
  movimientos,
  destinos,
  plazoDias,
  hoy,
  usuarioId,
  gestiona,
  puedeAnotar,
}: {
  f: FilaAlimento;
  movimientos: InventarioAlimentoMovimiento[];
  /** Nombre de cada corral o lote de ceba, por su identificador, para decir para quién fue una salida. */
  destinos: Record<string, string>;
  plazoDias: number;
  hoy: string;
  usuarioId: string;
  /** Propietario o administrador: cuenta, ajusta y define el peso. */
  gestiona: boolean;
  /** Puede anotar lo que se da de comer (también el ordeñador). */
  puedeAnotar: boolean;
}) {
  const id = f.producto_id;
  const estado = estadoAlimento(f, plazoDias, hoy);
  const dias = autonomiaDias(f, hoy);
  const diario = consumoDiarioKg(f, hoy);
  return (
    <div className="grid grid-cols-1 gap-4 lg:max-w-4xl">
      <Tarjeta titulo="Existencias">
        {f.desde && f.stock_kg !== null ? (
          <div className="space-y-3">
            <p className="font-display text-3xl font-semibold [overflow-wrap:anywhere]">{textoKg(f, f.stock_kg)}</p>
            <div className="flex flex-wrap items-center gap-1.5">
              <Insignia tono={TONO_ESTADO[estado]}>{ETIQUETA_ESTADO_ALIMENTO[estado]}</Insignia>
              <span className="text-sm text-humo">{DETALLE_ESTADO_ALIMENTO[estado]}</span>
            </div>
            {dias !== null && diario !== null ? (
              <p className="text-sm text-humo">
                Alcanza para unos <span className="font-semibold text-tinta">{diasTexto(dias)}</span>, al ritmo de {textoKg(f, Math.round(diario * 10) / 10)} por día en las últimas dos semanas. Se avisa por debajo de {diasTexto(plazoDias)}.
              </p>
            ) : (
              <p className="text-sm text-humo">Todavía no se puede calcular para cuántos días alcanza: faltan días con salidas anotadas (se necesitan al menos 3 en las últimas dos semanas).</p>
            )}
            <p className="text-sm text-humo">Contando desde el {formatoFecha(f.desde, corta)}.</p>
            {f.compras_sin_calcular > 0 ? (
              <Aviso tipo="atencion">
                {f.compras_sin_calcular === 1 ? "Una compra de este alimento no se pudo sumar" : `${f.compras_sin_calcular} compras de este alimento no se pudieron sumar`}:{" "}
                {faltaPeso(f) ? `falta decir cuánto pesa cada ${f.unidad ?? "unidad"} (abajo, «Peso de cada unidad»)` : "no dicen cuánto se compró"}. Corrígelas para que el inventario cuadre.
              </Aviso>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            <Insignia tono="neutro">{ETIQUETA_ESTADO_ALIMENTO.sin_contar}</Insignia>
            <p className="text-[0.9375rem] text-humo">Este alimento todavía no se cuenta. {gestiona ? "Haz el conteo de apertura (cuánto hay hoy en la bodega) y desde ese día la app suma las compras y resta lo que se dé de comer." : "El propietario o el administrador debe hacer primero el conteo de apertura."}</p>
          </div>
        )}
        {puedeAnotar || gestiona ? (
          <div className="mt-4 space-y-2">
            {puedeAnotar && f.desde ? (
              <Link href={`/inventario/alimento/${id}/salida`} className={clasesBoton("primario")}>
                <Utensils className="size-5" strokeWidth={2} aria-hidden="true" /> Anotar lo que se dio de comer
              </Link>
            ) : null}
            {gestiona ? (
              <Link href={`/inventario/alimento/${id}/contar`} className={clasesBoton(f.desde ? "secundario" : "primario")}>
                <ClipboardList className="size-5" strokeWidth={2} aria-hidden="true" /> {f.desde ? "Contar o ajustar existencias" : "Hacer el conteo de apertura"}
              </Link>
            ) : null}
          </div>
        ) : null}
      </Tarjeta>

      {!compraEnKg(f.unidad) && f.unidad ? (
        <Tarjeta titulo="Peso de cada unidad">
          {gestiona ? (
            <FormPesoUnidad productoId={id} unidad={f.unidad} kg={f.kg_por_unidad} />
          ) : (
            <p className="text-[0.9375rem] text-humo">{f.kg_por_unidad ? `Cada ${singular(f.unidad)} pesa ${f.kg_por_unidad} kg.` : "Todavía no se definió cuánto pesa cada unidad."}</p>
          )}
        </Tarjeta>
      ) : null}

      <Tarjeta titulo="Lo que se ha dado y contado">
        {movimientos.length === 0 ? (
          <p className="text-[0.9375rem] text-humo">Todavía no hay movimientos de este alimento.</p>
        ) : (
          <ul className="divide-y divide-arena">
            {movimientos.map((m) => {
              const propio = m.created_by === usuarioId && m.tipo === "salida";
              const destino = (m.ubicacion_id ? destinos[m.ubicacion_id] : null) ?? (m.lote_id ? destinos[m.lote_id] : null);
              return (
                <li key={m.id} className="space-y-1 py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 font-semibold [overflow-wrap:anywhere]">
                      {m.tipo === "apertura" ? "Conteo de apertura" : m.tipo === "salida" ? "Se dio de comer" : (ETIQUETA_MOTIVO_AJUSTE[m.motivo ?? "otro"] ?? "Ajuste")}
                      {destino ? ` · ${destino}` : ""}
                    </p>
                    <p className={`shrink-0 font-semibold ${m.tipo === "salida" || m.cantidad < 0 ? "text-rojo" : ""}`}>
                      {m.tipo === "salida" || m.cantidad < 0 ? "−" : m.tipo === "ajuste" ? "+" : ""}
                      {textoKg(f, Math.abs(m.cantidad))}
                    </p>
                  </div>
                  <p className="text-sm text-humo">{formatoFecha(m.fecha, corta)}</p>
                  {m.observaciones ? <p className="whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">{m.observaciones}</p> : null}
                  {gestiona || propio ? (
                    <EliminarRegistro
                      etiqueta={m.tipo === "salida" ? "Eliminar esta salida" : m.tipo === "apertura" ? "Eliminar el conteo de apertura" : "Eliminar este ajuste"}
                      resumen={m.tipo === "salida" ? `la salida del ${formatoFecha(m.fecha, corta)}` : m.tipo === "apertura" ? "el conteo de apertura" : `el ajuste del ${formatoFecha(m.fecha, corta)}`}
                      consecuencia={m.tipo === "apertura" ? "El alimento vuelve a «Por contar»" : undefined}
                      accion={eliminarMovimientoAlimento.bind(null, m.id)}
                      destino={`/inventario/alimento/${id}`}
                      mensaje="Movimiento eliminado"
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Tarjeta>
    </div>
  );
}
