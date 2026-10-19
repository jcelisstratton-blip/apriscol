"use client";

import { useActionState, useState, useTransition } from "react";
import { Check, Copy, Share2, X } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { CamposContrato } from "@/components/CamposContrato";
import { SelectorTarjetas } from "@/components/SelectorTarjetas";
import { useToast } from "@/components/Toast";
import { invitar, revocarInvitacion } from "@/app/(app)/mas/miembros/actions";
import { ESCENA_ROL } from "@/lib/escenas-forms-a-hato";
import { ESCENA_ACTIVA } from "@/lib/escenas-costos";
import { ETIQUETA_ROL } from "@/lib/permisos";
import type { RolFinca } from "@/lib/tipos";

const ROLES_INVITABLES: Exclude<RolFinca, "propietario">[] = ["administrador", "ordenador", "veterinario", "contador"];
const DETALLE: Record<(typeof ROLES_INVITABLES)[number], string> = {
  administrador: "Ve y edita todo, e invita personas",
  ordenador: "Registra ordeños y consulta el hato",
  veterinario: "Sanidad y reproducción",
  contador: "Solo consulta leche y reportes",
};

type Perfil = Exclude<RolFinca, "propietario"> | "ninguno";

/**
 * Agregar a alguien al equipo en un solo paso: primero el perfil (qué puede hacer en la app, o «Sin acceso a la app» para quien solo trabaja y cobra) y,
 * una vez elegido, su contrato (vinculación, forma de pago y valor). Con acceso se crea además la invitación y se entrega el enlace.
 * Si el plan no incluye invitar personas, solo se ofrece «Sin acceso a la app».
 */
export function FormInvitar({ hoy, puedeInvitar }: { hoy: string; puedeInvitar: boolean }) {
  const [estado, enviar, pendiente] = useActionState(invitar, undefined);
  const [rol, setRol] = useState<Perfil | "">(puedeInvitar ? "" : "ninguno");
  const toast = useToast();

  const copiar = async (enlace: string) => {
    try {
      await navigator.clipboard.writeText(enlace);
      toast.exito("Enlace copiado");
    } catch {
      toast.error("No se pudo copiar. Mantén presionado el enlace para copiarlo.");
    }
  };

  const compartir = async (enlace: string) => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Invitación a Apriscol", text: "Te invito a mi finca en Apriscol:", url: enlace });
      } catch {
        /* la persona canceló */
      }
    } else {
      await copiar(enlace);
    }
  };

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
              ...(puedeInvitar ? ROLES_INVITABLES.map((r) => ({ valor: r as Perfil, etiqueta: ETIQUETA_ROL[r], detalle: DETALLE[r], escena: ESCENA_ROL[r] })) : []),
              { valor: "ninguno" as Perfil, etiqueta: "Sin acceso a la app", detalle: "Trabaja en la finca y cobra, pero no entra", escena: ESCENA_ACTIVA.no },
            ]}
          />
        )}
      </Campo>
      {rol && rol !== "ninguno" ? (
        <Campo etiqueta="Correo de la persona" ayuda="Debe registrarse con este mismo correo.">
          {(id) => <input id={id} name="email" type="email" inputMode="email" autoCapitalize="none" required className={CLASE_INPUT} placeholder="nombre@correo.com" />}
        </Campo>
      ) : null}
      {rol ? <CamposContrato key={rol === "ninguno" ? "sin" : "con"} hoy={hoy} /> : null}
      {estado?.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      {rol ? (
        <Boton type="submit" pendiente={pendiente} cargando={rol === "ninguno" ? "Guardando…" : "Creando invitación…"}>
          {rol === "ninguno" ? "Guardar persona" : "Crear invitación"}
        </Boton>
      ) : null}
      {estado?.persona ? <Aviso tipo="exito">{estado.persona} quedó en tu equipo. Ya puedes registrarle pagos.</Aviso> : null}
      {estado?.enlace ? (
        <div className="space-y-3 rounded-2xl bg-lana p-3.5">
          <Aviso tipo="exito">Invitación lista para {estado.email}, con su contrato guardado. Compártele este enlace.</Aviso>
          <p className="rounded-xl bg-papel px-3 py-2 text-sm [overflow-wrap:anywhere]">{estado.enlace}</p>
          <div className="grid grid-cols-2 gap-2">
            <Boton type="button" variante="secundario" onClick={() => copiar(estado.enlace!)}>
              <Copy className="size-4" /> Copiar
            </Boton>
            <Boton type="button" onClick={() => compartir(estado.enlace!)}>
              <Share2 className="size-4" /> Enviar
            </Boton>
          </div>
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
