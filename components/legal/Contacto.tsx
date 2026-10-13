import { CORREO_PRIVACIDAD, RESPONSABLE } from "@/lib/legal";

/** Cómo escribirle al responsable: el correo configurado o, mientras no haya uno, el nombre de quien opera Apriscol. */
export function Contacto() {
  return CORREO_PRIVACIDAD ? (
    <a href={`mailto:${CORREO_PRIVACIDAD}`} className="font-semibold text-musgo underline underline-offset-4">
      {CORREO_PRIVACIDAD}
    </a>
  ) : (
    <span className="font-semibold">{RESPONSABLE}</span>
  );
}
