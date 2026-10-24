"use client";

import { useMemo, useState, useTransition } from "react";
import { Download, RotateCcw } from "lucide-react";
import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { Boton, clasesBoton } from "@/components/Boton";
import { CLASE_INPUT } from "@/components/Campo";
import { Segmentado } from "@/components/Segmentado";
import { FilaTarjetas, TarjetaOpcion } from "@/components/TarjetaOpcion";
import { Tarjeta } from "@/components/Tarjeta";
import { useToast } from "@/components/Toast";
import { ESCENA_ENFOQUE, ESCENA_PESTANA_PROYECCION } from "@/lib/escenas-proyecciones";
import { leerNumero } from "@/lib/numeros";
import type { BaseProyeccion, Procedencia } from "@/lib/proyeccion/base";
import type { Entrada } from "@/lib/proyeccion/analisis";
import type { EscenarioGuardado } from "@/lib/proyeccion/escenarios";
import { NOMBRE_ESCENARIO_BASE } from "@/lib/proyeccion/escenarios";
import { porAnio, simular, type Aviso as AvisoProyeccion, type Estacion, type Mes } from "@/lib/proyeccion/motor";
import {
  aplicarAjustes,
  DEFINICIONES,
  enRango,
  ETIQUETA_GRUPO_SUPUESTO,
  ETIQUETA_ORIGEN,
  GRUPOS_SUPUESTO,
  HORIZONTE_DEFECTO,
  HORIZONTES,
  type Ajustes,
  type ClaveSupuesto,
  type DefinicionSupuesto,
  type Supuestos,
} from "@/lib/proyeccion/supuestos";
import {
  columnasAlimento,
  columnasDinero,
  columnasHato,
  etiquetaMes,
  formatear,
  lineasResumen,
  NOTA_ENFOQUE,
  type ColumnaMes,
  type Enfoque,
} from "@/lib/proyeccion/vista";
import { BarraEscenarios } from "./BarraEscenarios";
import { Comparar } from "./Comparar";
import { Riesgos } from "./Riesgos";
import { guardarEscenario } from "./actions";

type Pestana = "resumen" | "hato" | "alimento" | "dinero" | "comparar" | "riesgos" | "supuestos";

const PESTANAS: { valor: Pestana; etiqueta: string; detalle: string }[] = [
  { valor: "resumen", etiqueta: "Resumen", detalle: "Año por año" },
  { valor: "hato", etiqueta: "Hato", detalle: "Animales mes a mes" },
  { valor: "alimento", etiqueta: "Alimento", detalle: "Lo que se come" },
  { valor: "dinero", etiqueta: "Dinero", detalle: "Lo que entra y sale" },
  { valor: "comparar", etiqueta: "Comparar", detalle: "Tus escenarios lado a lado" },
  { valor: "riesgos", etiqueta: "Riesgos", detalle: "Qué tan firme es" },
  { valor: "supuestos", etiqueta: "Supuestos", detalle: "Cambia los números" },
];

const ENFOQUES: { valor: Enfoque; etiqueta: string; detalle: string }[] = [
  { valor: "todo", etiqueta: "Todo", detalle: "Carne y leche juntas" },
  { valor: "carne", etiqueta: "Carne", detalle: "Animales que se venden" },
  { valor: "leche", etiqueta: "Leche", detalle: "Litros y ordeño" },
];

const SUFIJO: Record<DefinicionSupuesto["unidad"], string> = { n: "", pct: "%", meses: "meses", kg: "kg", pesos: "$", litros: "litros", kg_ms: "kg al día" };

export type PropsProyecciones = {
  hoy: string;
  base: BaseProyeccion["base"];
  procedencia: BaseProyeccion["procedencia"];
  inicio: BaseProyeccion["inicio"];
  hato: BaseProyeccion["hato"];
  gestacionDias: number;
  estacion: Estacion;
  escenarios: EscenarioGuardado[];
  activoInicial: string | null;
  puedeGuardar: boolean;
};

const mismos = (a: Ajustes, b: Ajustes) => {
  const ka = Object.keys(a) as ClaveSupuesto[];
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k]);
};

const entrada = (d: DefinicionSupuesto, n: number) => new Intl.NumberFormat("es-CO", { maximumFractionDigits: d.decimales, useGrouping: Math.abs(n) >= 10000 }).format(n);

export function Proyecciones(p: PropsProyecciones) {
  const toast = useToast();
  const [pendiente, empezar] = useTransition();
  const [pestana, setPestana] = useState<Pestana>("resumen");
  const [enfoque, setEnfoque] = useState<Enfoque>("todo");
  const [escenarios, setEscenarios] = useState<EscenarioGuardado[]>(p.escenarios);
  const [activoId, setActivoId] = useState<string | null>(p.activoInicial);
  const activo = escenarios.find((e) => e.id === activoId) ?? null;
  const [horizonte, setHorizonte] = useState<number>(activo?.horizonte ?? HORIZONTE_DEFECTO);
  const [ajustes, setAjustes] = useState<Ajustes>(activo?.ajustes ?? {});
  const [borradores, setBorradores] = useState<Partial<Record<ClaveSupuesto, string>>>({});
  const guardados = { ajustes: activo?.ajustes ?? {}, horizonte: activo?.horizonte ?? HORIZONTE_DEFECTO };

  const supuestos: Supuestos = useMemo(() => aplicarAjustes(p.base, ajustes), [p.base, ajustes]);
  const analisis: Entrada = useMemo(() => ({ inicio: p.inicio, horizonte, gestacionDias: p.gestacionDias, estacion: p.estacion }), [p.inicio, horizonte, p.gestacionDias, p.estacion]);
  const proyeccion = useMemo(() => simular(analisis.inicio, supuestos, horizonte, analisis.gestacionDias, analisis.estacion), [analisis, supuestos, horizonte]);
  const bloques = useMemo(() => porAnio(proyeccion), [proyeccion]);
  const sinCambios = mismos(ajustes, guardados.ajustes) && horizonte === guardados.horizonte;
  const sinHato = p.hato.total === 0;

  function cambiar(def: DefinicionSupuesto, texto: string) {
    setBorradores((b) => ({ ...b, [def.clave]: texto }));
    const n = leerNumero(texto);
    if (n === null || !enRango(def.clave, n)) return;
    setAjustes((a) => {
      const siguiente = { ...a };
      if (n === p.base[def.clave]) delete siguiente[def.clave];
      else siguiente[def.clave] = n;
      return siguiente;
    });
  }

  function volverAlValor(clave: ClaveSupuesto) {
    setAjustes((a) => {
      const siguiente = { ...a };
      delete siguiente[clave];
      return siguiente;
    });
    setBorradores((b) => {
      const siguiente = { ...b };
      delete siguiente[clave];
      return siguiente;
    });
  }

  function descartar() {
    setAjustes(guardados.ajustes);
    setHorizonte(guardados.horizonte);
    setBorradores({});
  }

  function recordar(e: EscenarioGuardado) {
    setEscenarios((lista) => (lista.some((x) => x.id === e.id) ? lista.map((x) => (x.id === e.id ? e : x)) : [...lista, e]));
    setActivoId(e.id);
  }

  function guardar() {
    empezar(async () => {
      const r = await guardarEscenario({ id: activoId, nombre: NOMBRE_ESCENARIO_BASE, ajustes, horizonte });
      if (r.ok) {
        recordar(r.escenario);
        toast.exito("Cambios guardados");
      } else toast.error(r.error);
    });
  }

  /** Crea un escenario nuevo con lo que hay en pantalla; devuelve el mensaje de error si no se pudo. */
  async function crear(nombre: string): Promise<string | null> {
    const r = await guardarEscenario({ id: null, nombre, ajustes, horizonte });
    if (!r.ok) return r.error;
    recordar(r.escenario);
    return null;
  }

  function elegir(id: string | null) {
    const e = escenarios.find((x) => x.id === id) ?? null;
    setActivoId(e?.id ?? null);
    setAjustes(e?.ajustes ?? {});
    setHorizonte(e?.horizonte ?? HORIZONTE_DEFECTO);
    setBorradores({});
  }

  function quitar(id: string) {
    const restantes = escenarios.filter((x) => x.id !== id);
    setEscenarios(restantes);
    const siguiente = restantes[0] ?? null;
    setActivoId(siguiente?.id ?? null);
    setAjustes(siguiente?.ajustes ?? {});
    setHorizonte(siguiente?.horizonte ?? HORIZONTE_DEFECTO);
    setBorradores({});
  }

  const direccionExcel = `/proyecciones/exportar?h=${horizonte}&a=${encodeURIComponent(JSON.stringify(ajustes))}`;
  const verEnfoque = pestana === "resumen" || pestana === "hato" || pestana === "alimento" || pestana === "dinero";

  return (
    <div className="space-y-4">
      <FilaTarjetas etiqueta="Secciones">
        {PESTANAS.map((t) => (
          <TarjetaOpcion key={t.valor} escena={ESCENA_PESTANA_PROYECCION[t.valor]} titulo={t.etiqueta} detalle={t.detalle} activo={pestana === t.valor} onClick={() => setPestana(t.valor)} />
        ))}
      </FilaTarjetas>

      <BarraEscenarios
        escenarios={escenarios}
        activoId={activoId}
        hayCambios={!sinCambios}
        puedeGuardar={p.puedeGuardar}
        alElegir={elegir}
        alCrear={crear}
        alRenombrar={(id, nombre) => setEscenarios((l) => l.map((x) => (x.id === id ? { ...x, nombre } : x)))}
        alEliminar={quitar}
      />

      <div className="space-y-3 lg:flex lg:items-end lg:justify-between lg:gap-6 lg:space-y-0">
        <div className="min-w-0 space-y-1.5 lg:w-80">
          <p className="text-sm font-semibold">Hasta cuándo</p>
          <Segmentado etiqueta="Meses a proyectar" valor={String(horizonte)} opciones={HORIZONTES.map((h) => ({ valor: String(h), etiqueta: `${h} meses` }))} onCambio={(v) => setHorizonte(Number(v))} />
        </div>
        <a href={direccionExcel} download className={`${clasesBoton("secundario")} lg:w-auto lg:px-6`}>
          <Download className="size-5" strokeWidth={2} aria-hidden="true" /> Descargar en Excel
        </a>
      </div>

      {verEnfoque ? (
        <FilaTarjetas etiqueta="Qué quieres ver">
          {ENFOQUES.map((e) => (
            <TarjetaOpcion key={e.valor} escena={ESCENA_ENFOQUE[e.valor]} titulo={e.etiqueta} detalle={e.detalle} activo={enfoque === e.valor} onClick={() => setEnfoque(e.valor)} />
          ))}
        </FilaTarjetas>
      ) : null}

      {!sinCambios ? (
        <Aviso tipo="atencion">
          <div className="space-y-2.5">
            <p>Cambiaste números que todavía no están guardados.</p>
            <div className="flex flex-wrap gap-2">
              {p.puedeGuardar ? (
                <Boton ancho={false} pendiente={pendiente} cargando="Guardando…" onClick={guardar}>
                  Guardar cambios
                </Boton>
              ) : null}
              <Boton ancho={false} variante="secundario" onClick={descartar} disabled={pendiente}>
                Descartar cambios
              </Boton>
            </div>
          </div>
        </Aviso>
      ) : null}

      {sinHato ? (
        <Aviso tipo="atencion">Todavía no hay animales activos en tu hato, así que no hay con qué proyectar. Registra tus animales y vuelve.</Aviso>
      ) : (
        <>
          {pestana === "resumen" ? <Resumen hoy={p.hoy} p={p} proyeccion={proyeccion} bloques={bloques} enfoque={enfoque} /> : null}
          {pestana === "hato" ? <TablaMeses hoy={p.hoy} meses={proyeccion.meses} columnas={columnasHato(enfoque)} titulo="Hato mes a mes" /> : null}
          {pestana === "alimento" ? (
            <div className="space-y-3">
              <Aviso tipo="info">
                Toneladas de materia seca (el alimento sin agua) y su costo, con {formatear("pesos", supuestos.costo_kg_ms)} por kilo. Incluye pasto, forraje, concentrado y sales.
              </Aviso>
              {p.estacion.mesesLluvia.length === 0 ? (
                <Aviso tipo="info">
                  Todavía no dijiste cuáles son tus meses de lluvia, así que la proyección no cambia el costo del alimento ni la leche en época seca. Defínelos en{" "}
                  <Link href="/mas/ajustes" className="font-semibold text-musgo underline underline-offset-4">Ajustes de la finca</Link>.
                </Aviso>
              ) : (
                <Aviso tipo="info">
                  En los meses fuera de lluvia (marcados «seco») el alimento cuesta {supuestos.seca_costo_alimento_pct} % más y la leche baja {supuestos.seca_litros_pct} %. Puedes cambiar los dos en «Supuestos».
                </Aviso>
              )}
              <TablaMeses hoy={p.hoy} meses={proyeccion.meses} columnas={columnasAlimento(enfoque)} titulo="Alimento mes a mes" conTotal />
            </div>
          ) : null}
          {pestana === "dinero" ? <Dinero hoy={p.hoy} proyeccion={proyeccion} enfoque={enfoque} /> : null}
        </>
      )}
      {verEnfoque && NOTA_ENFOQUE[enfoque] && !sinHato ? <Aviso tipo="info">{NOTA_ENFOQUE[enfoque]}</Aviso> : null}

      {pestana === "comparar" ? <Comparar escenarios={escenarios} ajustesPantalla={ajustes} hayCambios={!sinCambios} activoId={activoId} base={p.base} entrada={analisis} /> : null}
      {pestana === "riesgos" && !sinHato ? <Riesgos entrada={analisis} supuestos={supuestos} /> : null}
      {pestana === "supuestos" ? (
        <Supuestos_ procedencia={p.procedencia} base={p.base} supuestos={supuestos} ajustes={ajustes} borradores={borradores} onCambiar={cambiar} onVolver={volverAlValor} />
      ) : null}
    </div>
  );
}

function Resumen({ hoy, p, proyeccion, bloques, enfoque }: { hoy: string; p: PropsProyecciones; proyeccion: ReturnType<typeof simular>; bloques: ReturnType<typeof porAnio>; enfoque: Enfoque }) {
  const lineas = lineasResumen(enfoque);
  const serie = proyeccion.meses.map((m) => (enfoque === "carne" ? m.ingresosCarne - m.costoAlimentoCeba : enfoque === "leche" ? m.ingresosLeche - m.costoAlimentoLactancia : m.flujo));
  const tituloSerie = enfoque === "todo" ? "Lo que queda cada mes" : "Lo que queda cada mes sobre el alimento de esta línea";
  return (
    <div className="space-y-4">
      <p className="text-sm text-humo [overflow-wrap:anywhere]">
        Hoy tienes {Math.round(p.hato.vientres)} reproductoras, {Math.round(p.hato.sementales)} {p.hato.sementales === 1 ? "semental" : "sementales"}, {Math.round(p.hato.crias)} crías y {Math.round(p.hato.levante)} animales en levante.
      </p>
      <Avisos avisos={proyeccion.avisos} />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3 lg:items-start">
        {bloques.map((b) => (
          <Tarjeta key={b.etiqueta} titulo={b.etiqueta}>
            <p className="-mt-2 mb-2 text-[0.8125rem] text-humo">
              {etiquetaMes(hoy, b.desde)} a {etiquetaMes(hoy, b.hasta)}
            </p>
            <dl className="space-y-1.5">
              {lineas.map((l) => (
                <div key={l.titulo} className={`flex items-baseline justify-between gap-3 ${l.destacada ? "border-t border-arena pt-2 font-bold" : ""}`}>
                  <dt className={`min-w-0 text-[0.9375rem] [overflow-wrap:anywhere] ${l.destacada ? "" : "text-humo"}`}>{l.titulo}</dt>
                  <dd className="shrink-0 text-right text-[0.9375rem] font-semibold tabular-nums">{formatear(l.formato, l.valor(b))}</dd>
                </div>
              ))}
            </dl>
          </Tarjeta>
        ))}
      </div>
      <Tarjeta titulo={tituloSerie}>
        <GraficoMeses hoy={hoy} valores={serie} />
      </Tarjeta>
    </div>
  );
}

function Avisos({ avisos }: { avisos: AvisoProyeccion[] }) {
  if (avisos.length === 0) return null;
  return (
    <div className="space-y-2.5">
      {avisos.map((a) => (
        <Aviso key={a.tipo} tipo={a.tipo === "partos" ? "info" : "atencion"}>
          {a.detalle}
        </Aviso>
      ))}
    </div>
  );
}

function Dinero({ hoy, proyeccion, enfoque }: { hoy: string; proyeccion: ReturnType<typeof simular>; enfoque: Enfoque }) {
  return <TablaMeses hoy={hoy} meses={proyeccion.meses} columnas={columnasDinero(enfoque)} titulo="Dinero mes a mes" conTotal />;
}

/** El mes a mes: tabla en pantallas anchas y una tarjeta por mes en el celular (cada mes muestra todos sus datos). */
function TablaMeses({ hoy, meses, columnas, titulo, conTotal = false }: { hoy: string; meses: Mes[]; columnas: ColumnaMes[]; titulo: string; conTotal?: boolean }) {
  const total = (c: ColumnaMes) => meses.reduce((s, m) => s + c.valor(m), 0);
  return (
    <section aria-label={titulo} className="min-w-0">
      <div className="hidden overflow-x-auto rounded-3xl bg-papel ring-1 ring-arena lg:block">
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="border-b border-arena text-left text-humo">
              <th scope="col" className="px-4 py-3 font-semibold">Mes</th>
              {columnas.map((c) => (
                <th key={c.clave} scope="col" className="px-3 py-3 text-right font-semibold">{c.titulo}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {meses.map((m) => (
              <tr key={m.n} className="border-b border-arena/60 last:border-0">
                <th scope="row" className="whitespace-nowrap px-4 py-2.5 text-left font-semibold">{m.n} · {etiquetaMes(hoy, m.n)}{m.seco ? " · seco" : ""}</th>
                {columnas.map((c) => (
                  <td key={c.clave} className={`px-3 py-2.5 text-right ${c.formato === "pesos" && c.valor(m) < 0 ? "text-rojo" : ""}`}>{formatear(c.formato, c.valor(m))}</td>
                ))}
              </tr>
            ))}
            {conTotal ? (
              <tr className="border-t-2 border-arena bg-lana/60 font-bold">
                <th scope="row" className="px-4 py-3 text-left">Total</th>
                {columnas.map((c) => (
                  <td key={c.clave} className="px-3 py-3 text-right">{c.suma ? formatear(c.formato, total(c)) : ""}</td>
                ))}
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:hidden">
        {meses.map((m) => (
          <li key={m.n} className="min-w-0 rounded-2xl bg-papel p-3.5 ring-1 ring-arena">
            <p className="mb-2 text-sm font-bold">Mes {m.n} · {etiquetaMes(hoy, m.n)}{m.seco ? " · seco" : ""}</p>
            <dl className="space-y-1">
              {columnas.map((c) => (
                <div key={c.clave} className="flex items-baseline justify-between gap-3 text-[0.9375rem]">
                  <dt className="min-w-0 text-humo [overflow-wrap:anywhere]">{c.titulo}</dt>
                  <dd className={`shrink-0 text-right font-semibold tabular-nums ${c.formato === "pesos" && c.valor(m) < 0 ? "text-rojo" : ""}`}>{formatear(c.formato, c.valor(m))}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
        {conTotal ? (
          <li className="min-w-0 rounded-2xl bg-lana p-3.5 ring-1 ring-arena sm:col-span-2">
            <p className="mb-2 text-sm font-bold">Total de los {meses.length} meses</p>
            <dl className="space-y-1">
              {columnas.filter((c) => c.suma).map((c) => (
                <div key={c.clave} className="flex items-baseline justify-between gap-3 text-[0.9375rem]">
                  <dt className="min-w-0 text-humo [overflow-wrap:anywhere]">{c.titulo}</dt>
                  <dd className="shrink-0 text-right font-bold tabular-nums">{formatear(c.formato, total(c))}</dd>
                </div>
              ))}
            </dl>
          </li>
        ) : null}
      </ul>
    </section>
  );
}

/** Barras por mes: hacia arriba lo que queda a favor y hacia abajo lo que falta. */
function GraficoMeses({ hoy, valores }: { hoy: string; valores: number[] }) {
  const maximo = Math.max(1, ...valores.map((v) => Math.abs(v)));
  const hayNegativos = valores.some((v) => v < 0);
  const resumen = valores.map((v, i) => `${etiquetaMes(hoy, i + 1)}: ${formatear("pesos", v)}`).join("; ");
  return (
    <figure className="space-y-1.5">
      <div className="flex h-36 gap-0.5" role="img" aria-label={resumen}>
        {valores.map((v, i) => (
          <div key={i} className="flex min-w-0 flex-1 flex-col" title={`${etiquetaMes(hoy, i + 1)}: ${formatear("pesos", v)}`}>
            <div className={`flex items-end ${hayNegativos ? "h-1/2" : "h-full"}`}>
              <div className="w-full rounded-t-sm bg-musgo" style={{ height: `${v > 0 ? Math.max(3, (v / maximo) * 100) : 0}%` }} />
            </div>
            {hayNegativos ? (
              <div className="flex h-1/2 items-start border-t border-humo/40">
                <div className="w-full rounded-b-sm bg-rojo" style={{ height: `${v < 0 ? Math.max(3, (-v / maximo) * 100) : 0}%` }} />
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <figcaption className="flex items-center justify-between gap-3 text-xs text-humo">
        <span>{etiquetaMes(hoy, 1)}</span>
        <span className="inline-flex items-center gap-3">
          <span className="inline-flex items-center gap-1"><span className="size-2 rounded-sm bg-musgo" /> A favor</span>
          {hayNegativos ? <span className="inline-flex items-center gap-1"><span className="size-2 rounded-sm bg-rojo" /> Falta</span> : null}
        </span>
        <span>{etiquetaMes(hoy, valores.length)}</span>
      </figcaption>
    </figure>
  );
}

function Supuestos_({
  procedencia,
  base,
  supuestos,
  ajustes,
  borradores,
  onCambiar,
  onVolver,
}: {
  procedencia: Record<ClaveSupuesto, Procedencia>;
  base: Supuestos;
  supuestos: Supuestos;
  ajustes: Ajustes;
  borradores: Partial<Record<ClaveSupuesto, string>>;
  onCambiar: (d: DefinicionSupuesto, texto: string) => void;
  onVolver: (clave: ClaveSupuesto) => void;
}) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-humo">Cambia cualquier número y todo se recalcula al instante. Lo que no cambies se queda con el valor de tu finca o, si aún no hay datos, con uno de referencia.</p>
      {GRUPOS_SUPUESTO.map((g) => (
        <section key={g} aria-labelledby={`grupo-${g}`} className="space-y-3">
          <h2 id={`grupo-${g}`} className="text-base font-bold">{ETIQUETA_GRUPO_SUPUESTO[g]}</h2>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {DEFINICIONES.filter((d) => d.grupo === g).map((d) => {
              const texto = borradores[d.clave];
              const n = texto === undefined ? supuestos[d.clave] : leerNumero(texto);
              const invalido = texto !== undefined && (n === null || !enRango(d.clave, n));
              const origen = d.clave in ajustes ? "ajuste" : procedencia[d.clave].origen;
              const id = `sup-${d.clave}`;
              return (
                <div key={d.clave} className="min-w-0 space-y-1.5 rounded-2xl bg-papel p-3.5 ring-1 ring-arena">
                  <label htmlFor={id} className="block text-sm font-semibold [overflow-wrap:anywhere]">{d.etiqueta}</label>
                  <div className="flex items-center gap-2">
                    {d.unidad === "pesos" ? <span className="shrink-0 text-humo">$</span> : null}
                    <input
                      id={id}
                      inputMode="decimal"
                      autoComplete="off"
                      value={texto ?? entrada(d, supuestos[d.clave])}
                      onChange={(e) => onCambiar(d, e.target.value)}
                      aria-invalid={invalido}
                      className={`${CLASE_INPUT} min-w-0 flex-1 ${invalido ? "border-rojo" : ""}`}
                    />
                    {d.unidad !== "pesos" && SUFIJO[d.unidad] ? <span className="shrink-0 text-humo">{SUFIJO[d.unidad]}</span> : null}
                  </div>
                  {invalido ? (
                    <p className="text-sm text-rojo">Escribe un número entre {entrada(d, d.min)} y {entrada(d, d.max)}.</p>
                  ) : (
                    <p className="text-[0.8125rem] text-humo [overflow-wrap:anywhere]">{d.detalle}</p>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className={`text-[0.8125rem] font-semibold [overflow-wrap:anywhere] ${origen === "finca" ? "text-musgo" : origen === "ajuste" ? "text-ocre" : "text-humo"}`}>
                      {ETIQUETA_ORIGEN[origen]}
                      {origen === "finca" && procedencia[d.clave].muestra ? ` · ${procedencia[d.clave].muestra}` : ""}
                    </p>
                    {origen === "ajuste" ? (
                      <button type="button" onClick={() => onVolver(d.clave)} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-[0.8125rem] font-semibold text-musgo hover:bg-arena/60">
                        <RotateCcw className="size-4" strokeWidth={2} aria-hidden="true" /> Volver a {entrada(d, base[d.clave])}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
