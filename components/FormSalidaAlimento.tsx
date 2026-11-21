"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { Boton, clasesBoton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { Chip, FilaDesplazable } from "@/components/FilaDesplazable";
import { Selector } from "@/components/Selector";
import { useToast } from "@/components/Toast";
import { guardarSalida } from "@/app/(app)/inventario/alimento/actions";
import { AvisoGuardadoLocal } from "@/components/AvisoGuardadoLocal";
import { MENSAJE_GUARDADO_LOCAL } from "@/lib/campo";
import { accionConRespaldo, camposDe, errorDe, quedoEnCelular } from "@/lib/offline/respaldo";
import { singular, textoKg, unidadesDeCantidad, type FilaAlimento } from "@/lib/inventario-alimento";

import type { DestinoSalida } from "@/lib/alimento-reglas";
export type { DestinoSalida };

/**
 * Anotar lo que se dio de comer: alimento, cuánto (en kg o en bultos) y la fecha; el destino (un corral o un lote de ceba) es opcional y solo se ofrece a quien ve
 * Corrales o Carne. Con el alimento fijo (desde su ficha) es un solo paso; sin él, «Guardar y anotar otro» deja el formulario listo para el siguiente alimento.
 */
export function FormSalidaAlimento({
  alimentos,
  alimentoId,
  destinos,
  hoy,
  volver,
}: {
  alimentos: FilaAlimento[];
  /** El alimento, si ya viene elegido (desde su ficha). */
  alimentoId?: string;
  destinos: DestinoSalida[];
  hoy: string;
  volver: string;
}) {
  // Sin señal: la salida queda en el celular con el mismo identificador (nunca se duplica) y se envía sola; el formulario queda listo para la
  // siguiente, como con «Guardar y anotar otro». Nunca se pierde lo escrito.
  const [estado, enviar, pendiente] = useActionState(
    accionConRespaldo(guardarSalida, (formulario) => {
      const id = String(formulario.get("client_request_id") ?? "");
      if (!id) return null;
      const a = alimentos.find((x) => x.producto_id === formulario.get("producto_id"));
      const u = a && formulario.get("unidad") === "unidad" ? (a.unidad ?? "unidades") : "kg";
      return {
        id,
        tipo: "alimento",
        animalId: id,
        etiqueta: `${a?.nombre ?? "Alimento"} · ${String(formulario.get("cantidad") ?? "").trim()} ${u}`,
        fecha: String(formulario.get("fecha") ?? ""),
        campos: camposDe(formulario, ["client_request_id", "seguir"]),
      };
    }),
    undefined,
  );
  const guardadoLocal = quedoEnCelular(estado);
  const error = errorDe(estado);
  const [, iniciar] = useTransition();
  const toast = useToast();
  const [elegido, setElegido] = useState(alimentoId ?? "");
  const [cantidad, setCantidad] = useState("");
  const [unidad, setUnidad] = useState("kg");
  const [destino, setDestino] = useState("");
  const [ronda, setRonda] = useState(0);
  // Un identificador por salida: si se toca dos veces, la base guarda una sola. Se renueva al guardar para anotar la siguiente.
  const peticion = useRef<string | null>(null);
  const ultimo = useRef("");
  const atendido = useRef<unknown>(undefined);

  const alimento = alimentos.find((a) => a.producto_id === elegido) ?? null;
  const unidades = alimento ? unidadesDeCantidad(alimento) : [{ valor: "kg", nombre: "kg", factor: 1 }];
  const puedeSeguir = !alimentoId;
  const noListo = !elegido || !cantidad.trim();

  useEffect(() => {
    const enCelular = quedoEnCelular(estado);
    if (!(enCelular || (estado && "guardado" in estado && estado.guardado)) || atendido.current === estado) return;
    atendido.current = estado;
    peticion.current = null;
    if (enCelular) toast.exito(MENSAJE_GUARDADO_LOCAL);
    else toast.exito(`Salida guardada: ${ultimo.current}`);
    setElegido(alimentoId ?? "");
    setCantidad("");
    setUnidad("kg");
    setRonda((r) => r + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [estado, toast, alimentoId]);

  const alEnviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // El botón que se tocó viaja con el formulario: así el servidor sabe si es «Guardar y anotar otro».
    const datos = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
    ultimo.current = alimento?.nombre ?? "";
    peticion.current ??= crypto.randomUUID();
    datos.set("client_request_id", peticion.current);
    iniciar(() => enviar(datos));
  };

  return (
    <form onSubmit={alEnviar} className="space-y-5">
      <input type="hidden" name="producto_id" value={elegido} />
      <input type="hidden" name="unidad" value={unidad} />

      {!alimentoId ? (
        <Campo etiqueta="Alimento" ayuda="Lo que se le dio de comer al hato.">
          {(id) => (
            <Selector
              id={id}
              valor={elegido}
              onCambio={(v) => {
                setElegido(String(v));
                setUnidad("kg");
              }}
              titulo="¿Qué alimento?"
              placeholder="Elegir alimento"
              opciones={alimentos.map((a) => ({ valor: a.producto_id, etiqueta: a.nombre, detalle: a.stock_kg !== null ? `Quedan ${textoKg(a, a.stock_kg)}` : "Todavía sin contar" }))}
            />
          )}
        </Campo>
      ) : null}

      <div className="space-y-2">
        {unidades.length > 1 ? (
          <FilaDesplazable>
            {unidades.map((u) => (
              <Chip key={u.valor} activo={unidad === u.valor} onClick={() => setUnidad(u.valor)}>
                En {u.nombre}
              </Chip>
            ))}
          </FilaDesplazable>
        ) : null}
        <Campo etiqueta={`¿Cuánto se dio? (${unidades.find((u) => u.valor === unidad)?.nombre ?? "kg"})`} ayuda={unidad === "unidad" && alimento ? `Cada ${singular(alimento.unidad ?? "unidad")} pesa ${alimento.kg_por_unidad} kg. Puedes escribir decimales: 0,5.` : undefined}>
          {(id) => <input id={id} name="cantidad" value={cantidad} onChange={(e) => setCantidad(e.target.value)} inputMode="decimal" autoComplete="off" required className={CLASE_INPUT} placeholder="Ej. 25" />}
        </Campo>
      </div>

      <Campo etiqueta="Fecha">
        {(id) => <input id={id} name="fecha" type="date" defaultValue={hoy} max={hoy} required className={CLASE_INPUT} />}
      </Campo>

      {destinos.length > 0 ? (
        <Campo etiqueta="¿Para quién fue?" ayuda="Opcional. Un corral o un lote de ceba.">
          {(id) => <Selector id={id} nombre="destino" valor={destino} onCambio={(v) => setDestino(String(v))} titulo="¿Para quién fue?" placeholder="Todo el hato" permitirVacio opciones={destinos} />}
        </Campo>
      ) : null}

      <Campo etiqueta="Observaciones" ayuda="Opcional.">
        {(id) => <textarea key={ronda} id={id} name="observaciones" rows={2} maxLength={300} className={`${CLASE_INPUT} py-3`} />}
      </Campo>

      {error ? <Aviso tipo="error">{error}</Aviso> : null}
      {guardadoLocal ? <AvisoGuardadoLocal /> : null}
      <div className="space-y-2">
        <Boton type="submit" pendiente={pendiente} cargando="Guardando…" disabled={noListo}>
          Guardar salida
        </Boton>
        {puedeSeguir ? (
          <Boton type="submit" name="seguir" value="1" variante="secundario" pendiente={pendiente} cargando="Guardando…" disabled={noListo}>
            Guardar y anotar otro
          </Boton>
        ) : null}
        <Link href={volver} className={clasesBoton("fantasma")}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
