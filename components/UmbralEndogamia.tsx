"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Segmentado } from "@/components/Segmentado";
import { Sheet } from "@/components/Sheet";
import { useToast } from "@/components/Toast";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { porcentaje } from "@/lib/endogamia";

const OPCIONES = [
  { valor: "0.0313", etiqueta: "Estricto", f: 0.0313 },
  { valor: "0.0625", etiqueta: "Estándar", f: 0.0625 },
  { valor: "0.125", etiqueta: "Flexible", f: 0.125 },
] as const;

/** Umbral de alerta de endogamia de la finca: lo que cada propietario decide tolerar. */
export function UmbralEndogamia({ fincaId, umbral, puedeEditar }: { fincaId: string; umbral: number; puedeEditar: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [abierta, setAbierta] = useState(false);
  const inicial = OPCIONES.find((o) => Math.abs(o.f - umbral) < 0.0005)?.valor ?? "0.0625";
  const [valor, setValor] = useState<string>(inicial);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const guardar = () =>
    iniciar(async () => {
      setError(null);
      const { error: e } = await crearClienteNavegador().from("fincas").update({ umbral_endogamia: Number(valor) }).eq("id", fincaId);
      if (e) return setError(e.message);
      toast.exito("Umbral guardado");
      setAbierta(false);
      router.refresh();
    });

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-humo">Umbral de alerta de tu finca</p>
          <p className="font-display text-2xl font-semibold tabular-nums">{porcentaje(umbral)}</p>
          <p className="mt-0.5 text-[0.8125rem] text-humo">Un animal con endogamia igual o mayor a este valor se marca como alta.</p>
        </div>
        {puedeEditar ? (
          <button
            type="button"
            onClick={() => {
              setValor(inicial);
              setAbierta(true);
            }}
            className="min-h-11 shrink-0 rounded-full px-4 text-[0.9375rem] font-semibold text-musgo ring-1 ring-arena"
          >
            Cambiar
          </button>
        ) : null}
      </div>
      <Sheet
        abierta={abierta}
        onCerrar={() => (pendiente ? undefined : setAbierta(false))}
        titulo="Umbral de endogamia"
        pie={
          <Boton onClick={guardar} pendiente={pendiente} cargando="Guardando…">
            Guardar
          </Boton>
        }
      >
        <div className="space-y-4">
          <p className="text-[0.9375rem]">
            Cuando un animal o una cruza llega a este valor, la app lo marca como alta. El valor habitual para un hato
            cerrado es 6,25 % (equivale a cruzar primos hermanos).
          </p>
          <Segmentado
            etiqueta="Umbral"
            valor={valor}
            onCambio={setValor}
            opciones={OPCIONES.map((o) => ({ valor: o.valor, etiqueta: o.etiqueta }))}
          />
          <p className="text-sm text-humo">
            {valor === "0.0313" ? "3,13 %: alerta temprano, para quien prioriza la diversidad." : null}
            {valor === "0.0625" ? "6,25 %: equilibrado, el que recomendamos." : null}
            {valor === "0.125" ? "12,5 %: tolera cruces cercanos, como medio hermanos." : null}
          </p>
          {error ? <Aviso tipo="error">{error}</Aviso> : null}
        </div>
      </Sheet>
    </>
  );
}
