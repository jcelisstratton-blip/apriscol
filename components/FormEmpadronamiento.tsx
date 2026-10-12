"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { Boton, clasesBoton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { CampoNumeroHembras } from "@/components/CampoNumeroHembras";
import { Segmentado } from "@/components/Segmentado";
import { Selector } from "@/components/Selector";
import { OrigenYSemental, type OrigenSemental } from "@/components/OrigenYSemental";
import { X } from "lucide-react";
import { Insignia } from "@/components/Insignia";
import { SeleccionHembrasEmp, type FuenteHembras, type SeleccionEmp } from "@/components/SeleccionHembrasEmp";
import { crearEmpadronamiento, editarEmpadronamiento } from "@/app/(app)/reproduccion/empadronamiento/actions";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { etiquetaAnimal } from "@/lib/animal";
import { datosExternoVacios, etiquetaExterno, faltantesExterno, type DatosExterno } from "@/lib/semental-externo";
import { capacidadSemental, CRITERIOS_POR_DEFECTO, DURACION_DEFECTO_DIAS, DURACION_MAX_DIAS, leerNumeroHembras, mesesDesde, textoCC, VALORES_CC } from "@/lib/empadronamiento";
import { diasHasta, formatoFecha, sumarDias } from "@/lib/fechas";
import { leerNumero } from "@/lib/numeros";
import type { Empadronamiento, Especie } from "@/lib/tipos";

const coma = (n: number | null | undefined) => (n == null ? "" : String(n).replace(".", ","));
type Macho = { id: string; numero_arete: string; nombre: string | null; fecha_nacimiento?: string | null };
type HembrasElegidas = { ids: string[]; excepciones: string[]; etiquetas: Record<string, string>; clave: string };

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
  const [origen, setOrigen] = useState<OrigenSemental>("propio");
  const [extBase, setExtBase] = useState<DatosExterno>(() => datosExternoVacios("", ""));
  const [prestamo, setPrestamo] = useState<{ desde?: string; hasta?: string }>({});
  const [numHembras, setNumHembras] = useState("");
  const [hembras, setHembras] = useState<HembrasElegidas | null>(null);

  const dias = Number(duracion);
  const cierrePrevisto = /^\d{4}-\d{2}-\d{2}$/.test(inicio) && Number.isInteger(dias) && dias >= 1 && dias <= DURACION_MAX_DIAS ? sumarDias(inicio, dias) : null;

  // Los requisitos que filtran a las hembras: si no son números válidos todavía no se puede buscar.
  const edadN = Number(edad);
  const pesoN = leerNumero(peso);
  const criteriosOk = Number.isInteger(edadN) && edadN >= 1 && pesoN != null && pesoN > 0;
  const claveCriterios = `${especie}|${edadN}|${pesoN}|${cc}`;
  // El número de hembras que tendrá el semental lo decide la persona y es exacto: lo elegido debe coincidir con él.
  const fijado = leerNumeroHembras(numHembras);
  // Un semental de otro hato: el préstamo empieza con la temporada y termina con ella, salvo que la persona lo cambie.
  const externo: DatosExterno = { ...extBase, desde: prestamo.desde ?? inicio, hasta: prestamo.hasta ?? cierrePrevisto ?? inicio };
  const cambiarExterno = (d: DatosExterno) => {
    setExtBase(d);
    setPrestamo((p) => ({ desde: d.desde !== externo.desde ? d.desde : p.desde, hasta: d.hasta !== externo.hasta ? d.hasta : p.hasta }));
  };
  const faltanExterno = origen === "externo" ? faltantesExterno(externo) : [];
  const sementalListo = origen === "propio" ? macho != null : faltanExterno.length === 0;
  const nacimientoSemental = origen === "propio" ? (macho?.fecha_nacimiento ?? null) : externo.nacimiento || null;
  const etiquetaSemental = origen === "propio" ? (macho ? etiquetaAnimal(macho) : "") : etiquetaExterno({ nombre: externo.nombre.trim() || "Semental de otro hato", chip: externo.chip.trim() || "sin chip" });
  const recomendado = capacidadSemental(especie, mesesDesde(nacimientoSemental), null).max;
  const elegidasN = hembras?.ids.length ?? 0;
  const desactualizada = Boolean(hembras && hembras.clave !== claveCriterios);
  const requisito = editando
    ? null
    : !sementalListo
      ? origen === "propio"
        ? "Elige el semental."
        : `Completa los datos del semental: falta ${faltanExterno.join(", ")}.`
      : fijado == null
        ? "Escribe cuántas hembras tendrá el semental."
        : elegidasN !== fijado
          ? `Llevas ${elegidasN} de ${fijado} ${fijado === 1 ? "hembra" : "hembras"}: ${elegidasN < fijado ? `faltan ${fijado - elegidasN}` : `sobran ${elegidasN - fijado}`}.`
          : desactualizada
            ? "Cambiaste los requisitos después de elegir las hembras: ábrelas de nuevo para confirmarlas."
            : null;
  const quitarElegida = (id: string) =>
    setHembras((h) => {
      if (!h) return h;
      const ids = h.ids.filter((x) => x !== id);
      return ids.length === 0 ? null : { ...h, ids, excepciones: h.excepciones.filter((x) => x !== id) };
    });
  const llaveSemental = origen === "externo" ? "externo" : (macho?.id ?? "");
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
          {origen === "externo" ? <input type="hidden" name="semental_externo" value={JSON.stringify(externo)} /> : null}
          <OrigenYSemental
            fincaId={fincaId}
            especie={especie}
            origen={origen}
            onOrigen={(o) => {
              if (o !== origen) setHembras(null);
              setOrigen(o);
            }}
            macho={macho}
            onMacho={(m) => {
              if (m?.id !== macho?.id) setHembras(null);
              setMacho(m);
            }}
            externo={externo}
            onExterno={cambiarExterno}
            finTemporada={cierrePrevisto}
            nombreOrigen="origen"
            nombreMacho="macho_id"
          />
          <p className="text-[0.8125rem] text-humo">Después puedes sumar más sementales a la temporada.</p>
        </div>
      ) : null}

      {!editando ? <CampoNumeroHembras valor={numHembras} onCambio={setNumHembras} especie={especie} nacimiento={nacimientoSemental} /> : null}

      {!editando ? (
        <fieldset className="space-y-3 rounded-2xl bg-lana p-3.5">
          <legend className="px-1 text-sm font-semibold">Hembras con este semental</legend>
          <input type="hidden" name="hembra_ids" value={JSON.stringify(hembras?.ids ?? [])} />
          <input type="hidden" name="excepcion_ids" value={JSON.stringify(hembras?.excepciones ?? [])} />
          {!sementalListo ? (
            <p className="text-[0.9375rem] text-humo">{origen === "externo" ? "Completa primero los datos del semental" : "Elige primero el semental"}: aquí escoges con qué hembras va, y solo aparecen hembras libres (sin gestación).</p>
          ) : (
            <>
              {hembras && hembras.ids.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[0.9375rem]">
                    <strong>{hembras.ids.length}</strong>
                    {fijado != null ? ` de ${fijado}` : ""} {hembras.ids.length === 1 ? "hembra" : "hembras"} con <span className="font-semibold [overflow-wrap:anywhere]">{etiquetaSemental}</span>
                    {hembras.excepciones.length > 0 ? (
                      <>
                        {" "}
                        <Insignia tono="alerta">{hembras.excepciones.length} {hembras.excepciones.length === 1 ? "excepción" : "excepciones"}</Insignia>
                      </>
                    ) : null}
                  </p>
                  <ul className="max-h-60 divide-y divide-arena overflow-y-auto overscroll-contain rounded-xl bg-papel px-3 ring-1 ring-arena" aria-label="Hembras elegidas" tabIndex={0}>
                    {hembras.ids.map((id) => (
                      <li key={id} className="flex items-center justify-between gap-2 py-0.5">
                        <span className="min-w-0 py-2 text-[0.9375rem] [overflow-wrap:anywhere]">
                          {hembras.etiquetas[id] ?? "Hembra"}
                          {hembras.excepciones.includes(id) ? <Insignia tono="alerta">Excepción</Insignia> : null}
                        </span>
                        <button type="button" onClick={() => quitarElegida(id)} aria-label={`Quitar a ${hembras.etiquetas[id] ?? "la hembra"} de la lista`} className="grid size-11 shrink-0 place-items-center rounded-full text-humo hover:bg-arena hover:text-rojo">
                          <X className="size-5" strokeWidth={1.75} aria-hidden="true" />
                        </button>
                      </li>
                    ))}
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
                key={llaveSemental}
                machos={[{ id: origen === "externo" ? "externo" : (macho?.id ?? ""), etiqueta: etiquetaSemental, asignadas: 0, capacidad: fijado ?? recomendado, limite: fijado, externo: origen === "externo" }]}
                umbral={umbral}
                fuente={fuente}
                inicial={hembras && hembras.ids.length > 0 ? { machoId: origen === "externo" ? "externo" : (macho?.id ?? ""), hembraIds: hembras.ids, excepcionIds: hembras.excepciones } : undefined}
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
