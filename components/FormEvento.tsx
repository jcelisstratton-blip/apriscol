"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { AsistidoPor } from "@/components/AsistidoPor";
import { Boton, clasesBoton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { Chip, FilaDesplazable } from "@/components/FilaDesplazable";
import { Selector } from "@/components/Selector";
import { SelectorTarjetas, type OpcionTarjeta } from "@/components/SelectorTarjetas";
import { SelectorAnimales, type AnimalElegido } from "@/components/SelectorAnimales";
import { crearEvento, editarEvento } from "@/app/(app)/sanidad/actions";
import { sumarDias, formatoFecha } from "@/lib/fechas";
import { ESCENA_EVENTO } from "@/lib/escenas-sanidad";
import { ESCENA_VIA } from "@/lib/escenas-forms-a-sanidad";
import { ESCENA_CAMPO, ESCENA_GENERICA, ESCENA_SI_NO_MEDICAMENTO } from "@/lib/escenas-sanidad-campos";
import { ANESTESIAS, CATEGORIAS, COJERAS, diasSugeridosProxima, ETAPAS, MOTIVOS, REGLAS, type OpcionCampo } from "@/lib/sanidad-campos";
import { ETIQUETA_EVENTO, ETIQUETA_PRODUCTO, ETIQUETA_VIA, TIPOS_EVENTO, UNIDADES_DOSIS, VIAS, textoRetiro } from "@/lib/sanidad";
import type { VeterinarioRef } from "@/lib/veterinarios";
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
  /** Lo propio de cada tipo (ver `lib/sanidad-campos.ts`). */
  categoria?: string | null;
  motivo?: string | null;
  etapa?: string | null;
  dias_tratamiento?: number | null;
  cojera?: number | null;
  concentracion_pct?: number | null;
  minutos?: number | null;
  anestesia?: string | null;
};

/** Un lote de un producto veterinario, tal como lo dejó la compra. */
export type LoteDisponible = { gasto_id: string; producto_id: string; lote: string; vencimiento: string | null; comprado: string };

const NUEVO_PRODUCTO = "otro";
const coma = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n).replace(".", ","));
const entero = (v: string) => (/^\d{1,3}$/.test(v.trim()) ? Number(v) : 0);
const aTarjetas = (grupo: string, opciones: OpcionCampo[]): OpcionTarjeta<string>[] => opciones.map((o) => ({ valor: o.valor, etiqueta: o.etiqueta, detalle: o.detalle, escena: ESCENA_CAMPO[`${grupo}:${o.valor}`] ?? ESCENA_GENERICA }));

/**
 * Registrar lo que se le hizo a uno o varios animales (vacuna, desparasitación, tratamiento, podología, pediluvio, cirugía u otro), o corregir un registro. El
 * formulario se adapta al tipo: cada uno pide lo suyo (contra qué, por qué, cuántos días, qué solución, qué anestesia…), muestra el retiro de la leche y de la
 * carne solo cuando puede haberlo, y propone cuándo volver (refuerzo, revisión, retiro de puntos). Quién lo hizo: el veterinario de la finca u otra persona.
 */
export function FormEvento({
  fincaId,
  especies,
  productos,
  hoy,
  animalFijo,
  animalesIniciales = [],
  datos,
  programaId,
  solicitud,
  veterinarios,
  puedeAgregarVeterinario,
  lotes,
  puedeComprar,
  inventariados = [],
  aplicar = false,
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
  /** Si el evento aplica una programación, su id: los animales quedan como aplicados en ella. */
  programaId?: string;
  /** Solo al crear: identifica la apertura del formulario para ignorar un doble toque. */
  solicitud?: string;
  /** Los veterinarios del equipo: quien aplica o hace un procedimiento suele ser uno de ellos. */
  veterinarios: VeterinarioRef[];
  puedeAgregarVeterinario: boolean;
  /** Los lotes que registró quien compró (`lotes_sanidad`): el lote se elige de aquí, nunca se escribe. */
  lotes: LoteDisponible[];
  /** Los productos que el inventario de bodega ya sigue: al elegir uno, el formulario recuerda anotar la dosis para que se descuente. */
  inventariados?: string[];
  /**
   * «Aplicar la siguiente dosis» o «Aplicar lo programado»: casi todo viene de la vez anterior, así que se muestra como un resumen (con «Cambiar») y solo se piden a la vista
   * la fecha, los animales, la dosis, el lote y quién aplicó. Nada se quita: lo que se guarda es lo mismo, y si algo falta o hay un error, todo se muestra.
   */
  aplicar?: boolean;
  /** Quien puede registrar compras ve el enlace para agregar el lote que falta. */
  puedeComprar: boolean;
}) {
  const editando = Boolean(datos?.id);
  const [estado, enviar, pendiente] = useActionState(editando ? editarEvento : crearEvento, undefined);
  const [, iniciar] = useTransition();

  const [tipo, setTipo] = useState<TipoEvento>(datos?.tipo ?? "vacunacion");
  const [categoria, setCategoria] = useState(datos?.categoria ?? "");
  const [etapa, setEtapa] = useState(datos?.etapa ?? "");
  const [motivo, setMotivo] = useState(datos?.motivo ?? "");
  const [cojera, setCojera] = useState(datos?.cojera == null ? "" : String(datos.cojera));
  const [anestesia, setAnestesia] = useState(datos?.anestesia ?? "");
  const [medicamento, setMedicamento] = useState<"si" | "no">(datos?.producto_id || datos?.producto_nombre ? "si" : "no");
  const [diasTrat, setDiasTrat] = useState(String(datos?.dias_tratamiento ?? 1));
  const [concentracion, setConcentracion] = useState(coma(datos?.concentracion_pct));
  const [minutos, setMinutos] = useState(datos?.minutos == null ? "" : String(datos.minutos));
  const [productoId, setProductoId] = useState<string>(datos?.producto_id ?? (datos?.producto_nombre ? NUEVO_PRODUCTO : ""));
  const [nombreProducto, setNombreProducto] = useState(datos?.producto_id ? "" : (datos?.producto_nombre ?? ""));
  const [fecha, setFecha] = useState(datos?.fecha ?? hoy);
  // Los días de retiro que se ven son los de la etiqueta del producto; lo que se guarda suma los días del tratamiento (el retiro cuenta desde la última dosis).
  const sobrantes = Math.max(0, (datos?.dias_tratamiento ?? 1) - 1);
  const [retiroLeche, setRetiroLeche] = useState(String(datos && datos.retiro_leche_dias > 0 ? Math.max(0, datos.retiro_leche_dias - sobrantes) : 0));
  const [retiroCarne, setRetiroCarne] = useState(String(datos && datos.retiro_carne_dias > 0 ? Math.max(0, datos.retiro_carne_dias - sobrantes) : 0));
  const [unidad, setUnidad] = useState(datos?.unidad_dosis ?? "");
  const [via, setVia] = useState<ViaAplicacion | "">(datos?.via ?? "");
  const [proxima, setProxima] = useState(datos?.proxima_fecha ?? "");
  const [loteGasto, setLoteGasto] = useState(datos?.id && datos.lote_producto ? "actual" : "");
  const [animales, setAnimales] = useState<AnimalElegido[]>(animalesIniciales);
  const [cambiando, setCambiando] = useState(false);

  const r = REGLAS[tipo];
  const conMedicamento = tipo === "podologia" && medicamento === "si";
  const conProducto = r.producto === "requerido" || r.producto === "opcional" || conMedicamento;
  const retiroVisible = r.retiro === "abierto" || (r.retiro === "segun_medicamento" && conMedicamento);
  const retiroPlegable = r.retiro === "plegado";
  const hayRetiro = retiroVisible || retiroPlegable;
  const dosisVisible = conProducto && r.dosisVisible;
  const cantidadBano = conProducto && Boolean(r.cantidadBano) && productoId !== "";
  const detallesDeProducto = conProducto && !r.dosisVisible && !r.cantidadBano;
  // Si el producto está en el inventario, la dosis no se esconde: sin ella la aplicación no descuenta.
  const seguido = productoId !== "" && inventariados.includes(productoId);
  const detallesAbiertos = Boolean(datos && (datos.costo || (detallesDeProducto && (datos.dosis || datos.via)))) || (seguido && detallesDeProducto);
  const lotesDelProducto = lotes.filter((l) => l.producto_id === productoId);
  const retiroAbierto = Boolean(datos && (datos.retiro_leche_dias > 0 || datos.retiro_carne_dias > 0));

  // Un tratamiento de varios días: el retiro empieza después de la última dosis.
  const dt = r.diasTratamiento ? Math.max(1, Math.min(60, entero(diasTrat) || 1)) : 1;
  const extraDias = dt - 1;
  const etiquetaLeche = entero(retiroLeche);
  const etiquetaCarne = entero(retiroCarne);
  const totalLeche = hayRetiro && (retiroVisible || etiquetaLeche > 0) && etiquetaLeche > 0 ? etiquetaLeche + extraDias : 0;
  const totalCarne = hayRetiro && (retiroVisible || etiquetaCarne > 0) && etiquetaCarne > 0 ? etiquetaCarne + extraDias : 0;
  const frasesRetiro = textoRetiro(fecha, totalLeche, totalCarne);
  const ultimoDia = dt > 1 ? sumarDias(fecha, extraDias) : null;
  const faltanAnimales = !animalFijo && animales.length === 0;
  // Al aplicar lo que viene de antes se resume lo conocido; si falta el producto o la categoría, o hubo un error al guardar, se muestra todo para poder completarlo.
  const productoListo = !conProducto || (productoId !== "" && (productoId !== NUEVO_PRODUCTO || nombreProducto.trim() !== ""));
  const categoriaLista = !CATEGORIAS[tipo] || categoria !== "";
  // Los campos obligatorios que quedarían escondidos deben venir llenos: el navegador no puede avisar de un campo que no se ve.
  const solucionLista = !r.solucion || (concentracion.trim() !== "" && minutos.trim() !== "");
  const resumible = aplicar && !editando && productoListo && categoriaLista && solucionLista;
  const compacto = resumible && !cambiando && !estado?.error;
  const nombreDelProducto = productos.find((p) => p.id === productoId)?.nombre ?? nombreProducto;
  const detalleResumen = [CATEGORIAS[tipo]?.find((o) => o.valor === categoria)?.etiqueta, via ? `vía ${ETIQUETA_VIA[via].toLowerCase()}` : null].filter(Boolean).join(" · ");

  const elegirProducto = (v: string) => {
    setProductoId(v);
    // El lote es de un producto: al cambiar de producto se elige de nuevo (con un solo lote disponible, ya queda elegido).
    const delProducto = lotes.filter((l) => l.producto_id === v);
    setLoteGasto(delProducto.length === 1 ? delProducto[0].gasto_id : datos?.id && datos.lote_producto && v === datos.producto_id ? "actual" : "");
    const p = productos.find((x) => x.id === v);
    if (!p) return;
    // El catálogo propone lo habitual del producto (retiro y unidad); todo se puede cambiar en esta aplicación.
    setRetiroLeche(String(p.retiro_leche_dias));
    setRetiroCarne(String(p.retiro_carne_dias));
    if (p.unidad_dosis) setUnidad(p.unidad_dosis);
  };

  const elegirEtapa = (v: string) => {
    setEtapa(v);
    // Primera dosis → refuerzo en 4 semanas; refuerzo o revacunación → dentro de un año. Se propone solo si todavía no se eligió una fecha.
    const sugeridos = diasSugeridosProxima(tipo, v);
    if (sugeridos && !proxima) setProxima(sumarDias(fecha, sugeridos));
  };

  const cambiarTipo = (t: TipoEvento) => {
    setTipo(t);
    // Cada tipo tiene sus propias opciones: lo elegido en otro tipo no aplica.
    setCategoria("");
    setEtapa("");
    setMotivo("");
    setCojera("");
    setAnestesia("");
    setProxima("");
    if (t === "pediluvio" || t === "podologia") {
      setRetiroLeche("0");
      setRetiroCarne("0");
    }
  };

  // Se envía con onSubmit (no con `action`): si hay un error, lo que la persona escribió no se borra.
  const alEnviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    iniciar(() => enviar(formData));
  };

  const vet = r.veterinario;

  return (
    <form onSubmit={alEnviar} className="space-y-5">
      {datos?.id ? <input type="hidden" name="evento_id" value={datos.id} /> : <input type="hidden" name="client_request_id" value={solicitud ?? ""} />}
      {programaId ? <input type="hidden" name="programa_id" value={programaId} /> : null}
      {animalFijo ? (
        <>
          <input type="hidden" name="animal" value={animalFijo.id} />
          <input type="hidden" name="animal_id" value={animalFijo.id} />
        </>
      ) : null}
      <input type="hidden" name="retiro_leche_dias" value={String(totalLeche)} />
      <input type="hidden" name="retiro_carne_dias" value={String(totalCarne)} />

      {resumible ? (
        <div className="space-y-2 rounded-3xl bg-lana p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold [overflow-wrap:anywhere]">
                {ETIQUETA_EVENTO[tipo]}
                {nombreDelProducto ? ` · ${nombreDelProducto}` : ""}
              </p>
              {detalleResumen ? <p className="text-sm text-humo [overflow-wrap:anywhere]">{detalleResumen}</p> : null}
            </div>
            <button type="button" onClick={() => setCambiando((v) => !v)} aria-expanded={cambiando} className="inline-flex min-h-11 shrink-0 items-center rounded-full px-3 text-sm font-semibold text-musgo ring-1 ring-arena">
              {cambiando ? "Ocultar" : "Cambiar"}
            </button>
          </div>
          {hayRetiro ? (
            <p className="text-sm">
              {etiquetaLeche > 0 || etiquetaCarne > 0
                ? `Retiro: leche ${etiquetaLeche} ${etiquetaLeche === 1 ? "día" : "días"} · carne ${etiquetaCarne} ${etiquetaCarne === 1 ? "día" : "días"}`
                : "Sin retiro de leche ni de carne"}
            </p>
          ) : null}
          <p className="text-xs text-humo">Son los mismos datos de la vez anterior. Cámbialos solo si hoy es distinto.</p>
        </div>
      ) : null}

      <div className={compacto ? "hidden" : "space-y-5"}>
      <Campo etiqueta="¿Qué se hizo?">
        {(id) => (
          <SelectorTarjetas
            id={id}
            nombre="tipo"
            valor={tipo}
            onCambio={(v) => v && cambiarTipo(v)}
            titulo="¿Qué se hizo?"
            opciones={TIPOS_EVENTO.map((t) => ({ valor: t, etiqueta: ETIQUETA_EVENTO[t], escena: ESCENA_EVENTO[t] }))}
          />
        )}
      </Campo>

      <Aviso tipo="info">{r.ayuda}</Aviso>

      {CATEGORIAS[tipo] ? (
        <Campo etiqueta={r.tituloCategoria ?? "¿Qué fue?"}>
          {(id) => <SelectorTarjetas id={id} nombre="categoria" valor={categoria} onCambio={setCategoria} titulo={r.tituloCategoria ?? "¿Qué fue?"} opciones={aTarjetas(tipo, CATEGORIAS[tipo] ?? [])} />}
        </Campo>
      ) : null}
      {tipo === "pediluvio" && categoria === "cobre" ? <Aviso tipo="atencion">El sulfato de cobre no se recomienda en ovejas: puede ser tóxico si lo toman. Si tienes ovejas, consulta con tu veterinario.</Aviso> : null}
      {tipo === "cirugia" && (categoria === "castracion" || categoria === "descorne") ? <Aviso tipo="atencion">Antes de castrar o descornar conviene tener al animal vacunado contra el tétanos. Si no lo está, pregunta a tu veterinario.</Aviso> : null}

      {r.etapa ? (
        <Campo etiqueta="¿Qué dosis es?">
          {(id) => <SelectorTarjetas id={id} nombre="etapa" valor={etapa} onCambio={elegirEtapa} titulo="¿Qué dosis es?" opciones={aTarjetas("etapa", ETAPAS)} />}
        </Campo>
      ) : null}
      {r.motivo ? (
        <Campo etiqueta="¿Por qué se desparasita?">
          {(id) => <SelectorTarjetas id={id} nombre="motivo" valor={motivo} onCambio={setMotivo} titulo="¿Por qué se desparasita?" opciones={aTarjetas("motivo", MOTIVOS)} />}
        </Campo>
      ) : null}
      {r.cojera ? (
        <Campo etiqueta="¿Cómo caminaba antes?" ayuda="Opcional. Sirve para ver si mejora.">
          {(id) => <SelectorTarjetas id={id} nombre="cojera" valor={cojera} onCambio={setCojera} titulo="Cojera" permitirVacio etiquetaVacio="No lo revisé" opciones={aTarjetas("cojera", COJERAS)} />}
        </Campo>
      ) : null}
      {r.anestesia ? (
        <Campo etiqueta="¿Con qué anestesia?">
          {(id) => <SelectorTarjetas id={id} nombre="anestesia" valor={anestesia} onCambio={setAnestesia} titulo="Anestesia" opciones={aTarjetas("anestesia", ANESTESIAS)} />}
        </Campo>
      ) : null}
      {r.solucion ? (
        <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
          <Campo etiqueta="Concentración (%)" ayuda={categoria === "zinc" ? "El sulfato de zinc suele usarse al 10 %." : "Revisa la etiqueta."}>
            {(id) => <input id={id} name="concentracion_pct" value={concentracion} onChange={(e) => setConcentracion(e.target.value)} inputMode="decimal" autoComplete="off" required placeholder="Ej. 10" className={CLASE_INPUT} />}
          </Campo>
          <Campo etiqueta="Minutos en el baño" ayuda="Lo habitual: 5 a 15 minutos.">
            {(id) => <input id={id} name="minutos" value={minutos} onChange={(e) => setMinutos(e.target.value)} inputMode="numeric" pattern="[0-9]*" maxLength={3} autoComplete="off" required placeholder="Ej. 10" className={CLASE_INPUT} />}
          </Campo>
        </div>
      ) : null}

      {tipo === "podologia" ? (
        <Campo etiqueta="¿Se aplicó un medicamento?" ayuda="El recorte solo no deja retiro. Un antibiótico o un spray sí puede dejarlo.">
          {(id) => (
            <SelectorTarjetas
              id={id}
              valor={medicamento}
              onCambio={(v) => v && setMedicamento(v as "si" | "no")}
              titulo="¿Se aplicó un medicamento?"
              opciones={[
                { valor: "no", etiqueta: "No", detalle: "Solo se recortó o se limpió.", escena: ESCENA_SI_NO_MEDICAMENTO.no },
                { valor: "si", etiqueta: "Sí", detalle: "Se aplicó un producto.", escena: ESCENA_SI_NO_MEDICAMENTO.si },
              ]}
            />
          )}
        </Campo>
      ) : null}

      {conProducto ? (
        <>
          <Campo etiqueta={r.producto === "requerido" || conMedicamento ? "Producto aplicado" : "Producto (opcional)"} ayuda={productos.length === 0 ? "Aún no tienes productos guardados: escribe el nombre. Puedes guardarlos en Sanidad → Productos." : undefined}>
            {(id) => (
              <Selector
                id={id}
                nombre="producto_id"
                valor={productoId}
                onCambio={(v) => elegirProducto(String(v))}
                titulo="¿Qué producto?"
                placeholder={r.producto === "requerido" || conMedicamento ? "Elegir producto" : "Sin producto"}
                permitirVacio={r.producto !== "requerido" && !conMedicamento}
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
        </>
      ) : null}

      {cantidadBano ? (
        <>
          <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
            <Campo etiqueta="Producto usado en el baño" ayuda="Opcional. Lo que se gastó en total, no por animal.">
              {(id) => <input id={id} name="dosis" defaultValue={coma(datos?.dosis)} inputMode="decimal" autoComplete="off" className={CLASE_INPUT} placeholder="Ej. 500" />}
            </Campo>
            <Campo etiqueta="Unidad">
              {(id) => <Selector id={id} nombre="unidad_dosis" valor={unidad} onCambio={(v) => setUnidad(String(v))} titulo="Unidad" placeholder="Sin especificar" permitirVacio opciones={UNIDADES_DOSIS.map((u) => ({ valor: u, etiqueta: u }))} />}
            </Campo>
          </div>
          {seguido ? <Aviso tipo="info">Este producto está en tu inventario: anota cuánto se gastó para que se descuente.</Aviso> : null}
        </>
      ) : null}

      </div>

      {dosisVisible ? (
        <>
          <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
            <Campo etiqueta="Dosis" ayuda={tipo === "desparasitacion" ? "Según el peso del animal." : undefined}>
              {(id) => <input id={id} name="dosis" defaultValue={coma(datos?.dosis)} required={r.dosisObligatoria} inputMode="decimal" autoComplete="off" className={CLASE_INPUT} placeholder="Ej. 2,5" />}
            </Campo>
            <Campo etiqueta="Unidad">
              {(id) => <Selector id={id} nombre="unidad_dosis" valor={unidad} onCambio={(v) => setUnidad(String(v))} titulo="Unidad de la dosis" placeholder="Sin especificar" permitirVacio opciones={UNIDADES_DOSIS.map((u) => ({ valor: u, etiqueta: u }))} />}
            </Campo>
          </div>
          <div className={compacto ? "hidden" : undefined}>
            <Campo etiqueta="Vía">
              {(id) => (
                <SelectorTarjetas
                  id={id}
                  nombre="via"
                  valor={via}
                  onCambio={(v) => setVia(v as ViaAplicacion | "")}
                  titulo="¿Por dónde se aplicó?"
                  permitirVacio={!r.dosisObligatoria}
                  opciones={VIAS.map((v) => ({ valor: v, etiqueta: ETIQUETA_VIA[v], escena: ESCENA_VIA[v] }))}
                />
              )}
            </Campo>
          </div>
        </>
      ) : null}

      {r.diasTratamiento ? (
        <Campo etiqueta="¿Cuántos días dura el tratamiento?" ayuda={ultimoDia ? `La última dosis es el ${formatoFecha(ultimoDia, { day: "numeric", month: "long" })}. El retiro cuenta desde ese día.` : "Con un solo día, déjalo en 1."}>
          {(id) => <input id={id} name="dias_tratamiento" value={diasTrat} onChange={(e) => setDiasTrat(e.target.value)} inputMode="numeric" pattern="[0-9]*" maxLength={2} autoComplete="off" className={CLASE_INPUT} />}
        </Campo>
      ) : null}

      {r.diagnostico ? (
        <Campo etiqueta={r.diagnostico.etiqueta} ayuda={r.diagnostico.ayuda}>
          {(id) => <input id={id} name="diagnostico" defaultValue={datos?.diagnostico ?? ""} required={r.diagnostico?.obligatorio} maxLength={300} autoComplete="off" className={CLASE_INPUT} />}
        </Campo>
      ) : null}

      <Campo etiqueta="Fecha">
        {(id) => <input id={id} name="fecha" type="date" value={fecha} max={hoy} onChange={(e) => setFecha(e.target.value)} required className={CLASE_INPUT} />}
      </Campo>

      {animalFijo ? null : (
        <Campo etiqueta={tipo === "pediluvio" ? "Animales que pasaron por el baño" : "Animales"}>
          {() => <SelectorAnimales fincaId={fincaId} especies={especies} valor={animales} onCambio={setAnimales} />}
        </Campo>
      )}

      <div className={compacto ? "hidden" : "space-y-5"}>
      {retiroVisible ? (
        <div className="space-y-3 rounded-3xl border border-arena p-4">
          <p className="font-semibold">Retiro</p>
          <p className="-mt-2 text-[0.8125rem] text-humo">Días que no sirve la leche ni la carne después de la última dosis. Déjalo en 0 si no tiene. {r.ayudaRetiro}</p>
          <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
            <Campo etiqueta="Leche (días)">
              {(id) => <input id={id} value={retiroLeche} onChange={(e) => setRetiroLeche(e.target.value)} inputMode="numeric" pattern="[0-9]*" maxLength={3} autoComplete="off" className={CLASE_INPUT} />}
            </Campo>
            <Campo etiqueta="Carne (días)">
              {(id) => <input id={id} value={retiroCarne} onChange={(e) => setRetiroCarne(e.target.value)} inputMode="numeric" pattern="[0-9]*" maxLength={3} autoComplete="off" className={CLASE_INPUT} />}
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
      ) : null}
      {retiroPlegable ? (
        <details open={retiroAbierto} className="group rounded-3xl border border-arena p-4">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between font-semibold">
            <span className="min-w-0">¿Tiene retiro de leche o de carne?</span>
            <span className="shrink-0 pl-3 text-sm font-medium text-humo group-open:hidden">Mostrar</span>
            <span className="hidden shrink-0 pl-3 text-sm font-medium text-humo group-open:inline">Ocultar</span>
          </summary>
          <div className="mt-3 space-y-3">
            <p className="text-[0.8125rem] text-humo">{r.ayudaRetiro}</p>
            <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
              <Campo etiqueta="Leche (días)">
                {(id) => <input id={id} value={retiroLeche} onChange={(e) => setRetiroLeche(e.target.value)} inputMode="numeric" pattern="[0-9]*" maxLength={3} autoComplete="off" className={CLASE_INPUT} />}
              </Campo>
              <Campo etiqueta="Carne (días)">
                {(id) => <input id={id} value={retiroCarne} onChange={(e) => setRetiroCarne(e.target.value)} inputMode="numeric" pattern="[0-9]*" maxLength={3} autoComplete="off" className={CLASE_INPUT} />}
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
        </details>
      ) : null}
      </div>
      {tipo === "pediluvio" ? <Aviso tipo="info">Si el producto que usaste indica retiro en la etiqueta, regístralo como «Tratamiento».</Aviso> : null}

      <div className="space-y-2 rounded-3xl border border-arena p-4">
        <Campo etiqueta={r.proxima.etiqueta} ayuda={`Opcional. ${r.proxima.ayuda} Te lo recordamos en Sanidad y en Hoy cuando se acerque.`}>
          {(id) => <input id={id} name="proxima_fecha" type="date" value={proxima} min={sumarDias(fecha, 1)} onChange={(e) => setProxima(e.target.value)} className={CLASE_INPUT} />}
        </Campo>
        <FilaDesplazable>
          {r.proxima.chips.map((c) => (
            <Chip key={c.dias} activo={proxima === sumarDias(fecha, c.dias)} onClick={() => setProxima(sumarDias(fecha, c.dias))}>
              En {c.texto}
            </Chip>
          ))}
          {proxima ? <Chip activo={false} onClick={() => setProxima("")}>Sin fecha</Chip> : null}
        </FilaDesplazable>
      </div>

      {vet === "no" ? (
        <Campo etiqueta={r.etiquetaVeterinario} ayuda="Opcional.">
          {(id) => <input id={id} name="responsable" defaultValue={datos?.responsable ?? ""} maxLength={120} autoComplete="off" className={CLASE_INPUT} />}
        </Campo>
      ) : (
        <AsistidoPor nombre="responsable" etiqueta={r.etiquetaVeterinario} ayuda={vet === "requerido" ? undefined : "Opcional."} veterinarios={veterinarios} puedeAgregar={puedeAgregarVeterinario} inicial={datos?.responsable} requerido={vet === "requerido"} />
      )}

      {conProducto && r.lote && (productoId !== NUEVO_PRODUCTO && productoId !== "" ? true : Boolean(datos?.id && datos.lote_producto)) ? (
        <div className="space-y-3 rounded-3xl border border-arena p-4">
          {puedeComprar ? (
            <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
              <Campo etiqueta="Lote del producto" ayuda="Escribe el número o nombre del lote, como está en el frasco o la caja.">
                {(id) => <input id={id} name="lote_producto" defaultValue={datos?.lote_producto ?? ""} maxLength={60} autoComplete="off" className={CLASE_INPUT} placeholder="Número o nombre del lote" />}
              </Campo>
              <Campo etiqueta="Vence el lote" ayuda="Opcional.">
                {(id) => <input id={id} name="fecha_vencimiento" type="date" defaultValue={datos?.fecha_vencimiento ?? ""} className={CLASE_INPUT} />}
              </Campo>
            </div>
          ) : (
            <Campo etiqueta="Lote del producto" ayuda="Se elige de los lotes que el administrador registró al comprar. Sirve para rastrear el producto si hay un problema.">
              {(id) => (
                <Selector
                  id={id}
                  nombre="lote_gasto_id"
                  valor={loteGasto}
                  onCambio={(v) => setLoteGasto(String(v))}
                  titulo="¿Qué lote usaste?"
                  placeholder={lotesDelProducto.length === 0 && !(datos?.id && datos.lote_producto) ? "No hay lotes registrados" : "Elegir lote"}
                  permitirVacio
                  opciones={[
                    ...(datos?.id && datos.lote_producto && (productoId === datos.producto_id || productoId === NUEVO_PRODUCTO || productoId === "")
                      ? [{ valor: "actual", etiqueta: datos.lote_producto, detalle: `El que ya tenía el registro${datos.fecha_vencimiento ? ` · vence ${formatoFecha(datos.fecha_vencimiento, { day: "numeric", month: "short", year: "numeric" })}` : ""}` }]
                      : []),
                    ...lotesDelProducto.map((l) => ({ valor: l.gasto_id, etiqueta: l.lote, detalle: `Comprado el ${formatoFecha(l.comprado, { day: "numeric", month: "short", year: "numeric" })}${l.vencimiento ? ` · vence ${formatoFecha(l.vencimiento, { day: "numeric", month: "short", year: "numeric" })}` : ""}` })),
                  ]}
                />
              )}
            </Campo>
          )}
          {!puedeComprar && lotesDelProducto.length === 0 && productoId !== NUEVO_PRODUCTO && productoId !== "" ? (
            <Aviso tipo="atencion">
              Este producto todavía no tiene lotes registrados. Pídele al administrador que registre el lote al comprarlo.
            </Aviso>
          ) : null}
        </div>
      ) : null}


      <details open={detallesAbiertos} className="group rounded-3xl border border-arena p-4">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between font-semibold">
          <span className="min-w-0">{detallesDeProducto ? "Más detalles (dosis, costo)" : "Más detalles (costo)"}</span>
          <span className="shrink-0 pl-3 text-sm font-medium text-humo group-open:hidden">Mostrar</span>
          <span className="hidden shrink-0 pl-3 text-sm font-medium text-humo group-open:inline">Ocultar</span>
        </summary>
        <div className="mt-4 space-y-5">
          {detallesDeProducto ? (
            <>
              {seguido ? <Aviso tipo="info">Este producto está en tu inventario: anota la dosis y las unidades para que se descuente.</Aviso> : null}
              <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
                <Campo etiqueta="Dosis">
                  {(id) => <input id={id} name="dosis" defaultValue={coma(datos?.dosis)} inputMode="decimal" autoComplete="off" className={CLASE_INPUT} placeholder="Ej. 2,5" />}
                </Campo>
                <Campo etiqueta="Unidad">
                  {(id) => <Selector id={id} nombre="unidad_dosis" valor={unidad} onCambio={(v) => setUnidad(String(v))} titulo="Unidad de la dosis" placeholder="Sin especificar" permitirVacio opciones={UNIDADES_DOSIS.map((u) => ({ valor: u, etiqueta: u }))} />}
                </Campo>
              </div>
              <Campo etiqueta="Vía">
                {(id) => <SelectorTarjetas id={id} nombre="via" valor={via} onCambio={(v) => setVia(v as ViaAplicacion | "")} titulo="¿Por dónde se aplicó?" permitirVacio opciones={VIAS.map((v) => ({ valor: v, etiqueta: ETIQUETA_VIA[v], escena: ESCENA_VIA[v] }))} />}
              </Campo>
            </>
          ) : null}
          <Campo etiqueta="Costo" ayuda="Opcional, en pesos.">
            {(id) => <input id={id} name="costo" defaultValue={coma(datos?.costo)} inputMode="decimal" autoComplete="off" className={CLASE_INPUT} placeholder="0" />}
          </Campo>
        </div>
      </details>

      <Campo etiqueta={r.etiquetaObservaciones} ayuda="Opcional.">
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
