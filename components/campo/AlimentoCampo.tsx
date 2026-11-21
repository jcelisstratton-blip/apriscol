"use client";

import { useState } from "react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { Chip, FilaDesplazable } from "@/components/FilaDesplazable";
import { ListaPorTramos } from "@/components/ListaPorTramos";
import { Selector } from "@/components/Selector";
import { useToast } from "@/components/Toast";
import { InsigniaCampo } from "@/components/campo/EstadoCampo";
import { esquemaSalida } from "@/lib/alimento-reglas";
import { singular, textoKg, unidadesDeCantidad } from "@/lib/inventario-alimento";
import { leerNumero } from "@/lib/numeros";
import { MENSAJE_GUARDADO_LOCAL, type ReferenciaCampo, type RegistroCampo } from "@/lib/campo";
import { guardarEnCelular } from "@/lib/offline/campo-envio";

type Estado = { alimento: string; unidad: string; cantidad: string; fecha: string; destino: string; observaciones: string };
const inicial = (hoy: string): Estado => ({ alimento: "", unidad: "kg", cantidad: "", fecha: hoy, destino: "", observaciones: "" });

/**
 * Lo que se dio de comer, sin señal: lo mismo que «Anotar lo que se dio» (alimento, cuánto en kg o en bultos, fecha y, si la persona ve Corrales o Carne,
 * para qué corral o lote) con los alimentos de la copia de la finca y las mismas reglas (`esquemaSalida`; el servidor las vuelve a aplicar con
 * `guardarSalidaAlimentoCampo`, y es él quien pone el peso de cada bulto). Al guardar queda listo para el siguiente alimento.
 */
export function AlimentoCampo({ referencia, registros, usuarioId, hoy, enLinea, alGuardar }: {
  referencia: ReferenciaCampo;
  registros: RegistroCampo[];
  usuarioId: string;
  hoy: string;
  enLinea: boolean;
  alGuardar: () => void;
}) {
  const toast = useToast();
  const { alimentos, destinos } = referencia.alimentacion;
  const [e, setE] = useState<Estado>(() => inicial(hoy));
  const [editando, setEditando] = useState<RegistroCampo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const poner = <K extends keyof Estado>(k: K, valor: Estado[K]) => {
    setE((p) => ({ ...p, [k]: valor }));
    setError(null);
  };

  const fincaId = referencia.finca.id;
  const alimento = alimentos.find((a) => a.producto_id === e.alimento) ?? null;
  const unidades = alimento ? unidadesDeCantidad(alimento) : [{ valor: "kg", nombre: "kg", factor: 1 }];
  const unidad = unidades.find((u) => u.valor === e.unidad) ?? unidades[0];
  const cant = leerNumero(e.cantidad);
  const hechos = registros.filter((x) => x.tipo === "alimento" && x.usuarioId === usuarioId && x.fincaId === fincaId).sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
  const falta = !e.alimento ? "Elige el alimento." : !(cant && cant > 0) ? "Escribe cuánto se dio." : null;

  /** Los mismos campos que «Anotar lo que se dio» con señal (los vacíos no viajan). */
  const campos = (): Record<string, string> => {
    const x: Record<string, string> = { producto_id: e.alimento, cantidad: e.cantidad, unidad: unidad.valor, fecha: e.fecha, destino: e.destino, observaciones: e.observaciones };
    return Object.fromEntries(Object.entries(x).filter(([, valor]) => valor.trim() !== ""));
  };

  const limpiar = () => {
    setEditando(null);
    setE(inicial(hoy));
  };

  const guardar = async () => {
    if (falta) return setError(falta);
    if (e.fecha > hoy) return setError("La fecha no puede ser futura: registra lo que ya pasó.");
    const x = campos();
    const d = esquemaSalida.safeParse(x);
    if (!d.success) return setError(d.error.issues[0]?.message ?? "Revisa los datos.");
    const id = editando?.id ?? crypto.randomUUID();
    setGuardando(true);
    try {
      await guardarEnCelular({ id, creadoEn: editando?.creadoEn, tipo: "alimento", usuarioId, fincaId, animalId: id, etiqueta: `${alimento?.nombre ?? "Alimento"} · ${e.cantidad.trim()} ${unidad.nombre}`, fecha: d.data.fecha, campos: x });
    } catch {
      setGuardando(false);
      return setError("No se pudo guardar en este celular. Revisa que tenga espacio libre.");
    }
    setGuardando(false);
    toast.exito(enLinea ? "Salida guardada" : MENSAJE_GUARDADO_LOCAL);
    alGuardar();
    limpiar();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const corregir = (r: RegistroCampo) => {
    const x = r.campos ?? {};
    setEditando(r);
    setE({ alimento: x.producto_id ?? "", unidad: x.unidad ?? "kg", cantidad: x.cantidad ?? "", fecha: x.fecha ?? hoy, destino: x.destino ?? "", observaciones: x.observaciones ?? "" });
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!referencia.puede.alimento) return <Aviso>Tu rol no anota lo que se da de comer en esta finca.</Aviso>;
  if (alimentos.length === 0) return <Aviso>No hay alimentos con su primer conteo en la lista guardada. Haz el conteo con señal en Inventario → Alimento y vuelve a abrir esta pantalla.</Aviso>;

  return (
    <div className="space-y-6">
      {editando ? (
        <Aviso tipo="atencion">
          Estás corrigiendo {editando.etiqueta}, que aún no se ha enviado.{" "}
          <button type="button" onClick={limpiar} className="font-semibold text-musgo underline underline-offset-4">Cancelar</button>
        </Aviso>
      ) : null}

      <Campo etiqueta="Alimento" ayuda="Lo que se le dio de comer al hato.">
        {(id) => (
          <Selector
            id={id}
            valor={e.alimento}
            onCambio={(v) => setE((p) => ({ ...p, alimento: String(v), unidad: "kg" }))}
            titulo="¿Qué alimento?"
            placeholder="Elegir alimento"
            opciones={alimentos.map((a) => ({ valor: a.producto_id, etiqueta: a.nombre, detalle: a.stock_kg !== null ? `Quedaban ${textoKg(a, a.stock_kg)}` : "Todavía sin contar" }))}
          />
        )}
      </Campo>

      <div className="space-y-2">
        {unidades.length > 1 ? (
          <FilaDesplazable>
            {unidades.map((u) => (
              <Chip key={u.valor} activo={unidad.valor === u.valor} onClick={() => poner("unidad", u.valor)}>
                En {u.nombre}
              </Chip>
            ))}
          </FilaDesplazable>
        ) : null}
        <Campo etiqueta={`¿Cuánto se dio? (${unidad.nombre})`} ayuda={unidad.valor === "unidad" && alimento ? `Cada ${singular(alimento.unidad ?? "unidad")} pesa ${String(alimento.kg_por_unidad).replace(".", ",")} kg. Puedes escribir decimales: 0,5.` : undefined}>
          {(id) => <input id={id} value={e.cantidad} onChange={(ev) => poner("cantidad", ev.target.value)} inputMode="decimal" autoComplete="off" placeholder="Ej. 25" className={CLASE_INPUT} />}
        </Campo>
      </div>

      <Campo etiqueta="Fecha">
        {(id) => <input id={id} type="date" value={e.fecha} max={hoy} onChange={(ev) => poner("fecha", ev.target.value)} className={CLASE_INPUT} />}
      </Campo>

      {destinos.length > 0 ? (
        <Campo etiqueta="¿Para quién fue?" ayuda="Opcional. Un corral o un lote de ceba.">
          {(id) => <Selector id={id} valor={e.destino} onCambio={(v) => poner("destino", String(v))} titulo="¿Para quién fue?" placeholder="Todo el hato" permitirVacio opciones={destinos} />}
        </Campo>
      ) : null}

      <Campo etiqueta="Observaciones (opcional)">
        {(id) => <textarea id={id} value={e.observaciones} onChange={(ev) => poner("observaciones", ev.target.value)} rows={2} maxLength={300} className={`${CLASE_INPUT} py-3`} />}
      </Campo>

      {error ? <Aviso tipo="error">{error}</Aviso> : null}
      <Boton onClick={guardar} pendiente={guardando} cargando="Guardando…" disabled={falta !== null}>{editando ? "Guardar corrección" : "Guardar salida"}</Boton>

      {hechos.length > 0 ? (
        <section className="space-y-3" aria-labelledby="titulo-alimento-hecho">
          <h2 id="titulo-alimento-hecho" className="font-display text-xl font-semibold">Anotado en este celular · {hechos.length}</h2>
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
