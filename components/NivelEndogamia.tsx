import { Insignia } from "@/components/Insignia";
import { ETIQUETA_NIVEL, TONO_NIVEL, nivelEndogamia } from "@/lib/endogamia";

/** Etiqueta de color con el nivel de endogamia respecto al umbral de la finca. */
export function NivelEndogamia({ f, umbral }: { f: number; umbral: number }) {
  const nivel = nivelEndogamia(f, umbral);
  return <Insignia tono={TONO_NIVEL[nivel]}>{ETIQUETA_NIVEL[nivel]}</Insignia>;
}
