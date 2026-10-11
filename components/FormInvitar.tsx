"use client";

import { useActionState, useState, useTransition } from "react";
import { Check, Copy, Share2, X } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { Selector } from "@/components/Selector";
import { useToast } from "@/components/Toast";
import { invitar, revocarInvitacion } from "@/app/(app)/mas/miembros/actions";
import { ETIQUETA_ROL } from "@/lib/permisos";
import type { RolFinca } from "@/lib/tipos";

const ROLES_INVITABLES: Exclude<RolFinca, "propietario">[] = ["administrador", "ordenador", "veterinario", "contador"];
const DETALLE: Record<(typeof ROLES_INVITABLES)[number], string> = {
  administrador: "Ve y edita todo, e invita personas",
  ordenador: "Registra ordeños y consulta el hato",
  veterinario: "Sanidad y reproducción",
  contador: "Solo consulta leche y reportes",
};

export function FormInvitar() {
  const [estado, enviar, pendiente] = useActionState(invitar, undefined);
  const [rol, setRol] = useState<RolFinca | "">("ordenador");
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
      <Campo etiqueta="Correo de la persona" ayuda="Debe registrarse con este mismo correo.">
        {(id) => <input id={id} name="email" type="email" inputMode="email" autoCapitalize="none" required className={CLASE_INPUT} placeholder="nombre@correo.com" />}
      </Campo>
      <Campo etiqueta="Rol">
        {(id) => (
          <Selector
            id={id}
            nombre="rol"
            valor={rol}
            onCambio={setRol}
            titulo="¿Qué puede hacer?"
            opciones={ROLES_INVITABLES.map((r) => ({ valor: r, etiqueta: ETIQUETA_ROL[r], detalle: DETALLE[r] }))}
          />
        )}
      </Campo>
      {estado?.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      <Boton type="submit" pendiente={pendiente} cargando="Creando invitación…">
        Crear invitación
      </Boton>
      {estado?.enlace ? (
        <div className="space-y-3 rounded-2xl bg-lana p-3.5">
          <Aviso tipo="exito">Invitación lista para {estado.email}. Compártele este enlace.</Aviso>
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
