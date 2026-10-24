"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronsUpDown, KeyRound, LogOut, MoreHorizontal, ShieldCheck } from "lucide-react";
import { cerrarSesion } from "@/app/login/actions";

/**
 * La persona que inició sesión, al pie del menú lateral: una fila (avatar, nombre y correo) que abre un menú corto con lo de su cuenta
 * (más opciones, cambiar la contraseña, cerrar sesión). Lo de la finca no va aquí: vive en «Mi finca».
 */
export function MenuUsuario({ nombre, correo, esSuperadmin, enMas }: { nombre: string; correo: string; esSuperadmin: boolean; enMas: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const idMenu = useId();

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAbierto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAbierto(false);
        boton.current?.focus();
      }
    };
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", fuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [abierto]);

  const ITEM = "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[0.9375rem] font-semibold text-tinta transition hover:bg-arena/60";

  return (
    <div ref={raiz} className="relative">
      {abierto ? (
        <div id={idMenu} role="menu" aria-label="Tu cuenta" className="anim-sube absolute inset-x-0 bottom-full z-10 mb-2 space-y-0.5 rounded-2xl bg-papel p-1.5 shadow-lg ring-1 ring-arena">
          {esSuperadmin ? (
            <Link href="/admin" role="menuitem" onClick={() => setAbierto(false)} className={ITEM}>
              <ShieldCheck className="size-5 shrink-0 text-ocre" strokeWidth={1.7} /> Panel superadmin
            </Link>
          ) : null}
          <Link href="/mas" role="menuitem" aria-current={enMas ? "page" : undefined} onClick={() => setAbierto(false)} className={`${ITEM} ${enMas ? "bg-musgo/12 text-musgo" : ""}`}>
            <MoreHorizontal className="size-5 shrink-0 text-humo" strokeWidth={1.7} /> Más opciones
          </Link>
          <Link href="/cambiar-clave" role="menuitem" onClick={() => setAbierto(false)} className={ITEM}>
            <KeyRound className="size-5 shrink-0 text-humo" strokeWidth={1.7} /> Cambiar contraseña
          </Link>
          <div className="mx-2 my-1 border-t border-arena" aria-hidden="true" />
          <form action={cerrarSesion}>
            <button type="submit" role="menuitem" className={`${ITEM} hover:text-rojo`}>
              <LogOut className="size-5 shrink-0 text-humo" strokeWidth={1.7} /> Cerrar sesión
            </button>
          </form>
        </div>
      ) : null}
      <button
        ref={boton}
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-controls={abierto ? idMenu : undefined}
        className={`flex min-h-14 w-full items-center gap-3 rounded-2xl px-2 py-1.5 text-left transition hover:bg-arena/60 ${abierto ? "bg-arena/60" : ""}`}
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-musgo font-display text-lg font-semibold text-sobre-musgo" aria-hidden="true">
          {nombre.trim().charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold">{nombre}</span>
          <span className="block truncate text-xs text-humo">{correo}</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-humo" strokeWidth={1.75} aria-hidden="true" />
      </button>
    </div>
  );
}
