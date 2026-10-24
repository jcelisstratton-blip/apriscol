"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { CampoBusqueda } from "@/components/CampoBusqueda";
import { EstadoVacio } from "@/components/EstadoVacio";
import { Insignia } from "@/components/Insignia";
import { ListaPorTramos } from "@/components/ListaPorTramos";
import { Selector } from "@/components/Selector";
import { Sheet } from "@/components/Sheet";
import { useToast } from "@/components/Toast";
import { actualizarProducto, actualizarTercero, crearProducto, crearTercero } from "@/app/(app)/mas/productos/actions";
import { ETIQUETA_GRUPO, ETIQUETA_RUBRO, GRUPO_DE, GRUPOS, RUBROS_DE, UNIDADES_GASTO } from "@/lib/costos";
import { pesos } from "@/lib/ferias";
import { textoPrecio } from "@/lib/productos";
import { ETIQUETA_LINEA, LINEAS } from "@/lib/ventas";
import type { Producto, RubroGasto, Tercero, TipoTercero } from "@/lib/tipos";
import { sinTildes } from "@/lib/texto";

const ETIQUETA_TIPO_TERCERO: Record<TipoTercero, string> = { proveedor: "Proveedor", comprador: "Comprador", ambos: "Proveedor y comprador" };
const RUBROS_COMPRABLES = GRUPOS.flatMap((g) => RUBROS_DE[g]).filter((r): r is Exclude<RubroGasto, "mano_obra"> => r !== "mano_obra");

type Hoja = { tipo: "producto"; producto: Producto } | { tipo: "producto-nuevo" } | { tipo: "tercero"; tercero: Tercero } | { tipo: "tercero-nuevo" } | null;

/**
 * Las listas de la finca: lo que compra, lo que vende y a quiénes (proveedores y compradores). Cada elemento se abre en una hoja para cambiar su
 * precio habitual, su unidad o su nombre, o para ocultarlo de las listas (lo ya registrado lo sigue mostrando). Aquí también se agrega lo que no venía.
 */
export function GestionCatalogos({ vista, productos, terceros, puedeEditar }: { vista: "compras" | "ventas" | "terceros"; productos: Producto[]; terceros: Tercero[]; puedeEditar: boolean }) {
  const [busqueda, setBusqueda] = useState("");
  const [hoja, setHoja] = useState<Hoja>(null);
  const alBuscar = useCallback((t: string) => setBusqueda(t), []);
  const texto = sinTildes(busqueda);

  const items = vista === "terceros" ? terceros : productos.filter((p) => p.tipo === (vista === "compras" ? "compra" : "venta"));
  const visibles = (items as (Producto | Tercero)[]).filter((x) => !texto || sinTildes(x.nombre).includes(texto));
  const queAgregar = vista === "terceros" ? "Agregar un proveedor o comprador" : vista === "compras" ? "Agregar algo que compras" : "Agregar algo que vendes";

  return (
    <div className="space-y-3">
      {puedeEditar ? (
        <button
          type="button"
          onClick={() => setHoja(vista === "terceros" ? { tipo: "tercero-nuevo" } : { tipo: "producto-nuevo" })}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-musgo px-5 text-base font-semibold text-sobre-musgo shadow-sm hover:brightness-110 active:scale-[0.98]"
        >
          <Plus className="size-5" strokeWidth={2.2} aria-hidden="true" /> {queAgregar}
        </button>
      ) : null}
      {items.length > 8 ? <CampoBusqueda onBuscar={alBuscar} placeholder={vista === "terceros" ? "Buscar por nombre" : "Buscar un producto"} /> : null}

      {visibles.length === 0 ? (
        <EstadoVacio
          icono={<Plus strokeWidth={1.5} />}
          titulo={busqueda ? "Nada con esa búsqueda" : vista === "terceros" ? "Todavía no tienes proveedores ni compradores" : "Todavía no hay productos"}
          descripcion={busqueda ? "Prueba con otra palabra." : vista === "terceros" ? "Se agregan al registrar una compra o una venta: escribes el nombre una vez y la próxima solo lo eliges." : "La lista se arma sola con lo habitual de un aprisco."}
        />
      ) : (
        <ListaPorTramos<Producto | Tercero>
          key={`${vista}|${busqueda}`}
          items={visibles}
          clave={(x) => x.id}
          fila={(x) =>
            vista === "terceros" ? (
              <FilaTercero t={x as Tercero} alAbrir={puedeEditar ? () => setHoja({ tipo: "tercero", tercero: x as Tercero }) : undefined} />
            ) : (
              <FilaProducto p={x as Producto} alAbrir={puedeEditar ? () => setHoja({ tipo: "producto", producto: x as Producto }) : undefined} />
            )
          }
        />
      )}

      <HojaProducto hoja={hoja} vista={vista} alCerrar={() => setHoja(null)} />
      <HojaTercero hoja={hoja} alCerrar={() => setHoja(null)} />
    </div>
  );
}

const CLASE_FILA = "flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl bg-papel px-3.5 py-2.5 text-left ring-1 ring-arena";

function FilaProducto({ p, alAbrir }: { p: Producto; alAbrir?: () => void }) {
  const detalle = [p.unidad ? `Por ${p.unidad.replace(/s$/, "")}` : null, p.precio_habitual != null ? `último precio ${pesos(p.precio_habitual)}` : "sin precio todavía"].filter(Boolean).join(" · ");
  const contenido = (
    <>
      <span className="min-w-0">
        <span className="block font-semibold [overflow-wrap:anywhere]">{p.nombre}</span>
        <span className="block text-sm text-humo [overflow-wrap:anywhere]">
          {p.tipo === "compra" && p.rubro ? `${ETIQUETA_GRUPO[GRUPO_DE[p.rubro]]} · ` : p.linea ? `${ETIQUETA_LINEA[p.linea]} · ` : ""}
          {detalle}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        {!p.activo ? <Insignia tono="neutro">Oculto</Insignia> : null}
        {p.automatico ? <Insignia tono="musgo">Se registra solo</Insignia> : null}
      </span>
    </>
  );
  return alAbrir ? (
    <button type="button" onClick={alAbrir} className={`${CLASE_FILA} transition active:scale-[0.99]`}>
      {contenido}
    </button>
  ) : (
    <div className={CLASE_FILA}>{contenido}</div>
  );
}

function FilaTercero({ t, alAbrir }: { t: Tercero; alAbrir?: () => void }) {
  const contenido = (
    <>
      <span className="min-w-0">
        <span className="block font-semibold [overflow-wrap:anywhere]">{t.nombre}</span>
        <span className="block text-sm text-humo">{ETIQUETA_TIPO_TERCERO[t.tipo]}</span>
      </span>
      {!t.activo ? <Insignia tono="neutro">Oculto</Insignia> : null}
    </>
  );
  return alAbrir ? (
    <button type="button" onClick={alAbrir} className={`${CLASE_FILA} transition active:scale-[0.99]`}>
      {contenido}
    </button>
  ) : (
    <div className={CLASE_FILA}>{contenido}</div>
  );
}

// ───────────────────────── Hojas ─────────────────────────
function HojaProducto({ hoja, vista, alCerrar }: { hoja: Hoja; vista: "compras" | "ventas" | "terceros"; alCerrar: () => void }) {
  const abierta = hoja?.tipo === "producto" || hoja?.tipo === "producto-nuevo";
  const producto = hoja?.tipo === "producto" ? hoja.producto : null;
  return (
    <Sheet abierta={abierta} onCerrar={alCerrar} titulo={producto ? producto.nombre : vista === "compras" ? "Agregar algo que compras" : "Agregar algo que vendes"}>
      {abierta ? <FormProductoCatalogo key={producto?.id ?? "nuevo"} producto={producto} tipo={vista === "ventas" ? "venta" : "compra"} alTerminar={alCerrar} /> : null}
    </Sheet>
  );
}

function FormProductoCatalogo({ producto, tipo, alTerminar }: { producto: Producto | null; tipo: "compra" | "venta"; alTerminar: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [nombre, setNombre] = useState(producto?.nombre ?? "");
  const [unidad, setUnidad] = useState(producto?.unidad ?? "");
  const [precio, setPrecio] = useState(textoPrecio(producto?.precio_habitual));
  const [rubro, setRubro] = useState<string>(producto?.rubro ?? "");
  const [linea, setLinea] = useState<string>(producto?.linea ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const guardar = () =>
    iniciar(async () => {
      setError(null);
      const r = producto
        ? await actualizarProducto({ id: producto.id, nombre, unidad, precio_habitual: precio })
        : await crearProducto({ tipo, nombre, unidad, precio_habitual: precio, rubro: rubro || undefined, linea: linea || undefined });
      if (!r.ok) return setError(r.error);
      toast.exito(producto ? "Cambios guardados" : "Producto agregado");
      router.refresh();
      alTerminar();
    });
  const cambiarVisible = () =>
    iniciar(async () => {
      if (!producto) return;
      setError(null);
      const r = await actualizarProducto({ id: producto.id, activo: !producto.activo });
      if (!r.ok) return setError(r.error);
      toast.exito(producto.activo ? "Ya no sale en las listas" : "Vuelve a salir en las listas");
      router.refresh();
      alTerminar();
    });

  return (
    <div className="space-y-4">
      <Campo etiqueta="Nombre">{(id) => <input id={id} value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={120} autoComplete="off" className={CLASE_INPUT} />}</Campo>
      {!producto && tipo === "compra" ? (
        <Campo etiqueta="¿En qué rubro va?">
          {(id) => <Selector id={id} valor={rubro} onCambio={(v) => setRubro(String(v))} titulo="Rubro" placeholder="Elegir" opciones={RUBROS_COMPRABLES.map((r) => ({ valor: r, etiqueta: ETIQUETA_RUBRO[r], detalle: ETIQUETA_GRUPO[GRUPO_DE[r]] }))} />}
        </Campo>
      ) : null}
      {!producto && tipo === "venta" ? (
        <Campo etiqueta="¿En qué línea de venta va?">
          {(id) => <Selector id={id} valor={linea} onCambio={(v) => setLinea(String(v))} titulo="Línea de venta" placeholder="Elegir" opciones={LINEAS.map((l) => ({ valor: l, etiqueta: ETIQUETA_LINEA[l] }))} />}
        </Campo>
      ) : null}
      <Campo etiqueta="Unidad" ayuda="Cómo se cuenta: bultos, kilos, litros…">
        {(id) => <Selector id={id} valor={unidad} onCambio={(v) => setUnidad(String(v))} titulo="Unidad" placeholder="Sin especificar" permitirVacio opciones={UNIDADES_GASTO.map((u) => ({ valor: u, etiqueta: u }))} />}
      </Campo>
      <Campo etiqueta="Precio habitual (opcional)" ayuda="Se propone al registrar. Se actualiza solo con el último precio que uses.">
        {(id) => <input id={id} value={precio} onChange={(e) => setPrecio(e.target.value)} inputMode="decimal" autoComplete="off" placeholder="Ej. 62.500" className={CLASE_INPUT} />}
      </Campo>
      {error ? <Aviso tipo="error">{error}</Aviso> : null}
      <Boton onClick={guardar} pendiente={pendiente} cargando="Guardando…" disabled={!nombre.trim() || (!producto && tipo === "compra" && !rubro) || (!producto && tipo === "venta" && !linea)}>
        {producto ? "Guardar cambios" : "Agregar a la lista"}
      </Boton>
      {producto ? (
        <button type="button" onClick={cambiarVisible} disabled={pendiente} className="inline-flex min-h-11 w-full items-center justify-center text-[0.9375rem] font-semibold text-musgo underline-offset-4 hover:underline disabled:opacity-60">
          {producto.activo ? "Ocultar de las listas" : "Volver a mostrar en las listas"}
        </button>
      ) : null}
    </div>
  );
}

function HojaTercero({ hoja, alCerrar }: { hoja: Hoja; alCerrar: () => void }) {
  const abierta = hoja?.tipo === "tercero" || hoja?.tipo === "tercero-nuevo";
  const tercero = hoja?.tipo === "tercero" ? hoja.tercero : null;
  return (
    <Sheet abierta={abierta} onCerrar={alCerrar} titulo={tercero ? tercero.nombre : "Agregar un proveedor o comprador"}>
      {abierta ? <FormTerceroCatalogo key={tercero?.id ?? "nuevo"} tercero={tercero} alTerminar={alCerrar} /> : null}
    </Sheet>
  );
}

function FormTerceroCatalogo({ tercero, alTerminar }: { tercero: Tercero | null; alTerminar: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [nombre, setNombre] = useState(tercero?.nombre ?? "");
  const [tipo, setTipo] = useState<TipoTercero>(tercero?.tipo ?? "proveedor");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const guardar = () =>
    iniciar(async () => {
      setError(null);
      const r = tercero ? await actualizarTercero({ id: tercero.id, nombre, tipo }) : await crearTercero({ nombre, tipo });
      if (!r.ok) return setError(r.error);
      toast.exito(tercero ? "Cambios guardados" : "Agregado a la lista");
      router.refresh();
      alTerminar();
    });
  const cambiarVisible = () =>
    iniciar(async () => {
      if (!tercero) return;
      setError(null);
      const r = await actualizarTercero({ id: tercero.id, activo: !tercero.activo });
      if (!r.ok) return setError(r.error);
      toast.exito(tercero.activo ? "Ya no sale en las listas" : "Vuelve a salir en las listas");
      router.refresh();
      alTerminar();
    });

  return (
    <div className="space-y-4">
      <Campo etiqueta="Nombre">{(id) => <input id={id} value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={120} autoComplete="off" className={CLASE_INPUT} />}</Campo>
      <Campo etiqueta="¿Qué es para ti?">
        {(id) => <Selector id={id} valor={tipo} onCambio={(v) => v && setTipo(v as TipoTercero)} titulo="Tipo" opciones={(["proveedor", "comprador", "ambos"] as const).map((t) => ({ valor: t, etiqueta: ETIQUETA_TIPO_TERCERO[t] }))} />}
      </Campo>
      {error ? <Aviso tipo="error">{error}</Aviso> : null}
      <Boton onClick={guardar} pendiente={pendiente} cargando="Guardando…" disabled={!nombre.trim()}>
        {tercero ? "Guardar cambios" : "Agregar a la lista"}
      </Boton>
      {tercero ? (
        <button type="button" onClick={cambiarVisible} disabled={pendiente} className="inline-flex min-h-11 w-full items-center justify-center text-[0.9375rem] font-semibold text-musgo underline-offset-4 hover:underline disabled:opacity-60">
          {tercero.activo ? "Ocultar de las listas" : "Volver a mostrar en las listas"}
        </button>
      ) : null}
    </div>
  );
}
