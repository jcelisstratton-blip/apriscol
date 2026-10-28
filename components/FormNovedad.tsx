"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { Boton, clasesBoton } from "@/components/Boton";
import { Campo } from "@/components/Campo";
import { Chip, FilaDesplazable } from "@/components/FilaDesplazable";
import { OjoFamacha } from "@/components/OjoFamacha";
import { Selector } from "@/components/Selector";
import { SelectorTarjetas } from "@/components/SelectorTarjetas";
import { crearNovedad } from "@/app/(app)/novedades/actions";
import { AYUDA_MUESTRA, DETALLE_MUESTRA, ETIQUETA_MUESTRA, TIPOS_MUESTRA, type TipoMuestra } from "@/lib/coprologico";
import { ESCENA_VIA } from "@/lib/escenas-forms-a-sanidad";
import { ESCENA_MUESTRA, ESCENA_PRODUCTO, ESCENA_RESULTADO_PRUEBA, ESCENA_TIPO_NOVEDAD } from "@/lib/escenas-listas-sanidad";
import { ESC } from "@/lib/escenas";
import { FAMACHA, PUNTAJES_FAMACHA } from "@/lib/famacha";
import { CUANDO_NOVEDAD, DETALLE_TIPO_NOVEDAD, ETIQUETA_TIPO_NOVEDAD, TIPOS_NOVEDAD, faltaEnNovedad, type CuandoNovedad, type TipoNovedad } from "@/lib/novedades";
import { ETIQUETA_PRODUCTO, ETIQUETA_PRUEBA_CORTA, ETIQUETA_RESULTADO_PRUEBA, ETIQUETA_VIA, RESULTADOS_PRUEBA, TIPOS_PRODUCTO, TIPOS_PRUEBA, VIAS } from "@/lib/sanidad";
import type { Novedad, ResultadoPrueba, TipoProducto, TipoPrueba, ViaAplicacion } from "@/lib/tipos";

export type ProductoNovedad = { id: string; nombre: string; tipo: TipoProducto };
export type LoteNovedad = { gasto_id: string; producto_id: string; lote: string; vencimiento: string | null; comprado: string };

const COLOR_PUNTO = { ok: "bg-ok text-white", neutro: "bg-arena text-tinta", aviso: "bg-ambar text-white", alerta: "bg-rojo text-white" } as const;

/**
 * Enviar una novedad sobre un animal. **Todo se elige, nada se escribe**: primero qué quieres contar (los mismos botones de la ficha en Sanidad) y luego las
 * características de cada uno. No es un registro oficial: lo revisan el propietario, el administrador y el veterinario.
 */
export function FormNovedad({ animalId, animalTexto, productos, lotes, solicitud }: { animalId: string; animalTexto: string; productos: ProductoNovedad[]; lotes: LoteNovedad[]; solicitud: string }) {
  const [estado, enviar, pendiente] = useActionState(crearNovedad, undefined);
  const [, iniciar] = useTransition();
  const [tipo, setTipo] = useState<TipoNovedad | "">("");
  const [cuando, setCuando] = useState<CuandoNovedad>("hoy");
  const [categoria, setCategoria] = useState<TipoProducto | "">("");
  const [producto, setProducto] = useState("");
  const [via, setVia] = useState<ViaAplicacion | "">("");
  const [lote, setLote] = useState("");
  const [prueba, setPrueba] = useState<TipoPrueba | "">("");
  const [resultado, setResultado] = useState<ResultadoPrueba | "">("");
  const [muestra, setMuestra] = useState<TipoMuestra | "">("");
  const [puntaje, setPuntaje] = useState<number | null>(null);

  const delTipo = productos.filter((p) => p.tipo === categoria);
  const lotesDelProducto = lotes.filter((l) => l.producto_id === producto);
  const falta = faltaEnNovedad({
    tipo: tipo || undefined,
    categoria_producto: categoria || null,
    prueba: prueba || null,
    resultado_prueba: resultado || null,
    tipo_muestra: muestra || null,
    puntaje,
  } as Partial<Novedad>);

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
      <Aviso tipo="info">Esto es un aviso: lo ven el administrador y el veterinario. No queda como registro de Sanidad hasta que ellos lo confirmen. Solo eliges opciones, no escribes datos.</Aviso>

      <Campo etiqueta="¿Qué quieres contar?" ayuda={`Sobre ${animalTexto}.`}>
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
          <input type="hidden" name="categoria_producto" value={categoria} />
          <input type="hidden" name="producto_id" value={producto} />
          <input type="hidden" name="via" value={via} />
          <input type="hidden" name="lote_gasto_id" value={lote} />
          <Campo etiqueta="¿Qué se aplicó?">
            {(id) => (
              <SelectorTarjetas<TipoProducto>
                id={id}
                valor={categoria}
                onCambio={(v) => {
                  if (v) {
                    setCategoria(v);
                    setProducto("");
                    setLote("");
                  }
                }}
                titulo="¿Qué se aplicó?"
                opciones={TIPOS_PRODUCTO.map((t) => ({ valor: t, etiqueta: ETIQUETA_PRODUCTO[t], escena: ESCENA_PRODUCTO[t] }))}
              />
            )}
          </Campo>
          {categoria ? (
            <Campo etiqueta="¿Cuál producto?" ayuda={delTipo.length === 0 ? "Todavía no hay productos de este tipo en el catálogo. Puedes enviar la novedad igual." : "Opcional."}>
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
          ) : null}
          {producto ? (
            <Campo etiqueta="¿Qué lote?" ayuda={lotesDelProducto.length === 0 ? "Este producto no tiene lotes registrados." : "Opcional. Está en el frasco; se elige de los que registró quien compró."}>
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
            {(id) => <SelectorTarjetas<ViaAplicacion> id={id} valor={via} onCambio={(v) => setVia(v)} titulo="¿Por dónde se aplicó?" permitirVacio opciones={VIAS.map((v) => ({ valor: v, etiqueta: ETIQUETA_VIA[v], escena: ESCENA_VIA[v] }))} />}
          </Campo>
        </>
      ) : null}

      {tipo === "prueba" ? (
        <>
          <input type="hidden" name="prueba" value={prueba} />
          <input type="hidden" name="resultado_prueba" value={resultado} />
          <Campo etiqueta="¿Qué prueba fue?">
            {(id) => <SelectorTarjetas<TipoPrueba> id={id} valor={prueba} onCambio={(v) => v && setPrueba(v)} titulo="¿Qué prueba fue?" opciones={TIPOS_PRUEBA.map((t) => ({ valor: t, etiqueta: ETIQUETA_PRUEBA_CORTA[t], escena: ESC.laboratorio }))} />}
          </Campo>
          <Campo etiqueta="¿Cómo salió?">
            {(id) => <SelectorTarjetas<ResultadoPrueba> id={id} valor={resultado} onCambio={(v) => v && setResultado(v)} titulo="¿Cómo salió?" opciones={RESULTADOS_PRUEBA.map((r) => ({ valor: r, etiqueta: ETIQUETA_RESULTADO_PRUEBA[r], escena: ESCENA_RESULTADO_PRUEBA[r] }))} />}
          </Campo>
        </>
      ) : null}

      {tipo === "coprologico" ? (
        <>
          <input type="hidden" name="tipo_muestra" value={muestra} />
          <Campo etiqueta="¿Cómo se tomó la muestra?">
            {(id) => (
              <SelectorTarjetas<TipoMuestra>
                id={id}
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

      {falta && tipo ? <Aviso tipo="atencion">{falta}</Aviso> : null}
      {estado?.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      <div className="space-y-2">
        <Boton type="submit" pendiente={pendiente} cargando="Enviando…" disabled={falta !== null}>
          Enviar la novedad
        </Boton>
        <Link href={`/hato/${animalId}`} className={clasesBoton("fantasma")}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
