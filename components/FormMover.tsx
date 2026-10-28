"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { Boton, clasesBoton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { Selector } from "@/components/Selector";
import { SelectorTarjetas } from "@/components/SelectorTarjetas";
import { SelectorAnimales, type AnimalElegido } from "@/components/SelectorAnimales";
import { avisosDeMezcla, moverAnimales } from "@/app/(app)/hato/corrales/actions";
import { ESCENA_MOTIVO } from "@/lib/escenas-corrales";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { ETIQUETA_MOTIVO, ETIQUETA_TIPO_UBICACION, ETIQUETA_USO, MOTIVOS, textoOcupacion } from "@/lib/corrales";
import type { Especie, EstadoUbicacion, MotivoMovimiento, TipoUbicacion, UsoUbicacion } from "@/lib/tipos";

export type UbicacionOpcion = {
  id: string;
  nombre: string;
  tipo: TipoUbicacion;
  uso: UsoUbicacion;
  capacidad: number | null;
  ocupantes: number;
  estado: EstadoUbicacion;
  dias_descanso: number | null;
  dias_descanso_min: number;
};

const SIN_DESTINO = "__sin_destino";

/**
 * Mover animales a un corral o potrero (o sacarlos de donde están). Bloquea el guardado si el destino no tiene cupo para todos (hacinamiento), y avisa si un potrero
 * todavía descansa o si es una cuarentena. Desde un lote (`animalesIniciales`) sirve para rotarlo de potrero.
 */
export function FormMover({
  fincaId,
  especies,
  ubicaciones,
  hoy,
  animalesIniciales = [],
  destinoInicial,
  motivoInicial,
  animalDe,
  volverA,
  desde,
}: {
  fincaId: string;
  especies: Especie[];
  ubicaciones: UbicacionOpcion[];
  hoy: string;
  animalesIniciales?: AnimalElegido[];
  destinoInicial?: string;
  motivoInicial?: MotivoMovimiento;
  /** Si se llegó desde la ficha de un animal: al guardar se vuelve a ella. */
  animalDe?: string;
  /** Si se llegó desde una instalación: al guardar se vuelve a ella. */
  volverA?: string;
  /** El nombre de la instalación de la que se saca el lote (solo informativo). */
  desde?: string;
}) {
  const [estado, enviar, pendiente] = useActionState(moverAnimales, undefined);
  const [, iniciar] = useTransition();
  const [destino, setDestino] = useState<string>(destinoInicial ?? "");
  const [animales, setAnimales] = useState<AnimalElegido[]>(animalesIniciales);
  const [fecha, setFecha] = useState(hoy);
  const [motivo, setMotivo] = useState<MotivoMovimiento>(motivoInicial ?? "traslado");
  const [yaAhi, setYaAhi] = useState(0);
  const [mezcla, setMezcla] = useState<string[]>([]);

  const sinDestino = destino === SIN_DESTINO;
  const elDestino = ubicaciones.find((u) => u.id === destino);

  // Cuántos de los animales elegidos ya están en el destino (no cuentan: no se mueven), para avisar del hacinamiento con la cuenta real.
  const clave = `${destino}|${animales.map((a) => a.id).join(",")}`;
  useEffect(() => {
    let vigente = true;
    async function contar() {
      if (!elDestino || animales.length === 0) return setYaAhi(0);
      let n = 0;
      const supabase = crearClienteNavegador();
      for (let i = 0; i < animales.length; i += 100) {
        const { count } = await supabase
          .from("movimientos_animales")
          .select("id", { count: "exact", head: true })
          .eq("ubicacion_id", elDestino.id)
          .is("hasta", null)
          .in("animal_id", animales.slice(i, i + 100).map((a) => a.id));
        n += count ?? 0;
      }
      if (vigente) setYaAhi(n);
    }
    void contar();
    // Qué conviene revisar de la mezcla (lactantes con grandes, machos con hembras, pesos distintos): solo avisa, no bloquea.
    const pedirAvisos = async () => {
      if (!elDestino || animales.length === 0) return setMezcla([]);
      const r = await avisosDeMezcla(elDestino.id, animales.map((a) => a.id));
      if (vigente) setMezcla(r.avisos);
    };
    void pedirAvisos();
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  const elegirDestino = (v: string) => {
    setDestino(v);
    const u = ubicaciones.find((x) => x.id === v);
    // El motivo más probable según el destino; se puede cambiar.
    if (u?.uso === "cuarentena") setMotivo("cuarentena");
    else if (u?.uso === "maternidad") setMotivo("maternidad");
    else if (u?.tipo === "potrero") setMotivo("rotacion");
    else if (u) setMotivo("traslado");
  };

  // El hacinamiento se bloquea: no caben más animales que la capacidad (los que ya están en el destino no cuentan, no se mueven).
  const entran = Math.max(0, animales.length - yaAhi);
  const libres = elDestino?.capacidad ? Math.max(0, elDestino.capacidad - elDestino.ocupantes) : null;
  const sinCupo = Boolean(elDestino && libres !== null && entran > libres);
  const faltan = animales.length === 0 ? "Elige los animales." : !destino ? "Elige a dónde van." : null;

  const alEnviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    iniciar(() => enviar(datos));
  };
  const volver = animalDe ? `/hato/${animalDe}#ubicacion` : volverA ? `/hato/corrales/${volverA}` : "/hato?vista=corrales";

  return (
    <form onSubmit={alEnviar} className="space-y-5">
      {animalDe ? <input type="hidden" name="animal" value={animalDe} /> : null}
      {volverA ? <input type="hidden" name="volver" value={volverA} /> : null}
      <input type="hidden" name="sin_destino" value={sinDestino ? "si" : "no"} />
      {!sinDestino && destino ? <input type="hidden" name="destino" value={destino} /> : null}

      {desde ? <Aviso tipo="info">Vas a sacar el lote de <strong className="[overflow-wrap:anywhere]">{desde}</strong>. Elige a dónde va: así queda registrada su rotación.</Aviso> : null}

      <Campo etiqueta="¿A dónde van?">
        {(id) => (
          <Selector
            id={id}
            valor={destino}
            onCambio={(v) => elegirDestino(String(v))}
            titulo="¿A dónde van?"
            placeholder="Elegir corral o potrero"
            opciones={[
              ...ubicaciones.map((u) => ({
                valor: u.id,
                etiqueta: u.nombre,
                detalle: `${ETIQUETA_TIPO_UBICACION[u.tipo]} · ${ETIQUETA_USO[u.uso]} · ${textoOcupacion(u.ocupantes, u.capacidad)}`,
              })),
              { valor: SIN_DESTINO, etiqueta: "Sacarlos de su ubicación (sin destino)" },
            ]}
          />
        )}
      </Campo>

      {ubicaciones.length === 0 ? (
        <Aviso tipo="atencion">
          Aún no tienes corrales ni potreros. <Link href="/hato/corrales/nueva" className="font-semibold underline">Crea el primero</Link> para poder mover animales.
        </Aviso>
      ) : null}

      <Campo etiqueta="Animales" ayuda="Puedes sumar un grupo entero (hembras, en lactancia, gestantes, crías…) o buscar de a uno.">
        {() => <SelectorAnimales fincaId={fincaId} especies={especies} valor={animales} onCambio={setAnimales} />}
      </Campo>

      {sinCupo && elDestino && libres !== null ? (
        <Aviso tipo="atencion">
          {libres === 0
            ? `${elDestino.nombre} está llena: caben ${elDestino.capacidad} animales y ya tiene ${elDestino.ocupantes}. Elige otra instalación o saca a algunos antes.`
            : `En ${elDestino.nombre} solo caben ${libres} ${libres === 1 ? "animal más" : "animales más"} y elegiste ${entran}. Quita ${entran - libres} o elige otra instalación: el hacinamiento causa estrés, peleas y enfermedades respiratorias.`}
        </Aviso>
      ) : null}
      {elDestino?.estado === "descanso" ? (
        <Aviso tipo="atencion">
          {elDestino.nombre} está en descanso ({elDestino.dias_descanso ?? 0} de {elDestino.dias_descanso_min} días). Entrar antes acorta el descanso y los parásitos no alcanzan a morir.
        </Aviso>
      ) : null}
      {elDestino?.uso === "cuarentena" ? <Aviso tipo="info">En cuarentena los animales se quedan al menos 21 días (lo ideal, 30) antes de pasar al lote general.</Aviso> : null}

      {mezcla.length > 0 ? (
        <div className="space-y-2">
          {mezcla.map((t) => (
            <Aviso key={t} tipo="atencion">{t}</Aviso>
          ))}
          <p className="text-sm text-humo">Es una recomendación: puedes mover de todas formas.</p>
        </div>
      ) : null}

      <Campo etiqueta="Fecha del movimiento">
        {(id) => <input id={id} name="fecha" type="date" value={fecha} max={hoy} onChange={(e) => setFecha(e.target.value)} required className={`${CLASE_INPUT} sm:max-w-xs`} />}
      </Campo>
      <Campo etiqueta="Motivo">
        {(id) => <SelectorTarjetas id={id} nombre="motivo" valor={motivo} onCambio={(v) => v && setMotivo(v)} titulo="Motivo" opciones={MOTIVOS.map((m) => ({ valor: m, etiqueta: ETIQUETA_MOTIVO[m], escena: ESCENA_MOTIVO[m] }))} />}
      </Campo>

      <Campo etiqueta="Observaciones" ayuda="Opcional.">
        {(id) => <textarea id={id} name="observaciones" rows={2} maxLength={300} className={`${CLASE_INPUT} py-3`} />}
      </Campo>

      {faltan ? <Aviso tipo="atencion">{faltan}</Aviso> : null}
      {estado?.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      <div className="space-y-2">
        <Boton type="submit" pendiente={pendiente} cargando="Moviendo…" disabled={faltan != null || sinCupo}>
          {sinDestino ? "Sacar de su ubicación" : animales.length > 1 ? `Mover ${animales.length} animales` : "Mover"}
        </Boton>
        <Link href={volver} className={clasesBoton("fantasma")}>Cancelar</Link>
      </div>
    </form>
  );
}
