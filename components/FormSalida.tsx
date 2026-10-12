"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Aviso } from "@/components/Aviso";
import { Boton, clasesBoton } from "@/components/Boton";
import { CamposTrazabilidad } from "@/components/CamposTrazabilidad";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { SelectorTarjetas } from "@/components/SelectorTarjetas";
import { useToast } from "@/components/Toast";
import { corregirSalida } from "@/app/(app)/hato/actions";
import { MOTIVOS_BAJA } from "@/lib/bajas";
import { ESCENA_MOTIVO_BAJA } from "@/lib/escenas-forms-a-hato";
import { leerNumero } from "@/lib/numeros";
import type { Baja, MotivoBaja } from "@/lib/tipos";

const coma = (n: number | null | undefined) => (n == null ? "" : String(n).replace(".", ","));

/**
 * Corregir los datos de la salida de un animal (comprador, valor, peso, guía, destino, motivo, notas). Qué pasó y la fecha no se cambian
 * aquí: de eso depende el estado del animal y el control del retiro de carne.
 */
export function FormSalida({ baja }: { baja: Baja }) {
  const router = useRouter();
  const toast = useToast();
  const [motivo, setMotivo] = useState<MotivoBaja | "">(baja.motivo ?? "");
  const [comprador, setComprador] = useState(baja.comprador ?? "");
  const [valor, setValor] = useState(coma(baja.valor));
  const [peso, setPeso] = useState(coma(baja.peso_kg));
  const [guia, setGuia] = useState(baja.guia_movilizacion ?? "");
  const [destino, setDestino] = useState(baja.destino ?? "");
  const [detalle, setDetalle] = useState(baja.detalle ?? "");
  const [error, setError] = useState<string | null>(null);
  const [guardando, iniciar] = useTransition();

  const comercial = baja.tipo === "venta" || baja.tipo === "sacrificio";
  const numeroValor = valor.trim() === "" ? undefined : (leerNumero(valor) ?? Number.NaN);
  const numeroPeso = peso.trim() === "" ? undefined : (leerNumero(peso) ?? Number.NaN);
  const valorInvalido = baja.tipo === "venta" && numeroValor !== undefined && !Number.isFinite(numeroValor);
  const pesoInvalido = comercial && numeroPeso !== undefined && !Number.isFinite(numeroPeso);

  const guardar = () => {
    setError(null);
    iniciar(async () => {
      const r = await corregirSalida({
        animalId: baja.animal_id,
        motivo: motivo || undefined,
        comprador,
        valor: baja.tipo === "venta" ? numeroValor : undefined,
        detalle,
        ...(comercial ? { pesoKg: numeroPeso, guiaMovilizacion: guia, destino } : {}),
      });
      if (!r.ok) return setError(r.error);
      toast.exito("Cambios guardados");
      router.push(`/hato/${baja.animal_id}#salida`);
      router.refresh();
    });
  };

  return (
    <div className="space-y-5">
      {baja.tipo === "venta" ? (
        <>
          <Campo etiqueta="Comprador" ayuda="Opcional.">
            {(id) => <input id={id} value={comprador} maxLength={160} autoComplete="off" onChange={(e) => setComprador(e.target.value)} className={CLASE_INPUT} />}
          </Campo>
          <Campo etiqueta="Valor de la venta" ayuda="Opcional. En pesos." error={valorInvalido ? "Escribe solo números." : undefined}>
            {(id) => <input id={id} value={valor} inputMode="decimal" autoComplete="off" onChange={(e) => setValor(e.target.value)} placeholder="Ej. 450.000" className={CLASE_INPUT} />}
          </Campo>
        </>
      ) : null}

      {comercial ? <CamposTrazabilidad tipo={baja.tipo} peso={peso} onPeso={setPeso} pesoInvalido={pesoInvalido} guia={guia} onGuia={setGuia} destino={destino} onDestino={setDestino} /> : null}

      <Campo etiqueta="¿Por qué salió del hato?" ayuda="Opcional.">
        {(id) => <SelectorTarjetas id={id} valor={motivo} onCambio={setMotivo} titulo="¿Por qué salió del hato?" opciones={MOTIVOS_BAJA.map((m) => ({ ...m, escena: ESCENA_MOTIVO_BAJA[m.valor] }))} permitirVacio />}
      </Campo>

      <Campo etiqueta="Notas">
        {(id) => <textarea id={id} value={detalle} maxLength={1000} rows={3} onChange={(e) => setDetalle(e.target.value)} className={`${CLASE_INPUT} py-3`} placeholder="Opcional" />}
      </Campo>

      {error ? <Aviso tipo="error">{error}</Aviso> : null}
      <div className="space-y-2">
        <Boton onClick={guardar} pendiente={guardando} cargando="Guardando…" disabled={valorInvalido || pesoInvalido}>
          Guardar cambios
        </Boton>
        <Link href={`/hato/${baja.animal_id}#salida`} className={clasesBoton("fantasma")}>
          Cancelar
        </Link>
      </div>
    </div>
  );
}
