"use client";

import { useState, useTransition } from "react";
import { Plus, Stethoscope, User } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { SelectorTarjetas } from "@/components/SelectorTarjetas";
import { agregarVeterinario } from "@/app/(app)/personal/actions";
import { escena } from "@/lib/escenas";
import { ESCENA_ROL } from "@/lib/escenas-forms-a-hato";
import { estadoInicialAsistencia, nombreAsistencia, type QuienAsistio, type VeterinarioRef } from "@/lib/veterinarios";

const ESCENA_OTRA = escena(User, "grafito");

/**
 * «Asistido por»: dos tarjetas excluyentes, «Veterinario» u «Otra persona». Con «Veterinario» se elige entre los del equipo (con uno solo ya viene elegido) o se
 * agrega uno ahí mismo (nombre, tarjeta profesional y teléfono; solo propietario o administrador); con «Otra persona» se escribe su nombre. Manda un único
 * valor con el nombre, que se copia en el registro: si cambia el equipo, el historial sigue diciendo quién asistió en su momento.
 */
export function AsistidoPor({
  nombre,
  etiqueta = "Asistido por",
  ayuda,
  veterinarios: inicialesVets,
  puedeAgregar,
  inicial,
  requerido = false,
}: {
  /** Nombre del campo que recibe el servidor (`asistido_por`, `responsable`). */
  nombre: string;
  etiqueta?: string;
  ayuda?: string;
  veterinarios: VeterinarioRef[];
  /** Si quien registra puede agregar un veterinario al equipo desde aquí. */
  puedeAgregar: boolean;
  /** El nombre ya guardado, al corregir. */
  inicial?: string | null;
  requerido?: boolean;
}) {
  const [veterinarios, setVeterinarios] = useState(inicialesVets);
  const [estado, setEstado] = useState(() => estadoInicialAsistencia(inicialesVets, inicial));
  const [agregando, setAgregando] = useState(false);
  const [nuevo, setNuevo] = useState({ nombre: "", tarjeta: "", telefono: "" });
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const valor = nombreAsistencia(veterinarios, estado);
  // Sin veterinarios y sin permiso para agregar, solo queda la otra persona; con permiso, el alta aparece sola al elegir «Veterinario».
  const mostrarAlta = estado.quien === "veterinario" && (agregando || (veterinarios.length === 0 && puedeAgregar));

  const guardarNuevo = () =>
    iniciar(async () => {
      setError(null);
      const r = await agregarVeterinario(nuevo);
      if (!r.ok) return setError(r.error);
      setVeterinarios((v) => [...v, r.veterinario].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")));
      setEstado({ quien: "veterinario", veterinarioId: r.veterinario.id, escrito: "" });
      setNuevo({ nombre: "", tarjeta: "", telefono: "" });
      setAgregando(false);
    });

  return (
    <div className="space-y-3">
      <input type="hidden" name={nombre} value={valor} />
      <Campo etiqueta={etiqueta} ayuda={ayuda}>
        {(id) => (
          <SelectorTarjetas<QuienAsistio>
            id={id}
            valor={estado.quien}
            onCambio={(v) => setEstado((e) => ({ ...e, quien: v }))}
            titulo={etiqueta}
            opciones={[
              { valor: "veterinario", etiqueta: "Veterinario", detalle: "Del equipo de la finca", escena: ESCENA_ROL.veterinario },
              { valor: "otra", etiqueta: "Otra persona", detalle: "Escribe su nombre", escena: ESCENA_OTRA },
            ]}
          />
        )}
      </Campo>

      {estado.quien === "veterinario" && veterinarios.length > 0 ? (
        <Campo etiqueta="¿Cuál veterinario?">
          {(id) => (
            <SelectorTarjetas
              id={id}
              valor={estado.veterinarioId}
              onCambio={(v) => setEstado((e) => ({ ...e, veterinarioId: v }))}
              titulo="Veterinario"
              opciones={veterinarios.map((v) => ({ valor: v.id, etiqueta: v.nombre, detalle: v.tarjeta_profesional ? `T.P. ${v.tarjeta_profesional}` : "Veterinario de la finca", escena: ESCENA_ROL.veterinario }))}
            />
          )}
        </Campo>
      ) : null}

      {estado.quien === "veterinario" && veterinarios.length === 0 && !puedeAgregar ? (
        <Aviso tipo="info">Todavía no hay veterinarios en tu equipo. Pídele al propietario o a un administrador que lo agregue en Equipo, o elige «Otra persona».</Aviso>
      ) : null}

      {estado.quien === "veterinario" && veterinarios.length > 0 && puedeAgregar && !agregando ? (
        <button type="button" onClick={() => setAgregando(true)} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-musgo underline-offset-4 hover:underline">
          <Plus className="size-4" strokeWidth={2.2} aria-hidden="true" /> Agregar otro veterinario
        </button>
      ) : null}

      {mostrarAlta ? (
        <div className="space-y-3 rounded-2xl bg-papel p-3.5 ring-1 ring-arena">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Stethoscope className="size-4" strokeWidth={1.75} aria-hidden="true" /> Agregar un veterinario al equipo
          </p>
          <Campo etiqueta="Nombre">
            {(id) => <input id={id} value={nuevo.nombre} onChange={(e) => setNuevo((n) => ({ ...n, nombre: e.target.value }))} maxLength={120} autoComplete="off" className={CLASE_INPUT} />}
          </Campo>
          <Campo etiqueta="Tarjeta profesional">
            {(id) => <input id={id} value={nuevo.tarjeta} onChange={(e) => setNuevo((n) => ({ ...n, tarjeta: e.target.value }))} maxLength={40} autoComplete="off" className={CLASE_INPUT} />}
          </Campo>
          <Campo etiqueta="Teléfono" ayuda="Es a quien se llama en una urgencia.">
            {(id) => <input id={id} type="tel" inputMode="tel" value={nuevo.telefono} onChange={(e) => setNuevo((n) => ({ ...n, telefono: e.target.value }))} maxLength={20} autoComplete="off" placeholder="Ej. 300 123 4567" className={CLASE_INPUT} />}
          </Campo>
          {error ? <Aviso tipo="error">{error}</Aviso> : null}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Boton type="button" pendiente={pendiente} cargando="Agregando…" onClick={guardarNuevo}>
              Agregar y elegir
            </Boton>
            {agregando ? (
              <Boton type="button" variante="fantasma" onClick={() => { setAgregando(false); setError(null); }}>
                Cancelar
              </Boton>
            ) : null}
          </div>
          <p className="text-sm text-humo">Queda en Equipo como prestación de servicios; ahí puedes completar su pago y sus demás datos.</p>
        </div>
      ) : null}

      {estado.quien === "otra" ? (
        <Campo etiqueta="Nombre de quien asistió">
          {(id) => <input id={id} value={estado.escrito} onChange={(e) => setEstado((s) => ({ ...s, escrito: e.target.value }))} required={requerido} maxLength={120} autoComplete="off" className={CLASE_INPUT} />}
        </Campo>
      ) : null}
    </div>
  );
}
