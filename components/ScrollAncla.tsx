"use client";

import { useEffect } from "react";

/** Lleva la pantalla a la tarjeta que dice el `#ancla` de la dirección (los avisos de Semáforos apuntan a «#reproduccion», «#sanidad»…), aunque la página se haya armado después. */
export function ScrollAncla() {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) return;
    const llevar = () => document.getElementById(id)?.scrollIntoView({ block: "start" });
    llevar();
    const t = window.setTimeout(llevar, 350);
    return () => window.clearTimeout(t);
  }, []);
  return null;
}
