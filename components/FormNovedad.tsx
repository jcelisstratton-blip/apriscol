"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { Boton, clasesBoton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { Selector } from "@/components/Selector";
import { SelectorAnimal } from "@/components/SelectorAnimal";
import { SelectorTarjetas, type OpcionTarjeta } from "@/components/SelectorTarjetas";
import { crearNovedad } from "@/app/(app)/novedades/actions";
import { ESCENA_EVENTO } from "@/lib/escenas-sanidad";
import { ESCENA_CAMPO, ESCENA_GENERICA } from "@/lib/escenas-sanidad-campos";
import { ESCENA_RESULTADO_PRUEBA, ESCENA_TIPO_NOVEDAD } from "@/lib/escenas-listas-sanidad";
import { ESC } from "@/lib/escenas";
import { ESCENA_GRUPO_GASTO } from "@/lib/escenas-costos";
import { DETALLE_GRUPO, ETIQUETA_GRUPO, GRUPOS, type GrupoGasto } from "@/lib/costos";
import { DETALLE_TIPO_NOVEDAD, ETIQUETA_TIPO_NOVEDAD, faltaEnNovedad, type TipoNovedad } from "@/lib/novedades";
import { CATEGORIAS, REGLAS, type OpcionCampo } from "@/lib/sanidad-campos";
import { ETIQUETA_EVENTO, ETIQUETA_PRUEBA_CORTA, ETIQUETA_RESULTADO_PRUEBA, RESULTADOS_PRUEBA, TIPOS_EVENTO, TIPOS_PRUEBA } from "@/lib/sanidad";
import type { Novedad, ResultadoPrueba, TipoEvento, TipoPrueba } from "@/lib/tipos";

type AnimalElegido = { id: string; numero_arete: string; nombre: string | null };

/** Un producto del catálogo de Compras que se puede pedir comprar. */
export type ProductoCompra = { id: string; nombre: string; grupo: GrupoGasto };

const aTarjetas = (grupo: string, opciones: OpcionCampo[]): OpcionTarjeta<string>[] => opciones.map((o) => ({ valor: o.valor, etiqueta: o.etiqueta, detalle: o.detalle, escena: ESCENA_CAMPO[`${grupo}:${o.valor}`] ?? ESCENA_GENERICA }));

/**
 * Crear una novedad. **Todo se elige; lo único que se escribe son las observaciones.** Dos tarjetas según el perfil: «Comprar» (llega al administrador; se elige el grupo y el
 * producto del catálogo de Compras, o «Otro producto» y se explica en las observaciones, con la cantidad) y «Aplicar dosis» (llega al veterinario; sobre un animal, con las mismas
 * tarjetas de «Registrar una aplicación»). No es un registro oficial: quien la atiende completa lo demás al registrarlo de verdad.
 */
export function FormNovedad({ animalId: animalFijo, animalTexto, fincaId, solicitud, tipos, productos }: { animalId?: string; animalTexto?: string; fincaId: string; solicitud: string; /** Qué puede crear este perfil. */ tipos: TipoNovedad[]; /** El catálogo de Compras (para «Comprar»). */ productos: ProductoCompra[] }) {
  const [estado, enviar, pendiente] = useActionState(crearNovedad, undefined);
  const [, iniciar] = useTransition();
  const [elegido, setElegido] = useState<AnimalElegido | null>(null);
  const [tipo, setTipo] = useState<TipoNovedad | "">(tipos.length === 1 ? tipos[0] : "");
  const [grupo, setGrupo] = useState<GrupoGasto | "">("");
  const [productoId, setProductoId] = useState("");
  const [tipoEvento, setTipoEvento] = useState<TipoEvento | "">("");
  const [categoria, setCategoria] = useState("");
  const [prueba, setPrueba] = useState<TipoPrueba | "">("");
  const [resultado, setResultado] = useState<ResultadoPrueba | "">("");

  const esCompra = tipo === "compra";
  const animalId = esCompra ? "" : (animalFijo ?? elegido?.id ?? "");
  const productosDelGrupo = productos.filter((p) => p.grupo === grupo);
  const r = tipoEvento ? REGLAS[tipoEvento] : null;
  const falta = faltaEnNovedad({ tipo: tipo || undefined, grupo_compra: grupo || null, tipo_evento: tipoEvento || null, prueba: prueba || null, resultado_prueba: resultado || null } as Partial<Novedad>);

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
      <input type="hidden" name="grupo_compra" value={esCompra ? grupo : ""} />
      <input type="hidden" name="compra_producto_id" value={esCompra ? productoId : ""} />
      <Aviso tipo="info">Esto es una novedad: un aviso, no un registro. Quien la atiende (el administrador si es de comprar, el veterinario si es de aplicar una dosis) la confirma. Solo eliges opciones; lo único que puedes escribir son las observaciones.</Aviso>

      <Campo etiqueta="¿Qué quieres avisar?">
        {(id) => (
          <SelectorTarjetas<TipoNovedad>
            id={id}
            valor={tipo}
            onCambio={(v) => v && setTipo(v)}
            titulo="¿Qué quieres avisar?"
            opciones={tipos.map((t) => ({ valor: t, etiqueta: ETIQUETA_TIPO_NOVEDAD[t], detalle: DETALLE_TIPO_NOVEDAD[t], escena: ESCENA_TIPO_NOVEDAD[t] }))}
          />
        )}
      </Campo>

      {esCompra ? (
        <>
          <Campo etiqueta="¿De qué grupo es lo que hace falta?">
            {(id) => (
              <SelectorTarjetas<GrupoGasto>
                id={id}
                valor={grupo}
                onCambio={(v) => {
                  if (v) {
                    setGrupo(v);
                    setProductoId("");
                  }
                }}
                titulo="¿De qué grupo es?"
                opciones={GRUPOS.map((g) => ({ valor: g, etiqueta: ETIQUETA_GRUPO[g], detalle: DETALLE_GRUPO[g], escena: ESCENA_GRUPO_GASTO[g] }))}
              />
            )}
          </Campo>
          {grupo ? (
            <Campo etiqueta="¿Qué producto?" ayuda="Si no está en la lista, deja «Otro producto» y cuéntalo en las observaciones, con la cantidad.">
              {(id) => <Selector id={id} valor={productoId} onCambio={(v) => setProductoId(v)} titulo="¿Qué producto?" placeholder="Otro producto" permitirVacio opciones={productosDelGrupo.map((p) => ({ valor: p.id, etiqueta: p.nombre }))} />}
            </Campo>
          ) : null}
        </>
      ) : null}

      {tipo === "aplicacion" ? (
        <>
          {!animalFijo ? (
            <Campo etiqueta="Animal" ayuda="¿A cuál animal se le aplica?">
              {(id) => <SelectorAnimal id={id} nombre="animal_elegido" fincaId={fincaId} titulo="¿De qué animal es?" valor={elegido} onCambio={setElegido} vacio="Elegir animal" soloActivos />}
            </Campo>
          ) : (
            <p className="text-sm text-humo">Sobre {animalTexto}.</p>
          )}
          <Campo etiqueta="¿Qué se solicita?">
            {(id) => (
              <SelectorTarjetas<TipoEvento>
                id={id}
                nombre="tipo_evento"
                valor={tipoEvento}
                onCambio={(v) => {
                  if (v) {
                    setTipoEvento(v);
                    setCategoria("");
                  }
                }}
                titulo="¿Qué se solicita?"
                opciones={TIPOS_EVENTO.map((t) => ({ valor: t, etiqueta: ETIQUETA_EVENTO[t], escena: ESCENA_EVENTO[t] }))}
              />
            )}
          </Campo>
          {/* Elegidos los dos primeros, solo falta la enfermedad (o el parásito, la solución o el procedimiento): nada más. */}
          {tipoEvento && CATEGORIAS[tipoEvento] ? (
            <Campo etiqueta={r?.tituloCategoria ?? "¿Cuál?"}>
              {(id) => <SelectorTarjetas id={id} nombre="categoria" valor={categoria} onCambio={setCategoria} titulo={r?.tituloCategoria ?? "¿Cuál?"} permitirVacio etiquetaVacio="No sé" opciones={aTarjetas(tipoEvento, CATEGORIAS[tipoEvento] ?? [])} />}
            </Campo>
          ) : null}
        </>
      ) : null}

      {tipo === "prueba" ? (
        <>
          <Campo etiqueta="¿Qué prueba es?">
            {(id) => <SelectorTarjetas<TipoPrueba> id={id} nombre="prueba" valor={prueba} onCambio={(v) => v && setPrueba(v)} titulo="¿Qué prueba es?" opciones={TIPOS_PRUEBA.map((t) => ({ valor: t, etiqueta: ETIQUETA_PRUEBA_CORTA[t], escena: ESC.laboratorio }))} />}
          </Campo>
          <Campo etiqueta="¿Cómo salió?">
            {(id) => <SelectorTarjetas<ResultadoPrueba> id={id} nombre="resultado_prueba" valor={resultado} onCambio={(v) => v && setResultado(v)} titulo="¿Cómo salió?" opciones={RESULTADOS_PRUEBA.map((x) => ({ valor: x, etiqueta: ETIQUETA_RESULTADO_PRUEBA[x], escena: ESCENA_RESULTADO_PRUEBA[x] }))} />}
          </Campo>
        </>
      ) : null}

      {tipo ? (
        <Campo etiqueta="Observaciones" ayuda={esCompra ? "La cantidad y lo que haga falta saber. Es lo único que se escribe." : "Opcional. Es lo único que se escribe en una novedad."}>
          {(id) => <textarea id={id} name="observaciones" rows={3} maxLength={300} className={`${CLASE_INPUT} py-3`} />}
        </Campo>
      ) : null}

      {!esCompra && tipo && !animalId ? <Aviso tipo="atencion">Elige el animal para enviar.</Aviso> : falta && tipo ? <Aviso tipo="atencion">{falta}</Aviso> : null}
      {estado?.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      <div className="space-y-2">
        <Boton type="submit" pendiente={pendiente} cargando="Enviando…" disabled={falta !== null || (!esCompra && !animalId)}>
          Enviar la novedad
        </Boton>
        <Link href={animalFijo ? `/hato/${animalFijo}` : "/novedades"} className={clasesBoton("fantasma")}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
