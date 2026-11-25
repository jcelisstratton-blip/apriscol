"use client";

import { useState } from "react";
import { ArrowBigUp, Eye, EyeOff } from "lucide-react";
import { CLASE_INPUT } from "@/components/Campo";

/**
 * Campo de contraseña con botón para ver lo que escribes (en el celular es fácil equivocarse y no notarlo) y aviso de «Mayúsculas activadas»
 * mientras se escribe con Bloq Mayús encendido: es el error más común al entrar. El aviso sale de la tecla misma (`getModifierState`), se oculta al
 * salir del campo y en los teclados que no informan Bloq Mayús (la mayoría de los celulares) simplemente no aparece.
 */
export function CampoClave({
  id,
  name,
  autoComplete,
  minLength,
}: {
  id: string;
  name: string;
  autoComplete: "current-password" | "new-password";
  minLength?: number;
}) {
  const [visible, setVisible] = useState(false);
  const [mayusculas, setMayusculas] = useState(false);
  const leerMayusculas = (e: React.KeyboardEvent<HTMLInputElement>) => setMayusculas(e.getModifierState?.("CapsLock") ?? false);
  const idAviso = `${id}-mayusculas`;

  return (
    <>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          minLength={minLength}
          onKeyDown={leerMayusculas}
          onKeyUp={leerMayusculas}
          onBlur={() => setMayusculas(false)}
          aria-describedby={mayusculas ? idAviso : undefined}
          className={`${CLASE_INPUT} pr-14`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-pressed={visible}
          className="absolute right-1.5 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full text-humo hover:bg-arena"
        >
          {visible ? <EyeOff className="size-5" strokeWidth={1.75} /> : <Eye className="size-5" strokeWidth={1.75} />}
        </button>
      </div>
      <p id={idAviso} aria-live="polite" className={mayusculas ? "anim-sube flex items-center gap-1.5 text-[0.8125rem] font-semibold text-ambar" : "sr-only"}>
        {mayusculas ? (
          <>
            <ArrowBigUp className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            Mayúsculas activadas
          </>
        ) : null}
      </p>
    </>
  );
}
