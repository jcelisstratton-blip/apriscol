"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { Boton, clasesBoton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { Chip, FilaDesplazable } from "@/components/FilaDesplazable";
import { Selector } from "@/components/Selector";
import { SelectorAnimales, type AnimalElegido } from "@/components/SelectorAnimales";
import { crearEvento, editarEvento } from "@/app/(app)/sanidad/actions";
import { sumarDias } from "@/lib/fechas";
import {
  ETIQUETA_EVENTO, ETIQUETA_PRODUCTO, ETIQUETA_VIA, EVENTO_CON_PRODUCTO, EVENTO_CON_REFUERZO, EVENTO_DE_PRODUCTO, TIPOS_EVENTO, UNIDADES_DOSIS, VIAS, textoRetiro,
} from "@/lib/sanidad";
import type { Especie, ProductoVeterinario, TipoEvento, ViaAplicacion } from "@/lib/tipos";

/** Los datos de un evento, para corregirlo o para proponer la siguiente aplicación de uno anterior. */
export type DatosEvento = {
  id?: string;
  tipo: TipoEvento;
  fecha: string;
  producto_id: string | null;
  producto_nombre: string | null;
  lote_producto: string | null;
  fecha_vencimiento: string | null;
  dosis: number | null;
  unidad_dosis: string | null;
  via: ViaAplicacion | null;
  responsable: string | null;
  costo: number | null;
  retiro_leche_dias: number;
  retiro_carne_dias: number;
  diagnostico: string | null;
  observaciones: string | null;
  proxima_fecha: string | null;
};

const NUEVO_PRODUCTO = "otro";
const REFUERZOS = [
  { dias: 15, texto: "15 días" },
  { dias: 21, texto: "21 días" },
  { dias: 30, texto: "1 mes" },
  { dias: 90, texto: "3 meses" },
  { dias: 180, texto: "6 meses" },
  { dias: 365, texto: "1 año" },
];

const coma = (n: number | null) => (n === null ? "" : String(n).replace(".", ","));
const entero = (v: string) => (/^\d{1,3}$/.test(v.trim()) ? Number(v) : 0);

/**
 * Registrar una vacuna, desparasitación, tratamiento o cirugía, o corregir uno ya registrado. Se aplica a un animal (viene fijo desde su
 * ficha) o a varios a la vez (desde Sanidad).
 */
export function FormEvento({
  fincaId,
  especies,
  productos,
  hoy,
  animalFijo,
  animalesIniciales = [],
  datos,
  solicitud,
}: {
  fincaId: string;
  especies: Especie[];
  productos: ProductoVeterinario[];
  hoy: string;
  /** Si viene, el evento es de este animal (se llegó desde su ficha) y no se elige a quién. */
  animalFijo?: AnimalElegido;
  /** Al corregir o repetir un evento: los animales que ya lo tienen. */
  animalesIniciales?: AnimalElegido[];
  /** Si trae `id`, el formulario corrige ese evento; si no, solo propone estos valores. */
  datos?: DatosEvento;
  /** Solo al crear: identifica la apertura del formulario para ignorar un doble toque. */
  solicitud?: string;
}) {
  const editando = Boolean(datos?.id);
  const [estado, enviar, pendiente] = useActionState(editando ? editarEvento : crearEvento, undefined);
  const [, iniciar] = useTransition();

  const [tipo, setTipo] = useState<TipoEvento>(datos?.tipo ?? "vacunacion");
  const [productoId, setProductoId] = useState<string>(datos?.producto_id ?? (datos?.producto_nombre ? NUEVO_PRODUCTO : ""));
  const [nombreProducto, setNombreProducto] = useState(datos?.producto_id ? "" : (datos?.producto_nombre ?? ""));
  const [fecha, setFecha] = useState(datos?.fecha ?? hoy);
  const [retiroLeche, setRetiroLeche] = useState(String(datos?.retiro_leche_dias ?? 0));
  const [retiroCarne, setRetiroCarne] = useState(String(datos?.retiro_carne_dias ?? 0));
  const [unidad, setUnidad] = useState(datos?.unidad_dosis ?? "");
  const [via, setVia] = useState<ViaAplicacion | "">(datos?.via ?? "");
  const [proxima, setProxima] = useState(datos?.proxima_fecha ?? "");
  const [animales, setAnimales] = useState<AnimalElegido[]>(animalesIniciales);

  const conProducto = EVENTO_CON_PRODUCTO.includes(tipo);
  const conRefuerzo = EVENTO_CON_REFUERZO.includes(tipo);
  const detallesAbiertos = Boolean(datos && (datos.dosis || datos.via || datos.lote_producto || datos.fecha_vencimiento || datos.responsable || datos.costo));
  const frasesRetiro = textoRetiro(fecha, entero(retiroLeche), entero(retiroCarne));
  const faltanAnimales = !animalFijo && animales.length === 0;

  const elegirProducto = (v: string) => {
    setProductoId(v);
    const p = productos.find((x) => x.id === v);
    if (!p) return;
    // El catálogo propone lo habitual del producto; todo se puede cambiar en esta aplicación.
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

  return (
    <form onSubmit={alEnviar} className="space-y-5">
      {datos?.id ? <input type="hidden" name="evento_id" value={datos.id} /> : <input type="hidden" name="client_request_id" value={solicitud ?? ""} />}
      {animalFijo ? (
        <>
          <input type="hidden" name="animal" value={animalFijo.id} />
          <input type="hidden" name="animal_id" value={animalFijo.id} />
        </>
      ) : null}

      <Campo etiqueta="¿Qué se hizo?">
        {(id) => (
          <Selector
            id={id}
            nombre="tipo"
            valor={tipo}
            onCambio={(v) => v && setTipo(v)}
            titulo="¿Qué se hizo?"
            opciones={TIPOS_EVENTO.map((t) => ({ valor: t, etiqueta: ETIQUETA_EVENTO[t] }))}
          />
        )}
      </Campo>

      <Campo etiqueta={conProducto ? "Producto aplicado" : "Producto (opcional)"} ayuda={productos.length === 0 ? "Aún no tienes productos guardados: escribe el nombre. Puedes guardarlos en Sanidad → Productos." : undefined}>
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

      <Campo etiqueta="Fecha">
        {(id) => <input id={id} name="fecha" type="date" value={fecha} max={hoy} onChange={(e) => setFecha(e.target.value)} required className={CLASE_INPUT} />}
      </Campo>

      {animalFijo ? null : (
        <Campo etiqueta="Animales">
          {() => <SelectorAnimales fincaId={fincaId} especies={especies} valor={animales} onCambio={setAnimales} />}
        </Campo>
      )}

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
              <span key={f} className="block">{f}</span>
            ))}
          </Aviso>
        ) : null}
      </div>

      {conRefuerzo ? (
        <div className="space-y-2 rounded-3xl border border-arena p-4">
          <Campo etiqueta="Próxima dosis" ayuda="Opcional. Te lo recordamos en Sanidad y en Hoy cuando se acerque.">
            {(id) => <input id={id} name="proxima_fecha" type="date" value={proxima} min={sumarDias(fecha, 1)} onChange={(e) => setProxima(e.target.value)} className={CLASE_INPUT} />}
          </Campo>
          <FilaDesplazable>
            {REFUERZOS.map((r) => (
              <Chip key={r.dias} activo={proxima === sumarDias(fecha, r.dias)} onClick={() => setProxima(sumarDias(fecha, r.dias))}>
                En {r.texto}
              </Chip>
            ))}
            {proxima ? <Chip activo={false} onClick={() => setProxima("")}>Sin próxima dosis</Chip> : null}
          </FilaDesplazable>
        </div>
      ) : (
        <input type="hidden" name="proxima_fecha" value="" />
      )}

      <details open={detallesAbiertos} className="group rounded-3xl border border-arena p-4">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between font-semibold">
          <span className="min-w-0">Más detalles (dosis, lote, responsable, costo)</span>
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
                <Selector
                  id={id}
                  nombre="unidad_dosis"
                  valor={unidad}
                  onCambio={(v) => setUnidad(String(v))}
                  titulo="Unidad de la dosis"
                  placeholder="Sin especificar"
                  permitirVacio
                  opciones={UNIDADES_DOSIS.map((u) => ({ valor: u, etiqueta: u }))}
                />
              )}
            </Campo>
          </div>
          <Campo etiqueta="Vía">
            {(id) => (
              <Selector
                id={id}
                nombre="via"
                valor={via}
                onCambio={(v) => setVia(v as ViaAplicacion | "")}
                titulo="¿Por dónde se aplicó?"
                placeholder="Sin especificar"
                permitirVacio
                opciones={VIAS.map((v) => ({ valor: v, etiqueta: ETIQUETA_VIA[v] }))}
              />
            )}
          </Campo>
          <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
            <Campo etiqueta="Lote del producto">
              {(id) => <input id={id} name="lote_producto" defaultValue={datos?.lote_producto ?? ""} maxLength={60} autoComplete="off" className={CLASE_INPUT} />}
            </Campo>
            <Campo etiqueta="Vence el lote">
              {(id) => <input id={id} name="fecha_vencimiento" type="date" defaultValue={datos?.fecha_vencimiento ?? ""} className={CLASE_INPUT} />}
            </Campo>
          </div>
          <Campo etiqueta="Responsable" ayuda="Quién lo aplicó.">
            {(id) => <input id={id} name="responsable" defaultValue={datos?.responsable ?? ""} maxLength={120} autoComplete="off" className={CLASE_INPUT} />}
          </Campo>
          <Campo etiqueta="Costo" ayuda="Opcional, en pesos.">
            {(id) => <input id={id} name="costo" defaultValue={coma(datos?.costo ?? null)} inputMode="decimal" autoComplete="off" className={CLASE_INPUT} placeholder="0" />}
          </Campo>
        </div>
      </details>

      {tipo === "tratamiento" || tipo === "cirugia" ? (
        <Campo etiqueta="Diagnóstico" ayuda="Opcional. Qué se estaba tratando.">
          {(id) => <input id={id} name="diagnostico" defaultValue={datos?.diagnostico ?? ""} maxLength={300} autoComplete="off" className={CLASE_INPUT} />}
        </Campo>
      ) : (
        <input type="hidden" name="diagnostico" value="" />
      )}

      <Campo etiqueta="Observaciones" ayuda="Opcional.">
        {(id) => <textarea id={id} name="observaciones" defaultValue={datos?.observaciones ?? ""} rows={3} maxLength={1000} className={`${CLASE_INPUT} py-3`} />}
      </Campo>

      {faltanAnimales ? <Aviso tipo="atencion">Aún no elegiste animales. Elige al menos uno para guardar.</Aviso> : null}
      {estado?.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      <div className="space-y-2">
        <Boton type="submit" pendiente={pendiente} cargando="Guardando…" disabled={faltanAnimales}>
          {editando ? "Guardar cambios" : animales.length > 1 ? `Guardar para ${animales.length} animales` : "Guardar"}
        </Boton>
        {editando && datos?.id ? (
          <Link href={`/sanidad/evento/${datos.id}`} className={clasesBoton("fantasma")}>
            Cancelar
          </Link>
        ) : null}
      </div>
    </form>
  );
}
