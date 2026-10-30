"use client";

import { useEffect, useState } from "react";
import { Aviso } from "@/components/Aviso";
import { EnlaceBoton } from "@/components/Boton";
import { Cargando } from "@/components/Cargando";

/**
 * Lo que se ve al tocar «Abrir … en la app» en Telegram: Telegram abre esta página con sus datos firmados en la parte de la dirección que sigue al «#» (el servidor
 * nunca la recibe, por eso se lee aquí). Se mandan a `/api/telegram/sesion` y, si todo está bien, se pasa a la pantalla pedida ya con la sesión abierta.
 */
export function EntrarDesdeTelegram({ finca, destino }: { finca: string; destino: string }) {
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const datos = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("tgWebAppData");
        if (!datos) throw new Error("sin datos");
        const r = await fetch("/api/telegram/sesion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ initData: datos, f: finca, d: destino }) });
        const cuerpo = (await r.json().catch(() => null)) as { ok?: boolean; ruta?: string } | null;
        if (!r.ok || !cuerpo?.ok || typeof cuerpo.ruta !== "string") throw new Error("rechazado");
        if (vivo) window.location.replace(cuerpo.ruta);
      } catch {
        if (vivo) setFallo(true);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [finca, destino]);

  if (!fallo) {
    return (
      <div className="grid min-h-dvh place-items-center px-4">
        <Cargando texto="Abriendo Apriscol…" />
      </div>
    );
  }
  return (
    <div className="mx-auto grid min-h-dvh max-w-sm content-center gap-4 px-4">
      <Aviso tipo="atencion">No pudimos abrir tu cuenta desde Telegram. Vuelve a tocar el botón en el chat; si sigue igual, entra con tu correo.</Aviso>
      <EnlaceBoton href="/login">Entrar con mi correo</EnlaceBoton>
    </div>
  );
}
