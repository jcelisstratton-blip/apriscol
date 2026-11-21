"use client";

import { useState } from "react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { CampoIva } from "@/components/CampoIva";
import { ListaPorTramos } from "@/components/ListaPorTramos";
import { useDinero, useMoneda } from "@/components/ProveedorMoneda";
import { Selector } from "@/components/Selector";
import { SelectorTarjetas } from "@/components/SelectorTarjetas";
import { useToast } from "@/components/Toast";
import { InsigniaCampo } from "@/components/campo/EstadoCampo";
import { esquemaCompra, revisarCompra } from "@/lib/compra-reglas";
import { DESTINOS, DETALLE_DESTINO, DETALLE_GRUPO, ETIQUETA_DESTINO, ETIQUETA_GRUPO, ETIQUETA_PAGO, ETIQUETA_RUBRO, GRUPO_DE, GRUPOS, RUBROS_CON_LOTE, RUBROS_DE, RUBROS_LOTE_OBLIGATORIO, UNIDADES_GASTO, UNIDAD_SUGERIDA, type EstadoPago, type GrupoGasto } from "@/lib/costos";
import { ESCENA_DESTINO_GASTO, ESCENA_ESPECIE, ESCENA_GRUPO_GASTO, ESCENA_PAGO, ESCENA_RUBRO } from "@/lib/escenas-costos";
import { leerNumero } from "@/lib/numeros";
import { textoPrecio } from "@/lib/productos";
import { precioDeCada } from "@/lib/unidades";
import { MENSAJE_GUARDADO_LOCAL, etiquetaCampo, type ReferenciaCampo, type RegistroCampo } from "@/lib/campo";
import { guardarEnCelular } from "@/lib/offline/campo-envio";
import type { DestinoGasto, Especie, RubroGasto } from "@/lib/tipos";

const OTRO = "otro";
const NUEVO = "__nuevo";
const coma = (n: number | null | undefined) => (n == null ? "" : String(n).replace(".", ","));

type Estado = {
  grupo: GrupoGasto | "";
  producto: string;
  rubro: RubroGasto | "";
  descripcion: string;
  cantidad: string;
  unidad: string;
  precio: string;
  monto: string;
  fecha: string;
  proveedor: string;
  proveedorNuevo: string;
  productoVet: string;
  lote: string;
  loteVence: string;
  destino: DestinoGasto;
  especie: Especie | "";
  ubicacion: string;
  loteCeba: string;
  animal: string;
  pago: EstadoPago;
  pagadoEn: string;
  vence: string;
  iva: string;
  observaciones: string;
};

const inicial = (hoy: string, especies: Especie[], iva: number | null): Estado => ({
  grupo: "", producto: "", rubro: "", descripcion: "", cantidad: "", unidad: "", precio: "", monto: "", fecha: hoy, proveedor: "", proveedorNuevo: "",
  productoVet: "", lote: "", loteVence: "", destino: "finca", especie: especies.length === 1 ? especies[0] : "", ubicacion: "", loteCeba: "", animal: "",
  pago: "pagado", pagadoEn: "", vence: "", iva: coma(iva), observaciones: "",
});

/**
 * Compras sin señal: lo mismo que «Registrar una compra» (grupo → producto del catálogo con su unidad y su último precio, o «otra compra» con rubro y
 * descripción → cantidad y precio; proveedor; lote del producto veterinario; a quién se carga; pagado o por pagar; IVA y observaciones) con las listas de
 * la copia de la finca y las mismas reglas (`esquemaCompra`, `revisarCompra`; el servidor las vuelve a aplicar con `guardarCompraCampo`). Un proveedor que
 * no está en la lista se escribe y se crea (o se reutiliza) al enviar. La factura se adjunta después, con señal, corrigiendo la compra.
 */
export function CompraCampo({ referencia, registros, usuarioId, hoy, enLinea, alGuardar }: {
  referencia: ReferenciaCampo;
  registros: RegistroCampo[];
  usuarioId: string;
  hoy: string;
  enLinea: boolean;
  alGuardar: () => void;
}) {
  const toast = useToast();
  const dinero = useDinero();
  const moneda = useMoneda();
  const c = referencia.compras;
  const [e, setE] = useState<Estado>(() => inicial(hoy, c.especies, c.ivaDefecto));
  const [editando, setEditando] = useState<RegistroCampo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  // El campo del IVA guarda su propio texto: se vuelve a montar al limpiar o al corregir.
  const [vuelta, setVuelta] = useState(0);
  const poner = <K extends keyof Estado>(k: K, v: Estado[K]) => {
    setE((p) => ({ ...p, [k]: v }));
    setError(null);
  };

  const fincaId = referencia.finca.id;
  const delGrupo = e.grupo ? c.productos.filter((p) => GRUPO_DE[p.rubro] === e.grupo) : [];
  const elegido = c.productos.find((p) => p.id === e.producto);
  const cant = leerNumero(e.cantidad);
  const precioNum = leerNumero(e.precio);
  const totalLista = elegido && cant && cant > 0 && precioNum && precioNum > 0 ? Math.round(cant * precioNum * 100) / 100 : null;
  const total = elegido ? totalLista : leerNumero(e.monto);
  const porUnidad = !elegido && total && cant && cant > 0 ? total / cant : null;
  const conLote = c.conSanidad && Boolean(e.rubro) && RUBROS_CON_LOTE.includes(e.rubro as RubroGasto);
  const pideLote = c.conSanidad && Boolean(e.rubro) && RUBROS_LOTE_OBLIGATORIO.includes(e.rubro as RubroGasto);
  const hechos = registros.filter((x) => x.tipo === "compra" && x.usuarioId === usuarioId && x.fincaId === fincaId).sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
  const destinos = DESTINOS.filter((d) => (d !== "especie" || c.especies.length > 1) && (d !== "lote" || c.lotes.length > 0) && (d !== "ubicacion" || referencia.ubicaciones.length > 0) && (d !== "animal" || referencia.animales.length > 0));

  const elegirGrupo = (g: GrupoGasto | "") => {
    if (!g) return;
    setE((p) => (p.rubro && GRUPO_DE[p.rubro] !== g ? { ...p, grupo: g, rubro: "", producto: "" } : { ...p, grupo: g }));
    setError(null);
  };
  const elegirProducto = (id: string) => {
    if (id === OTRO) return setE((p) => ({ ...p, producto: OTRO, unidad: "", rubro: "", precio: "" }));
    const p = c.productos.find((x) => x.id === id);
    if (!p) return;
    setE((prev) => ({ ...prev, producto: id, rubro: p.rubro, unidad: p.unidad ?? "", precio: textoPrecio(p.precio), descripcion: p.nombre }));
    setError(null);
  };
  const elegirRubro = (r: RubroGasto | "") => {
    if (!r) return;
    setE((p) => ({ ...p, rubro: r, unidad: p.unidad || UNIDAD_SUGERIDA[r] || "" }));
  };

  const falta =
    !e.grupo ? "Elige en qué se gastó."
    : !e.producto ? "Elige qué compraste."
    : !e.rubro ? "Elige el rubro de la compra."
    : elegido && !(cant && cant > 0) ? "Escribe cuánto compraste."
    : elegido && !(precioNum && precioNum > 0) ? "Escribe el precio de cada unidad."
    : !elegido && !total ? "Escribe cuánto costó."
    : pideLote && !e.productoVet ? "Elige de qué producto veterinario es, para que el veterinario pueda elegir su lote."
    : pideLote && !e.lote.trim() ? "Escribe el lote (está en el frasco o la caja)."
    : e.destino === "especie" && !e.especie ? "Elige si es de las cabras o de las ovejas."
    : e.destino === "ubicacion" && !e.ubicacion ? "Elige el corral o potrero."
    : e.destino === "lote" && !e.loteCeba ? "Elige el lote de ceba."
    : e.destino === "animal" && !e.animal ? "Elige el animal."
    : null;

  /** Los mismos campos que «Registrar una compra» con señal (los vacíos no viajan). */
  const campos = (): Record<string, string> => {
    const x: Record<string, string> = {
      fecha: e.fecha, rubro: e.rubro, descripcion: elegido ? elegido.nombre : e.descripcion, producto_id: elegido?.id ?? "",
      cantidad: e.cantidad, unidad: e.cantidad.trim() ? e.unidad : "", monto: elegido ? (totalLista ? coma(totalLista) : "") : e.monto,
      tercero_id: e.proveedor !== NUEVO ? e.proveedor : "", proveedor_nuevo: e.proveedor === NUEVO ? e.proveedorNuevo : "",
      producto_vet_id: conLote ? e.productoVet : "", lote_producto: conLote ? e.lote : "", lote_vencimiento: conLote && e.lote ? e.loteVence : "",
      destino_tipo: e.destino, especie: e.destino === "especie" ? e.especie : "", ubicacion_id: e.destino === "ubicacion" ? e.ubicacion : "",
      lote_id: e.destino === "lote" ? e.loteCeba : "", animal_id: e.destino === "animal" ? e.animal : "",
      pago: e.pago, pagado_en: e.pago === "pagado" ? e.pagadoEn : "", vence: e.pago === "por_pagar" ? e.vence : "", iva_tarifa: e.iva, observaciones: e.observaciones,
    };
    return Object.fromEntries(Object.entries(x).filter(([, v]) => v.trim() !== ""));
  };

  const limpiar = () => {
    setEditando(null);
    setE(inicial(hoy, c.especies, c.ivaDefecto));
    setVuelta((n) => n + 1);
  };

  const guardar = async () => {
    if (falta) return setError(falta);
    if (e.proveedor === NUEVO && !e.proveedorNuevo.trim()) return setError("Escribe el nombre del proveedor nuevo.");
    const x = campos();
    const d = esquemaCompra.safeParse(x);
    if (!d.success) return setError(d.error.issues[0]?.message ?? "Revisa los datos.");
    const problema = revisarCompra(d.data, fincaId, hoy);
    if (problema) return setError(problema);
    const id = editando?.id ?? crypto.randomUUID();
    setGuardando(true);
    try {
      await guardarEnCelular({ id, creadoEn: editando?.creadoEn, tipo: "compra", usuarioId, fincaId, animalId: id, etiqueta: `${d.data.descripcion} · ${dinero(d.data.monto)}`, fecha: d.data.fecha, campos: x });
    } catch {
      setGuardando(false);
      return setError("No se pudo guardar en este celular. Revisa que tenga espacio libre.");
    }
    setGuardando(false);
    toast.exito(enLinea ? "Compra guardada" : MENSAJE_GUARDADO_LOCAL);
    alGuardar();
    limpiar();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const corregir = (r: RegistroCampo) => {
    const x = r.campos ?? {};
    const rubro = (x.rubro as RubroGasto) ?? "";
    const producto = x.producto_id ?? (rubro ? OTRO : "");
    const p = c.productos.find((y) => y.id === producto);
    const cantidad = x.cantidad ?? "";
    const n = leerNumero(cantidad);
    const monto = leerNumero(x.monto ?? "");
    setEditando(r);
    setE({
      ...inicial(hoy, c.especies, null),
      grupo: rubro ? GRUPO_DE[rubro] : "", producto, rubro, descripcion: x.descripcion ?? "", cantidad, unidad: x.unidad ?? "",
      precio: p && n && monto ? textoPrecio(monto / n) : "", monto: p ? "" : (x.monto ?? ""), fecha: x.fecha ?? hoy,
      proveedor: x.proveedor_nuevo ? NUEVO : (x.tercero_id ?? ""), proveedorNuevo: x.proveedor_nuevo ?? "",
      productoVet: x.producto_vet_id ?? "", lote: x.lote_producto ?? "", loteVence: x.lote_vencimiento ?? "",
      destino: (x.destino_tipo as DestinoGasto) ?? "finca", especie: (x.especie as Especie) ?? "", ubicacion: x.ubicacion_id ?? "", loteCeba: x.lote_id ?? "", animal: x.animal_id ?? "",
      pago: (x.pago as EstadoPago) ?? "pagado", pagadoEn: x.pagado_en ?? "", vence: x.vence ?? "", iva: x.iva_tarifa ?? "", observaciones: x.observaciones ?? "",
    });
    setVuelta((v) => v + 1);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!referencia.puede.compras) return <Aviso>Tu rol no registra compras en esta finca.</Aviso>;

  return (
    <div className="space-y-6">
      {editando ? (
        <Aviso tipo="atencion">
          Estás corrigiendo {editando.etiqueta}, que aún no se ha enviado.{" "}
          <button type="button" onClick={limpiar} className="font-semibold text-musgo underline underline-offset-4">Cancelar</button>
        </Aviso>
      ) : null}

      <SelectorTarjetas<GrupoGasto> titulo="¿En qué se gastó?" valor={e.grupo} onCambio={elegirGrupo} opciones={GRUPOS.map((g) => ({ valor: g, etiqueta: ETIQUETA_GRUPO[g], detalle: DETALLE_GRUPO[g], escena: ESCENA_GRUPO_GASTO[g] }))} />

      {e.grupo ? (
        <Campo etiqueta="¿Qué compraste?">
          {(id) => (
            <Selector
              id={id}
              valor={e.producto}
              onCambio={(v) => elegirProducto(String(v))}
              titulo="¿Qué compraste?"
              placeholder="Elegir de la lista"
              opciones={[
                ...delGrupo.map((p) => ({ valor: p.id, etiqueta: p.nombre, detalle: p.unidad ? `Se cuenta en ${p.unidad}` : undefined })),
                { valor: OTRO, etiqueta: "Otra compra (no está en la lista)", detalle: "La describes tú" },
              ]}
            />
          )}
        </Campo>
      ) : null}

      {e.producto === OTRO && e.grupo ? (
        <>
          <SelectorTarjetas<RubroGasto> titulo={`Rubro de ${ETIQUETA_GRUPO[e.grupo].toLowerCase()}`} valor={e.rubro} onCambio={elegirRubro} opciones={RUBROS_DE[e.grupo].filter((r) => r !== "mano_obra").map((r) => ({ valor: r, etiqueta: ETIQUETA_RUBRO[r], escena: ESCENA_RUBRO[r] }))} />
          <Campo etiqueta="¿Qué se compró o se pagó?" ayuda="Una frase corta: «Reparación del cerco», «Flete del concentrado»…">
            {(id) => <input id={id} value={e.descripcion} onChange={(ev) => poner("descripcion", ev.target.value)} maxLength={160} autoComplete="off" className={CLASE_INPUT} />}
          </Campo>
        </>
      ) : null}

      {elegido ? (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Campo etiqueta={`Cuántos ${e.unidad || "unidades"}`}>
              {(id) => <input id={id} value={e.cantidad} onChange={(ev) => poner("cantidad", ev.target.value)} inputMode="decimal" autoComplete="off" placeholder="Ej. 20" className={CLASE_INPUT} />}
            </Campo>
            <Campo etiqueta={precioDeCada(e.unidad)} ayuda={elegido.precio != null ? "Es el último precio que pagaste; cámbialo si subió." : "Solo la primera vez: queda guardado para la próxima."}>
              {(id) => <input id={id} value={e.precio} onChange={(ev) => poner("precio", ev.target.value)} inputMode="decimal" autoComplete="off" placeholder="Ej. 62.500" className={CLASE_INPUT} />}
            </Campo>
          </div>
          {totalLista ? (
            <p className="-mt-2 rounded-2xl bg-lana px-4 py-3 text-[0.9375rem]">
              Total de la compra: <span className="font-display text-lg font-semibold tabular-nums">{dinero(totalLista)}</span>
            </p>
          ) : null}
        </>
      ) : e.producto === OTRO ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Campo etiqueta="Valor total" ayuda={porUnidad ? `${dinero(porUnidad)} por ${e.unidad || "unidad"}` : `En ${moneda.codigo}, lo que costó todo.`}>
            {(id) => <input id={id} value={e.monto} onChange={(ev) => poner("monto", ev.target.value)} inputMode="decimal" autoComplete="off" placeholder="Ej. 1.250.000" className={CLASE_INPUT} />}
          </Campo>
          <Campo etiqueta="Cantidad (opcional)">
            {(id) => <input id={id} value={e.cantidad} onChange={(ev) => poner("cantidad", ev.target.value)} inputMode="decimal" autoComplete="off" placeholder="Ej. 20" className={CLASE_INPUT} />}
          </Campo>
          {e.cantidad.trim() ? (
            <Campo etiqueta="Unidad">
              {(id) => <Selector id={id} valor={e.unidad} onCambio={(v) => poner("unidad", String(v))} titulo="Unidad" placeholder="Sin especificar" permitirVacio opciones={UNIDADES_GASTO.map((u) => ({ valor: u, etiqueta: u }))} />}
            </Campo>
          ) : null}
        </div>
      ) : null}

      {e.producto ? (
        <>
          <Campo etiqueta="Fecha de la compra">
            {(id) => <input id={id} type="date" value={e.fecha} max={hoy} onChange={(ev) => poner("fecha", ev.target.value)} className={CLASE_INPUT} />}
          </Campo>
          <Campo etiqueta="Proveedor (opcional)">
            {(id) => (
              <Selector
                id={id}
                valor={e.proveedor}
                onCambio={(v) => poner("proveedor", String(v))}
                titulo="¿A quién se la compraste?"
                placeholder="Elegir"
                permitirVacio
                opciones={[...c.proveedores.map((t) => ({ valor: t.id, etiqueta: t.nombre })), { valor: NUEVO, etiqueta: "Otro proveedor (no está en la lista)", detalle: "Escribes su nombre" }]}
              />
            )}
          </Campo>
          {e.proveedor === NUEVO ? (
            <Campo etiqueta="Nombre del proveedor" ayuda="Queda en tu lista de proveedores al enviar (si ya existe, se usa el mismo).">
              {(id) => <input id={id} value={e.proveedorNuevo} onChange={(ev) => poner("proveedorNuevo", ev.target.value)} maxLength={120} autoComplete="off" className={CLASE_INPUT} />}
            </Campo>
          ) : null}
        </>
      ) : null}

      {conLote ? (
        <div className="space-y-4 rounded-3xl border border-arena p-4">
          <p className="text-sm text-humo">Con esto el veterinario elige el lote al aplicar el producto: no lo escribe.</p>
          <Campo etiqueta="¿De qué producto veterinario es?" ayuda={c.productosVet.length === 0 ? "Aún no hay productos veterinarios. Créalos con señal en Sanidad → Productos." : undefined}>
            {(id) => <Selector id={id} valor={e.productoVet} onCambio={(v) => poner("productoVet", String(v))} titulo="¿Qué producto veterinario?" placeholder="Elegir producto" permitirVacio={!pideLote} opciones={c.productosVet.map((p) => ({ valor: p.id, etiqueta: p.nombre }))} />}
          </Campo>
          <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
            <Campo etiqueta="Lote" ayuda="Número o nombre del lote, como está en el frasco.">
              {(id) => <input id={id} value={e.lote} onChange={(ev) => poner("lote", ev.target.value)} maxLength={60} autoComplete="off" placeholder="Ej. L2411-07" className={CLASE_INPUT} />}
            </Campo>
            <Campo etiqueta="Vence el lote" ayuda="Opcional.">
              {(id) => <input id={id} type="date" value={e.loteVence} onChange={(ev) => poner("loteVence", ev.target.value)} className={CLASE_INPUT} />}
            </Campo>
          </div>
        </div>
      ) : null}

      {e.producto ? (
        <>
          <SelectorTarjetas<DestinoGasto> titulo="¿A quién se carga?" valor={e.destino} onCambio={(v) => v && poner("destino", v)} opciones={destinos.map((d) => ({ valor: d, etiqueta: ETIQUETA_DESTINO[d], detalle: DETALLE_DESTINO[d], escena: ESCENA_DESTINO_GASTO[d] }))} />
          {e.destino === "especie" ? (
            <SelectorTarjetas<Especie> titulo="¿De cuáles?" valor={e.especie} onCambio={(v) => poner("especie", v)} opciones={c.especies.map((s) => ({ valor: s, etiqueta: s === "caprino" ? "Cabras" : "Ovejas", escena: ESCENA_ESPECIE[s] }))} />
          ) : null}
          {e.destino === "ubicacion" ? (
            <Campo etiqueta="Corral o potrero">
              {(id) => <Selector id={id} valor={e.ubicacion} onCambio={(v) => poner("ubicacion", String(v))} titulo="¿Qué corral o potrero?" placeholder="Elegir" opciones={referencia.ubicaciones.map((u) => ({ valor: u.id, etiqueta: u.nombre }))} />}
            </Campo>
          ) : null}
          {e.destino === "lote" ? (
            <Campo etiqueta="Lote de ceba">
              {(id) => <Selector id={id} valor={e.loteCeba} onCambio={(v) => poner("loteCeba", String(v))} titulo="¿Qué lote?" placeholder="Elegir" opciones={c.lotes.map((l) => ({ valor: l.id, etiqueta: l.nombre }))} />}
            </Campo>
          ) : null}
          {e.destino === "animal" ? (
            <Campo etiqueta="Animal">
              {(id) => <Selector id={id} valor={e.animal} onCambio={(v) => poner("animal", String(v))} titulo="Elegir el animal" placeholder="Elegir el animal" opciones={referencia.animales.map((a) => ({ valor: a.id, etiqueta: etiquetaCampo(a), detalle: a.activo ? undefined : "Ya salió del hato" }))} />}
            </Campo>
          ) : null}

          <SelectorTarjetas<EstadoPago> titulo="¿Ya se pagó?" valor={e.pago} onCambio={(v) => v && poner("pago", v)} opciones={(["pagado", "por_pagar"] as const).map((p) => ({ valor: p, etiqueta: ETIQUETA_PAGO[p], escena: ESCENA_PAGO[p] }))} />
          {e.pago === "pagado" ? (
            <Campo etiqueta="Fecha de pago" ayuda="Si lo dejas en blanco, se toma la fecha de la compra.">
              {(id) => <input id={id} type="date" value={e.pagadoEn} min={e.fecha} max={hoy} onChange={(ev) => poner("pagadoEn", ev.target.value)} className={CLASE_INPUT} />}
            </Campo>
          ) : (
            <Campo etiqueta="Vence el" ayuda="Opcional. Te avisamos en Hoy cuando se pase.">
              {(id) => <input id={id} type="date" value={e.vence} min={e.fecha} onChange={(ev) => poner("vence", ev.target.value)} className={CLASE_INPUT} />}
            </Campo>
          )}

          <CampoIva key={vuelta} total={total ?? null} inicial={leerNumero(e.iva)} onCambio={(t) => setE((p) => (p.iva === t ? p : { ...p, iva: t }))} />

          <Campo etiqueta="Observaciones (opcional)">
            {(id) => <textarea id={id} value={e.observaciones} onChange={(ev) => poner("observaciones", ev.target.value)} rows={2} maxLength={1000} className={`${CLASE_INPUT} py-3`} />}
          </Campo>
          <p className="text-sm text-humo">La factura (foto o PDF) se adjunta con señal, corrigiendo la compra en Hato → Compras.</p>
        </>
      ) : null}

      {falta ? <Aviso tipo="atencion">{falta}</Aviso> : null}
      {error ? <Aviso tipo="error">{error}</Aviso> : null}
      <Boton onClick={guardar} pendiente={guardando} cargando="Guardando…" disabled={falta !== null}>{editando ? "Guardar corrección" : "Guardar compra"}</Boton>

      {hechos.length > 0 ? (
        <section className="space-y-3" aria-labelledby="titulo-compras-hechas">
          <h2 id="titulo-compras-hechas" className="font-display text-xl font-semibold">Registradas en este celular · {hechos.length}</h2>
          <ListaPorTramos
            items={hechos}
            clave={(x) => x.id}
            fila={(x) => (
              <div className="flex min-h-[4.25rem] items-center gap-3 rounded-2xl bg-papel px-3.5 py-2.5 ring-1 ring-arena">
                <span className="min-w-0 flex-1">
                  <span className="block font-bold [overflow-wrap:anywhere]">{x.etiqueta}</span>
                  {x.estado === "error" && x.error ? <span className="block text-sm text-rojo [overflow-wrap:anywhere]">{x.error}</span> : null}
                  {x.estado !== "enviado" ? (
                    <button type="button" onClick={() => corregir(x)} className="mt-0.5 inline-flex min-h-11 items-center text-sm font-semibold text-musgo underline-offset-4 hover:underline">Corregir</button>
                  ) : null}
                </span>
                <InsigniaCampo r={x} />
              </div>
            )}
          />
        </section>
      ) : null}
    </div>
  );
}
