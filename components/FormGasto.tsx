"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { Boton, clasesBoton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { Selector } from "@/components/Selector";
import { SelectorAnimal } from "@/components/SelectorAnimal";
import { SelectorTarjetas } from "@/components/SelectorTarjetas";
import { SelectorTercero } from "@/components/SelectorTercero";
import { SubirSoporte } from "@/components/SubirSoporte";
import { crearGasto, editarGasto } from "@/app/(app)/hato/gastos/actions";
import { DESTINOS, DETALLE_DESTINO, DETALLE_GRUPO, ETIQUETA_DESTINO, ETIQUETA_GRUPO, ETIQUETA_PAGO, ETIQUETA_RUBRO, GRUPO_DE, GRUPOS, RUBROS_DE, UNIDADES_GASTO, UNIDAD_SUGERIDA, type EstadoPago, type GrupoGasto } from "@/lib/costos";
import { ESCENA_DESTINO_GASTO, ESCENA_ESPECIE, ESCENA_GRUPO_GASTO, ESCENA_PAGO, ESCENA_RUBRO } from "@/lib/escenas-costos";
import { pesos } from "@/lib/ferias";
import { leerNumero } from "@/lib/numeros";
import { comprasDeGrupo, textoPrecio } from "@/lib/productos";
import type { DestinoGasto, Especie, Gasto, Producto, RubroGasto, Tercero } from "@/lib/tipos";

const coma = (n: number | null | undefined) => (n == null ? "" : String(n).replace(".", ","));
type AnimalElegido = { id: string; numero_arete: string; nombre: string | null };

/**
 * Registrar o corregir una compra del aprisco. Se elige en qué se gastó (grupo), qué se compró (de la lista de productos de la finca, con su unidad y su
 * último precio) y a quién (de la lista de proveedores): lo único que se escribe es la cantidad. Lo que no está en la lista se registra como «otra
 * compra» con su rubro y su descripción. Además: a quién se carga (toda la finca, una especie, un corral, un lote o un animal), si ya se pagó o queda
 * por pagar, y la factura. Lo que ya se registra en Sanidad y en Ceba no se digita aquí.
 */
export function FormGasto({
  fincaId,
  especies,
  ubicaciones,
  lotes,
  hoy,
  gasto,
  animalInicial,
  rubroInicial,
  destinoInicial,
  animalDe,
  solicitud,
  conSoporte = true,
  productos,
  terceros,
}: {
  fincaId: string;
  especies: Especie[];
  ubicaciones: { id: string; nombre: string }[];
  lotes: { id: string; nombre: string }[];
  hoy: string;
  gasto?: Gasto;
  /** El animal al que se carga (al editar, o al venir desde su ficha). */
  animalInicial?: AnimalElegido | null;
  rubroInicial?: RubroGasto;
  destinoInicial?: { tipo: DestinoGasto; id?: string };
  /** Si se llegó desde la ficha de un animal: al guardar se vuelve a ella. */
  animalDe?: string;
  solicitud?: string;
  /** El plan incluye subir la factura (PDF o foto). */
  conSoporte?: boolean;
  /** Los productos de compra del catálogo de la finca. */
  productos: Producto[];
  /** Los proveedores y compradores de la finca. */
  terceros: Tercero[];
}) {
  const editando = Boolean(gasto);
  const [estado, enviar, pendiente] = useActionState(editando ? editarGasto : crearGasto, undefined);
  const [, iniciar] = useTransition();

  const rubroArranque = gasto?.rubro ?? rubroInicial ?? "";
  const [grupo, setGrupo] = useState<GrupoGasto | "">(rubroArranque ? GRUPO_DE[rubroArranque] : "");
  const [rubro, setRubro] = useState<RubroGasto | "">(rubroArranque);
  const [fecha, setFecha] = useState(gasto?.fecha ?? hoy);
  // «otro» = una compra que no está en la lista (o un gasto escrito antes de que existiera): se describe a mano.
  const [producto, setProducto] = useState<string>(gasto ? (gasto.producto_id ?? "otro") : "");
  const [cantidad, setCantidad] = useState(coma(gasto?.cantidad));
  const [unidad, setUnidad] = useState(gasto?.unidad ?? "");
  const [monto, setMonto] = useState(coma(gasto?.monto));
  const [precio, setPrecio] = useState(gasto?.producto_id && gasto.cantidad ? textoPrecio(gasto.monto / gasto.cantidad) : "");
  const [tercero, setTercero] = useState(gasto?.tercero_id ?? "");
  const [destino, setDestino] = useState<DestinoGasto>(gasto?.destino_tipo ?? destinoInicial?.tipo ?? (animalInicial ? "animal" : "finca"));
  const [especie, setEspecie] = useState<Especie | "">(gasto?.especie ?? (especies.length === 1 ? especies[0] : ""));
  const [ubicacion, setUbicacion] = useState(gasto?.ubicacion_id ?? (destinoInicial?.tipo === "ubicacion" ? (destinoInicial.id ?? "") : ""));
  const [lote, setLote] = useState(gasto?.lote_id ?? (destinoInicial?.tipo === "lote" ? (destinoInicial.id ?? "") : ""));
  const [animal, setAnimal] = useState<AnimalElegido | null>(animalInicial ?? null);
  const [pago, setPago] = useState<EstadoPago>(gasto ? (gasto.pagado_en ? "pagado" : "por_pagar") : "pagado");
  const [subiendo, setSubiendo] = useState(false);

  const delGrupo = grupo ? comprasDeGrupo(productos, grupo) : [];
  const elegido = productos.find((p) => p.id === producto);
  const usaLista = Boolean(elegido);
  const cant = leerNumero(cantidad);
  const precioNum = leerNumero(precio);
  // Con un producto de la lista el total sale de la cantidad por el precio; con «otra compra» se escribe.
  const totalLista = usaLista && cant && cant > 0 && precioNum && precioNum > 0 ? Math.round(cant * precioNum * 100) / 100 : null;
  const total = usaLista ? totalLista : leerNumero(monto);
  const porUnidad = !usaLista && total && cant && cant > 0 ? total / cant : null;

  const elegirGrupo = (g: GrupoGasto | "") => {
    if (!g) return;
    setGrupo(g);
    if (rubro && GRUPO_DE[rubro] !== g) {
      setRubro("");
      setProducto("");
    }
  };
  /** «Otra compra»: se vuelve a elegir el rubro (o se conserva el de un gasto que se está corrigiendo). */
  const elegirOtra = () => {
    setProducto("otro");
    setUnidad("");
    setRubro(gasto && GRUPO_DE[gasto.rubro] === grupo ? gasto.rubro : "");
  };
  const elegirProducto = (id: string) => {
    setProducto(id);
    const p = productos.find((x) => x.id === id);
    if (p?.rubro) {
      setRubro(p.rubro);
      setUnidad(p.unidad ?? "");
      setPrecio(textoPrecio(p.precio_habitual));
    } else {
      setRubro("");
    }
  };
  const elegirRubro = (r: RubroGasto | "") => {
    if (!r) return;
    setRubro(r);
    const sugerida = UNIDAD_SUGERIDA[r];
    if (!unidad && sugerida) setUnidad(sugerida);
  };

  const falta =
    !grupo ? "Elige en qué se gastó."
    : !producto ? "Elige qué compraste."
    : !rubro ? "Elige el rubro de la compra."
    : usaLista && !(cant && cant > 0) ? "Escribe cuánto compraste."
    : usaLista && !(precioNum && precioNum > 0) ? "Escribe el precio de cada unidad."
    : !usaLista && !total ? "Escribe cuánto costó."
    : destino === "especie" && !especie ? "Elige si es de las cabras o de las ovejas."
    : destino === "ubicacion" && !ubicacion ? "Elige el corral o potrero."
    : destino === "lote" && !lote ? "Elige el lote de ceba."
    : destino === "animal" && !animal ? "Elige el animal."
    : null;

  // Se envía con onSubmit (no con `action`): si hay un error, lo que la persona escribió no se borra.
  const alEnviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    iniciar(() => enviar(datos));
  };
  const volver = animalDe ? `/hato/${animalDe}#costos` : "/hato?vista=gastos";
  const destinosOfrecidos = DESTINOS.filter((d) => (d !== "especie" || especies.length > 1) && (d !== "lote" || lotes.length > 0 || destino === "lote") && (d !== "ubicacion" || ubicaciones.length > 0 || destino === "ubicacion"));

  return (
    <form onSubmit={alEnviar} className="space-y-6">
      {gasto ? <input type="hidden" name="gasto_id" value={gasto.id} /> : <input type="hidden" name="client_request_id" value={solicitud ?? ""} />}
      {animalDe ? <input type="hidden" name="volver" value={animalDe} /> : null}

      <Campo etiqueta="¿En qué se gastó?">
        {(id) => (
          <SelectorTarjetas
            id={id}
            valor={grupo}
            onCambio={elegirGrupo}
            titulo="Grupo de gasto"
            opciones={GRUPOS.map((g) => ({ valor: g, etiqueta: ETIQUETA_GRUPO[g], detalle: DETALLE_GRUPO[g], escena: ESCENA_GRUPO_GASTO[g] }))}
          />
        )}
      </Campo>
      {grupo ? (
        <Campo etiqueta="¿Qué compraste?">
          {(id) => (
            <Selector
              id={id}
              valor={producto}
              onCambio={(v) => (v === "otro" ? elegirOtra() : elegirProducto(String(v)))}
              titulo="¿Qué compraste?"
              placeholder="Elegir de la lista"
              opciones={[
                ...delGrupo.filter((p) => p.activo || p.id === producto).map((p) => ({ valor: p.id, etiqueta: p.nombre, detalle: p.unidad ? `Se cuenta en ${p.unidad}` : undefined })),
                { valor: "otro", etiqueta: "Otra compra (no está en la lista)", detalle: "La describes tú" },
              ]}
            />
          )}
        </Campo>
      ) : null}
      {/* El producto de la lista ya trae su rubro, su nombre y su unidad: viajan sin que se escriban. */}
      {usaLista && elegido ? (
        <>
          <input type="hidden" name="producto_id" value={elegido.id} />
          <input type="hidden" name="rubro" value={rubro} />
          <input type="hidden" name="descripcion" value={elegido.nombre} />
          <input type="hidden" name="unidad" value={unidad} />
          <input type="hidden" name="cantidad" value={cantidad} />
          <input type="hidden" name="monto" value={totalLista ? coma(totalLista) : ""} />
        </>
      ) : null}
      {producto === "otro" && grupo ? (
        <>
          <Campo etiqueta={`Rubro de ${ETIQUETA_GRUPO[grupo].toLowerCase()}`}>
            {(id) => (
              <SelectorTarjetas id={id} nombre="rubro" valor={rubro} onCambio={elegirRubro} titulo="Rubro" opciones={RUBROS_DE[grupo].filter((r) => r !== "mano_obra" || gasto?.rubro === "mano_obra").map((r) => ({ valor: r, etiqueta: ETIQUETA_RUBRO[r], escena: ESCENA_RUBRO[r] }))} />
            )}
          </Campo>
          <Campo etiqueta="¿Qué se compró o se pagó?" ayuda="Una frase corta: «Reparación del cerco», «Jornal de ordeño»…">
            {(id) => <input id={id} name="descripcion" defaultValue={gasto?.descripcion ?? ""} required maxLength={160} autoComplete="off" enterKeyHint="next" className={CLASE_INPUT} />}
          </Campo>
        </>
      ) : null}

      {usaLista && elegido ? (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Campo etiqueta={`Cuántos ${unidad || "unidades"}`}>
              {(id) => <input id={id} value={cantidad} onChange={(e) => setCantidad(e.target.value)} required inputMode="decimal" autoComplete="off" enterKeyHint="next" placeholder="Ej. 20" className={CLASE_INPUT} />}
            </Campo>
            <Campo etiqueta={`Precio de cada ${unidad ? unidad.replace(/s$/, "") : "unidad"}`} ayuda={elegido.precio_habitual != null ? "Es el último precio que pagaste; cámbialo si subió." : "Solo la primera vez: queda guardado para la próxima."}>
              {(id) => <input id={id} value={precio} onChange={(e) => setPrecio(e.target.value)} required inputMode="decimal" autoComplete="off" enterKeyHint="next" placeholder="Ej. 62.500" className={CLASE_INPUT} />}
            </Campo>
          </div>
          {totalLista ? (
            <p className="-mt-2 rounded-2xl bg-lana px-4 py-3 text-[0.9375rem]">
              Total de la compra: <span className="font-display text-lg font-semibold tabular-nums">{pesos(totalLista)}</span>
            </p>
          ) : null}
          <Campo etiqueta="Fecha de la compra">
            {(id) => <input id={id} name="fecha" type="date" value={fecha} max={hoy} onChange={(e) => setFecha(e.target.value)} required className={CLASE_INPUT} />}
          </Campo>
        </>
      ) : producto === "otro" ? (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Campo etiqueta="Valor total" ayuda={porUnidad ? `${pesos(porUnidad)} por ${unidad || "unidad"}` : "En pesos, lo que costó todo."}>
              {(id) => <input id={id} name="monto" value={monto} onChange={(e) => setMonto(e.target.value)} required inputMode="decimal" autoComplete="off" enterKeyHint="next" placeholder="Ej. 1.250.000" className={CLASE_INPUT} />}
            </Campo>
            <Campo etiqueta="Fecha de la compra">
              {(id) => <input id={id} name="fecha" type="date" value={fecha} max={hoy} onChange={(e) => setFecha(e.target.value)} required className={CLASE_INPUT} />}
            </Campo>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Campo etiqueta="Cantidad (opcional)" ayuda="Sirve para saber cuánto cuesta cada bulto, kilo o dosis.">
              {(id) => <input id={id} name="cantidad" value={cantidad} onChange={(e) => setCantidad(e.target.value)} inputMode="decimal" autoComplete="off" enterKeyHint="next" placeholder="Ej. 20" className={CLASE_INPUT} />}
            </Campo>
            {cantidad.trim() ? (
              <Campo etiqueta="Unidad">
                {(id) => <Selector id={id} nombre="unidad" valor={unidad} onCambio={(v) => setUnidad(String(v))} titulo="Unidad" placeholder="Sin especificar" permitirVacio opciones={UNIDADES_GASTO.map((u) => ({ valor: u, etiqueta: u }))} />}
              </Campo>
            ) : null}
          </div>
        </>
      ) : null}

      {producto ? (
        <Campo etiqueta="Proveedor (opcional)">
          {(id) => <SelectorTercero id={id} nombre="tercero_id" tipo="proveedor" terceros={terceros} valor={tercero} onCambio={(v) => setTercero(v)} titulo="¿A quién se la compraste?" placeholder="Elegir o agregar" />}
        </Campo>
      ) : null}

      <Campo etiqueta="¿A quién se carga?" ayuda="Para saber cuánto cuesta cada animal, cada lote y cada litro. Lo de toda la finca queda como gasto general.">
        {(id) => (
          <SelectorTarjetas
            id={id}
            nombre="destino_tipo"
            valor={destino}
            onCambio={(v) => v && setDestino(v)}
            titulo="A quién se carga"
            opciones={destinosOfrecidos.map((d) => ({ valor: d, etiqueta: ETIQUETA_DESTINO[d], detalle: DETALLE_DESTINO[d], escena: ESCENA_DESTINO_GASTO[d] }))}
          />
        )}
      </Campo>
      {destino === "especie" ? (
        <Campo etiqueta="¿De cuáles?">
          {(id) => (
            <SelectorTarjetas id={id} nombre="especie" valor={especie} onCambio={setEspecie} titulo="Especie" opciones={especies.map((e) => ({ valor: e, etiqueta: e === "caprino" ? "Cabras" : "Ovejas", escena: ESCENA_ESPECIE[e] }))} />
          )}
        </Campo>
      ) : null}
      {destino === "ubicacion" ? (
        <Campo etiqueta="Corral o potrero">
          {(id) => <Selector id={id} nombre="ubicacion_id" valor={ubicacion} onCambio={(v) => setUbicacion(String(v))} titulo="¿Qué corral o potrero?" placeholder="Elegir" opciones={ubicaciones.map((u) => ({ valor: u.id, etiqueta: u.nombre }))} />}
        </Campo>
      ) : null}
      {destino === "lote" ? (
        <Campo etiqueta="Lote de ceba">
          {(id) => <Selector id={id} nombre="lote_id" valor={lote} onCambio={(v) => setLote(String(v))} titulo="¿Qué lote?" placeholder="Elegir" opciones={lotes.map((l) => ({ valor: l.id, etiqueta: l.nombre }))} />}
        </Campo>
      ) : null}
      {destino === "animal" ? (
        <Campo etiqueta="Animal">
          {(id) => <SelectorAnimal id={id} nombre="animal_id" fincaId={fincaId} titulo="Elegir el animal" valor={animal} onCambio={setAnimal} incluirInactivos vacio="Elegir el animal" />}
        </Campo>
      ) : null}

      <Campo etiqueta="¿Ya se pagó?">
        {(id) => (
          <SelectorTarjetas
            id={id}
            nombre="pago"
            valor={pago}
            onCambio={(v) => v && setPago(v)}
            titulo="Pago"
            opciones={(["pagado", "por_pagar"] as const).map((p) => ({ valor: p, etiqueta: ETIQUETA_PAGO[p], escena: ESCENA_PAGO[p] }))}
          />
        )}
      </Campo>
      {pago === "pagado" ? (
        <Campo etiqueta="Fecha de pago" ayuda="Si lo dejas en blanco, se toma la fecha del gasto.">
          {(id) => <input id={id} name="pagado_en" type="date" defaultValue={gasto?.pagado_en ?? ""} min={fecha} max={hoy} className={CLASE_INPUT} />}
        </Campo>
      ) : (
        <Campo etiqueta="Vence el" ayuda="Opcional. Te avisamos en Hoy cuando se pase.">
          {(id) => <input id={id} name="vence" type="date" defaultValue={gasto?.vence ?? ""} min={fecha} className={CLASE_INPUT} />}
        </Campo>
      )}

      {conSoporte ? (
        <div className="space-y-1.5">
          <p className="text-sm font-semibold">Factura o soporte</p>
          <p className="text-[0.8125rem] text-humo">Opcional. La foto o el PDF de la factura: queda guardado como respaldo.</p>
          <SubirSoporte nombre="soporte_path" carpeta="gastos" etiqueta="Factura o soporte" inicial={gasto?.soporte_path} onEstado={setSubiendo} />
        </div>
      ) : (
        <p className="text-[0.8125rem] text-humo">
          Guardar la factura en PDF o foto está en el plan Profesional.{" "}
          <Link href="/mas/plan" className="font-semibold text-musgo underline underline-offset-4">
            Mejorar mi plan
          </Link>
        </p>
      )}

      <Campo etiqueta="Observaciones" ayuda="Opcional.">
        {(id) => <textarea id={id} name="observaciones" defaultValue={gasto?.observaciones ?? ""} rows={2} maxLength={1000} className={`${CLASE_INPUT} py-3`} />}
      </Campo>

      {falta ? <Aviso tipo="atencion">{falta}</Aviso> : null}
      {estado?.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      <div className="space-y-2">
        <Boton type="submit" pendiente={pendiente} cargando="Guardando…" disabled={Boolean(falta) || subiendo}>
          {editando ? "Guardar cambios" : "Guardar compra"}
        </Boton>
        <Link href={volver} className={clasesBoton("fantasma")}>Cancelar</Link>
      </div>
    </form>
  );
}
