"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { Boton, clasesBoton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { Segmentado } from "@/components/Segmentado";
import { Selector } from "@/components/Selector";
import { SelectorAnimal } from "@/components/SelectorAnimal";
import { crearEmpadronamiento, editarEmpadronamiento } from "@/app/(app)/reproduccion/empadronamiento/actions";
import { CRITERIOS_POR_DEFECTO, DURACION_DEFECTO_DIAS, RELACION_RECOMENDADA, DURACION_MAX_DIAS, textoCC, VALORES_CC } from "@/lib/empadronamiento";
import { diasHasta, formatoFecha, sumarDias } from "@/lib/fechas";
import type { Empadronamiento, Especie } from "@/lib/tipos";

const coma = (n: number | null | undefined) => (n == null ? "" : String(n).replace(".", ","));
type Macho = { id: string; numero_arete: string; nombre: string | null };

/**
 * Crear o corregir un empadronamiento (temporada de monta): fechas, criterios para elegir hembras y, al crearlo, el primer semental.
 * Cerrado, solo se corrigen las observaciones.
 */
export function FormEmpadronamiento({
  fincaId,
  especies,
  hoy,
  lote,
  solicitud,
}: {
  fincaId: string;
  especies: Especie[];
  hoy: string;
  lote?: Empadronamiento;
  solicitud?: string;
}) {
  const editando = Boolean(lote);
  const cerrado = Boolean(lote?.cerrado_en);
  const [estado, enviar, pendiente] = useActionState(editando ? editarEmpadronamiento : crearEmpadronamiento, undefined);
  const [, iniciar] = useTransition();
  const [especie, setEspecie] = useState<Especie>(lote?.especie ?? especies[0] ?? "caprino");
  const [inicio, setInicio] = useState(lote?.fecha_inicio ?? hoy);
  const [duracion, setDuracion] = useState(lote ? String(diasHasta(lote.fecha_fin_prevista, lote.fecha_inicio)) : String(DURACION_DEFECTO_DIAS));
  const [edad, setEdad] = useState(String(lote?.edad_min_meses ?? CRITERIOS_POR_DEFECTO[lote?.especie ?? especies[0] ?? "caprino"].edadMeses));
  const [peso, setPeso] = useState(lote ? coma(lote.peso_min_kg) : String(CRITERIOS_POR_DEFECTO[especies[0] ?? "caprino"].pesoKg));
  const [cc, setCc] = useState<number>(lote?.cc_min ?? CRITERIOS_POR_DEFECTO[lote?.especie ?? especies[0] ?? "caprino"].cc);
  const [macho, setMacho] = useState<Macho | null>(null);
  const rec = RELACION_RECOMENDADA[especie];

  const dias = Number(duracion);
  const cierrePrevisto = /^\d{4}-\d{2}-\d{2}$/.test(inicio) && Number.isInteger(dias) && dias >= 1 && dias <= DURACION_MAX_DIAS ? sumarDias(inicio, dias) : null;

  const cambiarEspecie = (e: Especie) => {
    setEspecie(e);
    setMacho(null);
    setEdad(String(CRITERIOS_POR_DEFECTO[e].edadMeses));
    setPeso(String(CRITERIOS_POR_DEFECTO[e].pesoKg));
    setCc(CRITERIOS_POR_DEFECTO[e].cc);
  };

  const alEnviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    iniciar(() => enviar(datos));
  };

  const volver = lote ? `/reproduccion/empadronamiento/${lote.id}` : "/hato?vista=empadronamiento";

  if (cerrado && lote) {
    return (
      <form onSubmit={alEnviar} className="space-y-5">
        <input type="hidden" name="empadronamiento_id" value={lote.id} />
        <input type="hidden" name="nombre" value={lote.nombre} />
        <input type="hidden" name="especie" value={lote.especie} />
        <input type="hidden" name="fecha_inicio" value={lote.fecha_inicio} />
        <input type="hidden" name="duracion_dias" value={diasHasta(lote.fecha_fin_prevista, lote.fecha_inicio)} />
        <input type="hidden" name="edad_min_meses" value={lote.edad_min_meses} />
        <input type="hidden" name="peso_min_kg" value={lote.peso_min_kg} />
        <input type="hidden" name="cc_min" value={lote.cc_min} />
        <input type="hidden" name="hembras_por_macho" value={lote.hembras_por_macho ?? ""} />
        <Aviso tipo="info">Este empadronamiento ya está cerrado y es parte de la historia: solo se pueden corregir sus observaciones.</Aviso>
        <Campo etiqueta="Observaciones" ayuda="Opcional.">
          {(id) => <textarea id={id} name="observaciones" defaultValue={lote.observaciones ?? ""} rows={4} maxLength={1000} className={`${CLASE_INPUT} py-3`} />}
        </Campo>
        {estado?.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
        <div className="space-y-2">
          <Boton type="submit" pendiente={pendiente} cargando="Guardando…">Guardar cambios</Boton>
          <Link href={volver} className={clasesBoton("fantasma")}>Cancelar</Link>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={alEnviar} className="space-y-5">
      {lote ? <input type="hidden" name="empadronamiento_id" value={lote.id} /> : <input type="hidden" name="client_request_id" value={solicitud ?? ""} />}

      <Campo etiqueta="Nombre o código" ayuda="Para reconocerla después: «Monta de octubre 2026», «Lote A».">
        {(id) => <input id={id} name="nombre" defaultValue={lote?.nombre ?? ""} required maxLength={80} autoComplete="off" enterKeyHint="next" className={CLASE_INPUT} />}
      </Campo>

      {especies.length > 1 || editando ? (
        <div className="space-y-1.5">
          <p className="text-sm font-semibold">Especie</p>
          {editando ? (
            <>
              <input type="hidden" name="especie" value={especie} />
              <p className="text-[0.9375rem]">{especie === "caprino" ? "Cabras" : "Ovejas"}</p>
              <p className="text-[0.8125rem] text-humo">La especie no cambia: los sementales y las hembras ya son de ella.</p>
            </>
          ) : (
            <Segmentado<Especie> nombre="especie" etiqueta="Especie" valor={especie} onCambio={cambiarEspecie} opciones={especies.map((e) => ({ valor: e, etiqueta: e === "caprino" ? "Cabras" : "Ovejas" }))} />
          )}
        </div>
      ) : (
        <input type="hidden" name="especie" value={especie} />
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Campo etiqueta="Empieza">
          {(id) => <input id={id} name="fecha_inicio" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} required className={CLASE_INPUT} />}
        </Campo>
        <Campo etiqueta="Dura (días)" ayuda="Lo habitual: 45 a 60 días.">
          {(id) => <input id={id} name="duracion_dias" value={duracion} onChange={(e) => setDuracion(e.target.value)} inputMode="numeric" autoComplete="off" required className={CLASE_INPUT} />}
        </Campo>
      </div>
      {cierrePrevisto ? <p className="-mt-2 text-sm text-humo">Cierre previsto: {formatoFecha(cierrePrevisto)}.</p> : null}

      <fieldset className="space-y-4 rounded-2xl bg-lana p-3.5">
        <legend className="px-1 text-sm font-semibold">Hembras que pueden entrar</legend>
        <p className="text-[0.8125rem] text-humo">Con estos mínimos la lista de hembras se filtra sola. Son una guía: ajústalos a tu raza y a tu sistema.</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Campo etiqueta="Edad mínima (meses)">
            {(id) => <input id={id} name="edad_min_meses" value={edad} onChange={(e) => setEdad(e.target.value)} inputMode="numeric" autoComplete="off" required className={CLASE_INPUT} />}
          </Campo>
          <Campo etiqueta="Peso mínimo (kg)">
            {(id) => <input id={id} name="peso_min_kg" value={peso} onChange={(e) => setPeso(e.target.value)} inputMode="decimal" autoComplete="off" required className={CLASE_INPUT} />}
          </Campo>
          <Campo etiqueta="Condición corporal mínima">
            {(id) => (
              <Selector id={id} nombre="cc_min" valor={cc} onCambio={(v) => v !== "" && setCc(v)} titulo="Condición corporal mínima" opciones={VALORES_CC.map((v) => ({ valor: v, etiqueta: textoCC(v) }))} />
            )}
          </Campo>
        </div>
      </fieldset>

      <Campo
        etiqueta="Hembras por semental (máximo)"
        ayuda={`Opcional. Si lo dejas vacío usamos lo recomendado según la edad de cada semental: ${especie === "caprino" ? "cabros" : "carneros"} jóvenes ${rec.joven} y adultos ${rec.adulto}. Es una guía: si te pasas, la app avisa, no bloquea.`}
      >
        {(id) => <input id={id} name="hembras_por_macho" defaultValue={lote?.hembras_por_macho ?? ""} inputMode="numeric" autoComplete="off" placeholder={`Recomendado: ${rec.joven} a ${rec.adulto}`} className={CLASE_INPUT} />}
      </Campo>

      {!editando ? (
        <div className="space-y-1.5">
          <p className="text-sm font-semibold">Semental</p>
          <SelectorAnimal key={especie} nombre="macho_id" fincaId={fincaId} sexo="macho" especie={especie} titulo="Elegir semental" valor={macho} onCambio={setMacho} vacio="Elegir un macho de tu hato" />
          <p className="text-[0.8125rem] text-humo">Después puedes sumar más sementales a la temporada.</p>
        </div>
      ) : null}

      <Campo etiqueta="Observaciones" ayuda="Opcional.">
        {(id) => <textarea id={id} name="observaciones" defaultValue={lote?.observaciones ?? ""} rows={3} maxLength={1000} className={`${CLASE_INPUT} py-3`} />}
      </Campo>

      {estado?.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      <div className="space-y-2">
        <Boton type="submit" pendiente={pendiente} cargando="Guardando…">{editando ? "Guardar cambios" : "Crear empadronamiento"}</Boton>
        <Link href={volver} className={clasesBoton("fantasma")}>Cancelar</Link>
      </div>
    </form>
  );
}
