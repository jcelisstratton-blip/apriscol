"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { Selector } from "@/components/Selector";
import { useToast } from "@/components/Toast";
import { darDeBaja } from "@/app/(app)/hato/actions";
import { MOTIVOS_BAJA, TIPOS_BAJA } from "@/lib/bajas";
import type { MotivoBaja, TipoBaja } from "@/lib/tipos";

/** Dar de baja a un animal: qué pasó, cuándo y, si fue una venta, a quién y por cuánto. */
export function FormBaja({
  animalId,
  etiqueta,
  hoy,
  nacimiento,
  enOrdeno,
}: {
  animalId: string;
  etiqueta: string;
  hoy: string;
  nacimiento: string | null;
  /** Hembra con lactancia abierta: sale también de la lista del ordeño. */
  enOrdeno: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [tipo, setTipo] = useState<TipoBaja | "">("");
  const [fecha, setFecha] = useState(hoy);
  const [motivo, setMotivo] = useState<MotivoBaja | "">("");
  const [comprador, setComprador] = useState("");
  const [valor, setValor] = useState("");
  const [consumo, setConsumo] = useState(false);
  const [detalle, setDetalle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, iniciar] = useTransition();

  const numeroValor = valor.trim() === "" ? undefined : Number(valor.replace(/[.\s]/g, "").replace(",", "."));
  const valorInvalido = numeroValor !== undefined && !Number.isFinite(numeroValor);

  const guardar = () => {
    if (!tipo) return;
    setError(null);
    iniciar(async () => {
      const r = await darDeBaja({
        animalId,
        tipo,
        fecha,
        motivo: motivo || undefined,
        comprador,
        valor: numeroValor,
        destinoConsumo: consumo,
        detalle,
      });
      if (!r.ok) return setError(r.error);
      toast.exito(`${etiqueta} salió del hato`);
      if (r.aviso) toast.error(r.aviso);
      router.push(`/hato/${animalId}`);
      router.refresh();
    });
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <p id="que-paso" className="text-sm font-semibold">¿Qué pasó con el animal?</p>
        <div role="radiogroup" aria-labelledby="que-paso" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {TIPOS_BAJA.map((t) => {
            const activo = tipo === t.valor;
            return (
              <button
                key={t.valor}
                type="button"
                role="radio"
                aria-checked={activo}
                onClick={() => setTipo(t.valor)}
                className={`flex min-h-16 min-w-0 items-center justify-between gap-3 rounded-2xl px-4 py-2.5 text-left ring-1 transition active:scale-[0.99] ${
                  activo ? "bg-musgo/10 ring-2 ring-musgo" : "bg-papel ring-arena hover:bg-arena/40"
                }`}
              >
                <span className="min-w-0">
                  <span className="block font-semibold">{t.etiqueta}</span>
                  <span className="block text-sm text-humo">{t.detalle}</span>
                </span>
                {activo ? <Check className="size-5 shrink-0 text-musgo" strokeWidth={2.2} aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      </div>

      <Campo etiqueta="¿Cuándo pasó?">
        {(id) => <input id={id} type="date" value={fecha} min={nacimiento ?? undefined} max={hoy} onChange={(e) => setFecha(e.target.value)} className={CLASE_INPUT} />}
      </Campo>

      {tipo === "venta" ? (
        <>
          <Campo etiqueta="Comprador" ayuda="Opcional.">
            {(id) => <input id={id} value={comprador} maxLength={160} autoComplete="off" onChange={(e) => setComprador(e.target.value)} className={CLASE_INPUT} placeholder="Nombre de quien lo compró" />}
          </Campo>
          <Campo etiqueta="Valor de la venta" ayuda="Opcional. En pesos." error={valorInvalido ? "Escribe solo números." : undefined}>
            {(id) => <input id={id} value={valor} inputMode="decimal" autoComplete="off" onChange={(e) => setValor(e.target.value)} className={CLASE_INPUT} placeholder="Ej. 450000" />}
          </Campo>
          <label className="flex min-h-11 items-start gap-3 text-[0.9375rem]">
            <input type="checkbox" checked={consumo} onChange={(e) => setConsumo(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--musgo)]" />
            <span>
              Va para consumo (frigorífico o carnicería)
              <span className="block text-[0.8125rem] text-humo">Si está en periodo de retiro de carne, no se podrá registrar así.</span>
            </span>
          </label>
        </>
      ) : null}

      <Campo etiqueta="¿Por qué sale del hato?" ayuda="Opcional. Sirve para saber con el tiempo por qué se descartan animales.">
        {(id) => (
          <Selector
            id={id}
            valor={motivo}
            onCambio={setMotivo}
            titulo="¿Por qué sale del hato?"
            opciones={MOTIVOS_BAJA}
            placeholder="Sin especificar"
            permitirVacio
          />
        )}
      </Campo>

      <Campo etiqueta="Notas">
        {(id) => <textarea id={id} value={detalle} maxLength={1000} rows={3} onChange={(e) => setDetalle(e.target.value)} className={`${CLASE_INPUT} py-3`} placeholder="Opcional" />}
      </Campo>

      {enOrdeno ? <Aviso tipo="info">Está en el ordeño: al darla de baja sale también de esa lista.</Aviso> : null}
      {error ? <Aviso tipo="error">{error}</Aviso> : null}
      {!tipo ? <Aviso tipo="atencion">Elige qué pasó con el animal para continuar.</Aviso> : null}

      <Boton variante="peligro" onClick={guardar} pendiente={guardando} cargando="Guardando…" disabled={!tipo || !fecha || valorInvalido}>
        Dar de baja
      </Boton>
    </div>
  );
}
