"use client";

import { useActionState, useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { CamposContrato } from "@/components/CamposContrato";
import { CamposPerfil } from "@/components/CamposPerfil";
import { EnlaceInvitacion } from "@/components/EnlaceInvitacion";
import { SelectorTarjetas } from "@/components/SelectorTarjetas";
import { useToast } from "@/components/Toast";
import { invitar, revocarInvitacion } from "@/app/(app)/mas/miembros/actions";
import { ESCENA_ROL } from "@/lib/escenas-forms-a-hato";
import { ESCENA_ACTIVA } from "@/lib/escenas-costos";
import { DETALLE_ROL, ETIQUETA_ROL, ROLES_INVITABLES } from "@/lib/permisos";
import type { RolFinca } from "@/lib/tipos";

type Perfil = Exclude<RolFinca, "propietario"> | "ninguno";

/**
 * Agregar a alguien al equipo en un solo paso: primero el perfil (qué puede hacer en la app, o «Sin acceso a la app» para quien solo trabaja y cobra) y,
 * una vez elegido, su contrato (vinculación, forma de pago y valor). Con acceso se crea además la invitación y se entrega el enlace.
 * Si el plan no incluye invitar personas, solo se ofrece «Sin acceso a la app».
 */
export function FormInvitar({ hoy, puedeInvitar, conContrato = true }: { hoy: string; puedeInvitar: boolean; conContrato?: boolean }) {
  const [estado, enviar, pendiente] = useActionState(invitar, undefined);
  const [rol, setRol] = useState<Perfil | "">(puedeInvitar ? "" : "ninguno");
  const [correo, setCorreo] = useState("");
  // Un veterinario puede quedar en el equipo sin correo (uno externo que no usa la app): no se invita, pero se ofrece en los procedimientos.
  const sinInvitacion = rol === "ninguno" || (rol === "veterinario" && !correo.trim());
  // Sin el módulo de personal (planes por debajo de Profesional) no hay contrato ni «Sin acceso»: solo se invita.
  return (
    <form action={enviar} className="space-y-4">
      <Campo etiqueta="¿Qué perfil tendrá?">
        {(id) => (
          <SelectorTarjetas
            id={id}
            nombre="rol"
            valor={rol}
            onCambio={setRol}
            titulo="¿Qué puede hacer?"
            opciones={[
              ...(puedeInvitar ? ROLES_INVITABLES.map((r) => ({ valor: r as Perfil, etiqueta: ETIQUETA_ROL[r], detalle: DETALLE_ROL[r], escena: ESCENA_ROL[r] })) : []),
              ...(conContrato ? [{ valor: "ninguno" as Perfil, etiqueta: "Sin acceso a la app", detalle: "Trabaja en la finca y cobra, pero no entra", escena: ESCENA_ACTIVA.no }] : []),
            ]}
          />
        )}
      </Campo>
      {rol && rol !== "ninguno" ? (
        <Campo
          etiqueta={rol === "veterinario" ? "Correo de la persona (opcional)" : "Correo de la persona"}
          ayuda={rol === "veterinario" ? "Si lo escribes, podrá entrar a la app con ese correo. Si no, solo queda en tu equipo para elegirlo al registrar procedimientos." : "Debe registrarse con este mismo correo."}
        >
          {(id) => <input id={id} name="email" type="email" inputMode="email" autoCapitalize="none" required={rol !== "veterinario"} value={correo} onChange={(e) => setCorreo(e.target.value)} className={CLASE_INPUT} placeholder="nombre@correo.com" />}
        </Campo>
      ) : null}
      {rol && conContrato ? <CamposContrato key={rol === "ninguno" ? "sin" : "con"} hoy={hoy} perfil={<CamposPerfil key={rol} rol={rol} />} /> : null}
      {estado?.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      {rol ? (
        <Boton type="submit" pendiente={pendiente} cargando={sinInvitacion ? "Guardando…" : "Creando invitación…"}>
          {sinInvitacion ? "Guardar persona" : "Crear invitación"}
        </Boton>
      ) : null}
      {estado?.persona ? <Aviso tipo="exito">{estado.persona} quedó en tu equipo. Ya puedes registrarle pagos.</Aviso> : null}
      {estado?.enlace ? (
        <div className="space-y-3 rounded-2xl bg-lana p-3.5">
          <Aviso tipo="exito">Invitación lista para {estado.email}{conContrato ? ", con su contrato guardado" : ""}. Compártele este enlace.</Aviso>
          <EnlaceInvitacion enlace={estado.enlace} />
        </div>
      ) : null}
    </form>
  );
}

export function RevocarInvitacion({ id }: { id: string }) {
  const [pendiente, iniciar] = useTransition();
  const [hecho, setHecho] = useState(false);
  const toast = useToast();
  return (
    <button
      type="button"
      disabled={pendiente || hecho}
      aria-label="Cancelar invitación"
      onClick={() =>
        iniciar(async () => {
          const r = await revocarInvitacion(id);
          if (r.error) toast.error(r.error);
          else {
            setHecho(true);
            toast.exito("Invitación cancelada");
          }
        })
      }
      className="grid size-11 shrink-0 place-items-center rounded-full text-humo hover:bg-arena disabled:opacity-50"
    >
      {hecho ? <Check className="size-5" /> : <X className="size-5" strokeWidth={1.75} />}
    </button>
  );
}
