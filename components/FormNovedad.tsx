"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { Boton, clasesBoton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { Chip, FilaDesplazable } from "@/components/FilaDesplazable";
import { OjoFamacha } from "@/components/OjoFamacha";
import { Selector } from "@/components/Selector";
import { SelectorAnimal } from "@/components/SelectorAnimal";
import { SelectorTarjetas, type OpcionTarjeta } from "@/components/SelectorTarjetas";
import { crearNovedad } from "@/app/(app)/novedades/actions";
import { AYUDA_MUESTRA, DETALLE_MUESTRA, ETIQUETA_MUESTRA, TIPOS_MUESTRA, type TipoMuestra } from "@/lib/coprologico";
import { ESCENA_EVENTO } from "@/lib/escenas-sanidad";
import { ESCENA_CAMPO, ESCENA_GENERICA } from "@/lib/escenas-sanidad-campos";
import { ESCENA_VIA } from "@/lib/escenas-forms-a-sanidad";
import { ESCENA_MUESTRA, ESCENA_RESULTADO_PRUEBA, ESCENA_TIPO_NOVEDAD } from "@/lib/escenas-listas-sanidad";
import { ESC } from "@/lib/escenas";
import { FAMACHA, PUNTAJES_FAMACHA } from "@/lib/famacha";
import { CUANDO_NOVEDAD, DETALLE_TIPO_NOVEDAD, ETIQUETA_TIPO_NOVEDAD, TIPOS_NOVEDAD, faltaEnNovedad, productosParaTipo, type CuandoNovedad, type TipoNovedad } from "@/lib/novedades";
import { ANESTESIAS, CATEGORIAS, COJERAS, ETAPAS, MOTIVOS, REGLAS, type OpcionCampo } from "@/lib/sanidad-campos";
import { ETIQUETA_EVENTO, ETIQUETA_PRUEBA_CORTA, ETIQUETA_RESULTADO_PRUEBA, ETIQUETA_VIA, RESULTADOS_PRUEBA, TIPOS_EVENTO, TIPOS_PRUEBA, VIAS } from "@/lib/sanidad";
import type { Novedad, ResultadoPrueba, TipoEvento, TipoPrueba, ViaAplicacion } from "@/lib/tipos";

export type ProductoNovedad = { id: string; nombre: string; tipo: string };
export type LoteNovedad = { gasto_id: string; producto_id: string; lote: string; vencimiento: string | null; comprado: string };
type AnimalElegido = { id: string; numero_arete: string; nombre: string | null };

const COLOR_PUNTO = { ok: "bg-ok text-white", neutro: "bg-arena text-tinta", aviso: "bg-ambar text-white", alerta: "bg-rojo text-white" } as const;
const aTarjetas = (grupo: string, opciones: OpcionCampo[]): OpcionTarjeta<string>[] => opciones.map((o) => ({ valor: o.valor, etiqueta: o.etiqueta, detalle: o.detalle, escena: ESCENA_CAMPO[`${grupo}:${o.valor}`] ?? ESCENA_GENERICA }));

/**
 * Enviar una novedad sobre un animal. **Todo se elige, nada se captura**: las mismas opciones de «Registrar una aplicación» (qué se hizo, contra qué, qué dosis, por qué,
 * cómo caminaba, qué anestesia, producto, lote y vía), de «Prueba diagnóstica», de «Examen coprológico» y de «Evaluación FAMACHA». Lo único que se escribe son las observaciones.
 * No es un registro oficial: lo revisan el propietario, el administrador y el veterinario.
 */
export function FormNovedad({
  animalId: animalFijo,
  animalTexto,
  fincaId,
  productos,
  lotes,
  solicitud,
}: {
  /** El animal, si ya viene elegido (desde su ficha). Si no, se elige en el formulario. */
  animalId?: string;
  animalTexto?: string;
  fincaId: string;
  productos: ProductoNovedad[];
  lotes: LoteNovedad[];
  solicitud: string;
}) {
  const [estado, enviar, pendiente] = useActionState(crearNovedad, undefined);
  const [, iniciar] = useTransition();
  const [elegido, setElegido] = useState<AnimalElegido | null>(null);
  const [tipo, setTipo] = useState<TipoNovedad | "">("");
  const [cuando, setCuando] = useState<CuandoNovedad>("hoy");
  // Aplicación (lo mismo que «Registrar una aplicación»)
  const [tipoEvento, setTipoEvento] = useState<TipoEvento | "">("");
  const [categoria, setCategoria] = useState("");
  const [etapa, setEtapa] = useState("");
  const [motivo, setMotivo] = useState("");
  const [cojera, setCojera] = useState("");
  const [anestesia, setAnestesia] = useState("");
  const [producto, setProducto] = useState("");
  const [lote, setLote] = useState("");
  const [via, setVia] = useState<ViaAplicacion | "">("");
  // Prueba, coprológico y FAMACHA
  const [prueba, setPrueba] = useState<TipoPrueba | "">("");
  const [resultado, setResultado] = useState<ResultadoPrueba | "">("");
  const [muestra, setMuestra] = useState<TipoMuestra | "">("");
  const [puntaje, setPuntaje] = useState<number | null>(null);

  const animalId = animalFijo ?? elegido?.id ?? "";
  const r = tipoEvento ? REGLAS[tipoEvento] : null;
  const delTipo = productosParaTipo(tipoEvento, productos);
  const lotesDelProducto = lotes.filter((l) => l.producto_id === producto);
  const conProducto = tipoEvento === "vacunacion" || tipoEvento === "desparasitacion" || tipoEvento === "tratamiento" || tipoEvento === "otro" || tipoEvento === "cirugia";
  const falta = faltaEnNovedad({
    tipo: tipo || undefined,
    tipo_evento: tipoEvento || null,
    prueba: prueba || null,
    resultado_prueba: resultado || null,
    tipo_muestra: muestra || null,
    puntaje,
  } as Partial<Novedad>);

  const cambiarTipoEvento = (t: TipoEvento) => {
    setTipoEvento(t);
    setCategoria("");
    setEtapa("");
    setMotivo("");
    setCojera("");
    setAnestesia("");
    setProducto("");
    setLote("");
  };

  const alEnviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    iniciar(() => enviar(datos));
  };

  return (
    <form onSubmit={alEnviar} className="space-y-5">
      <input type="hidden" name="animal_id" value={animalId} />
      <input type="hidden" name="client_request_id" value={solicitud} />
      <input type="hidden" name="tipo" value={tipo} />
      <input type="hidden" name="cuando" value={cuando} />
      <Aviso tipo="info">Esto es una novedad: un aviso para el administrador y el veterinario. No queda como registro de Sanidad hasta que ellos lo confirmen. Solo eliges opciones; lo único que puedes escribir son las observaciones.</Aviso>

      {!animalFijo ? (
        <Campo etiqueta="Animal" ayuda="¿De cuál animal es la novedad?">
          {(id) => <SelectorAnimal id={id} nombre="animal_elegido" fincaId={fincaId} titulo="¿De qué animal es?" valor={elegido} onCambio={setElegido} vacio="Elegir animal" soloActivos />}
        </Campo>
      ) : (
        <p className="text-sm text-humo">Sobre {animalTexto}.</p>
      )}

      <Campo etiqueta="¿Qué quieres contar?">
        {(id) => (
          <SelectorTarjetas<TipoNovedad>
            id={id}
            valor={tipo}
            onCambio={(v) => v && setTipo(v)}
            titulo="¿Qué quieres contar?"
            opciones={TIPOS_NOVEDAD.map((t) => ({ valor: t, etiqueta: ETIQUETA_TIPO_NOVEDAD[t], detalle: DETALLE_TIPO_NOVEDAD[t], escena: ESCENA_TIPO_NOVEDAD[t] }))}
          />
        )}
      </Campo>

      {tipo ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold">¿Cuándo fue?</p>
          <FilaDesplazable>
            {CUANDO_NOVEDAD.map((c) => (
              <Chip key={c.valor} activo={cuando === c.valor} onClick={() => setCuando(c.valor)}>
                {c.etiqueta}
              </Chip>
            ))}
          </FilaDesplazable>
        </div>
      ) : null}

      {tipo === "aplicacion" ? (
        <>
          <Campo etiqueta="¿Qué se hizo?">
            {(id) => (
              <SelectorTarjetas<TipoEvento>
                id={id}
                nombre="tipo_evento"
                valor={tipoEvento}
                onCambio={(v) => v && cambiarTipoEvento(v)}
                titulo="¿Qué se hizo?"
                opciones={TIPOS_EVENTO.map((t) => ({ valor: t, etiqueta: ETIQUETA_EVENTO[t], escena: ESCENA_EVENTO[t] }))}
              />
            )}
          </Campo>
          {r ? <Aviso tipo="info">{r.ayuda}</Aviso> : null}

          {tipoEvento && CATEGORIAS[tipoEvento] ? (
            <Campo etiqueta={r?.tituloCategoria ?? "¿Qué fue?"}>
              {(id) => <SelectorTarjetas id={id} nombre="categoria" valor={categoria} onCambio={setCategoria} titulo={r?.tituloCategoria ?? "¿Qué fue?"} permitirVacio etiquetaVacio="No sé" opciones={aTarjetas(tipoEvento, CATEGORIAS[tipoEvento] ?? [])} />}
            </Campo>
          ) : null}
          {tipoEvento === "pediluvio" && categoria === "cobre" ? <Aviso tipo="atencion">El sulfato de cobre no se recomienda en ovejas: puede ser tóxico si lo toman.</Aviso> : null}
          {r?.etapa ? (
            <Campo etiqueta="¿Qué dosis es?">
              {(id) => <SelectorTarjetas id={id} nombre="etapa" valor={etapa} onCambio={setEtapa} titulo="¿Qué dosis es?" permitirVacio etiquetaVacio="No sé" opciones={aTarjetas("etapa", ETAPAS)} />}
            </Campo>
          ) : null}
          {r?.motivo ? (
            <Campo etiqueta="¿Por qué se desparasita?">
              {(id) => <SelectorTarjetas id={id} nombre="motivo" valor={motivo} onCambio={setMotivo} titulo="¿Por qué se desparasita?" permitirVacio etiquetaVacio="No sé" opciones={aTarjetas("motivo", MOTIVOS)} />}
            </Campo>
          ) : null}
          {r?.cojera ? (
            <Campo etiqueta="¿Cómo caminaba antes?" ayuda="Opcional.">
              {(id) => <SelectorTarjetas id={id} nombre="cojera" valor={cojera} onCambio={setCojera} titulo="Cojera" permitirVacio etiquetaVacio="No lo revisé" opciones={aTarjetas("cojera", COJERAS)} />}
            </Campo>
          ) : null}
          {r?.anestesia ? (
            <Campo etiqueta="¿Con qué anestesia?">
              {(id) => <SelectorTarjetas id={id} nombre="anestesia" valor={anestesia} onCambio={setAnestesia} titulo="Anestesia" permitirVacio etiquetaVacio="No sé" opciones={aTarjetas("anestesia", ANESTESIAS)} />}
            </Campo>
          ) : null}

          {conProducto ? (
            <>
              <input type="hidden" name="producto_id" value={producto} />
              <input type="hidden" name="lote_gasto_id" value={lote} />
              <Campo etiqueta="¿Cuál producto?" ayuda={delTipo.length === 0 ? "No hay productos de este tipo en el catálogo. Puedes enviar la novedad igual." : "Opcional."}>
                {(id) => (
                  <Selector
                    id={id}
                    valor={producto}
                    onCambio={(v) => {
                      setProducto(String(v));
                      setLote("");
                    }}
                    titulo="¿Cuál producto?"
                    placeholder="Elegir producto"
                    permitirVacio
                    opciones={delTipo.map((p) => ({ valor: p.id, etiqueta: p.nombre }))}
                  />
                )}
              </Campo>
              {producto ? (
                <Campo etiqueta="¿Qué lote?" ayuda={lotesDelProducto.length === 0 ? "Este producto no tiene lotes registrados." : "Opcional. Se elige de los que registró quien compró."}>
                  {(id) => (
                    <Selector
                      id={id}
                      valor={lote}
                      onCambio={(v) => setLote(String(v))}
                      titulo="¿Qué lote?"
                      placeholder={lotesDelProducto.length === 0 ? "No hay lotes" : "Elegir lote"}
                      permitirVacio
                      opciones={lotesDelProducto.map((l) => ({ valor: l.gasto_id, etiqueta: l.lote, detalle: l.vencimiento ? `vence ${l.vencimiento}` : undefined }))}
                    />
                  )}
                </Campo>
              ) : null}
              <Campo etiqueta="¿Por dónde se aplicó?" ayuda="Opcional.">
                {(id) => <SelectorTarjetas<ViaAplicacion> id={id} nombre="via" valor={via} onCambio={(v) => setVia(v)} titulo="¿Por dónde se aplicó?" permitirVacio opciones={VIAS.map((v) => ({ valor: v, etiqueta: ETIQUETA_VIA[v], escena: ESCENA_VIA[v] }))} />}
              </Campo>
            </>
          ) : null}
        </>
      ) : null}

      {tipo === "prueba" ? (
        <>
          <Campo etiqueta="¿Qué prueba fue?">
            {(id) => <SelectorTarjetas<TipoPrueba> id={id} nombre="prueba" valor={prueba} onCambio={(v) => v && setPrueba(v)} titulo="¿Qué prueba fue?" opciones={TIPOS_PRUEBA.map((t) => ({ valor: t, etiqueta: ETIQUETA_PRUEBA_CORTA[t], escena: ESC.laboratorio }))} />}
          </Campo>
          <Campo etiqueta="¿Cómo salió?">
            {(id) => <SelectorTarjetas<ResultadoPrueba> id={id} nombre="resultado_prueba" valor={resultado} onCambio={(v) => v && setResultado(v)} titulo="¿Cómo salió?" opciones={RESULTADOS_PRUEBA.map((x) => ({ valor: x, etiqueta: ETIQUETA_RESULTADO_PRUEBA[x], escena: ESCENA_RESULTADO_PRUEBA[x] }))} />}
          </Campo>
        </>
      ) : null}

      {tipo === "coprologico" ? (
        <>
          <Campo etiqueta="¿Cómo se tomó la muestra?">
            {(id) => (
              <SelectorTarjetas<TipoMuestra>
                id={id}
                nombre="tipo_muestra"
                valor={muestra}
                onCambio={(v) => v && setMuestra(v)}
                titulo="¿Cómo se tomó la muestra?"
                opciones={TIPOS_MUESTRA.map((t) => ({ valor: t, etiqueta: ETIQUETA_MUESTRA[t], detalle: DETALLE_MUESTRA[t], escena: ESCENA_MUESTRA[t] }))}
              />
            )}
          </Campo>
          {muestra ? <Aviso tipo={muestra === "contaminada" ? "atencion" : "info"}>{AYUDA_MUESTRA[muestra]}</Aviso> : null}
        </>
      ) : null}

      {tipo === "famacha" ? (
        <div className="space-y-2">
          <input type="hidden" name="puntaje" value={puntaje ?? ""} />
          <p className="text-sm font-semibold" id="novedad-famacha">Color de la mucosa del ojo</p>
          <div role="radiogroup" aria-labelledby="novedad-famacha" className="grid grid-cols-1 gap-2">
            {PUNTAJES_FAMACHA.map((n) => {
              const f = FAMACHA[n];
              const activo = puntaje === n;
              return (
                <button key={n} type="button" role="radio" aria-checked={activo} onClick={() => setPuntaje(n)} className={`flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 py-2 text-left ring-1 transition ${activo ? "bg-musgo/10 ring-2 ring-musgo" : "bg-papel ring-arena hover:bg-lana"}`}>
                  <span className={`grid size-9 shrink-0 place-items-center rounded-full font-display text-lg font-semibold ${COLOR_PUNTO[f.tono]}`}>{n}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{f.color}</span>
                    <span className="block text-sm text-humo">{f.texto}</span>
                  </span>
                  <OjoFamacha puntaje={n} className="w-14 shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {tipo ? (
        <Campo etiqueta="Observaciones" ayuda="Opcional. Es lo único que se escribe en una novedad.">
          {(id) => <textarea id={id} name="observaciones" rows={3} maxLength={300} className={`${CLASE_INPUT} py-3`} />}
        </Campo>
      ) : null}

      {!animalId ? <Aviso tipo="atencion">Elige el animal para enviar.</Aviso> : falta && tipo ? <Aviso tipo="atencion">{falta}</Aviso> : null}
      {estado?.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      <div className="space-y-2">
        <Boton type="submit" pendiente={pendiente} cargando="Enviando…" disabled={falta !== null || !animalId}>
          Enviar la novedad
        </Boton>
        <Link href={animalFijo ? `/hato/${animalFijo}` : "/novedades"} className={clasesBoton("fantasma")}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
