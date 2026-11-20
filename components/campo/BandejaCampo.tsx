"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { EstadoVacio } from "@/components/EstadoVacio";
import { ListaPorTramos } from "@/components/ListaPorTramos";
import { InsigniaCampo } from "@/components/campo/EstadoCampo";
import { kg } from "@/lib/carne";
import { formatoFecha, litros as fmt } from "@/lib/fechas";
import type { RegistroCampo } from "@/lib/campo";
import { ETIQUETA_METODO, ETIQUETA_RESULTADO } from "@/lib/reproduccion";
import { actualizarRegistro, borrarRegistros } from "@/lib/offline/campo-db";

const JORNADA: Record<string, string> = { manana: "mañana", tarde: "tarde", noche: "noche" };

function Detalle({ r }: { r: RegistroCampo }) {
  const dia = formatoFecha(r.fecha, { day: "numeric", month: "short" });
  return (
    <span className="block text-sm text-humo [overflow-wrap:anywhere]">
      {r.tipo === "ordeno"
        ? `Ordeño · ${dia}, ${JORNADA[r.jornada ?? ""] ?? ""} · ${fmt(r.litros ?? 0)} L${r.descartar ? " (descartada)" : ""}`
        : r.tipo === "monta"
          ? `Monta · ${dia} · con ${r.machoEtiqueta ?? "reproductor"}`
          : r.tipo === "diagnostico" && r.diagnostico
            ? `Diagnóstico · ${dia} · ${ETIQUETA_METODO[r.diagnostico.metodo]}: ${ETIQUETA_RESULTADO[r.diagnostico.resultado]}`
            : `Peso · ${dia} · ${kg(r.peso ?? 0)}`}
    </span>
  );
}

/** Un registro con error: el motivo y qué hacer (reintentar o descartar, con confirmación en el mismo lugar). */
function FilaError({ r, alCambiar }: { r: RegistroCampo; alCambiar: () => void }) {
  const [confirmando, setConfirmando] = useState(false);
  return (
    <div className="space-y-2.5 rounded-2xl bg-papel p-3.5 ring-1 ring-rojo/25">
      <div className="min-w-0">
        <span className="block font-bold [overflow-wrap:anywhere]">{r.etiqueta}</span>
        <Detalle r={r} />
      </div>
      <p className="text-sm text-rojo [overflow-wrap:anywhere]">{r.error ?? "No se pudo guardar."}</p>
      {confirmando ? (
        <div className="space-y-2 rounded-2xl bg-lana p-3">
          <p className="text-[0.9375rem]">¿Descartar este registro? Se borra de este celular y no se envía.</p>
          <div className="grid grid-cols-2 gap-2">
            <Boton variante="secundario" onClick={() => setConfirmando(false)}>Cancelar</Boton>
            <Boton
              variante="peligro"
              onClick={async () => {
                await borrarRegistros([r.id]);
                alCambiar();
              }}
            >
              Sí, descartar
            </Boton>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Boton variante="secundario" onClick={() => setConfirmando(true)}>Descartar</Boton>
          <Boton
            variante="secundario"
            onClick={async () => {
              await actualizarRegistro(r.id, { estado: "pendiente", error: undefined });
              alCambiar();
            }}
          >
            Reintentar
          </Boton>
        </div>
      )}
    </div>
  );
}

/**
 * Lo guardado en este celular: lo que falta por enviar, los «Pendientes con error» (con el motivo, para reintentar o descartar) y lo enviado en
 * los últimos días. Solo los registros de la persona de la copia guardada; los de otra cuenta solo se cuentan.
 */
export function BandejaCampo({ registros, usuarioId, enLinea, enviando, deOtraCuenta, alEnviar }: {
  registros: RegistroCampo[];
  usuarioId: string;
  enLinea: boolean;
  enviando: boolean;
  deOtraCuenta: number;
  alEnviar: () => void;
}) {
  const mios = registros.filter((r) => r.usuarioId === usuarioId).sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
  const porEnviar = mios.filter((r) => r.estado === "pendiente" || r.estado === "enviando");
  const conError = mios.filter((r) => r.estado === "error");
  const enviados = mios.filter((r) => r.estado === "enviado");

  return (
    <div className="space-y-6">
      {conError.length > 0 ? (
        <section className="space-y-3" aria-labelledby="titulo-errores">
          <h2 id="titulo-errores" className="font-display text-xl font-semibold">Pendientes con error · {conError.length}</h2>
          <p className="text-sm text-humo">El servidor no los aceptó. Lee el motivo: reintenta si ya se resolvió o descártalo.</p>
          <div className="grid grid-cols-1 gap-2.5">
            {conError.map((r) => (
              <FilaError key={r.id} r={r} alCambiar={alEnviar} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3" aria-labelledby="titulo-por-enviar">
        <h2 id="titulo-por-enviar" className="font-display text-xl font-semibold">Por enviar · {porEnviar.length}</h2>
        {porEnviar.length === 0 ? (
          conError.length === 0 ? (
            <EstadoVacio icono={<CheckCircle2 strokeWidth={1.5} />} titulo="Todo está enviado" descripcion="Lo que anotes sin señal aparece aquí hasta que se envíe." />
          ) : (
            <p className="text-sm text-humo">No hay nada más esperando la señal.</p>
          )
        ) : (
          <>
            <p className="text-sm text-humo">{enLinea ? "Se están enviando solos." : "Se enviarán solos cuando vuelva la señal, con la app abierta."}</p>
            <ListaPorTramos
              items={porEnviar}
              clave={(r) => r.id}
              fila={(r) => (
                <div className="flex min-h-[4.25rem] items-center gap-3 rounded-2xl bg-papel px-3.5 py-2.5 ring-1 ring-arena">
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold [overflow-wrap:anywhere]">{r.etiqueta}</span>
                    <Detalle r={r} />
                  </span>
                  <InsigniaCampo r={r} />
                </div>
              )}
            />
            {enLinea ? (
              <Boton variante="secundario" onClick={alEnviar} pendiente={enviando} cargando="Enviando…">
                Enviar ahora
              </Boton>
            ) : null}
          </>
        )}
      </section>

      {deOtraCuenta > 0 ? (
        <Aviso>
          {deOtraCuenta === 1 ? "Hay 1 registro de otra cuenta en este celular" : `Hay ${deOtraCuenta} registros de otra cuenta en este celular`}: se envían cuando esa persona entre a Apriscol aquí.
        </Aviso>
      ) : null}

      {enviados.length > 0 ? (
        <section className="space-y-3" aria-labelledby="titulo-enviados">
          <h2 id="titulo-enviados" className="font-display text-xl font-semibold">Enviados · {enviados.length}</h2>
          <p className="text-sm text-humo">Ya están en Apriscol. Se borran de este celular a los pocos días.</p>
          <ListaPorTramos
            items={enviados}
            clave={(r) => r.id}
            fila={(r) => (
              <div className="flex min-h-[4.25rem] items-center gap-3 rounded-2xl bg-papel px-3.5 py-2.5 ring-1 ring-arena">
                <span className="min-w-0 flex-1">
                  <span className="block font-bold [overflow-wrap:anywhere]">{r.etiqueta}</span>
                  <Detalle r={r} />
                </span>
                <InsigniaCampo r={r} />
              </div>
            )}
          />
        </section>
      ) : null}
    </div>
  );
}
