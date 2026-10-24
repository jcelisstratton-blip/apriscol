"use client";

import { useState, useTransition } from "react";
import { Copy, Pencil, Plus } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { EliminarRegistro } from "@/components/EliminarRegistro";
import { Selector } from "@/components/Selector";
import { Sheet } from "@/components/Sheet";
import { useToast } from "@/components/Toast";
import { MAX_ESCENARIOS, nombreLibre, type EscenarioGuardado } from "@/lib/proyeccion/escenarios";
import { eliminarEscenario, renombrarEscenario } from "./actions";

type Modo = "nuevo" | "duplicar" | "renombrar";

const TITULO: Record<Modo, string> = { nuevo: "Nuevo escenario", duplicar: "Duplicar escenario", renombrar: "Cambiar el nombre" };

/**
 * Los escenarios guardados: elegir cuál se mira, crear uno con lo que hay en pantalla, duplicarlo, cambiarle el nombre o eliminarlo.
 * `alCrear` guarda un escenario nuevo (lo hace la pantalla, que tiene los números); renombrar y eliminar los resuelve la propia barra.
 */
export function BarraEscenarios({
  escenarios,
  activoId,
  hayCambios,
  puedeGuardar,
  alElegir,
  alCrear,
  alRenombrar,
  alEliminar,
}: {
  escenarios: EscenarioGuardado[];
  activoId: string | null;
  hayCambios: boolean;
  puedeGuardar: boolean;
  alElegir: (id: string | null) => void;
  alCrear: (nombre: string) => Promise<string | null>;
  alRenombrar: (id: string, nombre: string) => void;
  alEliminar: (id: string) => void;
}) {
  const toast = useToast();
  const [modo, setModo] = useState<Modo | null>(null);
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const activo = escenarios.find((e) => e.id === activoId) ?? null;
  const lleno = escenarios.length >= MAX_ESCENARIOS;

  function abrir(m: Modo) {
    setError(null);
    setNombre(m === "renombrar" ? (activo?.nombre ?? "") : m === "duplicar" ? nombreLibre(`${activo?.nombre ?? "Mi proyección"} (copia)`, escenarios.map((e) => e.nombre)) : nombreLibre("Otro escenario", escenarios.map((e) => e.nombre)));
    setModo(m);
  }

  function aceptar() {
    if (!modo) return;
    iniciar(async () => {
      setError(null);
      if (modo === "renombrar" && activo) {
        const r = await renombrarEscenario(activo.id, nombre);
        if (!r.ok) return setError(r.error);
        alRenombrar(activo.id, nombre.replace(/\s+/g, " ").trim());
        toast.exito("Nombre cambiado");
      } else {
        const mensaje = await alCrear(nombre);
        if (mensaje) return setError(mensaje);
        toast.exito("Escenario creado");
      }
      setModo(null);
    });
  }

  const opciones = escenarios.length > 0 ? escenarios.map((e) => ({ valor: e.id, etiqueta: e.nombre })) : [{ valor: "", etiqueta: "Mi proyección (sin guardar)" }];
  const BOTON = "inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-arena px-3.5 text-[0.9375rem] font-semibold text-tinta transition hover:brightness-95 active:scale-[0.98] disabled:opacity-50";

  return (
    <section aria-label="Escenarios" className="space-y-2.5 rounded-3xl bg-papel p-3.5 ring-1 ring-arena">
      <div className="space-y-1.5">
        <label htmlFor="escenario-actual" className="block text-sm font-semibold">Escenario</label>
        <Selector
          id="escenario-actual"
          titulo="Elige un escenario"
          valor={activoId ?? ""}
          opciones={opciones}
          onCambio={(v) => {
            if (hayCambios) return toast.error("Guarda o descarta tus cambios antes de cambiar de escenario.");
            alElegir(v === "" ? null : (v as string));
          }}
        />
        <p className="text-[0.8125rem] text-humo">Un escenario es una forma de ver tu finca: por ejemplo «con más hembras» o «si baja el precio». Puedes guardar hasta {MAX_ESCENARIOS} y compararlos en «Comparar».</p>
      </div>
      {puedeGuardar ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={BOTON} onClick={() => abrir("nuevo")} disabled={lleno}>
            <Plus className="size-4" strokeWidth={2} aria-hidden="true" /> Nuevo con lo de pantalla
          </button>
          {activo ? (
            <>
              <button type="button" className={BOTON} onClick={() => abrir("duplicar")} disabled={lleno}>
                <Copy className="size-4" strokeWidth={2} aria-hidden="true" /> Duplicar
              </button>
              <button type="button" className={BOTON} onClick={() => abrir("renombrar")}>
                <Pencil className="size-4" strokeWidth={2} aria-hidden="true" /> Cambiar nombre
              </button>
            </>
          ) : null}
        </div>
      ) : null}
      {lleno && puedeGuardar ? <Aviso tipo="info">Ya tienes {MAX_ESCENARIOS} escenarios: elimina alguno para crear otro.</Aviso> : null}
      {puedeGuardar && activo ? (
        <EliminarRegistro
          etiqueta="Eliminar este escenario"
          resumen={activo.nombre}
          accion={async () => {
            const r = await eliminarEscenario(activo.id);
            if (r.ok) alEliminar(activo.id);
            return r.ok ? { ok: true as const, destino: "/proyecciones" } : r;
          }}
          destino="/proyecciones"
          mensaje="Escenario eliminado"
        />
      ) : null}

      <Sheet
        abierta={modo !== null}
        onCerrar={() => setModo(null)}
        titulo={modo ? TITULO[modo] : undefined}
        pie={
          <Boton pendiente={pendiente} cargando="Guardando…" onClick={aceptar} disabled={nombre.trim() === ""}>
            {modo === "renombrar" ? "Guardar nombre" : "Crear escenario"}
          </Boton>
        }
      >
        <div className="space-y-3">
          {modo && modo !== "renombrar" ? <p className="text-sm text-humo">Se guarda con los números que ves ahora en pantalla.</p> : null}
          <Campo etiqueta="Nombre">
            {(id) => <input id={id} value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} autoComplete="off" className={CLASE_INPUT} />}
          </Campo>
          {error ? <Aviso tipo="error">{error}</Aviso> : null}
        </div>
      </Sheet>
    </section>
  );
}
