"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { Boton, clasesBoton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { Selector } from "@/components/Selector";
import { SelectorTarjetas } from "@/components/SelectorTarjetas";
import { SelectorAnimales, type AnimalElegido } from "@/components/SelectorAnimales";
import { editarPrograma, programarSanidad } from "@/app/(app)/sanidad/actions";
import { sumarDias } from "@/lib/fechas";
import { ESCENA_EVENTO } from "@/lib/escenas-sanidad";
import { ESCENA_VIA } from "@/lib/escenas-forms-a-sanidad";
import { ETIQUETA_EVENTO, ETIQUETA_PRODUCTO, ETIQUETA_VIA, EVENTO_CON_PRODUCTO, EVENTO_DE_PRODUCTO, TIPOS_PROGRAMABLES, UNIDADES_DOSIS, VIAS, textoRetiro } from "@/lib/sanidad";
import type { Especie, ProductoVeterinario, TipoEvento, ViaAplicacion } from "@/lib/tipos";

/** Los datos de una programación, para corregirla o para proponer valores (por ejemplo, el tipo desde la ficha de un animal). */
export type DatosPrograma = {
  id?: string;
  tipo: TipoEvento;
  fecha_programada: string;
  producto_id: string | null;
  producto_nombre: string | null;
  dosis: number | null;
  unidad_dosis: string | null;
  via: ViaAplicacion | null;
  retiro_leche_dias: number;
  retiro_carne_dias: number;
  observaciones: string | null;
};

const NUEVO_PRODUCTO = "otro";
const coma = (n: number | null) => (n === null ? "" : String(n).replace(".", ","));
const entero = (v: string) => (/^\d{1,3}$/.test(v.trim()) ? Number(v) : 0);

/**
 * Programar una vacuna, desparasitación, tratamiento o podología: qué se va a aplicar, para cuándo y a qué animales (los que aplican).
 * Cuando llega el día se aplica desde Hato → Sanidad y cada animal queda con su registro.
 */
export function FormPrograma({
  fincaId,
  especies,
  productos,
  hoy,
  animalesIniciales = [],
  animalDe,
  datos,
  solicitud,
}: {
  fincaId: string;
  especies: Especie[];
  productos: ProductoVeterinario[];
  hoy: string;
  animalesIniciales?: AnimalElegido[];
  /** Si se llegó desde la ficha de un animal: al guardar se vuelve a ella. */
  animalDe?: string;
  datos?: DatosPrograma;
  solicitud?: string;
}) {
  const editando = Boolean(datos?.id);
  const [estado, enviar, pendiente] = useActionState(editando ? editarPrograma : programarSanidad, undefined);
  const [, iniciar] = useTransition();

  const [tipo, setTipo] = useState<TipoEvento>(datos?.tipo ?? "vacunacion");
  const [productoId, setProductoId] = useState<string>(datos?.producto_id ?? (datos?.producto_nombre ? NUEVO_PRODUCTO : ""));
  const [nombreProducto, setNombreProducto] = useState(datos?.producto_id ? "" : (datos?.producto_nombre ?? ""));
  const [fecha, setFecha] = useState(datos?.fecha_programada ?? hoy);
  const [retiroLeche, setRetiroLeche] = useState(String(datos?.retiro_leche_dias ?? 0));
  const [retiroCarne, setRetiroCarne] = useState(String(datos?.retiro_carne_dias ?? 0));
  const [unidad, setUnidad] = useState(datos?.unidad_dosis ?? "");
  const [via, setVia] = useState<ViaAplicacion | "">(datos?.via ?? "");
  const [animales, setAnimales] = useState<AnimalElegido[]>(animalesIniciales);

  const conProducto = EVENTO_CON_PRODUCTO.includes(tipo);
  const frasesRetiro = textoRetiro(fecha || hoy, entero(retiroLeche), entero(retiroCarne));
  const faltanAnimales = animales.length === 0;
  const fechaValida = /^\d{4}-\d{2}-\d{2}$/.test(fecha);
  const pasada = fechaValida && fecha < hoy;

  const elegirProducto = (v: string) => {
    setProductoId(v);
    const p = productos.find((x) => x.id === v);
    if (!p) return;
    // El catálogo propone lo habitual del producto; todo se puede cambiar en esta programación.
    setTipo(EVENTO_DE_PRODUCTO[p.tipo]);
    setRetiroLeche(String(p.retiro_leche_dias));
    setRetiroCarne(String(p.retiro_carne_dias));
    if (p.unidad_dosis) setUnidad(p.unidad_dosis);
  };

  // Se envía con onSubmit (no con `action`): si hay un error, lo que la persona escribió no se borra.
  const alEnviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    iniciar(() => enviar(formData));
  };

  const volver = animalDe ? `/hato/${animalDe}#sanidad` : "/hato?vista=sanidad";

  return (
    <form onSubmit={alEnviar} className="space-y-5">
      {datos?.id ? <input type="hidden" name="programa_id" value={datos.id} /> : <input type="hidden" name="client_request_id" value={solicitud ?? ""} />}
      {animalDe ? <input type="hidden" name="animal" value={animalDe} /> : null}

      <Campo etiqueta="¿Qué se va a aplicar?">
        {(id) => (
          <SelectorTarjetas
            id={id}
            nombre="tipo"
            valor={tipo}
            onCambio={(v) => v && setTipo(v)}
            titulo="¿Qué se va a aplicar?"
            opciones={TIPOS_PROGRAMABLES.map((t) => ({ valor: t, etiqueta: ETIQUETA_EVENTO[t], escena: ESCENA_EVENTO[t] }))}
          />
        )}
      </Campo>

      <Campo etiqueta={conProducto ? "Producto" : "Producto (opcional)"} ayuda={productos.length === 0 ? "Aún no tienes productos guardados: escribe el nombre. Puedes guardarlos en Sanidad → Productos." : undefined}>
        {(id) => (
          <Selector
            id={id}
            nombre="producto_id"
            valor={productoId}
            onCambio={(v) => elegirProducto(String(v))}
            titulo="¿Qué producto?"
            placeholder={conProducto ? "Elegir producto" : "Sin producto"}
            permitirVacio={!conProducto}
            opciones={[
              ...productos.map((p) => ({ valor: p.id, etiqueta: p.nombre, detalle: ETIQUETA_PRODUCTO[p.tipo] })),
              { valor: NUEVO_PRODUCTO, etiqueta: "Otro (escribir el nombre)" },
            ]}
          />
        )}
      </Campo>
      {productoId === NUEVO_PRODUCTO ? (
        <Campo etiqueta="Nombre del producto">
          {(id) => <input id={id} name="producto_nombre" value={nombreProducto} onChange={(e) => setNombreProducto(e.target.value)} required maxLength={120} autoComplete="off" className={CLASE_INPUT} placeholder="Ej. Clostridial" />}
        </Campo>
      ) : null}

      <Campo etiqueta="Para cuándo" ayuda="El día en que se va a aplicar. Ese día te aparece en Hato → Sanidad y en Hoy.">
        {(id) => <input id={id} name="fecha_programada" type="date" value={fecha} min={editando ? undefined : hoy} max={sumarDias(hoy, 730)} onChange={(e) => setFecha(e.target.value)} required className={CLASE_INPUT} />}
      </Campo>
      {!editando && fecha === hoy ? (
        <Aviso tipo="info">
          ¿Ya la aplicaste o la vas a aplicar ahora?{" "}
          <Link href={animalDe ? `/hato/sanidad/nuevo?animal=${animalDe}` : "/hato/sanidad/nuevo"} className="font-semibold text-musgo underline underline-offset-4">Regístrala directamente</Link>.
        </Aviso>
      ) : null}
      {pasada ? <Aviso tipo="atencion">Esta fecha ya pasó: la programación quedará vencida hasta que se aplique.</Aviso> : null}

      <Campo etiqueta="Animales" ayuda="Los animales a los que aplica. Puedes sumar un grupo entero (hembras, en lactancia, gestantes, crías, sin podología…) o buscar de a uno.">
        {() => <SelectorAnimales fincaId={fincaId} especies={especies} valor={animales} onCambio={setAnimales} />}
      </Campo>

      <div className="space-y-3 rounded-3xl border border-arena p-4">
        <p className="font-semibold">Retiro</p>
        <p className="-mt-2 text-[0.8125rem] text-humo">Días que no sirve la leche ni la carne después de aplicarlo. Déjalo en 0 si no tiene.</p>
        <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
          <Campo etiqueta="Leche (días)">
            {(id) => <input id={id} name="retiro_leche_dias" value={retiroLeche} onChange={(e) => setRetiroLeche(e.target.value)} inputMode="numeric" pattern="[0-9]*" maxLength={3} autoComplete="off" className={CLASE_INPUT} />}
          </Campo>
          <Campo etiqueta="Carne (días)">
            {(id) => <input id={id} name="retiro_carne_dias" value={retiroCarne} onChange={(e) => setRetiroCarne(e.target.value)} inputMode="numeric" pattern="[0-9]*" maxLength={3} autoComplete="off" className={CLASE_INPUT} />}
          </Campo>
        </div>
        {frasesRetiro.length > 0 ? (
          <Aviso tipo="atencion">
            {frasesRetiro.map((f) => (
              <span key={f} className="block">{`Si se aplica ese día, ${f.charAt(0).toLowerCase()}${f.slice(1)}`}</span>
            ))}
          </Aviso>
        ) : null}
      </div>

      <details open={Boolean(datos?.dosis || datos?.via)} className="group rounded-3xl border border-arena p-4">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between font-semibold">
          <span className="min-w-0">Más detalles (dosis y vía)</span>
          <span className="shrink-0 pl-3 text-sm font-medium text-humo group-open:hidden">Mostrar</span>
          <span className="hidden shrink-0 pl-3 text-sm font-medium text-humo group-open:inline">Ocultar</span>
        </summary>
        <div className="mt-4 space-y-5">
          <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
            <Campo etiqueta="Dosis">
              {(id) => <input id={id} name="dosis" defaultValue={coma(datos?.dosis ?? null)} inputMode="decimal" autoComplete="off" className={CLASE_INPUT} placeholder="Ej. 2,5" />}
            </Campo>
            <Campo etiqueta="Unidad">
              {(id) => (
                <Selector id={id} nombre="unidad_dosis" valor={unidad} onCambio={(v) => setUnidad(String(v))} titulo="Unidad de la dosis" placeholder="Sin especificar" permitirVacio opciones={UNIDADES_DOSIS.map((u) => ({ valor: u, etiqueta: u }))} />
              )}
            </Campo>
          </div>
          <Campo etiqueta="Vía">
            {(id) => (
              <SelectorTarjetas id={id} nombre="via" valor={via} onCambio={(v) => setVia(v as ViaAplicacion | "")} titulo="¿Por dónde se aplica?" permitirVacio opciones={VIAS.map((v) => ({ valor: v, etiqueta: ETIQUETA_VIA[v], escena: ESCENA_VIA[v] }))} />
            )}
          </Campo>
        </div>
      </details>

      <Campo etiqueta="Observaciones" ayuda="Opcional.">
        {(id) => <textarea id={id} name="observaciones" defaultValue={datos?.observaciones ?? ""} rows={3} maxLength={1000} className={`${CLASE_INPUT} py-3`} />}
      </Campo>

      {faltanAnimales ? <Aviso tipo="atencion">Aún no elegiste animales. Elige al menos uno para guardar.</Aviso> : null}
      {estado?.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      <div className="space-y-2">
        <Boton type="submit" pendiente={pendiente} cargando="Guardando…" disabled={faltanAnimales}>
          {editando ? "Guardar cambios" : animales.length > 1 ? `Programar para ${animales.length} animales` : "Programar"}
        </Boton>
        <Link href={volver} className={clasesBoton("fantasma")}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
