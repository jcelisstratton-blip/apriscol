"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { EnlaceInvitacion } from "@/components/EnlaceInvitacion";
import { SelectorTarjetas } from "@/components/SelectorTarjetas";
import { Tarjeta } from "@/components/Tarjeta";
import { useToast } from "@/components/Toast";
import { darAcceso, renovarInvitacion, revocarInvitacion } from "@/app/(app)/mas/miembros/actions";
import { ESCENA_ROL } from "@/lib/escenas-forms-a-hato";
import { DETALLE_ROL, ETIQUETA_ROL, ROLES_INVITABLES } from "@/lib/permisos";
import type { Acceso } from "@/lib/invitacion";
import type { RolFinca } from "@/lib/tipos";

export type InvitacionPersona = { id: string; email: string; rol: RolFinca; enlace: string; vence: string };

/**
 * Acceso a la app de una persona del equipo, dentro de «Editar persona»: ver si ya entró, copiar o reenviar su invitación pendiente, renovarla si venció o
 * crear una nueva (con otro correo si hace falta). Antes el correo solo se pedía al crear a la persona y, si la invitación se cancelaba, no había cómo repetirla.
 */
export function AccesoPersona({
  personaId,
  correo,
  rolActual,
  esVeterinario,
  acceso,
  invitacion,
}: {
  personaId: string;
  correo: string | null;
  rolActual: RolFinca | null;
  esVeterinario: boolean;
  acceso: Acceso;
  invitacion: InvitacionPersona | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [ocupado, iniciar] = useTransition();
  const [estado, enviar, pendiente] = useActionState(darAcceso, undefined);
  const [enlaceRenovado, setEnlaceRenovado] = useState<string | null>(null);
  const [rol, setRol] = useState<string>(rolActual && rolActual !== "propietario" ? rolActual : esVeterinario ? "veterinario" : "");

  const cancelar = () =>
    iniciar(async () => {
      const r = await revocarInvitacion(invitacion!.id);
      if (r.error) return toast.error(r.error);
      toast.exito("Invitación cancelada");
      router.refresh();
    });

  const renovar = () =>
    iniciar(async () => {
      const r = await renovarInvitacion(invitacion!.id);
      if (r.error || !r.enlace) return toast.error(r.error ?? "No se pudo renovar la invitación.");
      setEnlaceRenovado(r.enlace);
      toast.exito("Invitación renovada por 7 días");
      router.refresh();
    });

  return (
    <Tarjeta titulo="Acceso a la app">
      <div className="space-y-3">
        {acceso === "aceptada" ? (
          <Aviso tipo="exito">Ya tiene acceso a la app con {correo ?? invitacion?.email}{rolActual ? ` como ${ETIQUETA_ROL[rolActual].toLowerCase()}` : ""}.</Aviso>
        ) : null}

        {acceso === "pendiente" && invitacion ? (
          <>
            <Aviso tipo="info">
              Invitación pendiente para {invitacion.email} como {ETIQUETA_ROL[invitacion.rol].toLowerCase()}. Vence el {invitacion.vence}. Compártele este enlace.
            </Aviso>
            <EnlaceInvitacion enlace={invitacion.enlace} />
            <Boton type="button" variante="fantasma" onClick={cancelar} pendiente={ocupado} cargando="Cancelando…">
              Cancelar esta invitación (para usar otro correo)
            </Boton>
          </>
        ) : null}

        {acceso === "vencida" && invitacion ? (
          <>
            <Aviso tipo="atencion">La invitación a {invitacion.email} venció el {invitacion.vence}. Renuévala para darle 7 días más con el mismo enlace.</Aviso>
            {enlaceRenovado ? <EnlaceInvitacion enlace={enlaceRenovado} /> : null}
            <Boton type="button" onClick={renovar} pendiente={ocupado} cargando="Renovando…">
              Renovar la invitación
            </Boton>
            <Boton type="button" variante="fantasma" onClick={cancelar} pendiente={ocupado} cargando="Cancelando…">
              Cancelarla y usar otro correo
            </Boton>
          </>
        ) : null}

        {acceso === "sin_invitacion" ? (
          <form action={enviar} className="space-y-4">
            <p className="text-[0.9375rem] text-humo">
              {correo ? `Tiene el correo ${correo} guardado, pero no hay una invitación activa.` : "Todavía no tiene acceso a la app."} Crea una invitación para que pueda entrar.
            </p>
            <input type="hidden" name="persona_id" value={personaId} />
            <Campo etiqueta="Correo de la persona" ayuda="Debe registrarse con este mismo correo.">
              {(id) => <input id={id} name="email" type="email" inputMode="email" autoCapitalize="none" required defaultValue={correo ?? ""} className={CLASE_INPUT} placeholder="nombre@correo.com" />}
            </Campo>
            <Campo etiqueta="¿Qué perfil tendrá?">
              {(id) => (
                <SelectorTarjetas
                  id={id}
                  nombre="rol"
                  valor={rol}
                  onCambio={(v) => setRol(String(v))}
                  titulo="¿Qué puede hacer?"
                  opciones={ROLES_INVITABLES.map((r) => ({ valor: r as string, etiqueta: ETIQUETA_ROL[r], detalle: DETALLE_ROL[r], escena: ESCENA_ROL[r] }))}
                />
              )}
            </Campo>
            {estado?.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
            <Boton type="submit" pendiente={pendiente} cargando="Creando invitación…" disabled={!rol}>
              Crear invitación
            </Boton>
            {estado?.enlace ? (
              <div className="space-y-3 rounded-2xl bg-lana p-3.5">
                <Aviso tipo="exito">Invitación lista para {estado.email}. Compártele este enlace.</Aviso>
                <EnlaceInvitacion enlace={estado.enlace} />
              </div>
            ) : null}
          </form>
        ) : null}
      </div>
    </Tarjeta>
  );
}
