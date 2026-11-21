import { Aviso } from "@/components/Aviso";
import { MENSAJE_GUARDADO_LOCAL, RUTA_CAMPO } from "@/lib/campo";

/** Lo que dice un formulario con señal cuando, al caerse la señal, el registro quedó guardado en el celular. Sin `"use client"`: solo dibuja. */
export function AvisoGuardadoLocal() {
  return (
    <Aviso tipo="exito">
      {MENSAJE_GUARDADO_LOCAL}{" "}
      <a href={`${RUTA_CAMPO}#bandeja`} className="font-semibold text-musgo underline underline-offset-4">Ver lo guardado</a>
    </Aviso>
  );
}
