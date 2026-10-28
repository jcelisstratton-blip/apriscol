"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { Boton, clasesBoton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { SelectorAnimal } from "@/components/SelectorAnimal";
import { SelectorTarjetas, type OpcionTarjeta } from "@/components/SelectorTarjetas";
import { crearNovedad } from "@/app/(app)/novedades/actions";
import { ESCENA_EVENTO } from "@/lib/escenas-sanidad";
import { ESCENA_CAMPO, ESCENA_GENERICA } from "@/lib/escenas-sanidad-campos";
import { ESCENA_RESULTADO_PRUEBA, ESCENA_TIPO_NOVEDAD } from "@/lib/escenas-listas-sanidad";
import { ESC } from "@/lib/escenas";
import { DETALLE_TIPO_NOVEDAD, ETIQUETA_TIPO_NOVEDAD, TIPOS_NOVEDAD_NUEVA, faltaEnNovedad, type TipoNovedad } from "@/lib/novedades";
import { CATEGORIAS, REGLAS, type OpcionCampo } from "@/lib/sanidad-campos";
import { ETIQUETA_EVENTO, ETIQUETA_PRUEBA_CORTA, ETIQUETA_RESULTADO_PRUEBA, RESULTADOS_PRUEBA, TIPOS_EVENTO, TIPOS_PRUEBA } from "@/lib/sanidad";
import type { Novedad, ResultadoPrueba, TipoEvento, TipoPrueba } from "@/lib/tipos";

type AnimalElegido = { id: string; numero_arete: string; nombre: string | null };

const aTarjetas = (grupo: string, opciones: OpcionCampo[]): OpcionTarjeta<string>[] => opciones.map((o) => ({ valor: o.valor, etiqueta: o.etiqueta, detalle: o.detalle, escena: ESCENA_CAMPO[`${grupo}:${o.valor}`] ?? ESCENA_GENERICA }));

/**
 * Crear una novedad sobre un animal. **Todo se elige; lo único que se escribe son las observaciones.** Primero sobre qué es (una aplicación o una prueba diagnóstica) y, para una
 * aplicación, qué se solicita (las mismas tarjetas de «Registrar una aplicación»); elegidas esas dos aparece solo lo que sigue —contra qué enfermedad, parásito o procedimiento—
 * y las observaciones. No es un registro oficial: lo revisan el propietario, el administrador y el veterinario, que completan lo demás al registrarlo de verdad.
 */
export function FormNovedad({ animalId: animalFijo, animalTexto, fincaId, solicitud }: { animalId?: string; animalTexto?: string; fincaId: string; solicitud: string }) {
  const [estado, enviar, pendiente] = useActionState(crearNovedad, undefined);
  const [, iniciar] = useTransition();
  const [elegido, setElegido] = useState<AnimalElegido | null>(null);
  const [tipo, setTipo] = useState<TipoNovedad | "">("");
  const [tipoEvento, setTipoEvento] = useState<TipoEvento | "">("");
  const [categoria, setCategoria] = useState("");
  const [prueba, setPrueba] = useState<TipoPrueba | "">("");
  const [resultado, setResultado] = useState<ResultadoPrueba | "">("");

  const animalId = animalFijo ?? elegido?.id ?? "";
  const r = tipoEvento ? REGLAS[tipoEvento] : null;
  const falta = faltaEnNovedad({ tipo: tipo || undefined, tipo_evento: tipoEvento || null, prueba: prueba || null, resultado_prueba: resultado || null } as Partial<Novedad>);

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
      <Aviso tipo="info">Esto es una novedad: un aviso para el administrador y el veterinario. No queda como registro de Sanidad hasta que ellos lo confirmen. Solo eliges opciones; lo único que puedes escribir son las observaciones.</Aviso>

      {!animalFijo ? (
        <Campo etiqueta="Animal" ayuda="¿De cuál animal es la novedad?">
          {(id) => <SelectorAnimal id={id} nombre="animal_elegido" fincaId={fincaId} titulo="¿De qué animal es?" valor={elegido} onCambio={setElegido} vacio="Elegir animal" soloActivos />}
        </Campo>
      ) : (
        <p className="text-sm text-humo">Sobre {animalTexto}.</p>
      )}

      <Campo etiqueta="¿Sobre qué es la novedad?">
        {(id) => (
          <SelectorTarjetas<TipoNovedad>
            id={id}
            valor={tipo}
            onCambio={(v) => v && setTipo(v)}
            titulo="¿Sobre qué es la novedad?"
            opciones={TIPOS_NOVEDAD_NUEVA.map((t) => ({ valor: t, etiqueta: ETIQUETA_TIPO_NOVEDAD[t], detalle: DETALLE_TIPO_NOVEDAD[t], escena: ESCENA_TIPO_NOVEDAD[t] }))}
          />
        )}
      </Campo>

      {tipo === "aplicacion" ? (
        <>
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
