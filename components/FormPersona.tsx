"use client";

import { useActionState, useTransition } from "react";
import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { Boton, clasesBoton } from "@/components/Boton";
import { CamposContrato } from "@/components/CamposContrato";
import { CamposPerfil } from "@/components/CamposPerfil";
import { crearPersona, editarPersona } from "@/app/(app)/personal/actions";
import type { Persona } from "@/lib/tipos";

/**
 * Corregir a una persona de la finca: su contrato (vinculación, forma de pago y valor), si sigue trabajando y sus observaciones. A las personas nuevas se
 * las registra al invitarlas, en Equipo.
 */
export function FormPersona({ hoy, persona, tienePagos = false }: { hoy: string; persona?: Persona; tienePagos?: boolean }) {
  const editando = Boolean(persona);
  const [estado, enviar, pendiente] = useActionState(editando ? editarPersona : crearPersona, undefined);
  const [, iniciar] = useTransition();

  const alEnviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    iniciar(() => enviar(datos));
  };

  return (
    <form onSubmit={alEnviar} className="space-y-6">
      {persona ? <input type="hidden" name="persona_id" value={persona.id} /> : null}
      <CamposContrato hoy={hoy} persona={persona} tienePagos={tienePagos} conEstado perfil={<CamposPerfil rol={persona?.rol ?? "ninguno"} persona={persona} />} />
      {estado?.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      <div className="space-y-2">
        <Boton type="submit" pendiente={pendiente} cargando="Guardando…">
          {editando ? "Guardar cambios" : "Guardar persona"}
        </Boton>
        <Link href="/mas/miembros" className={clasesBoton("fantasma")}>Cancelar</Link>
      </div>
    </form>
  );
}
