"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { CLASE_INPUT } from "@/components/Campo";

/** Campo de contraseña con botón para ver lo que escribes (en el celular es fácil equivocarse y no notarlo). */
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
  return (
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
  );
}
