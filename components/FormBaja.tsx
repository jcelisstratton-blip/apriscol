"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { SelectorTarjetas } from "@/components/SelectorTarjetas";
import { SelectorTercero } from "@/components/SelectorTercero";
import { useToast } from "@/components/Toast";
import { darDeBaja } from "@/app/(app)/hato/actions";
import { CamposTrazabilidad } from "@/components/CamposTrazabilidad";
import { MOTIVOS_BAJA, TIPOS_BAJA } from "@/lib/bajas";
import { ESCENA_MOTIVO_BAJA, ESCENA_TIPO_BAJA } from "@/lib/escenas-forms-a-hato";
import { ESCENA_COBRO } from "@/lib/escenas-costos";
import { leerNumero } from "@/lib/numeros";
import type { MotivoBaja, Tercero, TipoBaja } from "@/lib/tipos";

/** Dar de baja a un animal: qué pasó, cuándo y, si fue una venta, a quién y por cuánto. */
export function FormBaja({
  animalId,
  etiqueta,
  hoy,
  nacimiento,
  enOrdeno,
  terceros,
}: {
  animalId: string;
  etiqueta: string;
  hoy: string;
  nacimiento: string | null;
  /** Hembra con lactancia abierta: sale también de la lista del ordeño. */
  enOrdeno: boolean;
  /** Los compradores de la finca: el comprador se elige de la lista. */
  terceros: Tercero[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [tipo, setTipo] = useState<TipoBaja | "">("");
  const [fecha, setFecha] = useState(hoy);
  const [motivo, setMotivo] = useState<MotivoBaja | "">("");
  const [tercero, setTercero] = useState("");
  const [cobro, setCobro] = useState<"cobrado" | "por_cobrar">("cobrado");
  const [cobroVence, setCobroVence] = useState("");
  const [valor, setValor] = useState("");
  const [consumo, setConsumo] = useState(false);
  const [detalle, setDetalle] = useState("");
  const [peso, setPeso] = useState("");
  const [guia, setGuia] = useState("");
  const [destino, setDestino] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, iniciar] = useTransition();

  const numeroValor = valor.trim() === "" ? undefined : Number(valor.replace(/[.\s]/g, "").replace(",", "."));
  const valorInvalido = numeroValor !== undefined && !Number.isFinite(numeroValor);
  const comercial = tipo === "venta" || tipo === "sacrificio";
  const numeroPeso = peso.trim() === "" ? undefined : (leerNumero(peso) ?? Number.NaN);
  const pesoInvalido = comercial && numeroPeso !== undefined && !Number.isFinite(numeroPeso);

  const guardar = () => {
    if (!tipo) return;
    setError(null);
    iniciar(async () => {
      const r = await darDeBaja({
        animalId,
        tipo,
        fecha,
        motivo: motivo || undefined,
        terceroId: tercero,
        cobro: tipo === "venta" && numeroValor ? cobro : undefined,
        cobroVence: cobro === "por_cobrar" ? cobroVence : undefined,
        valor: numeroValor,
        destinoConsumo: consumo,
        detalle,
        ...(comercial ? { pesoKg: numeroPeso, guiaMovilizacion: guia, destino } : {}),
      });
      if (!r.ok) return setError(r.error);
      toast.exito(`${etiqueta} salió del hato`);
      if (r.aviso) toast.error(r.aviso);
      // Una salida para consumo va directo a sus controles de calidad (responderlos o dejar constancia de que no se hicieron).
      const paraConsumo = tipo === "sacrificio" || (tipo === "venta" && consumo);
      router.push(paraConsumo ? `/hato/${animalId}/controles?nuevo=1` : `/hato/${animalId}`);
      router.refresh();
    });
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <p id="que-paso" className="text-sm font-semibold">¿Qué pasó con el animal?</p>
        <SelectorTarjetas id="que-paso-opciones" valor={tipo} onCambio={setTipo} titulo="¿Qué pasó con el animal?" opciones={TIPOS_BAJA.map((t) => ({ ...t, escena: ESCENA_TIPO_BAJA[t.valor] }))} />
      </div>

      <Campo etiqueta="¿Cuándo pasó?">
        {(id) => <input id={id} type="date" value={fecha} min={nacimiento ?? undefined} max={hoy} onChange={(e) => setFecha(e.target.value)} className={CLASE_INPUT} />}
      </Campo>

      {tipo === "venta" ? (
        <>
          <Campo etiqueta="Comprador" ayuda="Opcional. Se elige de tu lista o se agrega una vez.">
            {(id) => <SelectorTercero id={id} tipo="comprador" terceros={terceros} valor={tercero} onCambio={(v) => setTercero(v)} titulo="¿A quién se lo vendiste?" placeholder="Elegir o agregar" />}
          </Campo>
          <Campo etiqueta="Valor de la venta" ayuda="Opcional. En pesos." error={valorInvalido ? "Escribe solo números." : undefined}>
            {(id) => <input id={id} value={valor} inputMode="decimal" autoComplete="off" onChange={(e) => setValor(e.target.value)} className={CLASE_INPUT} placeholder="Ej. 450000" />}
          </Campo>
          {numeroValor ? (
            <>
              <Campo etiqueta="¿Ya te pagaron?">
                {(id) => (
                  <SelectorTarjetas
                    id={id}
                    valor={cobro}
                    onCambio={(v) => v && setCobro(v)}
                    titulo="Cobro"
                    opciones={(["cobrado", "por_cobrar"] as const).map((c) => ({ valor: c, etiqueta: c === "cobrado" ? "Ya me pagaron" : "Me lo deben", escena: ESCENA_COBRO[c] }))}
                  />
                )}
              </Campo>
              {cobro === "por_cobrar" ? (
                <Campo etiqueta="Lo esperas el" ayuda="Opcional. Te avisamos cuando se pase.">
                  {(id) => <input id={id} type="date" value={cobroVence} min={fecha} onChange={(e) => setCobroVence(e.target.value)} className={CLASE_INPUT} />}
                </Campo>
              ) : null}
            </>
          ) : null}
          <label className="flex min-h-11 items-start gap-3 text-[0.9375rem]">
            <input type="checkbox" checked={consumo} onChange={(e) => setConsumo(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--musgo)]" />
            <span>
              Va para consumo (frigorífico o carnicería)
              <span className="block text-[0.8125rem] text-humo">Si está en periodo de retiro de carne, no se podrá registrar así.</span>
            </span>
          </label>
        </>
      ) : null}

      {comercial ? (
        <CamposTrazabilidad tipo={tipo} peso={peso} onPeso={setPeso} pesoInvalido={pesoInvalido} guia={guia} onGuia={setGuia} destino={destino} onDestino={setDestino} />
      ) : null}

      <Campo etiqueta="¿Por qué sale del hato?" ayuda="Opcional. Sirve para saber con el tiempo por qué se descartan animales.">
        {(id) => (
          <SelectorTarjetas
            id={id}
            valor={motivo}
            onCambio={setMotivo}
            titulo="¿Por qué sale del hato?"
            opciones={MOTIVOS_BAJA.map((m) => ({ ...m, escena: ESCENA_MOTIVO_BAJA[m.valor] }))}
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

      <Boton variante="peligro" onClick={guardar} pendiente={guardando} cargando="Guardando…" disabled={!tipo || !fecha || valorInvalido || pesoInvalido}>
        Dar de baja
      </Boton>
    </div>
  );
}
