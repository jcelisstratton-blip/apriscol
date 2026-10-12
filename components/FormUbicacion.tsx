"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { Boton, clasesBoton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { Segmentado } from "@/components/Segmentado";
import { Selector } from "@/components/Selector";
import { crearUbicacion, editarUbicacion } from "@/app/(app)/hato/corrales/actions";
import { AYUDA_USO, ETIQUETA_PISO, ETIQUETA_TIPO_UBICACION, ETIQUETA_USO, PISOS, PISOS_SECOS, TIPOS_UBICACION, USOS } from "@/lib/corrales";
import type { PisoUbicacion, TipoUbicacion, Ubicacion, UsoUbicacion } from "@/lib/tipos";

const coma = (n: number | null | undefined) => (n == null ? "" : String(n).replace(".", ","));

/**
 * Crear o corregir un corral (bajo techo) o un potrero (pastoreo): para qué se usa, cuántos animales caben, el piso y el agua del corral,
 * y las reglas de rotación del potrero (días de ocupación y de descanso). El tipo no cambia una vez creada.
 */
export function FormUbicacion({ ubicacion, volver, ocupantes = 0 }: { ubicacion?: Ubicacion; volver: string; /** Cuántos animales hay hoy (al editar): la capacidad no puede bajar de ahí. */ ocupantes?: number }) {
  const editando = Boolean(ubicacion);
  const [estado, enviar, pendiente] = useActionState(editando ? editarUbicacion : crearUbicacion, undefined);
  const [, iniciar] = useTransition();
  const [tipo, setTipo] = useState<TipoUbicacion>(ubicacion?.tipo ?? "corral");
  const [uso, setUso] = useState<UsoUbicacion>(ubicacion?.uso ?? "general");
  const [piso, setPiso] = useState<PisoUbicacion | "">(ubicacion?.piso ?? "");
  const [agua, setAgua] = useState<"si" | "no">(ubicacion && !ubicacion.agua ? "no" : "si");

  const alEnviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    iniciar(() => enviar(datos));
  };
  const corral = tipo === "corral";
  const usosDisponibles = USOS.filter((u) => corral || u !== "cuarentena");

  return (
    <form onSubmit={alEnviar} className="space-y-5">
      {ubicacion ? <input type="hidden" name="ubicacion_id" value={ubicacion.id} /> : null}

      <div className="space-y-1.5">
        <p className="text-sm font-semibold">¿Qué es?</p>
        {editando ? (
          <>
            <input type="hidden" name="tipo" value={tipo} />
            <p className="text-[0.9375rem]">{ETIQUETA_TIPO_UBICACION[tipo]}</p>
            <p className="text-[0.8125rem] text-humo">El tipo no cambia: su historial de animales es de un {tipo === "corral" ? "corral" : "potrero"}.</p>
          </>
        ) : (
          <Segmentado<TipoUbicacion>
            nombre="tipo"
            etiqueta="Tipo de instalación"
            valor={tipo}
            onCambio={(t) => {
              setTipo(t);
              if (t === "potrero" && uso === "cuarentena") setUso("general");
            }}
            opciones={TIPOS_UBICACION.map((t) => ({ valor: t, etiqueta: t === "corral" ? "Corral (bajo techo)" : "Potrero (pastoreo)" }))}
          />
        )}
      </div>

      <Campo etiqueta="Nombre o número" ayuda="Para reconocerlo: «Corral 1», «Maternidad», «Potrero La Ceiba».">
        {(id) => <input id={id} name="nombre" defaultValue={ubicacion?.nombre ?? ""} required maxLength={80} autoComplete="off" enterKeyHint="next" className={CLASE_INPUT} />}
      </Campo>

      <Campo etiqueta="¿Para qué se usa?" ayuda={AYUDA_USO[uso]}>
        {(id) => <Selector id={id} nombre="uso" valor={uso} onCambio={(v) => v && setUso(v)} titulo="¿Para qué se usa?" opciones={usosDisponibles.map((u) => ({ valor: u, etiqueta: ETIQUETA_USO[u], detalle: AYUDA_USO[u] }))} />}
      </Campo>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Campo etiqueta={corral ? "Cuántos animales caben" : "Cuántos animales caben (opcional)"} ayuda={`${corral ? "La app no deja pasar de ese número: así se evita el hacinamiento." : "Opcional: si lo pones, la app no deja pasar de ese número; si no, no hay tope."}${ocupantes ? ` Hoy hay ${ocupantes}: no puede ser menos.` : ""}`}>
          {(id) => <input id={id} name="capacidad" defaultValue={ubicacion?.capacidad ?? ""} required={corral} inputMode="numeric" autoComplete="off" className={CLASE_INPUT} />}
        </Campo>
        <Campo etiqueta="Área en m² (opcional)" ayuda="Sirve para ver cuánto espacio tiene cada animal.">
          {(id) => <input id={id} name="area_m2" defaultValue={coma(ubicacion?.area_m2)} inputMode="decimal" autoComplete="off" className={CLASE_INPUT} />}
        </Campo>
      </div>

      {corral ? (
        <>
          <Campo etiqueta="Piso" ayuda="Las cabras detestan la humedad: el piso elevado o emparrillado las mantiene secas y previene problemas de pezuñas y parásitos.">
            {(id) => (
              <Selector id={id} nombre="piso" valor={piso} onCambio={(v) => setPiso(v as PisoUbicacion | "")} titulo="Piso del corral" placeholder="Sin especificar" permitirVacio opciones={PISOS.filter((p) => p !== "pasto").map((p) => ({ valor: p, etiqueta: ETIQUETA_PISO[p] }))} />
            )}
          </Campo>
          {piso && !PISOS_SECOS.includes(piso) ? <Aviso tipo="info">Con este piso se mantiene más la humedad. Si puedes, un piso elevado o emparrillado cuida mejor las pezuñas.</Aviso> : null}

          <div className="space-y-1.5">
            <p className="text-sm font-semibold">Agua limpia y fresca a toda hora</p>
            <Segmentado<"si" | "no"> nombre="agua" etiqueta="Agua permanente" valor={agua} onCambio={setAgua} opciones={[{ valor: "si", etiqueta: "Sí, tiene" }, { valor: "no", etiqueta: "No tiene" }]} />
          </div>
          {agua === "no" ? <Aviso tipo="atencion">El agua limpia y fresca de forma permanente es indispensable. Te lo dejamos marcado para que lo resuelvas.</Aviso> : null}
        </>
      ) : (
        <div className="space-y-4 rounded-3xl border border-arena p-4">
          <p className="font-semibold">Rotación del potrero</p>
          <p className="-mt-2 text-[0.8125rem] text-humo">Ocupación corta y descanso largo: así el pasto rebrota y se rompe el ciclo de los parásitos.</p>
          <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
            <Campo etiqueta="Días de ocupación (máximo)" ayuda="Lo habitual: 3 a 5 días.">
              {(id) => <input id={id} name="dias_ocupacion_max" defaultValue={ubicacion?.dias_ocupacion_max ?? 5} required inputMode="numeric" autoComplete="off" className={CLASE_INPUT} />}
            </Campo>
            <Campo etiqueta="Días de descanso (mínimo)" ayuda="Lo habitual: 30 a 45 días.">
              {(id) => <input id={id} name="dias_descanso_min" defaultValue={ubicacion?.dias_descanso_min ?? 35} required inputMode="numeric" autoComplete="off" className={CLASE_INPUT} />}
            </Campo>
          </div>
        </div>
      )}

      <Campo etiqueta="Observaciones" ayuda="Opcional.">
        {(id) => <textarea id={id} name="observaciones" defaultValue={ubicacion?.observaciones ?? ""} rows={3} maxLength={500} className={`${CLASE_INPUT} py-3`} />}
      </Campo>

      {estado?.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      <div className="space-y-2">
        <Boton type="submit" pendiente={pendiente} cargando="Guardando…">{editando ? "Guardar cambios" : "Crear"}</Boton>
        <Link href={volver} className={clasesBoton("fantasma")}>Cancelar</Link>
      </div>
    </form>
  );
}
