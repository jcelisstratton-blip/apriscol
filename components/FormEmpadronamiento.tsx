"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { Boton, clasesBoton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { CampoNumeroHembras } from "@/components/CampoNumeroHembras";
import { Segmentado } from "@/components/Segmentado";
import { Selector } from "@/components/Selector";
import { SelectorAnimal } from "@/components/SelectorAnimal";
import { Insignia } from "@/components/Insignia";
import { SeleccionHembrasEmp, type FuenteHembras, type SeleccionEmp } from "@/components/SeleccionHembrasEmp";
import { crearEmpadronamiento, editarEmpadronamiento } from "@/app/(app)/reproduccion/empadronamiento/actions";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { etiquetaAnimal } from "@/lib/animal";
import { capacidadSemental, CRITERIOS_POR_DEFECTO, DURACION_DEFECTO_DIAS, DURACION_MAX_DIAS, leerNumeroHembras, mesesDesde, textoCC, VALORES_CC } from "@/lib/empadronamiento";
import { diasHasta, formatoFecha, sumarDias } from "@/lib/fechas";
import { leerNumero } from "@/lib/numeros";
import type { Empadronamiento, Especie } from "@/lib/tipos";

const coma = (n: number | null | undefined) => (n == null ? "" : String(n).replace(".", ","));
type Macho = { id: string; numero_arete: string; nombre: string | null; fecha_nacimiento?: string | null };
type HembrasElegidas = { ids: string[]; excepciones: string[]; etiquetas: Record<string, string>; clave: string };
const MUESTRA_ELEGIDAS = 8;

/**
 * Crear o corregir un empadronamiento (temporada de monta): fechas, criterios para elegir hembras y, al crearlo, el primer semental con
 * sus hembras (solo hembras libres: sin gestación). Más sementales y más hembras se suman después desde la temporada.
 * Cerrado, solo se corrigen las observaciones.
 */
export function FormEmpadronamiento({
  fincaId,
  umbral,
  especies,
  hoy,
  lote,
  solicitud,
}: {
  fincaId: string;
  /** Umbral de endogamia de la finca (para bloquear parejas al elegir las hembras). */
  umbral: number;
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
  const [numHembras, setNumHembras] = useState("");
  const [hembras, setHembras] = useState<HembrasElegidas | null>(null);

  // Los requisitos que filtran a las hembras: si no son números válidos todavía no se puede buscar.
  const edadN = Number(edad);
  const pesoN = leerNumero(peso);
  const criteriosOk = Number.isInteger(edadN) && edadN >= 1 && pesoN != null && pesoN > 0;
  const claveCriterios = `${especie}|${edadN}|${pesoN}|${cc}`;
  // El número de hembras que tendrá el semental lo decide la persona y es exacto: lo elegido debe coincidir con él.
  const fijado = leerNumeroHembras(numHembras);
  const recomendado = capacidadSemental(especie, mesesDesde(macho?.fecha_nacimiento ?? null), null).max;
  const elegidasN = hembras?.ids.length ?? 0;
  const desactualizada = Boolean(hembras && hembras.clave !== claveCriterios);
  const requisito = editando
    ? null
    : !macho
      ? "Elige el semental."
      : fijado == null
        ? "Escribe cuántas hembras tendrá el semental."
        : elegidasN !== fijado
          ? `Llevas ${elegidasN} de ${fijado} ${fijado === 1 ? "hembra" : "hembras"}: ${elegidasN < fijado ? `faltan ${fijado - elegidasN}` : `sobran ${elegidasN - fijado}`}.`
          : desactualizada
            ? "Cambiaste los requisitos después de elegir las hembras: ábrelas de nuevo para confirmarlas."
            : null;
  const machoId = macho?.id;
  const fuente = useMemo<FuenteHembras>(
    () => ({
      candidatas: () => crearClienteNavegador().rpc("empadronamiento_candidatas_criterios", { p_finca: fincaId, p_especie: especie, p_edad_min: edadN, p_peso_min: pesoN ?? 0, p_cc_min: cc }),
      endogamia: (id, ids) => crearClienteNavegador().rpc("empadronamiento_endogamia_previa", { p_finca: fincaId, p_macho: id, p_hembras: ids }),
    }),
    [fincaId, especie, edadN, pesoN, cc],
  );
  const alElegir = async (sel: SeleccionEmp) => {
    setHembras({ ids: sel.hembraIds, excepciones: sel.excepcionIds, etiquetas: sel.etiquetas, clave: claveCriterios });
    return null;
  };

  const dias = Number(duracion);
  const cierrePrevisto = /^\d{4}-\d{2}-\d{2}$/.test(inicio) && Number.isInteger(dias) && dias >= 1 && dias <= DURACION_MAX_DIAS ? sumarDias(inicio, dias) : null;

  const cambiarEspecie = (e: Especie) => {
    setEspecie(e);
    setMacho(null);
    setHembras(null);
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

      {!editando ? (
        <div className="space-y-1.5">
          <p className="text-sm font-semibold">Semental</p>
          <SelectorAnimal
            key={especie}
            nombre="macho_id"
            fincaId={fincaId}
            sexo="macho"
            especie={especie}
            titulo="Elegir semental"
            valor={macho}
            onCambio={(m) => {
              if (m?.id !== macho?.id) setHembras(null);
              setMacho(m);
            }}
            vacio="Elegir un macho de tu hato"
          />
          <p className="text-[0.8125rem] text-humo">Después puedes sumar más sementales a la temporada.</p>
        </div>
      ) : null}

      {!editando ? <CampoNumeroHembras valor={numHembras} onCambio={setNumHembras} especie={especie} nacimiento={macho?.fecha_nacimiento} /> : null}

      {!editando ? (
        <fieldset className="space-y-3 rounded-2xl bg-lana p-3.5">
          <legend className="px-1 text-sm font-semibold">Hembras con este semental</legend>
          <input type="hidden" name="hembra_ids" value={JSON.stringify(hembras?.ids ?? [])} />
          <input type="hidden" name="excepcion_ids" value={JSON.stringify(hembras?.excepciones ?? [])} />
          {!macho ? (
            <p className="text-[0.9375rem] text-humo">Elige primero el semental: aquí escoges con qué hembras va, y solo aparecen hembras libres (sin gestación).</p>
          ) : (
            <>
              {hembras && hembras.ids.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[0.9375rem]">
                    <strong>{hembras.ids.length}</strong>
                    {fijado != null ? ` de ${fijado}` : ""} {hembras.ids.length === 1 ? "hembra" : "hembras"} con <span className="font-semibold [overflow-wrap:anywhere]">{etiquetaAnimal(macho)}</span>
                    {hembras.excepciones.length > 0 ? (
                      <>
                        {" "}
                        <Insignia tono="alerta">{hembras.excepciones.length} {hembras.excepciones.length === 1 ? "excepción" : "excepciones"}</Insignia>
                      </>
                    ) : null}
                  </p>
                  <ul className="flex flex-wrap gap-1.5">
                    {hembras.ids.slice(0, MUESTRA_ELEGIDAS).map((id) => (
                      <li key={id} className="max-w-full rounded-full bg-papel px-2.5 py-1 text-sm ring-1 ring-arena [overflow-wrap:anywhere]">{hembras.etiquetas[id] ?? "Hembra"}</li>
                    ))}
                    {hembras.ids.length > MUESTRA_ELEGIDAS ? <li className="rounded-full px-2.5 py-1 text-sm text-humo">y {hembras.ids.length - MUESTRA_ELEGIDAS} más</li> : null}
                  </ul>
                  {fijado != null && hembras.ids.length > fijado ? (
                    <Aviso tipo="error">Elegiste {hembras.ids.length} hembras y el semental tendrá {fijado}. Cambia el número o abre la lista y quita hembras.</Aviso>
                  ) : null}
                </div>
              ) : (
                <p className="text-[0.9375rem] text-humo">
                  Aún no eliges hembras{fijado != null ? ` (este semental tendrá ${fijado})` : ""}. Solo aparecen hembras libres: sin gestación ni servicio esperando diagnóstico.
                </p>
              )}
              <SeleccionHembrasEmp
                key={`${machoId}`}
                machos={[{ id: macho.id, etiqueta: etiquetaAnimal(macho), asignadas: 0, capacidad: fijado ?? recomendado, limite: fijado }]}
                umbral={umbral}
                fuente={fuente}
                inicial={hembras && hembras.ids.length > 0 ? { machoId: macho.id, hembraIds: hembras.ids, excepcionIds: hembras.excepciones } : undefined}
                titulo="Elegir las hembras"
                boton={{ texto: hembras && hembras.ids.length > 0 ? "Cambiar las hembras" : "Elegir las hembras", variante: "secundario" }}
                deshabilitado={!criteriosOk || fijado == null}
                textoConfirmar={(n) => `Elegir ${n} ${n === 1 ? "hembra" : "hembras"}`}
                onConfirmar={alElegir}
              />
              {!criteriosOk ? <p className="text-sm text-humo">Revisa la edad y el peso mínimos de arriba para poder buscar las hembras.</p> : fijado == null ? <p className="text-sm text-humo">Escribe arriba cuántas hembras tendrá el semental para poder elegirlas.</p> : null}
            </>
          )}
        </fieldset>
      ) : null}

      <Campo etiqueta="Observaciones" ayuda="Opcional.">
        {(id) => <textarea id={id} name="observaciones" defaultValue={lote?.observaciones ?? ""} rows={3} maxLength={1000} className={`${CLASE_INPUT} py-3`} />}
      </Campo>

      {estado?.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      {requisito ? <Aviso tipo="atencion">{requisito}</Aviso> : null}
      <div className="space-y-2">
        <Boton type="submit" pendiente={pendiente} disabled={requisito != null} cargando="Guardando…">{editando ? "Guardar cambios" : "Crear empadronamiento"}</Boton>
        <Link href={volver} className={clasesBoton("fantasma")}>Cancelar</Link>
      </div>
    </form>
  );
}
